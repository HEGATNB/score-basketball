# repositories/prediction_stats_repository.py
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from repositories.base_repository import BaseRepository


class PredictionStatsRepository(BaseRepository):
    # Репозиторий для статистики прогнозов

    def __init__(self, db: Session):
        super().__init__(db)

    # Получение прогнозов пользователя с результатами матчей
    def get_predictions_with_outcomes(self, user_id: int) -> List[Dict[str, Any]]:
        query = """
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
                    AND g.game_date >= pred.created_at - INTERVAL '7 days'
                    AND g.game_date <= pred.created_at + INTERVAL '90 days'
                ORDER BY g.game_date ASC
                LIMIT 1
            ) g ON TRUE
            LEFT JOIN team t1 ON CAST(pred.team1_id AS TEXT) = t1.id
            LEFT JOIN team t2 ON CAST(pred.team2_id AS TEXT) = t2.id
            ORDER BY pred.created_at ASC
        """
        return self._fetch_all(query, {"user_id": user_id})

    # Получение пользователей, у которых есть прогнозы
    def get_users_with_predictions(self) -> List[Dict[str, Any]]:
        query = """
            SELECT u.id, u.username, u.name, u.email,
                   COUNT(p.id) AS pred_count
            FROM users u
            JOIN predictions p ON p.user_id = u.id
            GROUP BY u.id, u.username, u.name, u.email
            HAVING COUNT(p.id) > 0
        """
        return self._fetch_all(query)

    # Получение ID пользователей с прогнозами
    def get_user_ids_with_predictions(self) -> List[int]:
        query = """
            SELECT DISTINCT u.id 
            FROM users u
            JOIN predictions p ON p.user_id = u.id
            GROUP BY u.id
            HAVING COUNT(p.id) > 0
        """
        results = self._fetch_all(query)
        return [r["id"] for r in results]

    # Получение количества прогнозов пользователя
    def get_prediction_count_by_user(self, user_id: int) -> int:
        query = "SELECT COUNT(*) FROM predictions WHERE user_id = :user_id"
        return self._fetch_scalar(query, {"user_id": user_id}) or 0