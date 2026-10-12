from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from database import get_db
from services.ai_service import AIService
from services.team_service import TeamService
from services.audit_service import AuditService
from services.user_stats_service import UserStatsService, evaluate_challenges
from middleware.auth import get_current_user, require_admin
import schemas

router = APIRouter()

@router.post("/predict", response_model=schemas.PredictionResponse)
async def predict(
        prediction_data: schemas.PredictionRequest,
        request: Request,
        db: Session = Depends(get_db)
):
    try:
        print(f" Получены данные: team1_id={prediction_data.team1_id}, team2_id={prediction_data.team2_id}")

        # Проверка авторизации
        user_data = await get_current_user(request)
        if not user_data:
            print("Пользователь не авторизован")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated"
            )
        print(f" Пользователь авторизован: ID={user_data.user_id}, Role={user_data.role}")

        ai_svc = AIService(db)
        team_svc = TeamService(db)
        audit_svc = AuditService(db)

        # Проверка существования команд
        print(f" Поиск команды 1: {prediction_data.team1_id}")
        team1 = team_svc.get_team_by_id(prediction_data.team1_id)
        print(f"   Результат: {team1}")

        print(f" Поиск команды 2: {prediction_data.team2_id}")
        team2 = team_svc.get_team_by_id(prediction_data.team2_id)
        print(f"   Результат: {team2}")

        if not team1 or not team2:
            print(f"Команды не найдены: team1={team1 is not None}, team2={team2 is not None}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"One of the teams was not found: {prediction_data.team1_id} or {prediction_data.team2_id}"
            )

        if prediction_data.team1_id == prediction_data.team2_id:
            print("Команды одинаковые")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Teams must be different"
            )
        try:
            prediction = await ai_svc.predict_match(
                prediction_data.team1_id,
                prediction_data.team2_id,
                user_data.user_id
            )
            print(f"Предсказание получено: ID={prediction['id']}")
            print(f"Вероятности: {prediction['probabilityTeam1']}% / {prediction['probabilityTeam2']}%")
        except Exception as e:
            print(f"AI prediction error: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Could not create prediction: {str(e)}"
            )
        # Логирование
        audit_svc.log(
            user_id=user_data.user_id,
            action="PREDICT",
            entity="Prediction",
            entity_id=int(prediction["id"]),
            details={
                "team1": team1.get("name") or team1.get("full_name"),
                "team2": team2.get("name") or team2.get("full_name"),
                "probability": prediction.get("probabilityTeam1"),
                "confidence": prediction.get("confidence")
            },
            ip_address=request.client.host if request.client else None
        )

        print(" Предсказание успешно")
        return prediction

    except HTTPException:
        raise
    except Exception as e:
        print(f"Необработанная ошибка в predict: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/predict/preview")
async def predict_preview(
        team1: int,
        team2: int,
        db: Session = Depends(get_db),
):
    """Предварительная оценка вероятностей нейросетью без авторизации и записи в базу.
    Used by the home/match cards to surface real model probabilities
    """
    if team1 == team2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Teams must be different",
        )
    try:
        ai_svc = AIService(db)
        return await ai_svc.compute_preview(team1, team2)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"preview err: {e}")
        raise HTTPException(
            status_code=500,
            detail="Could not load prediction preview",
        )


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
            detail=f"Could not collect stats: {e}",
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
            detail=f"Could not calculate challenges: {e}",
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
            detail=f"Could not collect leaderboard: {e}",
        )
