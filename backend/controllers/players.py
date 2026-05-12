from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import logging

from database import get_db
from services.player_service import PlayerService
import schemas

router = APIRouter()
logger = logging.getLogger(__name__)

# Роуты для получения игроков
@router.get("", response_model=List[schemas.PlayerResponse])
@router.get("/", response_model=List[schemas.PlayerResponse])
async def get_all_players(
    team: Optional[str] = Query(None, description="Filter by team abbreviation"),
    season: Optional[str] = Query(None, description="Filter by season"),
    search: Optional[str] = Query(None, description="Search by player name"),
    min_games: int = Query(0, ge=0, description="Minimum games played"),
    sort_by: str = Query("pts", regex="^(pts|reb|ast|player_name|gp|season)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    logger.info(f"Players request: team={team}, season={season}, search={search}")

    try:
        player_service = PlayerService(db)
        players = player_service.get_all_players(
            team_abbrev=team,
            season=season,
            search=search,
            min_games=min_games,
            sort_by=sort_by,
            sort_order=sort_order,
            skip=skip,
            limit=limit
        )

        logger.info(f"Found {len(players)} players")
        return players

    except Exception as e:
        logger.error(f"Error in get_all_players: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting players: {str(e)}"
        )

# Роут для получения сезонов
@router.get("/seasons", response_model=List[str])
async def get_seasons(db: Session = Depends(get_db)):
    try:
        player_service = PlayerService(db)
        return player_service.get_seasons()
    except Exception as e:
        logger.error(f"Error in get_seasons: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error getting seasons"
        )

# Роут для получения лучших игроков
@router.get("/top/{category}", response_model=List[Dict[str, Any]])
async def get_top_players(
    category: str,
    min_games: int = Query(10, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    logger.info(f"Top players request: category={category}, min_games={min_games}")

    try:
        player_service = PlayerService(db)
        players = player_service.get_top_players(
            category=category,
            min_games=min_games,
            limit=limit
        )
        return players

    except Exception as e:
        logger.error(f"Error in get_top_players: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting top players: {str(e)}"
        )

# Получение игрока по id
@router.get("/{player_id}", response_model=schemas.PlayerResponse)
async def get_player_by_id(
    player_id: int,
    db: Session = Depends(get_db)
):
    logger.info(f"Player by ID request: {player_id}")

    try:
        player_service = PlayerService(db)
        player = player_service.get_player_by_id(player_id)

        if not player:
            logger.warning(f"Player with ID {player_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Player with ID {player_id} not found"
            )

        return player

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_player_by_id: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting player: {str(e)}"
        )

# Получение команды по сокращению (аббривеатуре)
@router.get("/team/{team_abbrev}", response_model=List[schemas.PlayerResponse])
async def get_players_by_team(
    team_abbrev: str,
    db: Session = Depends(get_db)
):
    logger.info(f"Players by team request: {team_abbrev}")

    try:
        player_service = PlayerService(db)
        players = player_service.get_players_by_team(team_abbrev)

        logger.info(f"Found {len(players)} players for team {team_abbrev}")
        return players

    except Exception as e:
        logger.error(f"Error in get_players_by_team: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting players by team: {str(e)}"
        )