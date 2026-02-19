from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import schemas, services, dependencies

router = APIRouter()


@router.get("/", response_model=List[schemas.TeamResponse])
async def get_all_teams(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db)
):
    """Получение списка всех команд"""
    team_service = services.TeamService(db)
    teams = team_service.get_all_teams(skip=skip, limit=limit)
    return teams


@router.get("/{team_id}", response_model=schemas.TeamResponse)
async def get_team_by_id(team_id: int, db: Session = Depends(get_db)):
    """Получение команды по ID"""
    team_service = services.TeamService(db)
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
        db: Session = Depends(get_db),
        current_user=Depends(dependencies.require_admin_or_operator)
):
    """Создание новой команды (только для админов и операторов)"""
    team_service = services.TeamService(db)

    # Проверка уникальности названия
    existing = team_service.get_team_by_name(team_data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Команда с таким названием уже существует"
        )

    team = team_service.create_team(team_data, current_user.id)

    # Логирование
    audit_service = services.AuditService(db)
    audit_service.log(
        user_id=current_user.id,
        action="CREATE",
        entity="Team",
        entity_id=team.id,
        details={"name": team_data.name}
    )

    return team


@router.put("/{team_id}", response_model=schemas.TeamResponse)
async def update_team(
        team_id: int,
        team_data: schemas.TeamUpdate,
        db: Session = Depends(get_db),
        current_user=Depends(dependencies.require_admin_or_operator)
):
    """Обновление команды"""
    team_service = services.TeamService(db)

    team = team_service.get_team_by_id(team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Команда с ID {team_id} не найдена"
        )

    updated_team = team_service.update_team(team_id, team_data, current_user.id)

    audit_service = services.AuditService(db)
    audit_service.log(
        user_id=current_user.id,
        action="UPDATE",
        entity="Team",
        entity_id=team_id,
        details=team_data.model_dump(exclude_unset=True)
    )

    return updated_team


@router.delete("/{team_id}")
async def delete_team(
        team_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(dependencies.require_admin)
):
    """Удаление команды (только для админов)"""
    team_service = services.TeamService(db)

    team = team_service.get_team_by_id(team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Команда с ID {team_id} не найдена"
        )

    deleted_team = team_service.delete_team(team_id, current_user.id)

    audit_service = services.AuditService(db)
    audit_service.log(
        user_id=current_user.id,
        action="DELETE",
        entity="Team",
        entity_id=team_id,
        details={"name": team.name}
    )

    return {"message": "Команда удалена", "team": deleted_team}