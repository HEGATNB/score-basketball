from controllers import admin
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import pandas as pd
import pickle
import os
import asyncio
from tensorflow.keras.models import load_model
from datetime import datetime
from typing import Optional
from pathlib import Path
from controllers import auth, teams, matches, predictions, players
from scripts.update_data import update_db_with_new_games
from scripts.train_model import train_model
from database import engine, Base, get_db
from sqlalchemy.orm import Session
from scheduler import data_updater
from services.model_metrics_service import ModelMetricsService
import atexit

app = FastAPI(
    title="HoopsAI API",
    description="API для прогнозирования баскетбольных матчей",
    version="1.0.0"
)

# CORS

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Переменные для нейросети

model = None
scaler = None
team_emas = {}
teams_df = None
STATS = ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fg_pct', 'fg3_pct', 'ft_pct']
MODEL_DIR = "./models"



class NeuralPredictionRequest(BaseModel):
    home_team: str
    away_team: str


class NeuralPredictionResponse(BaseModel):
    home_team: str
    away_team: str
    home_win_probability: float


# Загрузка нейросети
@app.on_event("startup")
def load_artifacts():
    global model, scaler, team_emas, teams_df
    model_path = os.path.join(MODEL_DIR, "model.h5")
    scaler_path = os.path.join(MODEL_DIR, "scaler.pkl")
    emas_path = os.path.join(MODEL_DIR, "team_emas.pkl")
    teams_path = os.path.join(MODEL_DIR, "teams.csv")

    if os.path.exists(model_path):
        try:
            model = load_model(model_path)
            with open(scaler_path, "rb") as f:
                scaler = pickle.load(f)
            with open(emas_path, "rb") as f:
                team_emas = pickle.load(f)
            if os.path.exists(teams_path):
                teams_df = pd.read_csv(teams_path)
            print("Neural network loaded successfully")
        except Exception as e:
            print(f"Error loading neural network: {e}")
    else:
        print("Neural network not found. Run train_model.py first.")


@app.on_event("startup")
async def start_scheduler():
    try:
        data_updater.start()
        print("Scheduler started")
    except Exception as e:
        print(f"Error starting scheduler: {e}")


@app.on_event("shutdown")
async def shutdown_scheduler():
    try:
        data_updater.stop()
        print("Scheduler stopped")
    except Exception as e:
        print(f"Error stopping scheduler: {e}")


# Эндпоинты для нейросети

@app.get("/api/neural/teams")
@app.get("/neural/teams")
def get_neural_teams():
    if teams_df is None:
        raise HTTPException(status_code=503, detail="Neural network not loaded")
    return teams_df[['team_abbrev', 'team_name']].drop_duplicates().to_dict(orient='records')


@app.post("/api/neural/predict")
@app.post("/neural/predict")
def neural_predict(request: NeuralPredictionRequest):
    if model is None or scaler is None or teams_df is None:
        raise HTTPException(status_code=503, detail="Neural network not loaded")

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

    return NeuralPredictionResponse(
        home_team=request.home_team,
        away_team=request.away_team,
        home_win_probability=float(prob)
    )


@app.post("/api/neural/retrain")
@app.post("/neural/retrain")
async def neural_retrain(background_tasks: BackgroundTasks):
    background_tasks.add_task(retrain_task)
    return {"message": "Retraining started in background. This may take several minutes."}


async def retrain_task():
    try:
        loop = asyncio.get_event_loop()
        print("Starting data update...")
        await loop.run_in_executor(None, update_db_with_new_games, None, 7)
        print("Data updated. Starting model training...")
        await loop.run_in_executor(None, train_model, None)
        print("Model trained. Reloading artifacts...")
        load_artifacts()
        print("Retraining completed successfully")
    except Exception as e:
        print(f"Error during retraining: {e}")


# Эндпоинты со статистикой модели

@app.get("/api/model/metrics/latest")
async def get_latest_model_metrics():
    try:
        from database import SessionLocal
        db = SessionLocal()
        metrics_service = ModelMetricsService(db)
        metrics = metrics_service.get_latest_metrics()
        db.close()

        if metrics:
            return metrics
        return {"message": "Model metrics not found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting metrics: {str(e)}")


@app.get("/api/model/metrics/history")
async def get_model_metrics_history(limit: int = 10):
    try:
        from database import SessionLocal
        db = SessionLocal()
        metrics_service = ModelMetricsService(db)
        history = metrics_service.get_metrics_history(limit)
        db.close()
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting history: {str(e)}")


@app.get("/api/model/metrics/stats")
async def get_model_stats():
    try:
        from database import SessionLocal
        db = SessionLocal()
        metrics_service = ModelMetricsService(db)
        stats = metrics_service.get_model_stats()
        db.close()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting stats: {str(e)}")


# Эндпоинты для администраторов

@app.get("/api/admin/update-status")
async def get_update_status(request: Request):
    from middleware.auth import require_admin
    await require_admin(request)

    return data_updater.get_status()


@app.post("/api/admin/force-data-update")
async def force_data_update(request: Request):
    from middleware.auth import require_admin
    await require_admin(request)

    asyncio.create_task(data_updater.update_data_daily())

    return {
        "message": "Data update started",
        "timestamp": datetime.now().isoformat()
    }


@app.post("/api/admin/force-model-retrain")
async def force_model_retrain(request: Request):
    from middleware.auth import require_admin
    await require_admin(request)

    asyncio.create_task(data_updater.retrain_model_weekly())

    return {
        "message": "Model retraining started",
        "timestamp": datetime.now().isoformat()
    }


# Проверка работы API

@app.get("/api/health")
@app.get("/health")
async def health_check():
    db_status = "unknown"
    try:
        from database import SessionLocal
        db = SessionLocal()
        db.execute("SELECT 1").scalar()
        db.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "OK",
        "timestamp": datetime.now().isoformat(),
        "neural_loaded": model is not None,
        "database": db_status,
        "service": "HoopsAI API",
        "scheduler_running": data_updater.scheduler.running if hasattr(data_updater, 'scheduler') else False
    }

@app.get("/api/debug/db-check")
@app.get("/debug/db-check")
async def check_database():
    try:
        from database import SessionLocal
        db = SessionLocal()

        tables = db.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """).fetchall()

        table_list = [t[0] for t in tables]

        game_count = 0
        sample_games = []

        if 'game' in table_list:
            game_count = db.execute("SELECT COUNT(*) as count FROM game").scalar()

            games = db.execute("""
                SELECT game_id, team_name_home, team_name_away, game_date 
                FROM game 
                LIMIT 3
            """).fetchall()

            for row in games:
                sample_games.append({
                    "game_id": row[0],
                    "home": row[1],
                    "away": row[2],
                    "date": str(row[3]) if row[3] else None
                })

        db.close()

        return {
            "database": "PostgreSQL",
            "connected": True,
            "tables": table_list,
            "games_count": game_count,
            "sample_games": sample_games
        }
    except Exception as e:
        return {
            "database": "PostgreSQL",
            "connected": False,
            "error": str(e)
        }


# ПОДКЛЮЧЕНИЕ КОНТРОЛЛЕРОВ

app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(teams.router, prefix="/api/teams", tags=["teams"])
app.include_router(matches.router, prefix="/api/matches", tags=["matches"])
app.include_router(predictions.router, prefix="/api", tags=["predictions"])
app.include_router(players.router, prefix="/api/players", tags=["players"])

# РОУТЫ БЕЗ API
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(teams.router, prefix="/teams", tags=["teams"])
app.include_router(matches.router, prefix="/matches", tags=["matches"])
app.include_router(predictions.router, prefix="", tags=["predictions"])
app.include_router(players.router, prefix="/players", tags=["players"])


@app.get("/")
async def root():
    return {
        "message": "HoopsAI API is running",
        "version": "1.0.0",
        "database": "PostgreSQL",
        "neural_loaded": model is not None,
        "scheduler": {
            "daily_update": "23:59",
            "weekly_retrain": "Sunday 00:30"
        },
        "endpoints": {
            "health": "/api/health or /health",
            "debug": "/api/debug/db-check or /debug/db-check",
            "model_metrics": {
                "latest": "/api/model/metrics/latest",
                "history": "/api/model/metrics/history",
                "stats": "/api/model/metrics/stats"
            },
            "admin": {
                "update_status": "/api/admin/update-status",
                "force_data_update": "POST /api/admin/force-data-update",
                "force_model_retrain": "POST /api/admin/force-model-retrain"
            },
            "neural": {
                "teams": "/api/neural/teams or /neural/teams",
                "predict": "POST /api/neural/predict or /neural/predict",
                "retrain": "POST /api/neural/retrain or /neural/retrain"
            },
            "auth": {
                "register": "POST /api/auth/register or /auth/register",
                "login": "POST /api/auth/login or /auth/login",
                "me": "GET /api/auth/me or /auth/me",
                "init": "POST /api/auth/init or /auth/init"
            },
            "teams": {
                "all": "GET /api/teams or /teams",
                "by_id": "GET /api/teams/{id} or /teams/{id}"
            },
            "matches": {
                "all": "GET /api/matches or /matches",
                "by_id": "GET /api/matches/{id} or /matches/{id}"
            },
            "predictions": {
                "predict": "POST /api/predict or /predict",
                "my": "GET /api/predictions/my or /predictions/my",
                "by_id": "GET /api/predictions/{id} or /predictions/{id}",
                "evaluate": "GET /api/predict/evaluate or /predict/evaluate",
                "stats": "GET /api/predict/stats or /predict/stats"
            },
            "players": {
                "all": "GET /api/players or /players",
                "by_id": "GET /api/players/{id} or /players/{id}",
                "by_team": "GET /api/players/team/{team_id} or /players/team/{team_id}"
            }
        },
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )