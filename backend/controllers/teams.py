from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
import schemas
from services.team_service import TeamService
from services.audit_service import AuditService
from middleware.auth import require_admin_or_operator, require_admin, get_current_user

router = APIRouter()

@router.get("", response_model=List[schemas.TeamResponse])
@router.get("/", response_model=List[schemas.TeamResponse])
async def get_all_teams(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db)
):
    team_service = TeamService(db)
    teams = team_service.get_all_teams(skip=skip, limit=limit)

    if not teams:
        return []

    return teams


@router.get("/{team_id}", response_model=schemas.TeamResponse)
async def get_team_by_id(team_id: int, db: Session = Depends(get_db)):
    team_service = TeamService(db)
    team = team_service.get_team_by_id(team_id)

    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team with ID {team_id} not found"
        )

    return team


@router.post("", response_model=schemas.TeamResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=schemas.TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
        team_data: schemas.TeamCreate,
        request: Request,
        db: Session = Depends(get_db)
):
    user = await require_admin_or_operator(request)

    team_service = TeamService(db)

    existing = team_service.get_team_by_name(team_data.full_name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team with this name already exists"
        )

    try:
        team = team_service.create_team(team_data, user.user_id)

        audit_service = AuditService(db)
        audit_service.log(
            user_id=user.user_id,
            action="CREATE",
            entity="Team",
            entity_id=team["id"],
            details={"name": team_data.full_name},
            ip_address=request.client.host if request.client else None
        )

        return team
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating team: {str(e)}"
        )


@router.put("/{team_id}", response_model=schemas.TeamResponse)
async def update_team(
        team_id: int,
        team_data: schemas.TeamUpdate,
        request: Request,
        db: Session = Depends(get_db)
):
    user = await require_admin_or_operator(request)

    team_service = TeamService(db)

    team = team_service.get_team_by_id(team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team with ID {team_id} not found"
        )

    try:
        updated_team = team_service.update_team(team_id, team_data, user.user_id)

        audit_service = AuditService(db)
        audit_service.log(
            user_id=user.user_id,
            action="UPDATE",
            entity="Team",
            entity_id=team_id,
            details=team_data.dict(exclude_unset=True),
            ip_address=request.client.host if request.client else None
        )

        return updated_team
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating team: {str(e)}"
        )


@router.delete("/{team_id}")
async def delete_team(
        team_id: int,
        request: Request,
        db: Session = Depends(get_db)
):
    user = await require_admin(request)

    team_service = TeamService(db)

    team = team_service.get_team_by_id(team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team with ID {team_id} not found"
        )

    try:
        deleted_team = team_service.delete_team(team_id, user.user_id)

        audit_service = AuditService(db)
        audit_service.log(
            user_id=user.user_id,
            action="DELETE",
            entity="Team",
            entity_id=team_id,
            details={"name": team["name"]},
            ip_address=request.client.host if request.client else None
        )

        return {"message": "Team deleted", "team": deleted_team}
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting team: {str(e)}"
        )