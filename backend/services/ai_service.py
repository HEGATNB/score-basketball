from sqlalchemy.orm import Session
from sqlalchemy import text
import numpy as np
import os
from datetime import datetime, timezone
import logging
import math
import sys
from typing import List, Dict, Any, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from repositories.prediction_repository import PredictionRepository
from repositories.game_repository import GameRepository
from repositories.team_repository import TeamRepository
from config import config
from services import model_artifacts
from services.forecast_context import ForecastDataUnavailable, availability_scenario
from services.nba_catalog import BY_ABBREV, BY_NBA_ID, normalize_abbrev
from services.nba_feed import current_standings

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self, db: Session, *, read_only: bool = False):
        self.db = db
        self.prediction_repo = PredictionRepository(db)
        self.game_repo = GameRepository(db)
        self.team_repo = TeamRepository(db)

        self.weights = {
            "winRate": 0.25,
            "homeAdvantage": 0.15,
            "recentForm": 0.20,
            "headToHead": 0.15,
            "offensiveStrength": 0.10,
            "defensiveStrength": 0.10,
            "paceAdvantage": 0.05
        }

        self.artifacts = model_artifacts.artifacts
        self.team_emas = self.artifacts.team_emas if self.artifacts else {}
        if not read_only:
            self._create_predictions_table()

    def _create_predictions_table(self):
        try:
            self.db.execute(text("""
                CREATE TABLE IF NOT EXISTS predictions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id),
                    team1_id INTEGER,
                    team2_id INTEGER,
                    probability_team1 FLOAT,
                    probability_team2 FLOAT,
                    expected_score_team1 INTEGER,
                    expected_score_team2 INTEGER,
                    confidence FLOAT,
                    model_version VARCHAR(50),
                    features JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            self.db.commit()
            print("Таблица predictions создана/проверена в PostgreSQL")
        except Exception as e:
            print(f"Ошибка при создании таблицы predictions: {e}")
            self.db.rollback()

    def compute_preview(self, team1_id: int, team2_id: int, *, include_context: bool = False) -> Dict[str, Any]:
        home = self._get_team_info(team1_id)
        away = self._get_team_info(team2_id)
        if not home or not away:
            raise ValueError("One of the teams was not found")

        stats1, stats2 = None, None
        try:
            stats1 = self.get_team_stats_by_season(team1_id)
            stats2 = self.get_team_stats_by_season(team2_id)
        except Exception:
            logger.info("Archive stats unavailable for prediction")

        features = {}
        baseline = self._neural_probability(team1_id, team2_id, features)
        if baseline is not None:
            model_version = "model-v1"
            confidence = min(95, 70 + abs(baseline - 50))
        else:
            baseline = self._archive_probability(team1_id, team2_id, stats1, stats2)
            if baseline is not None:
                model_version = "statistical-v1"
            else:
                source = current_standings()
                records = []
                for team in (home, away):
                    identity = BY_ABBREV.get(normalize_abbrev(team.get("abbrev") or ""))
                    records.append(source.get(str(identity[1])) if identity else None)
                if not all(record and record["wins"] + record["losses"] > 0 for record in records):
                    raise ForecastDataUnavailable("No recent results are available for these teams")
                home_record, away_record = records
                rates = [(team["wins"] + 2) / (team["wins"] + team["losses"] + 4) for team in records]
                home_odds = (rates[0] / (1 - rates[0])) / (rates[1] / (1 - rates[1]))
                home_odds *= 1.15
                baseline = 100 * home_odds / (1 + home_odds)
                model_version = "espn-records-v1"
                stats1 = {"pts_pg": home_record["points_per_game"], "opp_pts_pg": home_record["points_against"]}
                stats2 = {"pts_pg": away_record["points_per_game"], "opp_pts_pg": away_record["points_against"]}
            confidence = 70 + min(20, abs(baseline - 50) / 2)

        probability = round(max(0, min(100, baseline)), 1)
        context = None
        if include_context:
            context = availability_scenario(probability, home.get("abbrev") or "", away.get("abbrev") or "")
            probability = context["adjustedTeam1"]
            features["context"] = context

        return {
            "team1Id": team1_id,
            "team2Id": team2_id,
            "team1": home,
            "team2": away,
            "probabilityTeam1": probability,
            "probabilityTeam2": round(100 - probability, 1),
            "expectedScoreTeam1": self._expected_points(stats1, stats2),
            "expectedScoreTeam2": self._expected_points(stats2, stats1),
            "confidence": round(confidence, 1),
            "modelVersion": model_version,
            "context": context,
            "features": features,
        }

    @staticmethod
    def _expected_points(team: dict | None, opponent: dict | None) -> int | None:
        offense = (team or {}).get("pts_pg")
        defense = (opponent or {}).get("opp_pts_pg")
        values = [float(value) for value in (offense, defense) if value and 0 < float(value) < math.inf]
        return round(sum(values) / len(values)) if values else None

    def _neural_probability(self, team1_id: int, team2_id: int, features: dict) -> float | None:
        home = self.team_emas.get(str(team1_id))
        away = self.team_emas.get(str(team2_id))
        if not self.artifacts or not home or not away:
            return None
        try:
            home_values = [float(home[stat]) for stat in config.STATS]
            away_values = [float(away[stat]) for stat in config.STATS]
            inputs = self.artifacts.scale(
                np.array([home_values], dtype=np.float32), np.array([away_values], dtype=np.float32),
            )
            probability = 100 * float(self.artifacts.model.predict(inputs, verbose=0)[0][0])
            if not math.isfinite(probability):
                return None
            features.update({f"home_{stat}": value for stat, value in zip(config.STATS, home_values)})
            features.update({f"away_{stat}": value for stat, value in zip(config.STATS, away_values)})
            return probability
        except Exception:
            logger.exception("Neural prediction failed")
            return None

    def _archive_probability(self, team1_id: int, team2_id: int,
                             stats1: dict | None, stats2: dict | None) -> float | None:
        try:
            history1 = self._get_team_history(team1_id, 20)
            history2 = self._get_team_history(team2_id, 20)
            if not history1 or not history2:
                return None
            head_to_head = self._get_head_to_head(team1_id, team2_id, 10)
            home_win_rate = self._calculate_win_rate(team1_id, history1)
            home_form = self._calculate_recent_form(team1_id, history1[:5])
            away_form = self._calculate_recent_form(team2_id, history2[:5])
            form = home_form / (home_form + away_form) if home_form + away_form > 0 else 0.5
            h2h = self._calculate_head_to_head_factor(head_to_head, team1_id) if head_to_head else 0.5

            strength = 0.5
            if stats1 and stats2:
                off_home = float(stats1.get("pts_pg") or 110)
                def_away = float(stats2.get("opp_pts_pg") or 110)
                def_home = float(stats1.get("opp_pts_pg") or 110)
                strength = (off_home / (off_home + def_away) + def_away / (def_home + def_away)) / 2

            return 100 * (home_win_rate * 0.3 + 0.55 * 0.2 + h2h * 0.15 + form * 0.2 + strength * 0.15)
        except Exception:
            logger.info("Archive history unavailable for prediction")
            return None

    def predict_match(self, team1_id: int, team2_id: int, user_id: int,
                      *, include_context: bool = False) -> Dict[str, Any]:
        value = self.compute_preview(team1_id, team2_id, include_context=include_context)
        prediction_id = self.prediction_repo.create(
            user_id=user_id, team1_id=team1_id, team2_id=team2_id,
            prob1=value["probabilityTeam1"], prob2=value["probabilityTeam2"],
            score1=value["expectedScoreTeam1"], score2=value["expectedScoreTeam2"],
            confidence=value["confidence"], model_version=value["modelVersion"], features=value["features"],
        )
        return {**value, "id": str(prediction_id), "createdAt": datetime.now(timezone.utc).isoformat()}

    def get_team_stats_by_season(self, team_id: str, season_id: str = None):
        return self.game_repo.get_team_stats(team_id, limit=30 if not season_id else 1000)

    def _get_team_history(self, team_id: str, limit: int = 100):
        return self.game_repo.get_team_history(team_id, limit=limit)

    def _get_head_to_head(self, team1_id: str, team2_id: str, limit: int = 20):
        return self.game_repo.get_head_to_head(team1_id, team2_id, limit=limit)

    def _calculate_win_rate(self, team_id: int, history: List[Dict]) -> float:
        team_id = str(team_id)
        if not history:
            return 0.5

        wins = 0
        for match in history:
            if str(match["team_id_home"]) == team_id:
                if match.get("wl_home") == "W":
                    wins += 1
            elif str(match["team_id_away"]) == team_id:
                if match.get("wl_away") == "W":
                    wins += 1

        return wins / len(history)

    def _calculate_recent_form(self, team_id: str, recent_matches: List[Dict]) -> float:
        team_id = str(team_id)
        if not recent_matches:
            return 0.5

        total_score = 0
        for i, match in enumerate(recent_matches):
            weight = 1.0 - (i * 0.1)
            if str(match.get("team_id_home")) == team_id:
                if match.get("wl_home") == "W":
                    total_score += 1.0 * weight
            elif str(match.get("team_id_away")) == team_id:
                if match.get("wl_away") == "W":
                    total_score += 1.0 * weight

        max_possible = sum([1.0 - (i * 0.1) for i in range(len(recent_matches))])
        return total_score / max_possible if max_possible > 0 else 0.5

    def _calculate_head_to_head_factor(self, head_to_head: List[Dict], team1_id: str) -> float:
        team1_id = str(team1_id)
        if not head_to_head:
            return 0.5

        team1_wins = 0
        for match in head_to_head:
            if str(match.get("team_id_home")) == team1_id:
                if match.get("wl_home") == "W":
                    team1_wins += 1
            elif str(match.get("team_id_away")) == team1_id:
                if match.get("wl_away") == "W":
                    team1_wins += 1

        return team1_wins / len(head_to_head)

    def _get_team_info(self, team_id: int) -> Optional[Dict]:
        try:
            result = self.db.execute(
                text("SELECT id, full_name AS name, abbreviation AS abbrev FROM team WHERE id = :team_id"),
                {"team_id": str(team_id)},
            ).mappings().first()
            if result:
                return dict(result)
        except Exception:
            self.db.rollback()

        identity = BY_NBA_ID.get(team_id)
        return {"id": team_id, "name": identity[3], "abbrev": identity[2]} if identity else None

    async def get_user_predictions(self, user_id: int, skip: int = 0, limit: int = 50):
        predictions_data = self.prediction_repo.get_by_user(user_id, skip=skip, limit=limit)

        predictions = []
        for pred in predictions_data:
            model_version = pred.get("model_version") or "statistical-v1"

            predictions.append({
                "id": str(pred["id"]),
                "probabilityTeam1": float(pred["probability_team1"]),
                "probabilityTeam2": float(pred["probability_team2"]),
                "expectedScoreTeam1": pred.get("expected_score_team1"),
                "expectedScoreTeam2": pred.get("expected_score_team2"),
                "confidence": float(pred["confidence"]),
                "createdAt": pred["created_at"].isoformat() if pred["created_at"] else None,
                "team1Id": int(pred["team1_id"]) if pred["team1_id"] else None,
                "team2Id": int(pred["team2_id"]) if pred["team2_id"] else None,
                "team1": {
                    "id": int(pred["team1_id"]) if pred["team1_id"] else None,
                    "name": pred["team1_name"] or f"Team {pred['team1_id']}",
                    "abbrev": pred["team1_abbrev"] or f"T{pred['team1_id']}"
                },
                "team2": {
                    "id": int(pred["team2_id"]) if pred["team2_id"] else None,
                    "name": pred["team2_name"] or f"Team {pred['team2_id']}",
                    "abbrev": pred["team2_abbrev"] or f"T{pred['team2_id']}"
                },
                "modelVersion": model_version
            })

        return predictions

    async def get_prediction_by_id(self, prediction_id: int):
        """Получение прогноза по ID из PostgreSQL"""
        try:
            print(f"Получение прогноза ID: {prediction_id}")

            pred = self.prediction_repo.get_by_id(prediction_id)

            if not pred:
                print(f"Прогноз с ID {prediction_id} не найден")
                return None

            print(f"Прогноз найден: ID={pred.get('id')}")

            prob1 = float(pred.get("probability_team1", 0))
            prob2 = float(pred.get("probability_team2", 0))
            confidence = float(pred.get("confidence", 0))

            model_version = pred.get("model_version") or "statistical-v1"

            response = {
                "id": str(pred["id"]),
                "user_id": pred.get("user_id"),
                "probabilityTeam1": round(prob1, 1),
                "probabilityTeam2": round(prob2, 1),
                "expectedScoreTeam1": pred.get("expected_score_team1"),
                "expectedScoreTeam2": pred.get("expected_score_team2"),
                "confidence": round(confidence, 1),
                "createdAt": pred["created_at"].isoformat() if pred.get("created_at") else None,
                "team1Id": int(pred["team1_id"]) if pred.get("team1_id") else None,
                "team2Id": int(pred["team2_id"]) if pred.get("team2_id") else None,
                "team1": {
                    "id": int(pred["team1_id"]) if pred.get("team1_id") else None,
                    "name": pred.get("team1_name") or f"Team {pred.get('team1_id')}",
                    "abbrev": pred.get("team1_abbrev") or f"T{pred.get('team1_id')}"
                },
                "team2": {
                    "id": int(pred["team2_id"]) if pred.get("team2_id") else None,
                    "name": pred.get("team2_name") or f"Team {pred.get('team2_id')}",
                    "abbrev": pred.get("team2_abbrev") or f"T{pred.get('team2_id')}"
                },
                "modelVersion": model_version,
                "context": (pred.get("features") or {}).get("context")
            }

            print(f"Отправка ответа для ID {prediction_id}")
            return response

        except Exception as e:
            print(f"Ошибка получения прогноза по ID {prediction_id}: {e}")
            import traceback
            traceback.print_exc()
            return None

    async def evaluate_model(self) -> Optional[float]:
        try:
            return self.prediction_repo.evaluate_accuracy()
        except Exception:
            logger.info("Prediction accuracy unavailable")
            return None

    async def get_model_stats(self) -> Dict[str, Any]:
        """Статистика модели из реальных данных"""
        try:
            stats = self.prediction_repo.get_stats()

            total_pred = stats.get("total_predictions", 0)
            total_users = stats.get("total_users", 0)

            # Используем count() для общего количества матчей
            total_games = self.game_repo.count()

            accuracy = await self.evaluate_model()

            return {
                "totalPredictions": total_pred,
                "totalUsers": total_users,
                "totalTrainingGames": total_games,
                "accuracy": round(accuracy * 100, 1) if accuracy is not None else None,
                "modelVersion": "v1.0",
                "lastUpdated": datetime.now().isoformat()
            }
        except Exception as e:
            print(f"Ошибка получения статистики модели: {e}")
            return {
                "totalPredictions": 0,
                "totalUsers": 0,
                "totalTrainingGames": 0,
                "accuracy": None,
                "modelVersion": "v1.0",
                "lastUpdated": datetime.now().isoformat()
            }

    async def train_on_actual_result(self, match):
        try:
            self.db.execute(
                text("""
                    INSERT INTO audit_logs (action, entity, entity_id, details, created_at)
                    VALUES ('TRAIN_MODEL', 'Match', :match_id, :details, :created_at)
                """),
                {
                    "match_id": match["id"],
                    "details": f"Training on actual result: {match['home_score']}-{match['away_score']}",
                    "created_at": datetime.utcnow()
                }
            )
            self.db.commit()
        except Exception as e:
            print(f"Ошибка логирования обучения: {e}")

        return {"success": True, "match_id": match["id"]}
