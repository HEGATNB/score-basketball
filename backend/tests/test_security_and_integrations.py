from io import StringIO
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import Mock
import csv

from fastapi.testclient import TestClient
import pytest
from redis import ConnectionError

from config import config
from controllers import predictions
from database import get_db
from main import app
from repositories.game_repository import GameRepository
from scheduler import data_updater
from scripts.auth import TokenPayload, generate_token, verify_token
from scripts import update_data
from scripts.update_data import final_scores
from services import live_service
from services.espn_provider import FeedUnavailable
from services.redis_service import redis_service


@pytest.fixture(autouse=True)
def test_secret(monkeypatch):
    monkeypatch.setattr(config, "JWT_SECRET", "test-only-key-" * 4)
    monkeypatch.setattr(config, "JWT_EXPIRES_IN", "30m")


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(redis_service, "get", lambda key: None)
    monkeypatch.setattr(redis_service, "is_session_revoked", lambda *args: False)
    monkeypatch.setattr(redis_service, "check_rate_limit", lambda *args: (True, 60))
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def bearer(role):
    return {"Authorization": "Bearer " + generate_token(TokenPayload(7, "test@example.com", role))}


def test_startup_requires_secret(monkeypatch):
    monkeypatch.setattr(config, "JWT_SECRET", "")
    with pytest.raises(ValueError, match="JWT_SECRET"):
        with TestClient(app):
            pass


def test_token_claims_and_lifetime():
    token = generate_token(TokenPayload(7, "test@example.com", "operator"))
    payload = verify_token(token)
    assert payload.role == "operator"
    assert 1799 <= payload.expires_at - payload.issued_at <= 1800
    assert payload.token_id != verify_token(generate_token(payload)).token_id
    assert verify_token("invalid") is None


def test_all_retrain_routes_require_administrator(client, monkeypatch):
    queue = Mock(return_value=True)
    monkeypatch.setattr(data_updater, "queue_job", queue)
    for url in ("/api/neural/retrain", "/neural/retrain", "/api/admin/force-model-retrain"):
        assert client.post(url).status_code == 401
        assert client.post(url, headers=bearer("operator")).status_code == 403
        assert client.post(url, headers=bearer("admin")).status_code == 202
    assert queue.call_count == 3


def test_unsafe_routes_are_unavailable(client):
    for url in ("/api/debug/db-check", "/debug/db-check", "/api/auth/init", "/auth/init"):
        assert client.request("POST" if url.endswith("/init") else "GET", url).status_code == 404
    assert client.post("/api/admin/restore/1", headers=bearer("admin")).status_code == 410
    assert client.post("/api/admin/backup", headers=bearer("admin")).status_code == 410


def test_logout_all_revokes_older_tokens(client, monkeypatch):
    state = {}
    monkeypatch.setattr(redis_service, "client", SimpleNamespace(
        setex=lambda key, expiry, value: state.update({key: value}),
        mget=lambda *keys: [state.get(key) for key in keys],
    ))
    monkeypatch.setattr(redis_service, "is_session_revoked", redis_service.__class__.is_session_revoked.__get__(redis_service))
    monkeypatch.setattr("controllers.auth.AuditService", Mock())
    monkeypatch.setattr(data_updater, "get_status", lambda: {"is_running": True})
    old = bearer("operator")
    second = bearer("operator")
    response = client.post("/api/auth/logout-all", headers=old)
    assert response.status_code == 200
    assert client.get("/api/admin/update-status", headers=old).status_code == 401
    assert client.get("/api/admin/update-status", headers=second).status_code == 401
    assert client.get("/api/admin/update-status", headers=bearer("operator")).status_code == 200


def test_redis_outage_rejects_authorized_route(client, monkeypatch):
    monkeypatch.setattr(redis_service, "is_session_revoked", Mock(side_effect=ConnectionError))
    assert client.get("/api/admin/update-status", headers=bearer("operator")).status_code == 503


def test_preview_is_rate_limited_and_read_only(client, monkeypatch):
    monkeypatch.setattr(redis_service, "check_rate_limit", lambda *args: (False, 12))
    response = client.get("/api/predict/preview?team1=1&team2=2")
    assert response.status_code == 429
    assert response.headers["Retry-After"] == "12"
    monkeypatch.setattr(redis_service, "check_rate_limit", lambda *args: (True, 60))
    ai = Mock()
    ai.return_value.compute_preview.return_value = {"probabilityTeam1": 57}
    monkeypatch.setattr(predictions, "AIService", ai)
    cached = {}
    monkeypatch.setattr(redis_service, "get", cached.get)
    monkeypatch.setattr(redis_service, "set", lambda key, value, **kwargs: cached.update({key: value}))
    for _ in range(2):
        response = client.get("/api/predict/preview?team1=1&team2=2")
        assert response.json() == {"probabilityTeam1": 57}
    ai.assert_called_once()
    assert ai.call_args.kwargs == {"read_only": True}


def test_health_hides_database_errors(client):
    db = Mock()
    db.execute.side_effect = RuntimeError("private database diagnostics")
    app.dependency_overrides[get_db] = lambda: db
    response = client.get("/api/health")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}


def test_scoreboard_preserves_original_timestamp_on_fallback(monkeypatch):
    live_service._cache.clear()
    fetch = Mock(side_effect=[{"events": []}, FeedUnavailable(), FeedUnavailable()])
    monkeypatch.setattr(live_service.provider, "fetch", fetch)
    now = 10_000
    monkeypatch.setattr(live_service.time, "time", lambda: now)
    assert live_service.get_scoreboard()["fetchedAt"] == 10_000
    now += 70
    cached = live_service.get_scoreboard()
    assert cached["fetchedAt"] == 10_000
    assert cached["stale"] is True
    now += 600
    assert live_service.get_scoreboard()["fetchedAt"] is None
    live_service._cache.clear()


def test_only_completed_games_have_final_scores():
    event = {"status": {"type": {"completed": False}}}
    assert final_scores(event, {"score": "95"}, {"score": "100"}) is None
    event["status"]["type"]["completed"] = True
    assert final_scores(event, {"score": "95"}, {"score": "100"}) == (95, 100)
    with pytest.raises(FeedUnavailable):
        final_scores(event, {"score": None}, {"score": "100"})


def test_box_score_parses_espn_totals(monkeypatch):
    fields = {
        "fieldGoalsMade-fieldGoalsAttempted": "21-49",
        "threePointFieldGoalsMade-threePointFieldGoalsAttempted": "9-18",
        "freeThrowsMade-freeThrowsAttempted": "3-4",
        "totalRebounds": "19",
        "assists": "10",
        "steals": "5",
        "blocks": "0",
        "turnovers": "6",
        "fouls": "7",
    }
    stats = [{"name": name, "displayValue": value} for name, value in fields.items()]
    monkeypatch.setattr(update_data.provider, "summary", lambda event: {
        "boxscore": {"teams": [{"homeAway": side, "statistics": stats} for side in ("home", "away")]},
    })
    box_score = update_data.fetch_detailed_stats("123")
    assert box_score["home"]["rebounds"] == 19
    assert box_score["away"]["fieldGoalsAttempted"] == 49


def test_match_csv_is_scoped_to_operators(client):
    db = Mock()
    rows = MagicRows([("ESPN_7", "BOS", "NYK", 101, 97)])
    db.execute.return_value = rows
    app.dependency_overrides[get_db] = lambda: db
    url = "/api/admin/matches.csv?start=2026-11-01&end=2026-11-10"
    assert client.get(url, headers=bearer("user")).status_code == 403
    response = client.get(url, headers=bearer("operator"))
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert list(csv.reader(StringIO(response.text)))[1] == ["ESPN_7", "BOS", "NYK", "101", "97"]
    assert client.get(url.replace("11-10", "12-10"), headers=bearer("operator")).status_code == 422


def test_upcoming_games_are_filtered_and_ordered_before_pagination(monkeypatch):
    repo = GameRepository(Mock())
    fetch = Mock(return_value=[])
    monkeypatch.setattr(repo, "_fetch_all", fetch)
    start = datetime(2026, 11, 23, 8)
    repo.get_all(status_filter="scheduled", upcoming_from=start, limit=5)
    query, params = fetch.call_args.args
    assert "CAST(g.game_date AS timestamp) >= :upcoming_from" in query
    assert query.index("ORDER BY CAST(g.game_date AS timestamp)") < query.index("LIMIT :limit")
    assert params["upcoming_from"] == start


class MagicRows(list):
    def keys(self):
        return ("game_id", "team_abbreviation_home", "team_abbreviation_away", "pts_home", "pts_away")
