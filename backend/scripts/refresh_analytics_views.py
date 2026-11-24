"""Обновление материализованных представлений аналитики.

Вызывается после успешной загрузки данных
(см. scripts/update_data.update_db_with_new_games). Ошибка обновления
представлений не должна помечать импорт как неудачный, поэтому здесь она
обрабатывается и возвращается отдельно; отсутствующие представления
(миграция ещё не применена) пропускаются.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Dict, List

import psycopg2
from psycopg2 import sql

sys.path.append(str(Path(__file__).resolve().parent.parent))

from config import config

VIEWS: List[str] = [
    "mv_team_season_summary",
    "mv_player_season_summary",
]


def _connect():
    url = config.DATABASE_URL
    if not url:
        raise RuntimeError("DATABASE_URL / DB_* is not configured")
    return psycopg2.connect(url)


def refresh_analytics_views() -> Dict[str, dict]:
    """Обновляет все аналитические материализованные представления.

    Возвращает словарь {имя_представления: {"success": bool, "skipped": bool,
    "error": str|None}}. Никогда не поднимает исключение наружу.
    """
    results: Dict[str, dict] = {}

    try:
        conn = _connect()
    except Exception as e:
        print(f"[refresh_analytics_views] Не удалось подключиться к БД: {e}")
        return {v: {"success": False, "skipped": False, "error": str(e)} for v in VIEWS}

    try:
        cur = conn.cursor()
        for view in VIEWS:
            try:
                # Пропускаем отсутствующие представления (миграция не применена).
                cur.execute("SELECT to_regclass(%s)", (f"public.{view}",))
                if cur.fetchone()[0] is None:
                    results[view] = {"success": False, "skipped": True, "error": "view does not exist"}
                    print(f"[refresh_analytics_views] {view}: пропущено (не существует)")
                    continue

                cur.execute(sql.SQL("REFRESH MATERIALIZED VIEW {}").format(sql.Identifier(view)))
                conn.commit()
                results[view] = {"success": True, "skipped": False, "error": None}
                print(f"[refresh_analytics_views] {view}: обновлено")
            except Exception as e:
                conn.rollback()
                results[view] = {"success": False, "skipped": False, "error": str(e)}
                print(f"[refresh_analytics_views] {view}: ошибка — {e}")
        cur.close()
    finally:
        conn.close()

    return results


if __name__ == "__main__":
    import json

    print(json.dumps(refresh_analytics_views(), ensure_ascii=False, indent=2))
