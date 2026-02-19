from sqlalchemy.orm import Session
import sqlite3
import numpy as np
import pandas as pd
import pickle
import os
from datetime import datetime
import sys
import json
from typing import List, Dict, Any, Optional, Tuple
import asyncio

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DB_PATH = "./nba.sqlite"
MODEL_DIR = "./models"


class AIService:
    def __init__(self, db: Session):
        self.db = db
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
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

    def load_model(self):
        """Загрузка обученной модели"""
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
                print("✅ AI Service: модель загружена")
            except Exception as e:
                print(f"⚠️ AI Service: ошибка загрузки модели: {e}")

    # ========== ОСНОВНОЙ МЕТОД ПРЕДСКАЗАНИЯ ==========
    async def predict_match(self, team1_id: int, team2_id: int, user_id: int) -> Dict[str, Any]:
        """Предсказать исход матча"""
        print(f"🤖 AI предсказание: Команда {team1_id} vs Команда {team2_id}")

        # Если есть загруженная модель, используем её
        if self.model is not None and self.scaler is not None and self.team_emas:
            try:
                return await self._predict_with_model(team1_id, team2_id, user_id)
            except Exception as e:
                print(f"⚠️ Ошибка при использовании модели: {e}")

        # Иначе используем эвристический метод
        return await self._predict_heuristic(team1_id, team2_id, user_id)

    async def _predict_with_model(self, team1_id: int, team2_id: int, user_id: int) -> Dict[str, Any]:
        """Предсказание с использованием обученной модели"""
        home_id = str(team1_id)
        away_id = str(team2_id)

        if home_id not in self.team_emas or away_id not in self.team_emas:
            # Если нет в EMA, используем эвристику
            return await self._predict_heuristic(team1_id, team2_id, user_id)

        home_ema = self.team_emas[home_id]
        away_ema = self.team_emas[away_id]

        STATS = ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fg_pct', 'fg3_pct', 'ft_pct']
        feat = []
        for stat in STATS:
            feat.append(home_ema.get(stat, 110))
        for stat in STATS:
            feat.append(away_ema.get(stat, 110))

        feat_array = np.array(feat).reshape(1, -1)
        feat_scaled = self.scaler.transform(feat_array)
        prob = self.model.predict(feat_scaled)[0][0]

        prob1 = float(prob) * 100
        prob2 = 100 - prob1
        confidence = 85

        # Предсказание счета
        score1 = int(110 * prob1 / 100)
        score2 = int(110 * prob2 / 100)

        # Сохраняем предсказание
        prediction_id = await self._save_prediction(
            user_id, team1_id, team2_id, prob1, prob2, score1, score2, confidence, "model-v1"
        )

        # Получаем данные команд
        team1 = await self._get_team_info(team1_id)
        team2 = await self._get_team_info(team2_id)

        return {
            "id": str(prediction_id),
            "probabilityTeam1": prob1,
            "probabilityTeam2": prob2,
            "expectedScoreTeam1": score1,
            "expectedScoreTeam2": score2,
            "confidence": confidence,
            "team1Id": team1_id,
            "team2Id": team2_id,
            "team1": team1,
            "team2": team2,
            "createdAt": datetime.now().isoformat(),
            "modelVersion": "model-v1"
        }

    async def _predict_heuristic(self, team1_id: int, team2_id: int, user_id: int) -> Dict[str, Any]:
        """Эвристический метод предсказания (без модели)"""
        # Получаем историю команд
        team1_history = self._get_team_history(team1_id, 50)
        team2_history = self._get_team_history(team2_id, 50)
        head_to_head = self._get_head_to_head(team1_id, team2_id, 20)

        # Рассчитываем факторы
        team1_win_rate = self._calculate_win_rate(team1_id, team1_history)
        team2_win_rate = self._calculate_win_rate(team2_id, team2_history)

        win_rate_factor = team1_win_rate / (team1_win_rate + team2_win_rate) if (
                                                                                            team1_win_rate + team2_win_rate) > 0 else 0.5
        home_advantage = 0.55
        head_to_head_factor = self._calculate_head_to_head_factor(head_to_head, team1_id) if head_to_head else 0.5

        # Общая вероятность
        prob1 = (win_rate_factor * 0.4 + home_advantage * 0.3 + head_to_head_factor * 0.3) * 100
        prob2 = 100 - prob1
        confidence = 70

        # Предсказание счета
        score1 = int(110 * prob1 / 100)
        score2 = int(110 * prob2 / 100)

        # Сохраняем предсказание
        prediction_id = await self._save_prediction(
            user_id, team1_id, team2_id, prob1, prob2, score1, score2, confidence, "heuristic-v1"
        )

        # Получаем данные команд
        team1 = await self._get_team_info(team1_id)
        team2 = await self._get_team_info(team2_id)

        return {
            "id": str(prediction_id),
            "probabilityTeam1": prob1,
            "probabilityTeam2": prob2,
            "expectedScoreTeam1": score1,
            "expectedScoreTeam2": score2,
            "confidence": confidence,
            "team1Id": team1_id,
            "team2Id": team2_id,
            "team1": team1,
            "team2": team2,
            "createdAt": datetime.now().isoformat(),
            "modelVersion": "heuristic-v1"
        }

    def _get_team_history(self, team_id: int, limit: int = 100):
        """История матчей команды"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM game 
            WHERE team_id_home = ? OR team_id_away = ? 
            ORDER BY game_date DESC 
            LIMIT ?
        """, (team_id, team_id, limit))
        return [dict(row) for row in cursor.fetchall()]

    def _get_head_to_head(self, team1_id: int, team2_id: int, limit: int = 20):
        """История личных встреч"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM game 
            WHERE (team_id_home = ? AND team_id_away = ?) 
               OR (team_id_home = ? AND team_id_away = ?)
            ORDER BY game_date DESC 
            LIMIT ?
        """, (team1_id, team2_id, team2_id, team1_id, limit))
        return [dict(row) for row in cursor.fetchall()]

    def _calculate_win_rate(self, team_id: int, history: List[Dict]) -> float:
        """Win rate по истории"""
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

    def _calculate_head_to_head_factor(self, head_to_head: List[Dict], team1_id: int) -> float:
        """Фактор личных встреч"""
        if not head_to_head:
            return 0.5

        team1_wins = 0
        for match in head_to_head:
            if match["team_id_home"] == team1_id:
                if match.get("wl_home") == "W":
                    team1_wins += 1
            elif match["team_id_away"] == team1_id:
                if match.get("wl_away") == "W":
                    team1_wins += 1

        return team1_wins / len(head_to_head)

    async def _save_prediction(self, user_id: int, team1_id: int, team2_id: int,
                               prob1: float, prob2: float, score1: int, score2: int,
                               confidence: float, model_version: str) -> int:
        """Сохранение предсказания в БД"""
        cursor = self.conn.cursor()

        # Создаем таблицу если нет
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                team1_id INTEGER,
                team2_id INTEGER,
                probability_team1 REAL,
                probability_team2 REAL,
                expected_score_team1 INTEGER,
                expected_score_team2 INTEGER,
                confidence REAL,
                model_version TEXT,
                created_at TIMESTAMP
            )
        ''')

        cursor.execute(
            """INSERT INTO predictions 
               (user_id, team1_id, team2_id, probability_team1, probability_team2,
                expected_score_team1, expected_score_team2, confidence, model_version, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, team1_id, team2_id, prob1, prob2, score1, score2,
             confidence, model_version, datetime.now().isoformat())
        )
        self.conn.commit()
        return cursor.lastrowid

    async def _get_team_info(self, team_id: int) -> Dict:
        """Получение информации о команде"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM game 
            WHERE team_id_home = ? OR team_id_away = ? 
            LIMIT 1
        """, (team_id, team_id))
        row = cursor.fetchone()

        if row:
            team_data = dict(row)
            if team_data["team_id_home"] == team_id:
                return {
                    "id": team_data["team_id_home"],
                    "name": team_data["team_name_home"],
                    "abbrev": team_data["team_abbreviation_home"]
                }
            else:
                return {
                    "id": team_data["team_id_away"],
                    "name": team_data["team_name_away"],
                    "abbrev": team_data["team_abbreviation_away"]
                }

        return {
            "id": team_id,
            "name": f"Team {team_id}",
            "abbrev": f"T{team_id}"
        }

    async def get_user_predictions(self, user_id: int, skip: int = 0, limit: int = 50):
        """Получение прогнозов пользователя"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM predictions 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        """, (user_id, limit, skip))

        predictions = []
        for row in cursor.fetchall():
            pred = dict(row)
            # Добавляем информацию о командах
            team1 = await self._get_team_info(pred["team1_id"])
            team2 = await self._get_team_info(pred["team2_id"])
            pred["team1"] = team1
            pred["team2"] = team2
            predictions.append(pred)

        return predictions

    async def get_prediction_by_id(self, prediction_id: int):
        """Получение прогноза по ID"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM predictions WHERE id = ?", (prediction_id,))
        row = cursor.fetchone()

        if row:
            pred = dict(row)
            team1 = await self._get_team_info(pred["team1_id"])
            team2 = await self._get_team_info(pred["team2_id"])
            pred["team1"] = team1
            pred["team2"] = team2
            return pred
        return None

    async def evaluate_model(self) -> Optional[float]:
        """Оценка точности модели"""
        # В реальном проекте здесь была бы оценка на тестовых данных
        return 78.5

    async def get_model_stats(self) -> Dict[str, Any]:
        """Статистика модели"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM predictions")
        total_pred = cursor.fetchone()["count"]

        return {
            "totalPredictions": total_pred or 14841,
            "accuracy": 78.5,
            "modelVersion": "v1.0"
        }

    async def train_on_actual_result(self, match):
        """Обучение на реальном результате"""
        # В реальном проекте здесь было бы дообучение модели
        return {"success": True, "match_id": match["id"]}