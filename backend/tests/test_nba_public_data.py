from datetime import datetime, timedelta, timezone
import time

from services import forecast_context, live_service, nba_feed


def injury(name, status, reported, **details):
    return {
        "athlete": {"displayName": name}, "status": status,
        "date": reported.isoformat(), "details": details,
    }


def injury_group(team_id, injuries):
    return {"team": {"id": team_id}, "injuries": injuries}


def test_only_latest_fresh_confirmed_absences_count():
    now = datetime(2026, 11, 23, 12, tzinfo=timezone.utc)
    game = now + timedelta(days=1)
    yesterday = now - timedelta(days=1)
    summary = {"injuries": [
        injury_group("13", [
            injury("Available", "Out", yesterday),
            injury("Available", "Probable", now),
            injury("Questionable", "Day-To-Day", now),
            injury("Stale", "Out", now - timedelta(days=4)),
            injury("Returns", "Out", now, returnDate=game.date().isoformat()),
            injury("Away from game", "Out", yesterday),
            injury("Away from game", "Out", now),
        ]),
        injury_group("23", []),
    ]}

    assert forecast_context.confirmed_absences(summary, ("13", "23"), game, now) == [
        {"side": 1, "player": "Away from game", "reportedAt": now.isoformat()}
    ]
    assert forecast_context.confirmed_absences(summary, ("13", "2"), game, now) is None


def test_context_tracks_the_home_away_order_and_caps_shift(monkeypatch):
    now = datetime.now(timezone.utc)
    event = {
        "id": "123456", "date": (now + timedelta(hours=3)).isoformat(), "state": "pre",
        "home": {"id": "13"}, "away": {"id": "23"},
    }
    summary = {
        "header": {"competitions": [{"status": {"type": {"state": "pre"}}}]},
        "injuries": [injury_group("13", []), injury_group("23", [
            injury(f"Player {i}", "Out", now - timedelta(hours=1)) for i in range(5)
        ])],
    }
    monkeypatch.setattr(forecast_context, "scoreboard_window", lambda *args: [event])
    monkeypatch.setattr(forecast_context, "_fetch_with_cache", lambda *args, **kwargs: (time.time(), summary))

    result = forecast_context.availability_scenario(53, "LAL", "SAC")
    assert (result["status"], result["baseTeam1"], result["adjustedTeam1"]) == ("applied", 53, 59)
    assert result["eventId"] == "123456"
    assert len(result["absences"]) == 5
    assert forecast_context.availability_scenario(53, "SAC", "LAL")["status"] == "no_match"

    summary["injuries"] = summary["injuries"][1:]
    result = forecast_context.availability_scenario(53, "LAL", "SAC")
    assert (result["status"], result["adjustedTeam1"]) == ("unavailable", 53)


def test_news_uses_provider_team_tags_and_deduplicates(monkeypatch):
    team_tag = {"type": "team", "teamId": 13}
    data = {"articles": [
        {"id": 10, "headline": "Lakers report", "categories": [team_tag], "published": "2026-11-23T01:00Z"},
        {"id": 11, "headline": "Lakers mentioned", "categories": [{"type": "topic", "teamId": 13}]},
        {"id": 10, "headline": "Repeated headline", "categories": [team_tag]},
    ]}
    monkeypatch.setattr(live_service, "_fetch_with_cache", lambda *args, **kwargs: (time.time(), data))

    feed = live_service.get_news_feed(16, {"LAL"})
    assert [(item["id"], item["teams"]) for item in feed["items"]] == [("10", ["LAL"])]
    assert not feed["stale"]


def test_portable_schedule_filters_before_limit(monkeypatch):
    game_date = (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat()
    events = [
        {"id": "100", "date": game_date, "state": "pre", "home": {"id": "2", "score": None},
         "away": {"id": "1", "score": None}},
        {"id": "101", "date": game_date, "state": "pre", "home": {"id": "13", "score": None},
         "away": {"id": "23", "score": None}},
    ]
    monkeypatch.setattr(nba_feed, "scoreboard_window", lambda *args: events)

    match, = nba_feed.get_portable_matches("scheduled", 0, 1, team_id=1610612747)
    assert (match["id"], match["source"], match["away_team"]["abbrev"]) == (101, "espn", "SAC")


def test_scoreboard_uses_espn_calendar_after_utc_midnight(monkeypatch):
    class FixedClock(datetime):
        @classmethod
        def now(cls, tz):
            return cls(2026, 11, 23, 1, tzinfo=timezone.utc).astimezone(tz)

    requested = []

    def scoreboard(date):
        requested.append(date)
        return {"events": []}

    monkeypatch.setattr(nba_feed, "datetime", FixedClock)
    monkeypatch.setattr(nba_feed, "get_scoreboard", scoreboard)

    assert nba_feed.scoreboard_window(range(1)) == []
    assert requested == ["20261122"]
