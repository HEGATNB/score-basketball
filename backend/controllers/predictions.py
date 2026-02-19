from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
import json

from database import get_db
from services import ai_service, team_service, audit_service, match_service  # добавлен match_service
from middleware.auth import get_current_user, require_admin
import schemas

router = APIRouter()


@router.post("/predict", response_model=schemas.PredictionResponse)
async def predict(
        prediction_data: schemas.PredictionRequest,
        request: Request,
        db: Session = Depends(get_db)
):
    """Создание прогноза на матч"""
    # Проверка авторизации
    user_data = await get_current_user(request)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не авторизован"
        )

    ai_svc = ai_service.AIService(db)
    team_svc = team_service.TeamService(db)
    audit_svc = audit_service.AuditService(db)

    # Проверка существования команд
    team1 = team_svc.get_team_by_id(prediction_data.team1_id)
    team2 = team_svc.get_team_by_id(prediction_data.team2_id)

    if not team1 or not team2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Одна из команд не найдена"
        )

    if prediction_data.team1_id == prediction_data.team2_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Команды должны быть разными"
        )

    # Получение предсказания
    try:
        prediction = await ai_svc.predict_match(
            prediction_data.team1_id,
            prediction_data.team2_id,
            user_data.user_id
        )
    except Exception as e:
        print(f"⚠️ AI prediction error: {e}")
        # Используем демо-данные при ошибке
        prediction = {
            "probabilityTeam1": 55.5,
            "probabilityTeam2": 44.5,
            "expectedScoreTeam1": 112,
            "expectedScoreTeam2": 108,
            "confidence": 75,
            "modelVersion": "demo-v1"
        }

    # Логирование
    audit_svc.log(
        user_id=user_data.user_id,
        action="PREDICT",
        entity="Prediction",
        details={
            "team1": team1.name,
            "team2": team2.name,
            "probability": prediction.get("probabilityTeam1")
        }
    )

    return prediction


@router.get("/predictions/my", response_model=List[schemas.PredictionResponse])
async def get_my_predictions(
        request: Request,
        skip: int = 0,
        limit: int = 50,
        db: Session = Depends(get_db)
):
    """Получение истории прогнозов текущего пользователя"""
    user_data = await get_current_user(request)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не авторизован"
        )

    ai_svc = ai_service.AIService(db)
    predictions = await ai_svc.get_user_predictions(
        user_data.user_id,
        skip=skip,
        limit=limit
    )
    return predictions


@router.get("/predictions/{prediction_id}", response_model=schemas.PredictionResponse)
async def get_prediction_by_id(
        prediction_id: int,
        request: Request,
        db: Session = Depends(get_db)
):
    """Получение прогноза по ID"""
    user_data = await get_current_user(request)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не авторизован"
        )

    ai_svc = ai_service.AIService(db)
    prediction = await ai_svc.get_prediction_by_id(prediction_id)

    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Прогноз с ID {prediction_id} не найден"
        )

    # Проверка прав доступа
    if prediction.user_id != user_data.user_id and user_data.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет доступа к этому прогнозу"
        )

    return prediction


@router.post("/predictions/train/{match_id}")
async def train_on_match(
        match_id: int,
        request: Request,
        db: Session = Depends(get_db)
):
    """Обучение модели на реальном результате матча (только для админов)"""
    user_data = await get_current_user(request)
    if not user_data or user_data.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуются права администратора"
        )

    ai_svc = ai_service.AIService(db)
    match_svc = match_service.MatchService(db)
    audit_svc = audit_service.AuditService(db)

    # Проверка существования матча
    match = match_svc.get_match_by_id(match_id)

    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Матч с ID {match_id} не найден"
        )

    if match.status != "finished" or match.home_score is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Матч еще не завершен или не имеет результата"
        )

    # Обучение модели
    result = await ai_svc.train_on_actual_result(match)

    audit_svc.log(
        user_id=user_data.user_id,
        action="TRAIN_MODEL",
        entity="Match",
        entity_id=match_id,
        details=result
    )

    return {
        "message": "Модель успешно обучена на реальном результате",
        "result": result
    }


@router.get("/predict/evaluate")
async def evaluate_model(
        request: Request,
        db: Session = Depends(get_db)
):
    """Оценка точности модели"""
    user_data = await get_current_user(request)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не авторизован"
        )

    ai_svc = ai_service.AIService(db)
    accuracy = await ai_svc.evaluate_model()

    if accuracy is None:
        return {
            "accuracy": None,
            "message": "Недостаточно данных для оценки модели"
        }

    return {
        "accuracy": round(accuracy * 100, 2),
        "message": f"Точность модели: {accuracy * 100:.2f}%"
    }


@router.get("/predict/stats")
async def get_model_stats(
        request: Request,
        db: Session = Depends(get_db)
):
    """Получение статистики модели"""
    user_data = await get_current_user(request)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не авторизован"
        )

    ai_svc = ai_service.AIService(db)
    stats = await ai_svc.get_model_stats()
    return stats