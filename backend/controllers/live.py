"""Эндпоинты оперативных данных — тонкий слой над live_service.

Отдельный контроллер выделен потому, что оперативные данные поступают от ESPN,
используют собственное кеширование и не обращаются к базе SQL. Так проще
различать сетевые эндпоинты и локальные.
"""

from fastapi import APIRouter, HTTPException, Path, Query, status
from datetime import datetime
import logging
from typing import Optional

from services import live_service, nba_feed
from services.espn_provider import FeedUnavailable
from services.nba_catalog import normalize_abbrev

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/scoreboard")
def get_scoreboard(date: Optional[str] = Query(None, pattern=r"^[0-9]{8}$", description="YYYYMMDD; defaults to today")):
    """Счёт NBA за выбранный день с группами текущих, предстоящих и завершённых матчей."""
    if date:
        try:
            datetime.strptime(date, "%Y%m%d")
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Invalid scoreboard date") from exc
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
def get_match_details(event_id: str = Path(pattern=r"^[0-9]{1,20}$")):
    """Статистика матча ESPN, счёт по четвертям и лидеры команд."""
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
def get_top_news(limit: int = Query(16, ge=1, le=40)):
    """Заголовки новостей NBA от ESPN."""
    try:
        return live_service.get_top_news(limit=limit)
    except FeedUnavailable as exc:
        raise HTTPException(status_code=503, detail="News feed temporarily unavailable") from exc


@router.get("/news-feed")
def get_news_feed(limit: int = Query(40, ge=1, le=40), team: str | None = Query(None, pattern=r"^[A-Za-z]{2,4}$")):
    try:
        return live_service.get_news_feed(limit, {normalize_abbrev(team)} if team else None)
    except FeedUnavailable as exc:
        raise HTTPException(status_code=503, detail="News feed temporarily unavailable") from exc


@router.get("/roster/{team}")
def get_roster(team: str = Path(pattern=r"^[A-Za-z]{2,4}$")):
    try:
        roster = nba_feed.get_roster(team)
    except FeedUnavailable as exc:
        raise HTTPException(status_code=503, detail="Team roster temporarily unavailable") from exc
    if roster is None:
        raise HTTPException(status_code=404, detail="Team not found")
    return roster


@router.get("/news/{article_id}")
def get_article(article_id: str = Path(pattern=r"^[A-Za-z0-9_-]{1,100}$")):
    """Полный текст статьи ESPN: абзацы, изображения и связанные материалы."""
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
def get_highlights(limit: int = Query(12, ge=1, le=24)):
    """Воспроизводимые видеообзоры недавно завершившихся матчей.

    Собирает массив `videos` из сводок ESPN за последние дни и добавляет к каждому
    ролику данные соответствующего матча. Результат кешируется на 5 минут,
    чтобы снизить нагрузку при частых запросах интерфейса.
    """
    try:
        return live_service.get_recent_highlights(limit=limit)
    except Exception as e:
        logger.error(f"Highlights endpoint failed: {e}")
        return []
