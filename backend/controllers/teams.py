from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
import schemas
from services.team_service import TeamService
from services.audit_service import AuditService
from middleware.auth import require_admin_or_operator, require_admin, get_current_user  # добавлено

router = APIRouter()


@router.get("/", response_model=List[schemas.TeamResponse])
async def get_all_teams(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db)
):
    """Получение списка всех команд"""
    team_service = TeamService(db)
    return team_service.get_all_teams(skip=skip, limit=limit)


@router.get("/{team_id}", response_model=schemas.TeamResponse)
async def get_team_by_id(team_id: int, db: Session = Depends(get_db)):
    """Получение команды по ID"""
    team_service = TeamService(db)
    team = team_service.get_team_by_id(team_id)

    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Команда с ID {team_id} не найдена"
        )

    return team


@router.post("/", response_model=schemas.TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
        team_data: schemas.TeamCreate,
        request: Request,
        db: Session = Depends(get_db)
):
    """Создание новой команды (только для админов и операторов)"""
    # Проверка прав доступа
    user = await require_admin_or_operator(request)

    team_service = TeamService(db)

    existing = team_service.get_team_by_name(team_data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Команда с таким названием уже существует"
        )

    team = team_service.create_team(team_data, user.user_id)

    # Логирование
    audit_service = AuditService(db)
    audit_service.log(
        user_id=user.user_id,
        action="CREATE",
        entity="Team",
        entity_id=team["id"],
        details={"name": team_data.name}
    )

    return team


@router.put("/{team_id}", response_model=schemas.TeamResponse)
async def update_team(
        team_id: int,
        team_data: schemas.TeamUpdate,
        request: Request,
        db: Session = Depends(get_db)
):
    """Обновление команды"""
    # Проверка прав доступа
    user = await require_admin_or_operator(request)

    team_service = TeamService(db)

    team = team_service.get_team_by_id(team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Команда с ID {team_id} не найдена"
        )

    updated_team = team_service.update_team(team_id, team_data, user.user_id)

    audit_service = AuditService(db)
    audit_service.log(
        user_id=user.user_id,
        action="UPDATE",
        entity="Team",
        entity_id=team_id,
        details=team_data.dict(exclude_unset=True)
    )

    return updated_team


@router.delete("/{team_id}")
async def delete_team(
        team_id: int,
        request: Request,
        db: Session = Depends(get_db)
):
    """Удаление команды (только для админов)"""
    # Проверка прав доступа
    user = await require_admin(request)

    team_service = TeamService(db)

    team = team_service.get_team_by_id(team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Команда с ID {team_id} не найдена"
        )

    deleted_team = team_service.delete_team(team_id, user.user_id)

    audit_service = AuditService(db)
    audit_service.log(
        user_id=user.user_id,
        action="DELETE",
        entity="Team",
        entity_id=team_id,
        details={"name": team["name"]}
    )

    return {"message": "Команда удалена", "team": deleted_team}