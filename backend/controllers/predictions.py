from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import logging
from sqlalchemy.exc import SQLAlchemyError
from starlette.concurrency import run_in_threadpool

from database import get_db
from services.ai_service import AIService
from services.forecast_context import ForecastDataUnavailable
from services.audit_service import AuditService
from services.user_stats_service import UserStatsService, evaluate_challenges
from middleware.auth import enforce_rate_limit, get_current_user, require_admin
from services.redis_service import redis_service
import schemas

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/predict", response_model=schemas.PredictionResponse)
async def predict(
        prediction_data: schemas.PredictionRequest,
        request: Request,
        db: Session = Depends(get_db)
):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if prediction_data.team1_id == prediction_data.team2_id:
        raise HTTPException(status_code=400, detail="Teams must be different")
    await enforce_rate_limit(request, "predict-user", limit=30, period=60, identity=user.user_id)
    return await run_in_threadpool(save_prediction, db, request, prediction_data, user.user_id)


def save_prediction(db: Session, request: Request, data: schemas.PredictionRequest, user_id: int):
    try:
        prediction = AIService(db).predict_match(
            data.team1_id, data.team2_id, user_id, include_context=data.include_context,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="One of the teams was not found") from exc
    except ForecastDataUnavailable as exc:
        raise HTTPException(status_code=503, detail="Not enough data for a prediction") from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Prediction storage unavailable") from exc

    try:
        AuditService(db).log(
            user_id=user_id, action="PREDICT", entity="Prediction", entity_id=int(prediction["id"]),
            details={"team1": prediction["team1"]["name"], "team2": prediction["team2"]["name"],
                     "probability": prediction["probabilityTeam1"]},
            ip_address=request.client.host if request.client else None,
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Audit insert failed for prediction %s", prediction["id"])
    return prediction


@router.get("/predict/preview")
async def predict_preview(
        request: Request,
        team1: int,
        team2: int,
        include_context: bool = False,
        db: Session = Depends(get_db),
):
    """Public, read-only preview for the home and match cards."""
    await enforce_rate_limit(request, "predict-preview", limit=90, period=60)
    if team1 == team2:
        raise HTTPException(status_code=400, detail="Teams must be different")

    return await run_in_threadpool(get_cached_preview, db, team1, team2, include_context)


def get_cached_preview(db: Session, team1: int, team2: int, include_context: bool = False):
    key = f"predict-preview:v2:{team1}:{team2}:{int(include_context)}"
    cached = redis_service.get(key)
    if cached is not None:
        return cached
    try:
        service = AIService(db, read_only=True)
        value = service.compute_preview(team1, team2, include_context=True) if include_context else service.compute_preview(team1, team2)
        value.pop("features", None)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="One of the teams was not found") from exc
    except ForecastDataUnavailable as exc:
        raise HTTPException(status_code=503, detail="Not enough data for a prediction") from exc
    redis_service.set(key, value, expire=60)
    return value


@router.get("/predict/stats")
async def get_model_stats(
        request: Request,
        db: Session = Depends(get_db)
):
    ai_svc = AIService(db)
    stats = await ai_svc.get_model_stats()
    return stats


@router.get("/predict/evaluate")
async def evaluate_model(
        request: Request,
        db: Session = Depends(get_db)
):

    ai_svc = AIService(db)
    accuracy = await ai_svc.evaluate_model()

    if accuracy is None:
        return {
            "accuracy": None,
            "message": "Not enough data to evaluate the model"
        }

    return {
        "accuracy": round(accuracy * 100, 1),
        "message": f"Model accuracy: {accuracy * 100:.1f}%"
    }


@router.get("/predictions/my", response_model=List[schemas.PredictionResponse])
async def get_my_predictions(
        request: Request,
        skip: int = 0,
        limit: int = 50,
        db: Session = Depends(get_db)
):
    user_data = await get_current_user(request)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    ai_svc = AIService(db)
    predictions = await ai_svc.get_user_predictions(
        user_data.user_id,
        skip=skip,
        limit=limit
    )
    return predictions


# Получение предсказание по id (существующего)

@router.get("/predictions/{prediction_id}", response_model=schemas.PredictionResponse)
async def get_prediction_by_id(
        prediction_id: int,
        request: Request,
        db: Session = Depends(get_db)
):
    user_data = await get_current_user(request)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    ai_svc = AIService(db)
    prediction = await ai_svc.get_prediction_by_id(prediction_id)

    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prediction with ID {prediction_id} was not found"
        )
    # Проверка прав доступа
    if prediction.get("user_id") != user_data.user_id and user_data.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this prediction"
        )

    return prediction


@router.post("/predictions/train/{match_id}")
async def train_on_match(
        match_id: int,
        request: Request,
        db: Session = Depends(get_db)
):
    user_data = await require_admin(request)

    ai_svc = AIService(db)
    audit_svc = AuditService(db)

    from services.match_service import MatchService
    match_svc = MatchService(db)
    match = match_svc.get_match_by_id(match_id)

    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Match with ID {match_id} was not found"
        )

    if match.get("status") != "finished" or match.get("home_score") is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The match is not finished or has no result yet"
        )

    result = await ai_svc.train_on_actual_result(match)

    audit_svc.log(
        user_id=user_data.user_id,
        action="TRAIN_MODEL",
        entity="Match",
        entity_id=match_id,
        details=result,
        ip_address=request.client.host if request.client else None
    )

    return {
        "message": "The model was trained on the actual result",
        "result": result
    }


# ============================================================
# Статистика пользователя, профиль, достижения и таблица лидеров
# ============================================================

@router.get("/predictions/my/stats")
async def get_my_stats(request: Request, db: Session = Depends(get_db)):
    """Сводная статистика профиля: точность, серии, опыт, последние 20 прогнозов и категории."""
    user_data = await get_current_user(request)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        svc = UserStatsService(db)
        return svc.get_user_stats(user_data.user_id)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not collect stats",
        )


@router.get("/challenges/my")
async def get_my_challenges(request: Request, db: Session = Depends(get_db)):
    """Прогресс достижений, рассчитанный по сохранённым прогнозам."""
    user_data = await get_current_user(request)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        svc = UserStatsService(db)
        stats = svc.get_user_stats(user_data.user_id)
        return evaluate_challenges(stats)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not calculate challenges",
        )


@router.get("/leaderboard")
async def get_leaderboard(
        request: Request,
        limit: int = 20,
        db: Session = Depends(get_db),
):
    """Рейтинг пользователей по опыту; доступен всем посетителям."""
    try:
        svc = UserStatsService(db)
        board = svc.get_leaderboard(limit=limit)
        try:
            user_data = await get_current_user(request)
            if user_data:
                for row in board:
                    if row["userId"] == user_data.user_id:
                        row["isYou"] = True
        except Exception:
            pass
        return board
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not collect leaderboard",
        )
