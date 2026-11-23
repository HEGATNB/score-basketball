"""Сервис оперативных данных: получает публичные сводки и счёт ESPN,
используя небольшой кеш в памяти с ограниченным сроком хранения."""

from __future__ import annotations

from collections import OrderedDict
from datetime import datetime, timedelta, timezone
import time
from threading import Lock
import logging
from typing import Any, Dict, List, Optional, Tuple

from services.espn_provider import ESPNProvider, FeedUnavailable, SCOREBOARD, SUMMARY, NEWS
from services.nba_catalog import BY_ESPN_ID, normalize_abbrev

logger = logging.getLogger(__name__)

provider = ESPNProvider()
_cache: OrderedDict[str, Tuple[float, Any]] = OrderedDict()
_cache_lock = Lock()


def _store(key: str, value: Any):
    with _cache_lock:
        _cache[key] = value
        _cache.move_to_end(key)
        if len(_cache) > 512:
            _cache.popitem(last=False)


def _fetch_with_cache(url: str, params: Optional[Dict[str, Any]] = None, ttl: int = 30):
    """Returns (fetched_at, data). Retains the true fetch time for stale data."""
    key = f"{url}?{sorted((params or {}).items())}"
    cached = _cache.get(key)
    if cached and time.time() - cached[0] < ttl:
        return cached

    try:
        data = provider.fetch(url, params)
    except FeedUnavailable as exc:
        logger.warning("ESPN request failed: %s", exc)
        return cached if cached and time.time() - cached[0] <= max(ttl, 600) else (None, None)
    result = (time.time(), data)
    _store(key, result)
    return result


def _score(value):
    text = str(value)
    return int(text) if text.isascii() and text.isdecimal() and len(text) <= 3 else None


def _team_short_name(team_obj: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": team_obj.get("id"),
        "abbrev": team_obj.get("abbreviation"),
        "name": team_obj.get("displayName") or team_obj.get("name"),
        "shortName": team_obj.get("shortDisplayName"),
        "color": ("#" + team_obj.get("color")) if team_obj.get("color") else None,
        "altColor": ("#" + team_obj.get("alternateColor")) if team_obj.get("alternateColor") else None,
        "logo": team_obj.get("logo"),
    }


def _parse_event(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Преобразует событие ESPN в плоскую запись для интерфейса сайта."""
    try:
        if not event.get("id") or not datetime.fromisoformat(event["date"].replace("Z", "+00:00")).tzinfo:
            return None
        comp = (event.get("competitions") or [{}])[0]
        comps = comp.get("competitors", [])
        if len(comps) < 2:
            return None

        # ESPN размещает хозяев перед гостями, но мы дополнительно проверяем поле homeAway
        home = next((c for c in comps if c.get("homeAway") == "home"), comps[0])
        away = next((c for c in comps if c.get("homeAway") == "away"), comps[1])

        status = event.get("status", {}) or comp.get("status", {})
        state = (status.get("type") or {}).get("state")  # "pre" / "in" / "post"
        completed = (status.get("type") or {}).get("completed", False)
        detail = (status.get("type") or {}).get("detail")  # "Q4 7:42" / "Final" / "Final/OT"
        short_detail = (status.get("type") or {}).get("shortDetail")
        clock = status.get("displayClock")
        period = status.get("period")

        return {
            "id": event.get("id"),
            "date": event.get("date"),
            "state": state,  # 'pre' | 'in' | 'post'
            "completed": completed,
            "detail": detail,
            "shortDetail": short_detail,
            "clock": clock,
            "period": period,
            "venue": (comp.get("venue") or {}).get("fullName"),
            "broadcast": ", ".join(
                b.get("names", [""])[0] for b in (comp.get("broadcasts") or []) if b.get("names")
            ),
            "home": {
                **_team_short_name(home.get("team") or {}),
                "score": _score(home.get("score")),
                "record": next(
                    (r.get("summary") for r in (home.get("records") or []) if r.get("type") == "total"),
                    None,
                ),
                "winner": home.get("winner"),
            },
            "away": {
                **_team_short_name(away.get("team") or {}),
                "score": _score(away.get("score")),
                "record": next(
                    (r.get("summary") for r in (away.get("records") or []) if r.get("type") == "total"),
                    None,
                ),
                "winner": away.get("winner"),
            },
        }
    except Exception as e:
        logger.warning(f"Skip event parse: {e}")
        return None


def get_scoreboard(date: Optional[str] = None) -> Dict[str, Any]:
    """Возвращает счёт за сегодня (или дату YYYYMMDD) с группировкой матчей по статусу."""
    params = {"dates": date} if date else None
    fetched_at, data = _fetch_with_cache(SCOREBOARD, params=params, ttl=30)
    if not data:
        return {"events": [], "live": [], "upcoming": [], "finished": [], "fetchedAt": None, "error": "ESPN unavailable"}

    events = []
    for e in data.get("events", []):
        parsed = _parse_event(e)
        if parsed:
            events.append(parsed)

    live = [e for e in events if e["state"] == "in"]
    upcoming = [e for e in events if e["state"] == "pre"]
    finished = [e for e in events if e["state"] == "post"]

    return {
        "events": events,
        "live": live,
        "upcoming": upcoming,
        "finished": finished,
        "fetchedAt": fetched_at,
        "stale": time.time() - fetched_at > 60,
        "season": (data.get("season") or {}).get("year"),
        "week": (data.get("week") or {}).get("number"),
    }


def _extract_video_url(video: Dict[str, Any]) -> Optional[str]:
    """ESPN предоставляет данные в нескольких форматах; проверяем их по очереди."""
    # 1. links.source.href (HLS или mp4)
    links = video.get("links") or {}
    src = (links.get("source") or {}).get("href")
    if src:
        return src
    # 2. links.mobile.source.href
    mobile = links.get("mobile") or {}
    msrc = (mobile.get("source") or {}).get("href")
    if msrc:
        return msrc
    # 3. links.api.self.href (ссылка на JSON)
    # 4. Объект потоковой трансляции непосредственно в описании видео
    stream = video.get("streaming") or {}
    if stream.get("src"):
        return stream["src"]
    # 5. videoSourceID
    return None


def _parse_video(video: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Преобразует описание видео ESPN в плоскую структуру."""
    try:
        url = _extract_video_url(video)
        if not url:
            return None
        thumb = video.get("thumbnail") or (video.get("posterImages") or {}).get("default", {}).get("href")
        return {
            "id": str(video.get("id") or ""),
            "title": video.get("headline") or video.get("title") or "Highlight",
            "caption": video.get("caption") or video.get("description"),
            "thumbnail": thumb,
            "duration": video.get("duration"),
            "url": url,
            "webUrl": (video.get("links") or {}).get("web", {}).get("href"),
            "published": video.get("originalPublishDate") or video.get("lastModified"),
        }
    except Exception:
        return None


def get_match_details(espn_event_id: str) -> Optional[Dict[str, Any]]:
    """Подробная статистика и лидеры матча по идентификатору события ESPN."""
    fetched_at, data = _fetch_with_cache(SUMMARY, params={"event": espn_event_id}, ttl=60)
    if not data:
        return None

    header = data.get("header") or {}
    comp = ((header.get("competitions") or [{}])[0]) or {}
    comps = comp.get("competitors", []) or []
    if not comps:
        return None

    teams_summary: List[Dict[str, Any]] = []
    for c in comps:
        team = c.get("team", {}) or {}
        linescores = c.get("linescores") or []
        teams_summary.append({
            **_team_short_name(team),
            "homeAway": c.get("homeAway"),
            "score": _score(c.get("score")),
            "winner": c.get("winner"),
            "linescores": [int(q.get("value", 0)) for q in linescores],
            "record": next(
                (r.get("summary") for r in (c.get("record") or []) if r.get("type") == "total"),
                None,
            ),
        })

    # Статистика матча по каждой команде
    boxscore = data.get("boxscore") or {}
    team_stats = []
    for t in boxscore.get("teams", []):
        stats = {s.get("name") or s.get("label"): s.get("displayValue") for s in (t.get("statistics") or [])}
        team_stats.append({
            **_team_short_name(t.get("team") or {}),
            "stats": stats,
        })

    # Лидеры команд
    leaders = []
    for l in data.get("leaders") or []:
        for cat in l.get("leaders") or []:
            leaders.append({
                "team": _team_short_name(l.get("team") or {}),
                "name": cat.get("displayName") or cat.get("name"),
                "value": cat.get("displayValue"),
                "athlete": (cat.get("athlete") or {}).get("displayName") if cat.get("athlete") else None,
            })

    status = (comp.get("status") or {})

    # Видео: обзоры и повторы
    videos: List[Dict[str, Any]] = []
    for v in (data.get("videos") or []):
        parsed = _parse_video(v)
        if parsed:
            videos.append(parsed)

    return {
        "id": espn_event_id,
        "date": comp.get("date"),
        "stale": time.time() - fetched_at > 120,
        "venue": (comp.get("venue") or {}).get("fullName"),
        "broadcast": ", ".join(
            b.get("names", [""])[0] for b in (comp.get("broadcasts") or []) if b.get("names")
        ),
        "state": (status.get("type") or {}).get("state"),
        "detail": (status.get("type") or {}).get("detail"),
        "completed": (status.get("type") or {}).get("completed"),
        "teams": teams_summary,
        "teamStats": team_stats,
        "leaders": leaders,
        "videos": videos,
    }


def get_recent_highlights(limit: int = 12) -> List[Dict[str, Any]]:
    """Собирает видеообзоры недавно завершившихся матчей.

    Возвращает список видео с контекстом матча (логотипы команд, счёт и дата),
    чтобы интерфейс мог показать подборку доступных для просмотра роликов.
    """
    cache_key = f"__highlights_aggregate_{limit}"
    now = time.time()
    cached = _cache.get(cache_key)
    # Кеш на 5 минут: сбор данных из нескольких сводок требует ресурсов
    if cached and now - cached[0] < 300:
        return cached[1]

    out: List[Dict[str, Any]] = []
    try:
        # Загружаем завершённые матчи за сегодня и три предыдущих дня
        today = datetime.now(timezone.utc)
        seen_event_ids = set()

        for offset in range(0, 4):
            d = today - timedelta(days=offset)
            date_str = d.strftime("%Y%m%d")
            sb = get_scoreboard(date=date_str)
            for event in sb.get("finished", []) + sb.get("live", []):
                if event["id"] in seen_event_ids:
                    continue
                seen_event_ids.add(event["id"])
                details = get_match_details(event["id"])
                if not details or not details.get("videos"):
                    continue
                home_name = event["home"].get("name") or event["home"].get("abbrev") or ""
                away_name = event["away"].get("name") or event["away"].get("abbrev") or ""
                event_date = event.get("date")
                try:
                    if event_date:
                        dt = datetime.fromisoformat(event_date.replace("Z", "+00:00"))
                        date_str = dt.strftime("%b %d %Y")
                    else:
                        date_str = ""
                except Exception:
                    date_str = ""
                yt_query = f"NBA {away_name} vs {home_name} highlights {date_str}".strip()

                for v in details["videos"]:
                    out.append({
                        **v,
                        "youtubeQuery": yt_query,
                        "matchup": {
                            "eventId": event["id"],
                            "date": event_date,
                            "home": {
                                "abbrev": event["home"].get("abbrev"),
                                "name": event["home"].get("name"),
                                "logo": event["home"].get("logo"),
                                "score": event["home"].get("score"),
                            },
                            "away": {
                                "abbrev": event["away"].get("abbrev"),
                                "name": event["away"].get("name"),
                                "logo": event["away"].get("logo"),
                                "score": event["away"].get("score"),
                            },
                        },
                    })
                    if len(out) >= limit:
                        break
                if len(out) >= limit:
                    break
            if len(out) >= limit:
                break
    except Exception as e:
        logger.warning(f"highlights aggregation failed: {e}")

    _store(cache_key, (now, out))
    return out


def _hires_thumb(url: Optional[str], width: int = 1280, height: int = 720) -> Optional[str]:
    """Безопасно формирует ссылку на изображение высокого разрешения.

    ESPN предоставляет два типа изображений:
    - **Исходные**: `r1234.jpg` (без суффикса размера). CDN ESPN может изменить
      их размер с помощью параметров `?w=&h=`.
    - **Обрезанные**: `r1234_608x342_16-9.jpg`. Исходник может быть недоступен
      (404), поэтому удалять суффикс небезопасно. Увеличение уже обрезанного
      изображения не улучшит его качество.

    Размер меняется только для ссылок без суффикса обрезки. Обрезанные
    изображения возвращаются без изменений: для карточки шириной около 440 px
    исходного размера обычно достаточно.
    """
    if not url:
        return url
    import re

    # Сначала удаляем существующие параметры изменения размера, затем задаём новые
    base_url = re.sub(r"[?&](w|h|width|height|format|scale|quality)=[^&]+", "", url)
    base_url = re.sub(r"\?&", "?", base_url).rstrip("?&")

    # Определяем суффикс предварительной обрезки ESPN: `_AAxBB` (возможно, с `_X-Y`)
    has_baked_crop = bool(re.search(r"_\d{2,4}x\d{2,4}(_\d+-\d+)?(?=\.[a-zA-Z]{3,4}(?:$|\?))", base_url))

    if has_baked_crop:
        # Не увеличиваем маленький фрагмент: возвращаем исходную ссылку,
        # чтобы получить изображение в реально доступном размере.
        return base_url

    # Для исходного изображения можно безопасно запросить большой размер.
    sep = "&" if "?" in base_url else "?"
    return f"{base_url}{sep}w={width}&h={height}&format=jpg&scale=crop&quality=85"


def _byline_text(byline: Any) -> Optional[str]:
    if not byline:
        return None
    if isinstance(byline, str):
        return byline
    if isinstance(byline, list):
        names = [b.get("name") if isinstance(b, dict) else str(b) for b in byline]
        return ", ".join(filter(None, names))
    if isinstance(byline, dict):
        return byline.get("name")
    return None


def get_top_news(limit: int = 16) -> List[Dict[str, Any]]:
    return get_news_feed(limit)["items"]


def get_news_feed(limit: int = 16, teams: set[str] | None = None) -> dict:
    fetched_at, data = _fetch_with_cache(NEWS, params={"limit": 40}, ttl=300)
    if not data:
        raise FeedUnavailable("ESPN news unavailable")

    out: List[Dict[str, Any]] = []
    seen = set()
    for art in data["articles"]:
        article_id = str(art.get("id") or art.get("dataSourceIdentifier") or "")
        title = art.get("headline") or art.get("title")
        if not article_id.isascii() or not article_id.isdigit() or not title or article_id in seen:
            continue
        categories = [item for item in art.get("categories") or [] if isinstance(item, dict)]
        codes = set()
        for category in categories:
            if category.get("type") != "team":
                continue
            team_info = category.get("team") or {}
            team = BY_ESPN_ID.get(str(category.get("teamId") or team_info.get("id")))
            abbrev = team_info.get("abbreviation")
            if team:
                codes.add(team[2])
            elif isinstance(abbrev, str):
                codes.add(normalize_abbrev(abbrev))
        if teams and codes.isdisjoint(teams):
            continue
        seen.add(article_id)
        images = art.get("images") or []
        # Выбираем самое широкое изображение: ESPN обычно сортирует их по размеру,
        # но если размеры не указаны, используем первое.
        best_img = None
        if images:
            with_w = [i for i in images if isinstance(i, dict) and i.get("width")]
            best_img = max(with_w, key=lambda i: int(i.get("width") or 0)) if with_w else images[0]
        # Для главного баннера и страницы новостей запрашиваем 1920×1080:
        # изображения шириной около 700 px сохранят чёткость на экранах Retina.
        thumb = _hires_thumb(best_img.get("url") if isinstance(best_img, dict) else None, width=1920, height=1080)
        out.append({
            "id": article_id,
            "title": title,
            "description": art.get("description"),
            "category": categories[0].get("description") if categories else None,
            "teams": sorted(codes),
            "published": art.get("published"),
            "thumb": thumb,
            "byline": _byline_text(art.get("byline")),
            "type": art.get("type"),
            "url": (art.get("links") or {}).get("web", {}).get("href"),
        })
    out.sort(key=lambda item: item.get("published") or "", reverse=True)
    return {"items": out[:limit], "fetchedAt": fetched_at, "stale": time.time() - fetched_at > 600}


def get_article(article_id: str) -> Optional[Dict[str, Any]]:
    """Получает полный текст статьи через API ESPN."""
    if not article_id or not article_id.isdigit():
        return None
    url = provider.article_url(article_id)
    _, data = _fetch_with_cache(url, ttl=900)
    if not data:
        return None

    # ESPN иногда возвращает объект внутри { headlines: [{...}] }, а иногда напрямую.
    # Приводим оба варианта к единому формату.
    article = data
    if isinstance(data.get("headlines"), list) and data["headlines"]:
        article = data["headlines"][0]

    images = article.get("images") or []
    # Оставляем до четырёх иллюстраций для более информативного окна статьи.
    image_list = []
    for img in images[:6]:
        u = img.get("url") if isinstance(img, dict) else None
        if u:
            image_list.append({
                "url": _hires_thumb(u, width=1600, height=900),
                "caption": img.get("caption") if isinstance(img, dict) else None,
                "credit": img.get("credit") if isinstance(img, dict) else None,
                "width": img.get("width") if isinstance(img, dict) else None,
                "height": img.get("height") if isinstance(img, dict) else None,
            })

    # Удаляем HTML-разметку перед разделением текста на абзацы.
    raw_story = article.get("story") or ""
    paragraphs: List[str] = []
    if raw_story:
        import re
        # Выделяем блоки <p>…</p>, затем удаляем оставшиеся теги.
        for block in re.findall(r"<p[^>]*>(.*?)</p>", raw_story, flags=re.S | re.I):
            clean = re.sub(r"<[^>]+>", "", block).strip()
            # Пропускаем служебные теги ESPN, например <video1> и <alsosee>
            if not clean or clean.startswith("<"):
                continue
            paragraphs.append(clean)
        if not paragraphs:
            # Если теги абзацев отсутствуют, разделяем текст по переводам строки
            clean = re.sub(r"<[^>]+>", "", raw_story).strip()
            paragraphs = [p.strip() for p in clean.split("\n") if p.strip()]

    related = []
    for r in (article.get("related") or [])[:6]:
        if not isinstance(r, dict):
            continue
        r_images = r.get("images") or []
        r_thumb = r_images[0].get("url") if r_images and isinstance(r_images[0], dict) else None
        related.append({
            "id": str(r.get("id") or ""),
            "title": r.get("headline") or r.get("title"),
            "url": (r.get("links") or {}).get("web", {}).get("href"),
            "thumb": _hires_thumb(r_thumb, width=640, height=360),
        })

    return {
        "id": str(article.get("id") or article_id),
        "title": article.get("headline") or article.get("title"),
        "description": article.get("description"),
        "byline": _byline_text(article.get("byline")),
        "category": (article.get("categories") or [{}])[0].get("description") if article.get("categories") else None,
        "published": article.get("published") or article.get("originallyPosted"),
        "lastModified": article.get("lastModified"),
        "section": article.get("section"),
        "keywords": [k.get("name") if isinstance(k, dict) else str(k) for k in (article.get("keywords") or [])][:10],
        "paragraphs": paragraphs[:30],
        "images": image_list,
        "related": related,
        "url": (article.get("links") or {}).get("web", {}).get("href"),
    }
