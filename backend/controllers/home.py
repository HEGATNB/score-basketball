"""Home / dashboard data controller — aggregates featured content for the landing page."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Optional
import logging

from database import get_db
from services.match_service import MatchService
from services.team_service import TeamService
from services.player_service import PlayerService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/summary")
async def get_home_summary(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """One-shot landing page payload: featured match, top teams, top players, headline stats."""
    try:
        match_service = MatchService(db)
        team_service = TeamService(db)
        player_service = PlayerService(db)

        # Featured: pick the most recent upcoming match, fall back to recent finished
        all_matches = match_service.get_all_matches(filters={}, skip=0, limit=20)
        upcoming = [m for m in all_matches if m.get("status") != "finished"]
        finished = [m for m in all_matches if m.get("status") == "finished"]
        featured_match = (upcoming[0] if upcoming else (finished[0] if finished else None))

        # Top teams by wins
        all_teams = team_service.get_all_teams(skip=0, limit=200)
        top_teams = sorted(all_teams, key=lambda t: (t.get("wins", 0) or 0), reverse=True)[:6]

        # Top players (scoring leaders)
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
            )
        except Exception as e:
            logger.warning(f"Player leaderboard fetch failed: {e}")
            top_players = []

        return {
            "featuredMatch": featured_match,
            "upcomingMatches": upcoming[:6],
            "recentMatches": finished[:6],
            "topTeams": top_teams,
            "topPlayers": top_players,
            "totals": {
                "teams": len(all_teams),
                "matches": len(all_matches),
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
    """League leaderboard for the given category — points, rebounds, assists."""
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
            detail=f"Leaderboard failed: {str(e)}",
        )


@router.get("/search")
async def search_global(
    q: str = Query(..., min_length=2, description="Search term"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Global search across teams and players."""
    try:
        team_service = TeamService(db)
        player_service = PlayerService(db)

        all_teams = team_service.get_all_teams(skip=0, limit=200)
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
            )
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
