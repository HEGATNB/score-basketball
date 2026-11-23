"""Read-only ESPN data for public pages when the local archive is missing."""

from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
import math
from zoneinfo import ZoneInfo

from services.espn_provider import BASE, FeedUnavailable
from services.live_service import _fetch_with_cache, get_scoreboard
from services.nba_catalog import BY_ABBREV, BY_ESPN_ID, BY_NBA_ID, DIVISION_BY_ABBREV, TEAMS, normalize_abbrev

STANDINGS = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings"
ESPN_TIMEZONE = ZoneInfo("America/New_York")


def current_standings() -> dict[str, dict]:
    _, data = _fetch_with_cache(STANDINGS, ttl=300)
    standings = {}
    for group in (data or {}).get("children", []):
        for entry in (group.get("standings") or {}).get("entries", []):
            team_id = str((entry.get("team") or {}).get("id"))
            stats = {stat.get("name"): stat.get("value") for stat in entry.get("stats", [])}
            wins, losses = stats.get("wins"), stats.get("losses")
            if not all(isinstance(value, (int, float)) and math.isfinite(value) and value >= 0
                       for value in (wins, losses)):
                continue
            standings[team_id] = {
                "wins": int(wins), "losses": int(losses),
                "win_pct": wins / (wins + losses) if wins + losses else 0,
                "points_per_game": stats.get("avgPointsFor") or 0,
                "points_against": stats.get("avgPointsAgainst") or 0,
            }
    return standings


def catalog_team(team: tuple, standings: dict[str, dict]) -> dict:
    nba_id, espn_id, abbrev, name, city, conference = team
    stats = standings.get(str(espn_id))
    return {
        "id": nba_id, "espn_id": espn_id, "name": name, "full_name": name, "abbrev": abbrev,
        "city": city, "conference": conference, "division": DIVISION_BY_ABBREV[abbrev],
        "source": "espn" if stats else "catalog",
        "has_stats": stats is not None,
        **(stats or {}),
    }


def catalog_teams() -> list[dict]:
    standings = current_standings()
    return [catalog_team(team, standings) for team in TEAMS]


def get_catalog_team(team_id: int) -> dict | None:
    team = BY_NBA_ID.get(team_id)
    if team is None:
        return None
    profile = catalog_team(team, current_standings())
    _, data = _fetch_with_cache(f"{BASE}/teams/{team[1]}", ttl=300)
    if data:
        venue = ((data.get("team") or {}).get("venue") or {}).get("fullName")
        profile["arena"] = venue
    return profile


def get_roster(abbrev: str) -> list[dict] | None:
    team = BY_ABBREV.get(normalize_abbrev(abbrev))
    if team is None:
        return None
    _, data = _fetch_with_cache(f"{BASE}/teams/{team[1]}/roster", ttl=300)
    if not data or not isinstance(data.get("athletes"), list):
        raise FeedUnavailable("ESPN roster unavailable")

    roster = []
    for entry in data["athletes"]:
        players = entry.get("items", [entry])
        for player in players:
            if not player.get("id") or not player.get("fullName"):
                continue
            roster.append({
                "id": str(player["id"]), "name": player["fullName"], "number": player.get("jersey"),
                "position": (player.get("position") or {}).get("abbreviation"),
                "photo": (player.get("headshot") or {}).get("href"),
            })
    return roster


def scoreboard_window(days: range, today: date | None = None) -> list[dict]:
    today = today or datetime.now(ESPN_TIMEZONE).date()
    keys = [(today + timedelta(days=day)).strftime("%Y%m%d") for day in days]
    with ThreadPoolExecutor(max_workers=min(3, len(keys))) as pool:
        scoreboards = list(pool.map(get_scoreboard, keys))
    available = [board for board in scoreboards if not board.get("error")]
    if not available:
        raise FeedUnavailable("ESPN scoreboard unavailable")
    return list({event["id"]: event for board in available for event in board["events"]}.values())


def get_portable_matches(kind: str | None, skip: int, limit: int, *, team_id: int | None = None) -> list[dict]:
    days = range(0, 4) if kind == "scheduled" else range(-3, 1) if kind == "finished" else range(-3, 4)
    now = datetime.now(timezone.utc)
    matches = []
    for event in scoreboard_window(days):
        state = event["state"]
        if state not in ("pre", "post"):
            continue
        status = "scheduled" if state == "pre" else "finished"
        if kind and status != kind:
            continue
        try:
            tipoff = datetime.fromisoformat(event["date"].replace("Z", "+00:00"))
        except (AttributeError, TypeError, ValueError):
            continue
        if tipoff.tzinfo is None or (state == "pre" and tipoff < now):
            continue
        home = BY_ESPN_ID.get(str(event["home"]["id"]))
        away = BY_ESPN_ID.get(str(event["away"]["id"]))
        if home is None or away is None or not str(event["id"]).isdigit():
            continue
        if team_id is not None and team_id not in (home[0], away[0]):
            continue

        matches.append({
            "id": int(event["id"]), "game_id": "ESPN_" + str(event["id"]),
            "source": "espn", "date": event["date"], "status": status,
            "home_team_id": home[0], "away_team_id": away[0],
            "home_team": catalog_team(home, {}), "away_team": catalog_team(away, {}),
            "home_score": event["home"]["score"], "away_score": event["away"]["score"],
        })
    matches.sort(key=lambda game: game["date"], reverse=kind != "scheduled")
    return matches[skip:skip + limit]
