from sqlalchemy.orm import Session
from sqlalchemy import text
import numpy as np
import pandas as pd
import pickle
import os
from datetime import datetime, timedelta
import sys
from typing import List, Dict, Any, Optional
import asyncio
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from repositories.prediction_repository import PredictionRepository
from repositories.game_repository import GameRepository
from repositories.team_repository import TeamRepository

MODEL_DIR = "./models"


class AIService:
    def __init__(self, db: Session):
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

        # Загружаем модель если есть
        self.model = None
        self.scaler = None
        self.team_emas = {}
        self.load_model()

        # Создаем таблицу для предсказаний если нет
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

    def load_model(self):
        # Загрузка обученной модели
        model_path = os.path.join(MODEL_DIR, "model.h5")
        scaler_path = os.path.join(MODEL_DIR, "scaler.pkl")
        emas_path = os.path.join(MODEL_DIR, "team_emas.pkl")

        if os.path.exists(model_path):
            try:
                from tensorflow.keras.models import load_model
                self.model = load_model(model_path)
                with open(scaler_path, "rb") as f:
                    self.scaler = pickle.load(f)
                with open(emas_path, "rb") as f:
                    self.team_emas = pickle.load(f)
                print("AI Service: модель загружена")
            except Exception as e:
                print(f"AI Service: ошибка загрузки модели: {e}")

    async def predict_match(self, team1_id: int, team2_id: int, user_id: int) -> Dict[str, Any]:
        print(f"AI предсказание: Команда {team1_id} vs Команда {team2_id}")

        # Получаем данные о командах
        team1 = await self._get_team_info(team1_id)
        team2 = await self._get_team_info(team2_id)

        if not team1 or not team2:
            raise ValueError("Одна из команд не найдена в базе данных")

        # Если есть загруженная модель, используем её
        if self.model is not None and self.scaler is not None and self.team_emas:
            try:
                return await self._predict_with_model(team1_id, team2_id, user_id, team1, team2)
            except Exception as e:
                print(f"Ошибка при использовании модели: {e}")

        # Иначе используем статистический метод
        return await self._predict_statistical(team1_id, team2_id, user_id, team1, team2)

    async def _predict_with_model(self, team1_id: int, team2_id: int, user_id: int, team1: Dict, team2: Dict) -> Dict[
        str, Any]:
        # Предсказание с использованием обученной модели
        home_id = str(team1_id)
        away_id = str(team2_id)

        if home_id not in self.team_emas or away_id not in self.team_emas:
            return await self._predict_statistical(team1_id, team2_id, user_id, team1, team2)

        home_ema = self.team_emas[home_id]
        away_ema = self.team_emas[away_id]

        STATS = ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fg_pct', 'fg3_pct', 'ft_pct']
        feat = []
        features_dict = {}

        for stat in STATS:
            val = home_ema.get(stat, 110)
            feat.append(val)
            features_dict[f"home_{stat}"] = val

        for stat in STATS:
            val = away_ema.get(stat, 110)
            feat.append(val)
            features_dict[f"away_{stat}"] = val

        feat_array = np.array(feat).reshape(1, -1)
        feat_scaled = self.scaler.transform(feat_array)
        prob = self.model.predict(feat_scaled)[0][0]

        prob1 = float(prob) * 100
        prob2 = 100 - prob1

        # Рассчитываем уверенность на основе разницы вероятностей
        confidence = min(95, 70 + abs(prob1 - 50))

        # Предсказание счета на основе средних показателей
        avg_score = 110
        score1 = int(avg_score * prob1 / 100)
        score2 = int(avg_score * prob2 / 100)

        # Сохраняем предсказание
        prediction_id = self.prediction_repo.create(
            user_id=user_id,
            team1_id=team1_id,
            team2_id=team2_id,
            prob1=prob1,
            prob2=prob2,
            score1=score1,
            score2=score2,
            confidence=confidence,
            model_version="model-v1",
            features=features_dict
        )

        return {
            "id": str(prediction_id),
            "probabilityTeam1": round(prob1, 1),
            "probabilityTeam2": round(prob2, 1),
            "expectedScoreTeam1": score1,
            "expectedScoreTeam2": score2,
            "confidence": round(confidence, 1),
            "team1Id": team1_id,
            "team2Id": team2_id,
            "team1": team1,
            "team2": team2,
            "createdAt": datetime.now().isoformat(),
            "modelVersion": "model-v1"
        }

    async def _predict_statistical(self, team1_id: str, team2_id: str, user_id: int, team1: Dict, team2: Dict) -> Dict[
        str, Any]:
        #Статистический метод предсказания
        try:
            # Получаем статистику команд
            team1_stats = self.get_team_stats_by_season(team1_id)
            team2_stats = self.get_team_stats_by_season(team2_id)

            # Получаем историю матчей
            team1_history = self._get_team_history(team1_id, 20)
            team2_history = self._get_team_history(team2_id, 20)
            head_to_head = self._get_head_to_head(team1_id, team2_id, 10)

            # Рассчитываем факторы
            team1_win_rate = self._calculate_win_rate(team1_id, team1_history)
            team2_win_rate = self._calculate_win_rate(team2_id, team2_history)

            # Фактор преимущества дома
            home_advantage = 0.55

            # Фактор личных встреч
            head_to_head_factor = self._calculate_head_to_head_factor(head_to_head, team1_id) if head_to_head else 0.5

            # Фактор формы
            team1_form = self._calculate_recent_form(team1_id, team1_history[:5])
            team2_form = self._calculate_recent_form(team2_id, team2_history[:5])
            form_factor = team1_form / (team1_form + team2_form) if (team1_form + team2_form) > 0 else 0.5

            # Фактор силы
            if team1_stats and team2_stats:
                offensive_factor = team1_stats.get('pts_pg', 110) / (
                        team1_stats.get('pts_pg', 110) + team2_stats.get('opp_pts_pg', 110))
                defensive_factor = team2_stats.get('opp_pts_pg', 110) / (
                        team1_stats.get('opp_pts_pg', 110) + team2_stats.get('opp_pts_pg', 110))
                strength_factor = (offensive_factor + defensive_factor) / 2
            else:
                strength_factor = 0.5

            # Общая вероятность
            prob1 = (
                            team1_win_rate * 0.3 +
                            home_advantage * 0.2 +
                            head_to_head_factor * 0.15 +
                            form_factor * 0.2 +
                            strength_factor * 0.15
                    ) * 100

            prob2 = 100 - prob1
            confidence = 70 + min(20, abs(prob1 - 50) / 2)

            # Предсказание счета
            if team1_stats and team2_stats:
                score1 = int(team1_stats.get('pts_pg', 110) * (prob1 / 100))
                score2 = int(team2_stats.get('pts_pg', 110) * (prob2 / 100))
            else:
                score1 = int(110 * prob1 / 100)
                score2 = int(110 * prob2 / 100)

            # Сохраняем предсказание
            prediction_id = self.prediction_repo.create(
                user_id=user_id,
                team1_id=int(team1_id),
                team2_id=int(team2_id),
                prob1=prob1,
                prob2=prob2,
                score1=score1,
                score2=score2,
                confidence=confidence,
                model_version="statistical-v1",
                features=None
            )

            return {
                "id": str(prediction_id),
                "probabilityTeam1": round(prob1, 1),
                "probabilityTeam2": round(prob2, 1),
                "expectedScoreTeam1": score1,
                "expectedScoreTeam2": score2,
                "confidence": round(confidence, 1),
                "team1Id": int(team1_id),
                "team2Id": int(team2_id),
                "team1": team1,
                "team2": team2,
                "createdAt": datetime.now().isoformat(),
                "modelVersion": "statistical-v1"
            }

        except Exception as e:
            print(f"Ошибка в статистическом предсказании: {e}")
            import traceback
            traceback.print_exc()
            raise

    def get_team_stats_by_season(self, team_id: str, season_id: str = None):
        return self.game_repo.get_team_stats(team_id, limit=30 if not season_id else 1000)

    def _get_team_history(self, team_id: str, limit: int = 100):
        return self.game_repo.get_team_history(team_id, limit=limit)

    def _get_head_to_head(self, team1_id: str, team2_id: str, limit: int = 20):
        return self.game_repo.get_head_to_head(team1_id, team2_id, limit=limit)

    def _calculate_win_rate(self, team_id: int, history: List[Dict]) -> float:
        if not history:
            return 0.5

        wins = 0
        for match in history:
            if match["team_id_home"] == team_id:
                if match.get("wl_home") == "W":
                    wins += 1
            elif match["team_id_away"] == team_id:
                if match.get("wl_away") == "W":
                    wins += 1

        return wins / len(history)

    def _calculate_recent_form(self, team_id: str, recent_matches: List[Dict]) -> float:
        if not recent_matches:
            return 0.5

        total_score = 0
        for i, match in enumerate(recent_matches):
            weight = 1.0 - (i * 0.1)
            if match.get("team_id_home") == team_id:
                if match.get("wl_home") == "W":
                    total_score += 1.0 * weight
            elif match.get("team_id_away") == team_id:
                if match.get("wl_away") == "W":
                    total_score += 1.0 * weight

        max_possible = sum([1.0 - (i * 0.1) for i in range(len(recent_matches))])
        return total_score / max_possible if max_possible > 0 else 0.5

    def _calculate_head_to_head_factor(self, head_to_head: List[Dict], team1_id: str) -> float:
        if not head_to_head:
            return 0.5

        team1_wins = 0
        for match in head_to_head:
            if match.get("team_id_home") == team1_id:
                if match.get("wl_home") == "W":
                    team1_wins += 1
            elif match.get("team_id_away") == team1_id:
                if match.get("wl_away") == "W":
                    team1_wins += 1

        return team1_wins / len(head_to_head)

    async def _save_prediction(self, user_id: int, team1_id: int, team2_id: int,
                               prob1: float, prob2: float, score1: int, score2: int,
                               confidence: float, model_version: str, features: Dict = None) -> int:
        return self.prediction_repo.create(
            user_id=user_id,
            team1_id=team1_id,
            team2_id=team2_id,
            prob1=prob1,
            prob2=prob2,
            score1=score1,
            score2=score2,
            confidence=confidence,
            model_version=model_version,
            features=features
        )

    async def _get_team_info(self, team_id) -> Optional[Dict]:
        try:
            team_id_str = str(team_id)
            print(f"Поиск команды с ID: '{team_id_str}'")

            result = self.db.execute(
                text("""
                    SELECT 
                        id,
                        full_name as name,
                        abbreviation as abbrev
                    FROM team 
                    WHERE id = :team_id
                """),
                {"team_id": team_id_str}
            ).fetchone()

            if result:
                print(f"Найдена: {result.name}")
                return {
                    "id": result.id,
                    "name": result.name,
                    "abbrev": result.abbrev
                }
            else:
                print(f"Команда с ID '{team_id_str}' не найдена")
                return None

        except Exception as e:
            print(f"Ошибка получения информации о команде {team_id}: {e}")
            import traceback
            traceback.print_exc()
            return None

    async def get_user_predictions(self, user_id: int, skip: int = 0, limit: int = 50):
        predictions_data = self.prediction_repo.get_by_user(user_id, skip=skip, limit=limit)

        predictions = []
        for pred in predictions_data:
            model_version = pred.get("model_version") or "statistical-v1"

            predictions.append({
                "id": str(pred["id"]),
                "probabilityTeam1": float(pred["probability_team1"]),
                "probabilityTeam2": float(pred["probability_team2"]),
                "expectedScoreTeam1": int(pred["expected_score_team1"]),
                "expectedScoreTeam2": int(pred["expected_score_team2"]),
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
                "expectedScoreTeam1": int(pred.get("expected_score_team1", 0)),
                "expectedScoreTeam2": int(pred.get("expected_score_team2", 0)),
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
                "modelVersion": model_version
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
            result = self.db.execute(
                text("""
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
                """)
            ).fetchone()

            if result and result[0] > 0:
                accuracy = result[1] / result[0]
                return accuracy
        except Exception as e:
            print(f"Ошибка оценки модели: {e}")

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
                "accuracy": round(accuracy * 100, 1) if accuracy else None,
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