from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from services.auth_service import AuthService
from middleware.auth import get_current_user
import schemas
from scripts.auth import generate_token, TokenPayload  # изменено

router = APIRouter()

@router.post("/register", response_model=schemas.TokenResponse)
async def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """Регистрация нового пользователя"""
    service = AuthService(db)

    existing_user = service.get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже существует"
        )

    user = service.create_user(user_data)

    # Генерация токена
    token_payload = auth_utils.TokenPayload(user_id=user.id, email=user.email, role=user.role)
    access_token = auth_utils.generate_token(token_payload)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/login", response_model=schemas.TokenResponse)
async def login(login_data: schemas.UserLogin, db: Session = Depends(get_db)):
    """Вход в систему"""
    service = auth_service.AuthService(db)

    user = service.authenticate_user(login_data.email, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль"
        )

    # Генерация токена
    from auth import generate_token, TokenPayload
    token_payload = TokenPayload(user_id=user.id, email=user.email, role=user.role)
    access_token = generate_token(token_payload)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.get("/me", response_model=schemas.UserResponse)
async def get_me(request: Request, db: Session = Depends(get_db)):
    """Получение информации о текущем пользователе"""
    user_data = await get_current_user(request)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не авторизован"
        )

    service = auth_service.AuthService(db)
    user = service.get_user_by_id(user_data.user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )

    return user


@router.post("/init")
async def init_database(db: Session = Depends(get_db)):
    """Инициализация базы данных тестовыми пользователями"""
    service = auth_service.AuthService(db)
    result = service.init_database()
    return {"message": "База данных инициализирована", **result}