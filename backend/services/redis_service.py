import redis
import json
import logging
from typing import Optional, Any, Dict, List
from datetime import datetime, timedelta
from config import config

logger = logging.getLogger(__name__)


class RedisService:

    def __init__(self):
        self.client = None
        self._connect()

    def _connect(self):
        try:
            self.client = redis.Redis(
                host=config.REDIS_HOST,
                port=config.REDIS_PORT,
                password=config.REDIS_PASSWORD if config.REDIS_PASSWORD else None,
                db=config.REDIS_DB,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            self.client.ping()
            logger.info(f" Redis успешно подключен на {config.REDIS_HOST}:{config.REDIS_PORT}")
        except Exception as e:
            logger.warning(f"️ Ошибка подключения Redis {e}. Запуск без Redis.")
            self.client = None

    def is_available(self) -> bool:
        if not self.client:
            return False
        try:
            self.client.ping()
            return True
        except:
            return False

    # Добавляет токен в черный список

    def blacklist_token(self, token: str, expires_in: int = 604800) -> bool:
        if not self.is_available():
            return False
        try:
            key = f"blacklist:{token}"
            self.client.setex(key, expires_in, "1")
            logger.info(f"Token blacklisted: {token[:20]}...")
            return True
        except Exception as e:
            logger.error(f"Error blacklisting token: {e}")
            return False

    # Проверяет есть ли токен в черном списке

    def is_token_blacklisted(self, token: str) -> bool:
        if not self.is_available():
            return False
        try:
            key = f"blacklist:{token}"
            return self.client.exists(key) == 1
        except Exception as e:
            logger.error(f"Error checking blacklist: {e}")
            return False

    # Отзывает все токены пользователя

    def revoke_all_user_tokens(self, user_id: int, expires_in: int = 604800) -> bool:
        if not self.is_available():
            return False
        try:
            key = f"user_tokens_revoked:{user_id}"
            self.client.setex(key, expires_in, str(datetime.now().timestamp()))
            logger.info(f"All tokens revoked for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error revoking user tokens: {e}")
            return False

    # Проверяет не были ли отозваны токены пользователя после выдачи токена

    def is_user_tokens_revoked(self, user_id: int, token_issued_at: float) -> bool:
        if not self.is_available():
            return False
        try:
            key = f"user_tokens_revoked:{user_id}"
            revoked_at = self.client.get(key)
            if revoked_at:
                return token_issued_at < float(revoked_at)
            return False
        except Exception as e:
            logger.error(f"Error checking user tokens revoked: {e}")
            return False

    # Проверяет лимит запросов

    def check_rate_limit(self, key: str, limit: int = 5, period: int = 60) -> tuple:
        if not self.is_available():
            return True, limit, 0

        try:
            redis_key = f"rate_limit:{key}"
            current = self.client.get(redis_key)

            if current is None:
                self.client.setex(redis_key, period, 1)
                return True, limit - 1, period

            attempts = int(current)
            if attempts >= limit:
                ttl = self.client.ttl(redis_key)
                return False, 0, ttl

            self.client.incr(redis_key)
            return True, limit - (attempts + 1), self.client.ttl(redis_key)

        except Exception as e:
            logger.error(f"Error checking rate limit: {e}")
            return True, limit, 0

    # Сброс лимита запросов для ключа

    def reset_rate_limit(self, key: str) -> bool:
        if not self.is_available():
            return False
        try:
            redis_key = f"rate_limit:{key}"
            self.client.delete(redis_key)
            return True
        except Exception as e:
            logger.error(f"Error resetting rate limit: {e}")
            return False

    # Получение данных их хэша

    def get(self, key: str) -> Optional[Any]:
        if not self.is_available():
            return None
        try:
            data = self.client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Error getting from cache: {e}")
            return None
    # Сохранение в хеш
    def set(self, key: str, value: Any, expire: int = 300) -> bool:
        if not self.is_available():
            return False
        try:
            self.client.setex(key, expire, json.dumps(value, default=str))
            return True
        except Exception as e:
            logger.error(f"Error setting cache: {e}")
            return False

    # Удаление из кеша

    def delete(self, key: str) -> bool:
        if not self.is_available():
            return False
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Error deleting from cache: {e}")
            return False

    # Очистка ключей по шаблону

    def clear_pattern(self, pattern: str) -> int:
        if not self.is_available():
            return 0
        try:
            keys = self.client.keys(pattern)
            if keys:
                return self.client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Error clearing pattern: {e}")
            return 0

    # СЕССИИ ПОЛЬЗОВАТЕЛЕЙ

    # Сохраняет сессию пользователя

    def save_user_session(self, user_id: int, token: str, expires_in: int = 604800) -> bool:
        if not self.is_available():
            return False
        try:
            key = f"session:{user_id}:{token[:20]}"
            self.client.setex(key, expires_in, token)
            return True
        except Exception as e:
            logger.error(f"Error storing user session: {e}")
            return False
    # Получает все сессии пользователя

    def get_user_sessions(self, user_id: int) -> List[str]:
        if not self.is_available():
            return []
        try:
            keys = self.client.keys(f"session:{user_id}:*")
            sessions = []
            for key in keys:
                token = self.client.get(key)
                if token:
                    sessions.append(token)
            return sessions
        except Exception as e:
            logger.error(f"Error getting user sessions: {e}")
            return []

    # Отзывает сессию пользователя

    def revoke_user_session(self, user_id: int, token_prefix: str) -> bool:
        if not self.is_available():
            return False
        try:
            key = f"session:{user_id}:{token_prefix}"
            self.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Error revoking user session: {e}")
            return False


# Создаем глобальный экземпляр

redis_service = RedisService()