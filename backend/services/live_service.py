"""Live data service — proxies the ESPN public scoreboard / summary endpoints
with a small in-memory TTL cache so we don't hammer ESPN on every page hit."""

from __future__ import annotations

import time
import logging
from typing import Any, Dict, List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)

ESPN_SCOREBOARD = "http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"
ESPN_SUMMARY = "http://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary"
ESPN_NEWS = "http://site.api.espn.com/apis/site/v2/sports/basketball/nba/news"
ESPN_ARTICLE = "https://content.core.api.espn.com/v1/sports/news/{id}"

# url -> (timestamp, payload)
_cache: Dict[str, Tuple[float, Any]] = {}


def _fetch_with_cache(url: str, params: Optional[Dict[str, Any]] = None, ttl: int = 30) -> Optional[Dict[str, Any]]:
    """Fetch JSON from ESPN with a tiny TTL cache. None on failure (so callers fall back gracefully)."""
    key = url + "?" + "&".join(f"{k}={v}" for k, v in sorted((params or {}).items()))
    now = time.time()
    cached = _cache.get(key)
    if cached and now - cached[0] < ttl:
        return cached[1]

    try:
        resp = requests.get(url, params=params, timeout=6, headers={"User-Agent": "SCORE/1.0"})
        if resp.status_code != 200:
            logger.warning(f"ESPN {resp.status_code} for {url}")
            # Return stale cached value if we have one — better than nothing
            return cached[1] if cached else None
        data = resp.json()
        _cache[key] = (now, data)
        return data
    except Exception as e:
        logger.warning(f"ESPN fetch failed for {url}: {e}")
        return cached[1] if cached else None


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
    """Turn one ESPN scoreboard event into a flat row our frontend wants."""
    try:
        comp = (event.get("competitions") or [{}])[0]
        comps = comp.get("competitors", [])
        if len(comps) < 2:
            return None

        # ESPN orders competitors home-then-away, but we double-check via homeAway field
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
                "score": int(home.get("score")) if (home.get("score") or "").isdigit() else None,
                "record": next(
                    (r.get("summary") for r in (home.get("records") or []) if r.get("type") == "total"),
                    None,
                ),
                "winner": home.get("winner"),
            },
            "away": {
                **_team_short_name(away.get("team") or {}),
                "score": int(away.get("score")) if (away.get("score") or "").isdigit() else None,
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
    """Return today's (or given date YYYYMMDD) scoreboard with grouped live/upcoming/finished."""
    params = {"dates": date} if date else None
    data = _fetch_with_cache(ESPN_SCOREBOARD, params=params, ttl=30)
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
        "fetchedAt": time.time(),
        "season": (data.get("season") or {}).get("year"),
        "week": (data.get("week") or {}).get("number"),
    }


def _extract_video_url(video: Dict[str, Any]) -> Optional[str]:
    """ESPN exposes a few different shapes. Try them in order of preference."""
    # 1. links.source.href (HLS or mp4)
    links = video.get("links") or {}
    src = (links.get("source") or {}).get("href")
    if src:
        return src
    # 2. links.mobile.source.href
    mobile = links.get("mobile") or {}
    msrc = (mobile.get("source") or {}).get("href")
    if msrc:
        return msrc
    # 3. links.api.self.href (json refs)
    # 4. Streaming object on video itself
    stream = video.get("streaming") or {}
    if stream.get("src"):
        return stream["src"]
    # 5. videoSourceID
    return None


def _parse_video(video: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Flatten one ESPN video object."""
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
    """Detailed box-score + leaders for a single ESPN event id."""
    data = _fetch_with_cache(ESPN_SUMMARY, params={"event": espn_event_id}, ttl=60)
    if not data:
        return None

    header = data.get("header") or {}
    comp = ((header.get("competitions") or [{}])[0]) or {}
    comps = comp.get("competitors", []) or []

    teams_summary: List[Dict[str, Any]] = []
    for c in comps:
        team = c.get("team", {}) or {}
        linescores = c.get("linescores") or []
        teams_summary.append({
            **_team_short_name(team),
            "homeAway": c.get("homeAway"),
            "score": int(c.get("score")) if (c.get("score") or "").isdigit() else None,
            "winner": c.get("winner"),
            "linescores": [int(q.get("value", 0)) for q in linescores],
            "record": next(
                (r.get("summary") for r in (c.get("record") or []) if r.get("type") == "total"),
                None,
            ),
        })

    # Boxscore — per-team team stats
    boxscore = data.get("boxscore") or {}
    team_stats = []
    for t in boxscore.get("teams", []):
        stats = {s.get("name") or s.get("label"): s.get("displayValue") for s in (t.get("statistics") or [])}
        team_stats.append({
            **_team_short_name(t.get("team") or {}),
            "stats": stats,
        })

    # Leaders
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

    # Videos (highlights, recaps)
    videos: List[Dict[str, Any]] = []
    for v in (data.get("videos") or []):
        parsed = _parse_video(v)
        if parsed:
            videos.append(parsed)

    return {
        "id": espn_event_id,
        "date": header.get("competitions", [{}])[0].get("date"),
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
    """Aggregate highlight videos from recently finished games.

    Returns a flat list of videos enriched with the game context
    (team logos, score, date) so the frontend can show a premium
    carousel of real playable clips.
    """
    cache_key = f"__highlights_aggregate_{limit}"
    now = time.time()
    cached = _cache.get(cache_key)
    # 5-minute TTL — aggregating multiple summaries is expensive
    if cached and now - cached[0] < 300:
        return cached[1]

    out: List[Dict[str, Any]] = []
    try:
        # Pull today + last 2 days of finished games
        from datetime import datetime, timedelta
        today = datetime.utcnow()
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
                    from datetime import datetime as _dt
                    if event_date:
                        dt = _dt.fromisoformat(event_date.replace("Z", "+00:00"))
                        date_str = dt.strftime("%b %d %Y")
                    else:
                        date_str = ""
                except Exception:
                    date_str = ""
                # Resolve a YouTube video ID once per matchup — same clip for
                # all the videos under it, so we don't pay search cost per item.
                yt_query = f"NBA {away_name} vs {home_name} highlights {date_str}".strip()
                youtube_id = _resolve_youtube_id(yt_query)

                for v in details["videos"]:
                    out.append({
                        **v,
                        "youtubeId": youtube_id,
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

    _cache[cache_key] = (now, out)
    return out


def _resolve_youtube_id(query: str) -> Optional[str]:
    """Search YouTube for `query` and return the first video id.

    YouTube embeds with a concrete video_id (`https://youtube.com/embed/ID`)
    play everywhere — no geo-block. The trick is finding the ID; we scrape
    the public search results page for the first `"videoId":"XXX"` token.
    Cached for 24h so we hit YouTube once per matchup.
    """
    if not query:
        return None
    cache_key = f"__yt_id__{query.lower()}"
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and now - cached[0] < 86400:
        return cached[1]

    try:
        import re
        resp = requests.get(
            "https://www.youtube.com/results",
            params={"search_query": query, "hl": "en"},
            timeout=6,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        if resp.status_code != 200:
            _cache[cache_key] = (now, None)
            return None
        html = resp.text
        # First "videoId":"XXX" hit — YouTube returns videos before channels/playlists.
        m = re.search(r'"videoId":"([A-Za-z0-9_-]{11})"', html)
        vid = m.group(1) if m else None
        _cache[cache_key] = (now, vid)
        return vid
    except Exception as e:
        logger.warning(f"YouTube ID resolve failed for {query!r}: {e}")
        _cache[cache_key] = (now, None)
        return None


def _hires_thumb(url: Optional[str], width: int = 1280, height: int = 720) -> Optional[str]:
    """Build a hi-res image URL — safely.

    ESPN images come in two flavours:
    - **Master**: `r1234.jpg` (no size suffix). These ARE resizable via
      `?w=&h=` query params — ESPN's CDN returns a freshly downsized crop.
    - **Pre-cropped**: `r1234_608x342_16-9.jpg`. The master may not exist
      publicly (404), so stripping the suffix is unsafe. Appending `?w=` to
      these works (server returns 200) but the source is already 608px so
      upscaling to 1920 just gives a soft image.

    Strategy: only request resize on URLs that DON'T already have a baked
    crop suffix. For pre-cropped URLs, pass through unchanged — at the
    homepage display size (~440px card width) 608px is still 1.4× density
    and looks fine.
    """
    if not url:
        return url
    import re

    # Strip any existing resize query params first (we'll rewrite them)
    base_url = re.sub(r"[?&](w|h|width|height|format|scale|quality)=[^&]+", "", url)
    base_url = re.sub(r"\?&", "?", base_url).rstrip("?&")

    # Detect ESPN pre-cropped suffix: `_AAxBB` (optionally followed by `_X-Y`)
    has_baked_crop = bool(re.search(r"_\d{2,4}x\d{2,4}(_\d+-\d+)?(?=\.[a-zA-Z]{3,4}(?:$|\?))", base_url))

    if has_baked_crop:
        # Don't try to upscale from a tiny crop — return the URL as-is so
        # ESPN serves the bytes that actually exist.
        return base_url

    # Master image — safe to ask for a big resize.
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
    """Headlines from ESPN news feed."""
    data = _fetch_with_cache(ESPN_NEWS, params={"limit": limit}, ttl=300)
    if not data:
        return []

    out: List[Dict[str, Any]] = []
    for art in (data.get("articles") or [])[:limit]:
        images = art.get("images") or []
        # Pick the widest image — ESPN orders by size descending usually,
        # but fall back to the first if no dimensions are recorded.
        best_img = None
        if images:
            with_w = [i for i in images if isinstance(i, dict) and i.get("width")]
            best_img = max(with_w, key=lambda i: int(i.get("width") or 0)) if with_w else images[0]
        # Use 1920×1080 for the homepage hero / news-page hero — these images
        # get displayed at ~700px wide, so we want 2× pixel density at retina.
        thumb = _hires_thumb(best_img.get("url") if isinstance(best_img, dict) else None, width=1920, height=1080)
        out.append({
            "id": str(art.get("id") or art.get("dataSourceIdentifier") or ""),
            "title": art.get("headline") or art.get("title"),
            "description": art.get("description"),
            "category": (art.get("categories") or [{}])[0].get("description") if art.get("categories") else None,
            "published": art.get("published"),
            "thumb": thumb,
            "byline": _byline_text(art.get("byline")),
            "type": art.get("type"),
            "url": (art.get("links") or {}).get("web", {}).get("href"),
        })
    return out


def get_article(article_id: str) -> Optional[Dict[str, Any]]:
    """Fetch full article body from ESPN content API."""
    if not article_id or not article_id.isdigit():
        return None
    url = ESPN_ARTICLE.format(id=article_id)
    data = _fetch_with_cache(url, ttl=900)
    if not data:
        return None

    # ESPN sometimes wraps it as { headlines: [{...}] }, sometimes as the
    # article object directly. Normalise both shapes.
    article = data
    if isinstance(data.get("headlines"), list) and data["headlines"]:
        article = data["headlines"][0]

    images = article.get("images") or []
    # Keep up to 4 illustrative images for a richer modal.
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

    # Strip raw HTML tags from story for paragraph splitting.
    raw_story = article.get("story") or ""
    paragraphs: List[str] = []
    if raw_story:
        import re
        # Pull <p>…</p> blocks, then strip remaining tags.
        for block in re.findall(r"<p[^>]*>(.*?)</p>", raw_story, flags=re.S | re.I):
            clean = re.sub(r"<[^>]+>", "", block).strip()
            # Skip ESPN placeholder tags like <video1>, <alsosee>
            if not clean or clean.startswith("<"):
                continue
            paragraphs.append(clean)
        if not paragraphs:
            # Fallback: split by linebreak
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
