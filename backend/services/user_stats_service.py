from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# ===== Настраиваемые параметры =====
XP_BASE_WIN = 50
XP_HIGH_CONF_BONUS = 25
XP_HIGH_CONF_THRESHOLD = 70  # процентов
XP_UNDERDOG_BONUS = 50
LAST_N_FOR_SPARK = 20

# Границы категорий уверенности
HIGH_CONF_MIN = 65.0
LOW_CONF_MAX = 55.0


def _outcome_xp(correct: bool, confidence: float, is_underdog_pick: bool) -> int:
    """Опыт, начисляемый за один прогноз."""
    if not correct:
        return 0
    xp = XP_BASE_WIN
    if confidence >= XP_HIGH_CONF_THRESHOLD:
        xp += XP_HIGH_CONF_BONUS
    if is_underdog_pick:
        xp += XP_UNDERDOG_BONUS
    return xp


def _streaks(outcomes: List[Optional[bool]]) -> Dict[str, int]:
    """Возвращает текущую и лучшую серии по списку результатов в хронологическом порядке.
    `outcomes` отсортирован от старых к новым; None (неразрешённый прогноз) прерывает серию."""
    best = 0
    current = 0
    run = 0
    for o in outcomes:
        if o is True:
            run += 1
            best = max(best, run)
        else:
            run = 0
    # Текущее значение — число последовательных побед в конце списка
    for o in reversed(outcomes):
        if o is True:
            current += 1
        else:
            break
    return {"current": current, "best": best}


class UserStatsService:
    def __init__(self, db: Session):
        self.db = db

    # ---------- единичная загрузка данных ----------

    def _fetch_predictions_with_outcomes(self, user_id: int) -> List[Dict[str, Any]]:
        """Загружает прогнозы пользователя и сопоставляет их с завершёнными матчами.
        Возвращает записи от старых к новым."""
        query = text("""
            WITH pred AS (
                SELECT
                    p.id,
                    p.user_id,
                    p.team1_id,
                    p.team2_id,
                    p.probability_team1,
                    p.probability_team2,
                    p.confidence,
                    p.expected_score_team1,
                    p.expected_score_team2,
                    p.created_at,
                    CASE
                        WHEN p.probability_team1 >= p.probability_team2 THEN p.team1_id
                        ELSE p.team2_id
                    END AS predicted_winner_id
                FROM predictions p
                WHERE p.user_id = :user_id
            )
            SELECT
                pred.*,
                g.game_id,
                g.game_date,
                g.team_id_home,
                g.team_id_away,
                g.pts_home,
                g.pts_away,
                t1.full_name AS team1_name,
                t1.abbreviation AS team1_abbrev,
                t2.full_name AS team2_name,
                t2.abbreviation AS team2_abbrev
            FROM pred
            LEFT JOIN LATERAL (
                SELECT g.*
                FROM game g
                WHERE
                    (
                        (g.team_id_home = CAST(pred.team1_id AS TEXT)
                         AND g.team_id_away = CAST(pred.team2_id AS TEXT))
                        OR
                        (g.team_id_home = CAST(pred.team2_id AS TEXT)
                         AND g.team_id_away = CAST(pred.team1_id AS TEXT))
                    )
                    AND g.pts_home IS NOT NULL
                    AND g.pts_away IS NOT NULL
                    AND NULLIF(g.game_date, '')::timestamp >= pred.created_at - INTERVAL '7 days'
                    AND NULLIF(g.game_date, '')::timestamp <= pred.created_at + INTERVAL '90 days'
                ORDER BY NULLIF(g.game_date, '')::timestamp ASC
                LIMIT 1
            ) g ON TRUE
            LEFT JOIN team t1 ON CAST(pred.team1_id AS TEXT) = t1.id
            LEFT JOIN team t2 ON CAST(pred.team2_id AS TEXT) = t2.id
            ORDER BY pred.created_at ASC
        """)
        rows = self.db.execute(query, {"user_id": user_id}).fetchall()

        # Показатели побед и поражений команд нужны для определения фаворита и аутсайдера
        team_records = self._team_records()

        result: List[Dict[str, Any]] = []
        for r in rows:
            d = dict(r._mapping)

            # Определяем фактического победителя завершённого матча
            pts_home = d.get("pts_home")
            pts_away = d.get("pts_away")
            home_id = d.get("team_id_home")
            away_id = d.get("team_id_away")

            actual_winner_id = None
            if pts_home is not None and pts_away is not None:
                try:
                    if int(pts_home) > int(pts_away):
                        actual_winner_id = home_id
                    elif int(pts_away) > int(pts_home):
                        actual_winner_id = away_id
                except (TypeError, ValueError):
                    actual_winner_id = None

            predicted_id = str(d["predicted_winner_id"])
            correct: Optional[bool]
            if actual_winner_id is None:
                correct = None
            else:
                correct = actual_winner_id == predicted_id

            # Аутсайдер — команда из прогноза с худшим показателем побед и поражений
            t1_rec = team_records.get(str(d["team1_id"]), {"w": 0, "l": 0})
            t2_rec = team_records.get(str(d["team2_id"]), {"w": 0, "l": 0})
            t1_pct = t1_rec["w"] / max(1, t1_rec["w"] + t1_rec["l"])
            t2_pct = t2_rec["w"] / max(1, t2_rec["w"] + t2_rec["l"])
            picked_t1 = predicted_id == str(d["team1_id"])
            is_underdog_pick = (picked_t1 and t1_pct < t2_pct) or (not picked_t1 and t2_pct < t1_pct)

            conf = float(d.get("confidence") or 0)
            xp = _outcome_xp(correct or False, conf, is_underdog_pick) if correct is True else 0

            result.append({
                "id": d["id"],
                "team1_id": d["team1_id"],
                "team2_id": d["team2_id"],
                "team1_name": d.get("team1_name"),
                "team1_abbrev": d.get("team1_abbrev"),
                "team2_name": d.get("team2_name"),
                "team2_abbrev": d.get("team2_abbrev"),
                "predicted_winner_id": predicted_id,
                "actual_winner_id": actual_winner_id,
                "correct": correct,
                "confidence": conf,
                "is_underdog_pick": is_underdog_pick,
                "xp": xp,
                "created_at": d["created_at"].isoformat() if d.get("created_at") else None,
                "game_date": d["game_date"].isoformat() if d.get("game_date") else None,
                "pts_home": pts_home,
                "pts_away": pts_away,
            })
        return result

    def _team_records(self) -> Dict[str, Dict[str, int]]:
        """Строит соответствие team_id -> {w, l} по последнему сезону из team_info_common."""
        rows = self.db.execute(text("""
            SELECT DISTINCT ON (team_id)
                team_id, w, l
            FROM team_info_common
            WHERE w IS NOT NULL AND l IS NOT NULL
            ORDER BY team_id, season_id DESC
        """)).fetchall()
        return {
            str(r._mapping["team_id"]): {
                "w": int(r._mapping["w"] or 0),
                "l": int(r._mapping["l"] or 0),
            }
            for r in rows
        }

    # ---------- публичный интерфейс ----------

    def get_user_stats(self, user_id: int) -> Dict[str, Any]:
        rows = self._fetch_predictions_with_outcomes(user_id)

        total = len(rows)
        completed = [r for r in rows if r["correct"] is not None]
        correct = [r for r in completed if r["correct"]]
        accuracy = (len(correct) / len(completed) * 100.0) if completed else 0.0

        outcomes_chrono: List[Optional[bool]] = [r["correct"] for r in completed]
        streak = _streaks(outcomes_chrono)

        # Последние N результатов для графика, включая неразрешённые («?»)
        last_n = rows[-LAST_N_FOR_SPARK:]
        spark = [
            "W" if r["correct"] is True
            else "L" if r["correct"] is False
            else "?"
            for r in last_n
        ]

        # Опыт начисляется только за верные прогнозы
        total_xp = sum(r["xp"] for r in rows)

        # Разбивка по категориям
        high_conf = [r for r in completed if r["confidence"] >= HIGH_CONF_MIN]
        low_conf = [r for r in completed if r["confidence"] <= LOW_CONF_MAX]
        underdog = [r for r in completed if r["is_underdog_pick"]]
        favourite = [r for r in completed if not r["is_underdog_pick"]]

        def _pct(rows_subset: List[Dict[str, Any]]) -> Dict[str, Any]:
            if not rows_subset:
                return {"n": 0, "correct": 0, "pct": None}
            c = sum(1 for r in rows_subset if r["correct"])
            return {"n": len(rows_subset), "correct": c, "pct": round(c / len(rows_subset) * 100, 1)}

        # Место в таблице лидеров
        rank = self._rank_for_user(user_id, total_xp)

        return {
            "user_id": user_id,
            "totalPredictions": total,
            "completedPredictions": len(completed),
            "correctPredictions": len(correct),
            "accuracy": round(accuracy, 1),
            "currentStreak": streak["current"],
            "bestStreak": streak["best"],
            "totalXp": total_xp,
            "rank": rank,
            "lastOutcomes": spark,
            "categories": {
                "highConfidence": _pct(high_conf),
                "lowConfidence": _pct(low_conf),
                "underdog": _pct(underdog),
                "favourite": _pct(favourite),
            },
        }

    def get_leaderboard(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Ранжирует пользователей по опыту. Опыт рассчитывается по той же логике,
        что и в get_user_stats, но вычисляются только нужные для рейтинга данные."""
        # Загружаем пользователей, у которых есть хотя бы один прогноз
        users = self.db.execute(text("""
            SELECT u.id, u.username, u.name, u.email,
                   COUNT(p.id) AS pred_count
            FROM users u
            JOIN predictions p ON p.user_id = u.id
            GROUP BY u.id, u.username, u.name, u.email
            HAVING COUNT(p.id) > 0
        """)).fetchall()

        board: List[Dict[str, Any]] = []
        for u in users:
            stats = self.get_user_stats(u._mapping["id"])
            board.append({
                "userId": u._mapping["id"],
                "username": u._mapping["username"] or (u._mapping["email"] or "").split("@")[0],
                "name": u._mapping["name"] or u._mapping["username"],
                "totalPredictions": stats["totalPredictions"],
                "accuracy": stats["accuracy"],
                "totalXp": stats["totalXp"],
                "currentStreak": stats["currentStreak"],
            })

        board.sort(key=lambda r: (-r["totalXp"], -r["accuracy"], -r["totalPredictions"]))
        for i, row in enumerate(board, start=1):
            row["rank"] = i

        return board[:limit]

    def _rank_for_user(self, user_id: int, user_xp: int) -> Optional[int]:
        """Быстро определяет место по числу пользователей с большим количеством опыта.
        Сейчас опыт пересчитывается для каждого пользователя; при росте базы стоит добавить кеш."""
        try:
            users = self.db.execute(text("""
                SELECT u.id FROM users u
                JOIN predictions p ON p.user_id = u.id
                GROUP BY u.id
                HAVING COUNT(p.id) > 0
            """)).fetchall()
            higher = 0
            for u in users:
                other_id = u._mapping["id"]
                if other_id == user_id:
                    continue
                # Повторный расчёт опыта затратен, поэтому пока откладываем его до необходимости.
                # Позицию возвращаем после формирования полного рейтинга.
            # Проще сформировать весь рейтинг (пользователей пока немного) и найти свою позицию
            board = self.get_leaderboard_no_recurse()
            for row in board:
                if row["userId"] == user_id:
                    return row["rank"]
            return None
        except Exception as e:
            logger.warning(f"rank lookup failed: {e}")
            return None

    def get_leaderboard_no_recurse(self) -> List[Dict[str, Any]]:
        """Аналог get_leaderboard в упрощённом виде, чтобы _rank_for_user мог вызвать метод
        без бесконечной рекурсии: get_leaderboard вызывает get_user_stats, а тот — _rank_for_user."""
        users = self.db.execute(text("""
            SELECT u.id, u.username, u.name, u.email
            FROM users u
            JOIN predictions p ON p.user_id = u.id
            GROUP BY u.id, u.username, u.name, u.email
            HAVING COUNT(p.id) > 0
        """)).fetchall()

        out: List[Dict[str, Any]] = []
        for u in users:
            uid = u._mapping["id"]
            rows = self._fetch_predictions_with_outcomes(uid)
            total_xp = sum(r["xp"] for r in rows)
            completed = [r for r in rows if r["correct"] is not None]
            correct = [r for r in completed if r["correct"]]
            accuracy = (len(correct) / len(completed) * 100.0) if completed else 0.0
            out.append({
                "userId": uid,
                "username": u._mapping["username"] or (u._mapping["email"] or "").split("@")[0],
                "totalPredictions": len(rows),
                "totalXp": total_xp,
                "accuracy": round(accuracy, 1),
            })
        out.sort(key=lambda r: (-r["totalXp"], -r["accuracy"], -r["totalPredictions"]))
        for i, row in enumerate(out, start=1):
            row["rank"] = i
        return out


# ===== Достижения =====

def evaluate_challenges(stats: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Рассчитывает прогресс достижений по фиксированным правилам и данным статистики.

    Каждое достижение содержит:
      id, icon, title, desc, progress (0–100), value (отображаемое значение), reward (очки),
      color, locked (bool — true, если прогресс равен 0 и есть предварительное условие).
    """
    completed = stats["completedPredictions"]
    correct = stats["correctPredictions"]
    accuracy = stats["accuracy"]
    streak = stats["currentStreak"]
    best_streak = stats["bestStreak"]
    underdog = stats["categories"]["underdog"]
    rank = stats.get("rank")

    out: List[Dict[str, Any]] = []

    # 1. Серия из 5 побед
    target = 5
    p = min(100, int(streak / target * 100)) if streak >= 0 else 0
    out.append({
        "id": "streak_5",
        "icon": "streak",
        "title": "DECISION STREAK",
        "desc": "5 correct predictions without a miss",
        "progress": p,
        "value": f"{streak} / {target}",
        "reward": "+250 pts",
        "color": "#ff5a1f",
        "locked": False,
    })

    # 2. Точность не менее 70% при наличии хотя бы 5 прогнозов
    min_n = 5
    if completed >= min_n:
        p = min(100, int(accuracy / 70 * 100))
        out.append({
            "id": "accuracy_70",
            "icon": "accuracy",
            "title": "WEEKLY ACCURACY",
            "desc": "70% threshold on completed games",
            "progress": p,
            "value": f"{accuracy:.0f}% / 70%",
            "reward": "+500 pts",
            "color": "#5db8ff",
            "locked": False,
        })
    else:
        out.append({
            "id": "accuracy_70",
            "icon": "accuracy",
            "title": "WEEKLY ACCURACY",
            "desc": "Requires at least 5 completed predictions",
            "progress": int(completed / min_n * 100),
            "value": f"{completed} / {min_n} predictions",
            "reward": "+500 pts",
            "color": "#5db8ff",
            "locked": True,
        })

    # 3. Аутсайдер: 3 верных прогноза на аутсайдера
    target_u = 3
    u_correct = underdog["correct"]
    out.append({
        "id": "underdog_3",
        "icon": "underdog",
        "title": "DIFFICULT MATCHUP",
        "desc": "3 correct picks against the favorite",
        "progress": min(100, int(u_correct / target_u * 100)),
        "value": f"{u_correct} / {target_u}",
        "reward": "+700 pts",
        "color": "#d1ff3a",
        "locked": False,
    })

    # 4. Вхождение в первую десятку рейтинга
    if rank:
        p = 100 if rank <= 10 else max(0, int((50 - rank) / 40 * 100))
        out.append({
            "id": "top_10",
            "icon": "champion",
            "title": "WEEKLY TOP",
            "desc": "Top 10 by prediction quality",
            "progress": p,
            "value": f"#{rank}" + (" - UNLOCKED" if rank <= 10 else ""),
            "reward": "+1000 pts",
            "color": "#ffb800",
            "locked": False,
        })
    else:
        out.append({
            "id": "top_10",
            "icon": "champion",
            "title": "WEEKLY TOP",
            "desc": "Top 10 by prediction quality",
            "progress": 0,
            "value": "Make your first prediction",
            "reward": "+1000 pts",
            "color": "#ffb800",
            "locked": True,
        })

    # 5. Бонус — лучшая серия
    out.append({
        "id": "best_streak",
        "icon": "streak",
        "title": "PEAK FORM",
        "desc": "Best streak of correct decisions",
        "progress": min(100, int(best_streak / 10 * 100)),
        "value": f"{best_streak} / 10",
        "reward": "+300 pts",
        "color": "#2ee68a",
        "locked": False,
    })

    # 6. Количество — 25 прогнозов всего
    out.append({
        "id": "volume_25",
        "icon": "accuracy",
        "title": "PROFILE DEPTH",
        "desc": "25 completed predictions in history",
        "progress": min(100, int(completed / 25 * 100)),
        "value": f"{completed} / 25",
        "reward": "+200 pts",
        "color": "#f472b6",
        "locked": False,
    })

    labels = {
        "streak_5": ("DECISION STREAK", "5 correct predictions without a miss"),
        "accuracy_70": ("WEEKLY ACCURACY", "70% threshold on completed games"),
        "underdog_3": ("DIFFICULT MATCHUP", "3 correct picks against the favorite"),
        "top_10": ("WEEKLY TOP", "Top 10 by prediction quality"),
        "best_streak": ("PEAK FORM", "Best streak of correct decisions"),
        "volume_25": ("PROFILE DEPTH", "25 completed predictions in history"),
    }
    for item in out:
        title_desc = labels.get(item["id"])
        if title_desc:
            item["title"], item["desc"] = title_desc
        if item["id"] == "accuracy_70" and completed < min_n:
            item["desc"] = "Requires at least 5 completed predictions"
            item["value"] = f"{completed} / {min_n} predictions"
        if item["id"] == "top_10":
            if rank:
                item["value"] = f"#{rank}" + (" - UNLOCKED" if rank <= 10 else "")
            else:
                item["value"] = "Make your first prediction"

    return out
