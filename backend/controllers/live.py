"""Live data endpoints — thin wrappers around live_service.

Why a separate controller: live data comes from ESPN, has its own caching, and
doesn't touch the SQL database. Keeping it isolated makes it obvious which
endpoints are network-dependent and which are local.
"""

from fastapi import APIRouter, HTTPException, Query, status
import logging
from typing import Optional

from services import live_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/scoreboard")
async def get_scoreboard(date: Optional[str] = Query(None, description="YYYYMMDD; defaults to today")):
    """Live NBA scoreboard for the given day. Returns live/upcoming/finished groups."""
    try:
        data = live_service.get_scoreboard(date)
        return data
    except Exception as e:
        logger.error(f"Scoreboard endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Live scoreboard temporarily unavailable",
        )


@router.get("/match/{event_id}")
async def get_match_details(event_id: str):
    """ESPN box-score, line-scores, leaders for one game."""
    try:
        data = live_service.get_match_details(event_id)
        if data is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Match {event_id} not found on live feed",
            )
        return data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Match details endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Live match details temporarily unavailable",
        )


@router.get("/news")
async def get_top_news(limit: int = Query(16, ge=1, le=40)):
    """ESPN NBA news headlines."""
    try:
        return live_service.get_top_news(limit=limit)
    except Exception as e:
        logger.error(f"News endpoint failed: {e}")
        # News is non-critical — return empty list rather than 5xx
        return []


@router.get("/news/{article_id}")
async def get_article(article_id: str):
    """Full body for a single ESPN article — paragraphs, images, related."""
    try:
        data = live_service.get_article(article_id)
        if data is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Article {article_id} not found",
            )
        return data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Article endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Article temporarily unavailable",
        )


@router.get("/highlights")
async def get_highlights(limit: int = Query(12, ge=1, le=24)):
    """Real playable highlight videos pulled from recently finished games.

    Aggregates the `videos` array from ESPN's per-match summary endpoint
    across the last few days and tags each clip with its parent matchup.
    Cached aggressively (5 min) on the backend so the frontend can poll cheaply.
    """
    try:
        return live_service.get_recent_highlights(limit=limit)
    except Exception as e:
        logger.error(f"Highlights endpoint failed: {e}")
        return []
