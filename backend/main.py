from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import numpy as np
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from config import config
from controllers import admin, auth, home, live, matches, players, predictions, teams
from database import get_db
from middleware.auth import enforce_rate_limit, require_admin, require_admin_or_operator
from scheduler import data_updater
from scripts.auth import validate_jwt_config
from services import model_artifacts
from services.model_metrics_service import ModelMetricsService

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_jwt_config()
    await run_in_threadpool(model_artifacts.reload_artifacts)
    await data_updater.start()
    try:
        yield
    finally:
        await data_updater.stop()


app = FastAPI(
    title="HoopsAI API",
    description="API for basketball match prediction",
    version="1.0.0",
    docs_url="/docs" if config.is_development else None,
    redoc_url="/redoc" if config.is_development else None,
    openapi_url="/openapi.json" if config.is_development else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


class NeuralPredictionRequest(BaseModel):
    home_team: str
    away_team: str


class NeuralPredictionResponse(BaseModel):
    home_team: str
    away_team: str
    home_win_probability: float


@app.get("/api/neural/teams")
@app.get("/neural/teams")
def get_neural_teams():
    snapshot = model_artifacts.artifacts
    if snapshot is None or snapshot.teams is None:
        raise HTTPException(status_code=503, detail="Neural network not loaded")
    return snapshot.teams[["team_abbrev", "team_name"]].drop_duplicates().to_dict(orient="records")


async def limit_neural_prediction(request: Request):
    await enforce_rate_limit(request, "predict-neural", limit=30, period=60)


@app.post("/api/neural/predict", dependencies=[Depends(limit_neural_prediction)])
@app.post("/neural/predict", dependencies=[Depends(limit_neural_prediction)])
def neural_predict(request: NeuralPredictionRequest):
    snapshot = model_artifacts.artifacts
    if snapshot is None or snapshot.teams is None:
        raise HTTPException(status_code=503, detail="Neural network not loaded")

    teams_df = snapshot.teams
    home_row = teams_df[teams_df["team_abbrev"] == request.home_team]
    away_row = teams_df[teams_df["team_abbrev"] == request.away_team]
    if home_row.empty or away_row.empty:
        raise HTTPException(status_code=404, detail="Team not found")

    home_id = str(home_row.iloc[0]["team_id"])
    away_id = str(away_row.iloc[0]["team_id"])
    if home_id not in snapshot.team_emas or away_id not in snapshot.team_emas:
        raise HTTPException(status_code=404, detail="Team data not available")

    home = np.array([[snapshot.team_emas[home_id][stat] for stat in config.STATS]], dtype=np.float32)
    away = np.array([[snapshot.team_emas[away_id][stat] for stat in config.STATS]], dtype=np.float32)
    probability = snapshot.model.predict(snapshot.scale(home, away), verbose=0)[0][0]
    return NeuralPredictionResponse(
        home_team=request.home_team,
        away_team=request.away_team,
        home_win_probability=float(probability),
    )


@app.get("/api/model/metrics/latest")
def get_latest_model_metrics(db: Session = Depends(get_db)):
    return ModelMetricsService(db).get_latest_metrics() or {"message": "Model metrics not found"}


@app.get("/api/model/metrics/history")
def get_model_metrics_history(limit: int = Query(10, ge=1, le=100), db: Session = Depends(get_db)):
    return ModelMetricsService(db).get_metrics_history(limit)


@app.get("/api/model/metrics/stats")
def get_model_stats(db: Session = Depends(get_db)):
    return ModelMetricsService(db).get_model_stats()


@app.get("/api/admin/update-status", dependencies=[Depends(require_admin_or_operator)])
def get_update_status():
    return data_updater.get_status()


@app.post("/api/admin/force-data-update", status_code=202)
async def force_data_update(request: Request, user=Depends(require_admin_or_operator)):
    return await launch_job(request, user.user_id, "data-update")


@app.post("/api/admin/force-model-retrain", status_code=202)
@app.post("/api/neural/retrain", status_code=202)
@app.post("/neural/retrain", status_code=202)
async def force_model_retrain(request: Request, user=Depends(require_admin)):
    return await launch_job(request, user.user_id, "model-retrain")


async def launch_job(request: Request, user_id: int, name: str):
    if data_updater.is_busy:
        raise HTTPException(status_code=409, detail="A data or model job is already running")
    await enforce_rate_limit(request, name, limit=1, period=60, identity=user_id)
    if not data_updater.queue_job(name, user_id, request.url.path in {"/api/neural/retrain", "/neural/retrain"}):
        raise HTTPException(status_code=409, detail="A data or model job is already running")
    return {"message": "Job started", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/health")
@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1")).scalar()
    except Exception as exc:
        logger.warning("Database health check failed", extra={"error_type": type(exc).__name__})
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return {"status": "OK"}


# ПОДКЛЮЧЕНИЕ КОНТРОЛЛЕРОВ

app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(teams.router, prefix="/api/teams", tags=["teams"])
app.include_router(matches.router, prefix="/api/matches", tags=["matches"])
app.include_router(predictions.router, prefix="/api", tags=["predictions"])
app.include_router(players.router, prefix="/api/players", tags=["players"])
app.include_router(home.router, prefix="/api/home", tags=["home"])
app.include_router(live.router, prefix="/api/live", tags=["live"])

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
        "neural_loaded": model_artifacts.artifacts is not None,
        "scheduler": {
            "daily_update": "23:59",
            "weekly_retrain": "Sunday 00:30"
        },
        "endpoints": {
            "health": "/api/health or /health",
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
                "me": "GET /api/auth/me or /auth/me"
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
        "docs": app.docs_url
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=config.is_development
    )
