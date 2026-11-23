from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status as http_status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
import schemas
from services.match_service import MatchService
from services.nba_feed import get_portable_matches
from services.espn_provider import FeedUnavailable

router = APIRouter()


@router.get("", response_model=List[schemas.MatchResponse])
@router.get("/", response_model=List[schemas.MatchResponse])
def get_all_matches(
        status: Optional[str] = Query(None, description="Filter by status (finished/scheduled)"),
        team_id: Optional[int] = Query(None, description="Filter by team ID"),
        upcoming: bool = Query(False, description="Return future scheduled games, nearest first"),
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
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail="Status must be 'finished' or 'scheduled'"
                )
            filters["status"] = status

        if upcoming:
            if status and status != "scheduled":
                raise HTTPException(status_code=400, detail="Upcoming games must be scheduled")
            filters.update(status="scheduled", upcoming_from=datetime.now(timezone.utc).replace(tzinfo=None))
        if team_id is not None:
            filters["team_id"] = team_id

        matches = match_service.get_all_matches(filters, skip=skip, limit=limit)
        if not matches and skip == 0:
            matches = get_portable_matches(filters.get("status"), skip, limit, team_id=team_id)

        return matches

    except HTTPException:
        raise
    except FeedUnavailable as exc:
        raise HTTPException(status_code=503, detail="Schedule temporarily unavailable") from exc
    except Exception as e:
        print(f"Error in get_all_matches: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
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
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Match with ID {match_id} not found"
            )

        return match

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_match_by_id: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
