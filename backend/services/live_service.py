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
    }


def get_top_news(limit: int = 6) -> List[Dict[str, Any]]:
    """Headlines from ESPN news feed."""
    data = _fetch_with_cache(ESPN_NEWS, params={"limit": limit}, ttl=300)
    if not data:
        return []

    out: List[Dict[str, Any]] = []
    for art in (data.get("articles") or [])[:limit]:
        images = art.get("images") or []
        thumb = images[0].get("url") if images else None
        out.append({
            "id": str(art.get("id") or art.get("dataSourceIdentifier") or ""),
            "title": art.get("headline") or art.get("title"),
            "description": art.get("description"),
            "category": (art.get("categories") or [{}])[0].get("description") if art.get("categories") else None,
            "published": art.get("published"),
            "thumb": thumb,
            "url": (art.get("links") or {}).get("web", {}).get("href"),
        })
    return out
