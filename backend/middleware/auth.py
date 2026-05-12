# backend/middleware/auth.py
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer
import sys
import os
from datetime import datetime
from jose import jwt  # вместо import jwt

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.auth import verify_token, TokenPayload
from services.redis_service import redis_service
from config import config

security = HTTPBearer()


def extract_token_from_request(request: Request) -> str | None:
    """Извлекает токен из заголовка Authorization"""
    authorization = request.headers.get("Authorization")
    if not authorization:
        return None
    if not authorization.startswith("Bearer "):
        return None
    return authorization[7:]


def get_token_issued_at(token: str) -> float | None:
    """Извлекает время выдачи токена из payload"""
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"], options={"verify_exp": False})
        return payload.get("iat", None)
    except:
        return None


async def get_current_user(request: Request):
    """Получение текущего пользователя из токена с проверкой черного списка"""
    token = extract_token_from_request(request)

    if not token:
        print("⚠️ Нет заголовка Authorization")
        return None

    print(f"🔑 Получен токен: {token[:20]}...")

    # Проверка в черном списке Redis
    if redis_service.is_available() and redis_service.is_token_blacklisted(token):
        print("❌ Токен в черном списке")
        return None

    payload = verify_token(token)

    if not payload:
        print("❌ Токен недействителен")
        return None

    # Проверка, не были ли отозваны все токены пользователя
    iat = get_token_issued_at(token)
    if iat and redis_service.is_available() and redis_service.is_user_tokens_revoked(payload.user_id, iat):
        print(f"❌ Токены пользователя {payload.user_id} были отозваны")
        return None

    print(f"✅ Пользователь аутентифицирован: ID={payload.user_id}, Email={payload.email}")
    return payload


async def require_admin(request: Request):
    """Проверка роли admin"""
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
    """Проверка роли admin или operator"""
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