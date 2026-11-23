"""Контроллер главной страницы: собирает избранные данные для панели сайта."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Any, Dict, List
import logging
from datetime import datetime, timezone

from database import get_db
from services.espn_provider import FeedUnavailable
from services.match_service import MatchService
from services.nba_feed import catalog_teams, get_portable_matches
from services.team_service import TeamService
from services.player_service import PlayerService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/summary")
def get_home_summary(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Возвращает данные главной страницы: матч, лучшие команды и игроки, основные показатели."""
    try:
        match_service = MatchService(db)
        team_service = TeamService(db)
        player_service = PlayerService(db)

        upcoming = match_service.get_all_matches({
            "status": "scheduled",
            "upcoming_from": datetime.now(timezone.utc).replace(tzinfo=None),
        }, limit=10)
        finished = match_service.get_all_matches({"status": "finished"}, limit=10)
        schedule_unavailable = False
        if not upcoming or not finished:
            try:
                live_matches = get_portable_matches(None, 0, 200)
                upcoming = upcoming or [game for game in reversed(live_matches) if game["status"] == "scheduled"][:10]
                finished = finished or [game for game in live_matches if game["status"] == "finished"][:10]
            except FeedUnavailable:
                schedule_unavailable = not upcoming and not finished
        featured_match = (upcoming[0] if upcoming else (finished[0] if finished else None))

        # Лучшие команды по числу побед
        archive_teams = team_service.get_all_teams(skip=0, limit=200)
        all_teams = archive_teams or catalog_teams()
        top_teams = sorted(all_teams, key=lambda t: (t.get("wins", 0) or 0), reverse=True)[:6]

        # Лучшие игроки по набранным очкам
        try:
            top_players = player_service.get_all_players(
                team_abbrev=None,
                season=None,
                search=None,
                min_games=15,
                sort_by="pts",
                sort_order="desc",
                skip=0,
                limit=16,
            ) if archive_teams else []
        except Exception as e:
            logger.warning(f"Player leaderboard fetch failed: {e}")
            top_players = []

        return {
            "featuredMatch": featured_match,
            "upcomingMatches": upcoming[:6],
            "recentMatches": finished[:6],
            "scheduleUnavailable": schedule_unavailable,
            "topTeams": top_teams,
            "topPlayers": top_players,
            "totals": {
                "teams": len(all_teams),
                "matches": len(upcoming) + len(finished),
                "upcoming": len(upcoming),
                "finished": len(finished),
            },
        }
    except Exception as e:
        logger.error(f"Home summary failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not assemble home summary",
        )


@router.get("/leaderboard/{category}")
async def get_leaderboard(
    category: str,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Рейтинг игроков лиги по выбранной категории: очки, подборы или передачи."""
    if category not in ("pts", "reb", "ast", "stl", "blk"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category must be one of pts, reb, ast, stl, blk",
        )

    try:
        player_service = PlayerService(db)
        leaders = player_service.get_top_players(
            category=category,
            min_games=15,
            limit=limit,
        )
        return leaders
    except Exception as e:
        logger.error(f"Leaderboard fetch failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Leaderboard failed",
        )


@router.get("/search")
def search_global(
    q: str = Query(..., min_length=2, description="Search term"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Глобальный поиск по командам и игрокам."""
    try:
        team_service = TeamService(db)
        player_service = PlayerService(db)

        archive_teams = team_service.get_all_teams(skip=0, limit=200)
        all_teams = archive_teams or catalog_teams()
        query_lc = q.strip().lower()
        team_hits = [
            t
            for t in all_teams
            if query_lc in (t.get("name", "") or "").lower()
            or query_lc in (t.get("abbrev", "") or "").lower()
            or query_lc in (t.get("city", "") or "").lower()
        ][:10]

        try:
            player_hits = player_service.get_all_players(
                team_abbrev=None,
                season=None,
                search=q,
                min_games=0,
                sort_by="pts",
                sort_order="desc",
                skip=0,
                limit=10,
            ) if archive_teams else []
        except Exception:
            player_hits = []

        return {
            "query": q,
            "teams": team_hits,
            "players": player_hits,
            "total": len(team_hits) + len(player_hits),
        }
    except Exception as e:
        logger.error(f"Global search failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Search failed",
        )
