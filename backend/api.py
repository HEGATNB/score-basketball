from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import pandas as pd
import pickle
import os
import asyncio
from tensorflow.keras.models import load_model

# Импортируем функции из наших модулей
from backend.scripts.update_data import update_db_with_new_games
from backend.scripts.train_model import train_model

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for model and artifacts
model = None
scaler = None
team_emas = {}
teams_df = None
STATS = ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fg_pct', 'fg3_pct', 'ft_pct']
MODEL_DIR = "./models"
DB_PATH = "./nba.sqlite"

class PredictionRequest(BaseModel):
    home_team: str
    away_team: str

class PredictionResponse(BaseModel):
    home_team: str
    away_team: str
    home_win_probability: float

@app.on_event("startup")
def load_artifacts():
    global model, scaler, team_emas, teams_df
    model_path = os.path.join(MODEL_DIR, "model.h5")
    scaler_path = os.path.join(MODEL_DIR, "scaler.pkl")
    emas_path = os.path.join(MODEL_DIR, "team_emas.pkl")
    teams_path = os.path.join(MODEL_DIR, "teams.csv")

    if not os.path.exists(model_path):
        raise RuntimeError("Model not found. Run train_model.py first.")
    model = load_model(model_path)
    with open(scaler_path, "rb") as f:
        scaler = pickle.load(f)
    with open(emas_path, "rb") as f:
        team_emas = pickle.load(f)
    teams_df = pd.read_csv(teams_path)

@app.get("/teams")
def get_teams():
    """Return list of team abbreviations and names."""
    return teams_df[['team_abbrev', 'team_name']].drop_duplicates().to_dict(orient='records')

@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    home_row = teams_df[teams_df['team_abbrev'] == request.home_team]
    away_row = teams_df[teams_df['team_abbrev'] == request.away_team]
    if home_row.empty or away_row.empty:
        raise HTTPException(status_code=404, detail="Team not found")
    home_id = str(home_row.iloc[0]['team_id'])
    away_id = str(away_row.iloc[0]['team_id'])

    if home_id not in team_emas or away_id not in team_emas:
        raise HTTPException(status_code=404, detail="Team data not available")

    home_ema = team_emas[home_id]
    away_ema = team_emas[away_id]

    feat = []
    for stat in STATS:
        feat.append(home_ema[stat])
    for stat in STATS:
        feat.append(away_ema[stat])

    feat_array = np.array(feat).reshape(1, -1)
    feat_scaled = scaler.transform(feat_array)
    prob = model.predict(feat_scaled)[0][0]

    return PredictionResponse(
        home_team=request.home_team,
        away_team=request.away_team,
        home_win_probability=float(prob)
    )

async def retrain_task():
    """Фоновая задача: обновление данных и переобучение."""
    try:
        loop = asyncio.get_event_loop()
        print("Starting data update...")
        # Обновляем базу новыми играми (последние 7 дней)
        await loop.run_in_executor(None, update_db_with_new_games, DB_PATH, 7)
        print("Data update completed. Starting model training...")
        # Переобучаем модель
        await loop.run_in_executor(None, train_model, DB_PATH)
        print("Model training completed. Reloading artifacts...")
        # Перезагружаем артефакты
        load_artifacts()
        print("✅ Retraining completed successfully")
    except Exception as e:
        print(f"❌ Error during retraining: {e}")

@app.post("/retrain")
async def retrain(background_tasks: BackgroundTasks):
    """Запускает обновление данных и переобучение модели в фоне."""
    background_tasks.add_task(retrain_task)
    return {"message": "Retraining started in background. This may take several minutes."}

@app.get("/")
def root():
    return {"message": "NBA Game Predictor API"}