from fastapi import Request, HTTPException, status
from redis import RedisError
from starlette.concurrency import run_in_threadpool

from scripts.auth import verify_token
from services.redis_service import redis_service


def extract_token_from_request(request: Request) -> str | None:
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    return token if scheme.lower() == "bearer" and token else None


async def get_current_user(request: Request):
    token = extract_token_from_request(request)
    payload = verify_token(token) if token else None
    if payload is None:
        return None

    try:
        revoked = await run_in_threadpool(
            redis_service.is_session_revoked, payload.token_id, payload.user_id, payload.issued_at,
        )
    except RedisError as exc:
        raise HTTPException(status_code=503, detail="Session service temporarily unavailable") from exc
    return None if revoked else payload


async def enforce_rate_limit(request: Request, scope: str, limit: int, period: int, identity=None):
    identity = identity if identity is not None else (request.client.host if request.client else "unknown")
    try:
        allowed, retry_after = await run_in_threadpool(
            redis_service.check_rate_limit, f"{scope}:{identity}", limit, period,
        )
    except RedisError as exc:
        raise HTTPException(status_code=503, detail="Rate limit service temporarily unavailable") from exc
    if not allowed:
        raise HTTPException(
            status_code=429, detail="Too many requests", headers={"Retry-After": str(retry_after)},
        )


# Проверка роли администратора
async def require_admin(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не авторизован",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен. Требуются права администратора"
        )
    return user


async def require_admin_or_operator(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не авторизован",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.role not in ["admin", "operator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен. Требуются права администратора или оператора"
        )
    return user