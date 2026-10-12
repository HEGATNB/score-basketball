"""Эндпоинты оперативных данных — тонкий слой над live_service.

Отдельный контроллер выделен потому, что оперативные данные поступают от ESPN,
используют собственное кеширование и не обращаются к базе SQL. Так проще
различать сетевые эндпоинты и локальные.
"""

from fastapi import APIRouter, HTTPException, Query, status
import logging
from typing import Optional

from services import live_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/scoreboard")
async def get_scoreboard(date: Optional[str] = Query(None, description="YYYYMMDD; defaults to today")):
    """Счёт NBA за выбранный день с группами текущих, предстоящих и завершённых матчей."""
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
async def get_top_news(limit: int = Query(16, ge=1, le=40)):
    """Заголовки новостей NBA от ESPN."""
    try:
        return live_service.get_top_news(limit=limit)
    except Exception as e:
        logger.error(f"News endpoint failed: {e}")
        # Новости не критичны: при сбое возвращаем пустой список вместо ошибки 5xx
        return []


@router.get("/news/{article_id}")
async def get_article(article_id: str):
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
async def get_highlights(limit: int = Query(12, ge=1, le=24)):
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
