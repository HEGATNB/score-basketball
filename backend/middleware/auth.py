from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer
from jose import JWTError
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.auth import verify_token, TokenPayload  # изменено

security = HTTPBearer()


async def get_current_user(request: Request):
    """Получение текущего пользователя из токена"""
    authorization = request.headers.get("Authorization")

    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization[7:]
    payload = verify_token(token)

    return payload


async def require_admin(request: Request):
    """Проверка роли admin"""
    user = await get_current_user(request)
    if not user or user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен. Требуются права администратора"
        )
    return user


async def require_admin_or_operator(request: Request):
    """Проверка роли admin или operator"""
    user = await get_current_user(request)
    if not user or user.role not in ["admin", "operator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен. Требуются права администратора или оператора"
        )
    return user