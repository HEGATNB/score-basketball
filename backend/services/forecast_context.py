"""Optional availability scenario for a specific upcoming NBA game."""

from datetime import datetime, timedelta, timezone
import time

from services.espn_provider import FeedUnavailable, SUMMARY
from services.live_service import _fetch_with_cache
from services.nba_catalog import BY_ABBREV, normalize_abbrev
from services.nba_feed import ESPN_TIMEZONE, scoreboard_window

MAX_SHIFT = 6.0
POINTS_PER_ABSENCE = 1.5
REPORT_MAX_AGE = timedelta(hours=72)


class ForecastDataUnavailable(Exception):
    """Neither local results nor ESPN standings support a baseline prediction."""


def _timestamp(value) -> datetime | None:
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return result if result.tzinfo else None
    except (AttributeError, TypeError, ValueError):
        return None


def confirmed_absences(
        summary: dict, team_ids: tuple[str, str], tipoff: datetime, now: datetime,
) -> list[dict] | None:
    groups = {
        str((group.get("team") or {}).get("id") or group.get("id")): group["injuries"]
        for group in summary.get("injuries") or []
        if isinstance(group, dict) and isinstance(group.get("injuries"), list)
    }
    if any(team_id not in groups for team_id in team_ids):
        return None

    evidence = []
    for side, team_id in enumerate(team_ids, start=1):
        latest = {}
        for item in groups[team_id]:
            if not isinstance(item, dict):
                continue
            reported = _timestamp(item.get("date"))
            athlete = item.get("athlete") or {}
            player = athlete.get("displayName")
            if not reported or not player or not now - REPORT_MAX_AGE <= reported <= now:
                continue
            player_id = str(athlete.get("id") or player.casefold())
            out = str(item.get("status", "")).strip().casefold() == "out"
            previous = latest.get(player_id)
            if previous is None or reported > previous[0] or (reported == previous[0] and not out):
                latest[player_id] = reported, out, player, item

        for reported, out, player, item in latest.values():
            if not out:
                continue
            # A reported return on or before game day makes this absence uncertain.
            return_date = (item.get("details") or {}).get("returnDate")
            if return_date and str(return_date)[:10] <= tipoff.astimezone(ESPN_TIMEZONE).date().isoformat():
                continue
            evidence.append({"side": side, "player": player, "reportedAt": reported.isoformat()})
    return evidence


def availability_scenario(base_probability: float, home: str, away: str) -> dict:
    home_team = BY_ABBREV.get(normalize_abbrev(home))
    away_team = BY_ABBREV.get(normalize_abbrev(away))
    base_probability = round(base_probability, 1)
    result = {
        "status": "no_match",
        "baseTeam1": base_probability, "adjustedTeam1": base_probability,
        "shiftTeam1": 0.0, "eventId": None, "gameDate": None, "sourceUrl": None,
        "absences": [],
    }
    if not home_team or not away_team:
        return result

    team_ids = str(home_team[1]), str(away_team[1])
    now = datetime.now(timezone.utc)
    try:
        events = scoreboard_window(range(0, 4), now.astimezone(ESPN_TIMEZONE).date())
    except FeedUnavailable:
        return {**result, "status": "unavailable"}

    for event in sorted(events, key=lambda row: row["date"]):
        tipoff = _timestamp(event["date"])
        if (event["state"] == "pre" and tipoff and now <= tipoff <= now + timedelta(hours=72)
                and (str(event["home"]["id"]), str(event["away"]["id"])) == team_ids):
            break
    else:
        return result

    event_id = str(event["id"])
    if not event_id.isdigit():
        return result
    result.update(
        status="unavailable", eventId=event_id, gameDate=tipoff.isoformat(),
        sourceUrl=f"https://www.espn.com/nba/game/_/gameId/{event_id}",
    )
    fetched_at, summary = _fetch_with_cache(SUMMARY, {"event": event_id}, ttl=60)
    if not summary or time.time() - fetched_at > 120:
        return result

    competition = ((summary.get("header") or {}).get("competitions") or [{}])[0]
    state = ((competition.get("status") or {}).get("type") or {}).get("state")
    if state != "pre":
        return result

    absences = confirmed_absences(summary, team_ids, tipoff, now)
    if absences is None:
        return result
    home_out = sum(item["side"] == 1 for item in absences)
    away_out = len(absences) - home_out
    shift = max(-MAX_SHIFT, min(MAX_SHIFT, (away_out - home_out) * POINTS_PER_ABSENCE))
    adjusted = round(max(0, min(100, base_probability + shift)), 1)
    return {
        **result, "status": "applied" if adjusted != base_probability else "neutral",
        "adjustedTeam1": adjusted, "shiftTeam1": round(adjusted - base_probability, 1), "absences": absences,
    }
