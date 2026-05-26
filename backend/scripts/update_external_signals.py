import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

import psycopg2
import requests
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = Path(os.getenv("MODEL_DIR", str(BASE_DIR / "models")))
MODEL_DIR.mkdir(parents=True, exist_ok=True)
SIGNALS_PATH = MODEL_DIR / "external_signals.json"


def load_environment() -> None:
    candidates = [BASE_DIR / "env", BASE_DIR / ".env", Path(".env")]
    for env_path in candidates:
        if env_path.exists():
            load_dotenv(env_path)
            break
    else:
        load_dotenv()


def get_db_connection():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME", "nba"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        cursor_factory=RealDictCursor,
    )


def fetch_team_ids() -> Dict[str, Dict[str, Any]]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, full_name, abbreviation FROM team ORDER BY id")
            rows = cur.fetchall()
    finally:
        conn.close()

    result: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        team_id = str(row["id"])
        result[team_id] = {
            "team_name": row.get("full_name"),
            "team_abbrev": row.get("abbreviation"),
        }
    return result


def _normalize_feed_item(item: Dict[str, Any]) -> Dict[str, Any]:
    score = item.get("availability_score")
    if score is None:
        injuries = float(item.get("injuries_count", 0.0))
        score = max(0.15, min(1.0, 1.0 - injuries * 0.12))
    score = float(score)
    score = max(0.05, min(1.0, score))

    return {
        "availability_score": score,
        "injuries_count": int(item.get("injuries_count", 0)),
        "notes": item.get("notes"),
    }


def pull_external_feed(url: str, timeout_seconds: int = 8) -> Dict[str, Dict[str, Any]]:
    response = requests.get(url, timeout=timeout_seconds)
    response.raise_for_status()
    payload = response.json()

    if isinstance(payload, dict):
        payload = payload.get("signals") or payload.get("teams") or []
    if not isinstance(payload, list):
        return {}

    normalized: Dict[str, Dict[str, Any]] = {}
    for item in payload:
        if not isinstance(item, dict):
            continue
        team_id = item.get("team_id") or item.get("teamId")
        if team_id is None:
            continue
        normalized[str(team_id)] = _normalize_feed_item(item)
    return normalized


def build_signals() -> Dict[str, Any]:
    load_environment()
    enabled = str(os.getenv("ENABLE_EXTERNAL_SIGNALS", "false")).lower() in {"1", "true", "yes"}
    source_url = os.getenv("EXTERNAL_SIGNALS_URL")
    team_registry = fetch_team_ids()

    signals: Dict[str, Dict[str, Any]] = {}
    if enabled and source_url:
        try:
            signals = pull_external_feed(source_url)
        except Exception as exc:
            print(f"Warning: external feed unavailable ({exc}). Falling back to neutral values.")

    # Graceful fallback for missing or disabled feeds.
    for team_id, team_info in team_registry.items():
        if team_id not in signals:
            signals[team_id] = {
                "availability_score": 0.5,
                "injuries_count": 0,
                "notes": "neutral_fallback",
            }
        signals[team_id].update(team_info)

    payload = {
        "enabled": enabled,
        "source": source_url if enabled and source_url else "local_fallback",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "signals": signals,
    }
    SIGNALS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


if __name__ == "__main__":
    output = build_signals()
    print(f"External signals updated: {len(output['signals'])} teams -> {SIGNALS_PATH}")
