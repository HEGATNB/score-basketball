import redis
import json
import logging
from typing import Optional, Any
from time import time
from config import config

logger = logging.getLogger(__name__)

class RedisService:

    def __init__(self):
        options = {"decode_responses": True, "socket_connect_timeout": 2, "socket_timeout": 2}
        if config.REDIS_URL:
            self.client = redis.Redis.from_url(config.REDIS_URL, **options)
        else:
            self.client = redis.Redis(
                host=config.REDIS_HOST,
                port=config.REDIS_PORT,
                password=config.REDIS_PASSWORD,
                db=config.REDIS_DB,
                **options,
            )

    def is_available(self) -> bool:
        try:
            return bool(self.client.ping())
        except redis.RedisError:
            return False

    def blacklist_token(self, token_id: str, expires_in: int) -> bool:
        try:
            self.client.setex(f"blacklist:jti:{token_id}", expires_in, "1")
            return True
        except redis.RedisError:
            logger.warning("Could not revoke token")
            return False

    def revoke_all_user_tokens(self, user_id: int) -> bool:
        try:
            # Covers all tokens, even if the configured access-token TTL was reduced.
            self.client.setex(f"user_tokens_revoked:{user_id}", 86400, str(time()))
            return True
        except redis.RedisError:
            logger.warning("Could not revoke user sessions")
            return False

    def is_session_revoked(self, token_id: str, user_id: int, issued_at: float) -> bool:
        blacklisted, revoked_at = self.client.mget(
            f"blacklist:jti:{token_id}", f"user_tokens_revoked:{user_id}",
        )
        return bool(blacklisted or (revoked_at and issued_at <= float(revoked_at)))

    def check_rate_limit(self, key: str, limit: int, period: int) -> tuple[bool, int]:
        # Redis evaluates the increment and expiry together, even under concurrent requests.
        current, ttl = self.client.eval(
            """
            local count = redis.call('INCR', KEYS[1])
            if count == 1 or redis.call('TTL', KEYS[1]) < 0 then
                redis.call('EXPIRE', KEYS[1], ARGV[1])
            end
            return {count, redis.call('TTL', KEYS[1])}
            """,
            1, f"rate_limit:{key}", period,
        )
        return current <= limit, max(1, ttl)

    # Сбрасывает лимит запросов для ключа
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

    # Получает данные из кеша
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

    # Сохраняет данные в кеш
    def set(self, key: str, value: Any, expire: int = 300) -> bool:
        if not self.is_available():
            return False
        try:
            self.client.setex(key, expire, json.dumps(value, default=str))
            return True
        except Exception as e:
            logger.error(f"Error setting cache: {e}")
            return False

    # Удаляет данные из кеша
    def delete(self, key: str) -> bool:
        if not self.is_available():
            return False
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Error deleting from cache: {e}")
            return False

    # Очищает ключи по шаблону
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


redis_service = RedisService()
