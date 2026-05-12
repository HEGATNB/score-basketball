from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
import schemas
from services.match_service import MatchService

router = APIRouter()


@router.get("", response_model=List[schemas.MatchResponse])
@router.get("/", response_model=List[schemas.MatchResponse])
async def get_all_matches(
        status: Optional[str] = Query(None, description="Filter by status (finished/scheduled)"),
        team_id: Optional[int] = Query(None, description="Filter by team ID"),
        skip: int = Query(0, ge=0),
        limit: int = Query(100, ge=1, le=1000),
        db: Session = Depends(get_db)
):
    try:
        match_service = MatchService(db)

        filters = {}
        if status:
            if status not in ["finished", "scheduled"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Status must be 'finished' or 'scheduled'"
                )
            filters["status"] = status

        matches = match_service.get_all_matches(filters, skip=skip, limit=limit)

        if team_id:
            matches = [m for m in matches if m["home_team_id"] == team_id or m["away_team_id"] == team_id]

        return matches

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_all_matches: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/{match_id}", response_model=schemas.MatchResponse)
async def get_match_by_id(
        match_id: int,
        db: Session = Depends(get_db)
):
    try:
        match_service = MatchService(db)
        match = match_service.get_match_by_id(match_id)

        if not match:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Match with ID {match_id} not found"
            )

        return match

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_match_by_id: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )