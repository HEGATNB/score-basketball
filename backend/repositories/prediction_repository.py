from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from repositories.base_repository import BaseRepository
import json


class PredictionRepository(BaseRepository):
    """Репозиторий для работы с таблицей predictions"""

    def __init__(self, db: Session):
        super().__init__(db)

    def create(self, user_id: int, team1_id: int, team2_id: int,
               prob1: float, prob2: float, score1: int, score2: int,
               confidence: float, model_version: str, features: Dict = None) -> int:
        features_json = json.dumps(features) if features else None
        query = """
            INSERT INTO predictions 
            (user_id, team1_id, team2_id, probability_team1, probability_team2,
             expected_score_team1, expected_score_team2, confidence, model_version, features, created_at)
            VALUES (:user_id, :team1_id, :team2_id, :prob1, :prob2, :score1, :score2, 
                    :confidence, :model_version, :features, NOW())
            RETURNING id
        """
        params = {
            "user_id": user_id,
            "team1_id": team1_id,
            "team2_id": team2_id,
            "prob1": prob1,
            "prob2": prob2,
            "score1": score1,
            "score2": score2,
            "confidence": confidence,
            "model_version": model_version,
            "features": features_json
        }
        result = self._execute_with_commit(query, params)
        return result.scalar()

    def get_by_id(self, prediction_id: int) -> Optional[Dict[str, Any]]:
        query = """
            SELECT 
                p.id,
                p.user_id,
                p.team1_id,
                p.team2_id,
                p.probability_team1,
                p.probability_team2,
                p.expected_score_team1,
                p.expected_score_team2,
                p.confidence,
                p.model_version,
                p.created_at,
                t1.full_name as team1_name,
                t1.abbreviation as team1_abbrev,
                t2.full_name as team2_name,
                t2.abbreviation as team2_abbrev
            FROM predictions p
            LEFT JOIN team t1 ON p.team1_id::text = t1.id
            LEFT JOIN team t2 ON p.team2_id::text = t2.id
            WHERE p.id = :id
        """
        return self._fetch_one(query, {"id": prediction_id})

    def get_by_user(self, user_id: int, skip: int = 0, limit: int = 50) -> List[Dict[str, Any]]:
        query = """
            SELECT 
                p.id,
                p.user_id,
                p.team1_id,
                p.team2_id,
                p.probability_team1,
                p.probability_team2,
                p.expected_score_team1,
                p.expected_score_team2,
                p.confidence,
                p.model_version,
                p.created_at,
                t1.full_name as team1_name,
                t1.abbreviation as team1_abbrev,
                t2.full_name as team2_name,
                t2.abbreviation as team2_abbrev
            FROM predictions p
            LEFT JOIN team t1 ON p.team1_id::text = t1.id
            LEFT JOIN team t2 ON p.team2_id::text = t2.id
            WHERE p.user_id = :user_id
            ORDER BY p.created_at DESC
            LIMIT :limit OFFSET :skip
        """
        return self._fetch_all(query, {"user_id": user_id, "limit": limit, "skip": skip})

    def evaluate_accuracy(self) -> Optional[float]:
        query = """
            SELECT 
                COUNT(*) as total,
                SUM(CASE 
                    WHEN (p.probability_team1 > 50 AND g.wl_home = 'W') OR
                         (p.probability_team1 < 50 AND g.wl_away = 'W')
                    THEN 1 ELSE 0 
                END) as correct
            FROM predictions p
            JOIN game g ON (CAST(p.team1_id AS TEXT) = g.team_id_home 
                        AND CAST(p.team2_id AS TEXT) = g.team_id_away)
            WHERE g.wl_home IS NOT NULL
        """
        result = self._fetch_one(query)
        if result and result.get("total", 0) > 0:
            return result["correct"] / result["total"]
        return None

    def get_stats(self) -> Dict[str, Any]:
        total = self._fetch_scalar("SELECT COUNT(*) FROM predictions") or 0
        users = self._fetch_scalar("SELECT COUNT(DISTINCT user_id) FROM predictions") or 0
        return {"total_predictions": total, "total_users": users}

    def count(self) -> int:
        return self._fetch_scalar("SELECT COUNT(*) FROM predictions") or 0