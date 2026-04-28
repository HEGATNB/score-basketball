from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
from jose import jwt

from database import get_db
import schemas
from services.auth_service import AuthService
from services.audit_service import AuditService
from services.redis_service import redis_service
from scripts.auth import generate_token, TokenPayload, verify_token
from middleware.auth import extract_token_from_request, get_token_issued_at
from config import config

router = APIRouter()

@router.post("/login", response_model=schemas.TokenResponse)
async def login(
        request: Request,
        db: Session = Depends(get_db)
):
    try:
        body = await request.json()
        print(f"Получен запрос на логин: {body}")

        identifier = body.get("identifier") or body.get("email")
        password = body.get("password")

        if not identifier or not password:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Необходимо указать email/identifier и пароль"
            )
        # Ограничение запросов

        client_ip = request.client.host if request.client else "unknown"
        rate_key = f"login:{client_ip}:{identifier}"
        is_allowed, remaining, reset_time = redis_service.check_rate_limit(rate_key, limit=5, period=300)

        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Слишком много попыток входа. Попробуйте через {reset_time} секунд"
            )

        print(f"Попытка входа с identifier: {identifier}")

        service = AuthService(db)
        user = None

        # Поиск пользователя

        if "@" in identifier:
            user = service.authenticate_user(identifier, password)
        else:
            from sqlalchemy import text
            result = db.execute(
                text(
                    "SELECT id, email, name, username, role, password_hash, is_blocked, created_at FROM users WHERE username = :username OR name = :name"),
                {"username": identifier, "name": identifier}
            ).fetchone()

            if result:
                user_data = dict(result._mapping)
                from scripts.auth import verify_password
                if verify_password(password, user_data["password_hash"]):
                    user = {
                        "id": user_data["id"],
                        "email": user_data["email"],
                        "name": user_data["name"] or user_data["username"],
                        "role": user_data["role"],
                        "is_blocked": user_data["is_blocked"],
                        "created_at": user_data["created_at"]
                    }

        if not user:
            print(f"Неудачная попытка входа для {identifier}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный email/имя или пароль",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if user.get("is_blocked"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Пользователь заблокирован"
            )
        redis_service.reset_rate_limit(rate_key)
        payload = TokenPayload(
            user_id=user["id"],
            email=user["email"],
            role=user["role"]
        )
        token = generate_token(payload)
        redis_service.save_user_session(user["id"], token)

        print(f"Токен создан для {user['email']}")

        try:
            audit = AuditService(db)
            audit.log(
                user_id=user["id"],
                action="LOGIN",
                entity="User",
                entity_id=user["id"],
                ip_address=request.client.host if request.client else None
            )
        except Exception as e:
            print(f"Ошибка логирования: {e}")

        user_response = schemas.UserResponse(
            id=user["id"],
            email=user["email"],
            name=user.get("name", user["email"]),
            role=user["role"],
            created_at=user.get("created_at", datetime.utcnow())
        )

        return {
            "token": token,
            "token_type": "bearer",
            "user": user_response
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка в login: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )


@router.post("/logout")
async def logout(request: Request, db: Session = Depends(get_db)):
    from middleware.auth import get_current_user

    try:
        token = extract_token_from_request(request)
        user_data = await get_current_user(request)

        if token and redis_service.is_available():
            # Получаем время жизни токена

            try:
                payload = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"], options={"verify_exp": False})
                exp = payload.get("exp", 0)
                iat = payload.get("iat", 0)
                expires_in = max(exp - int(datetime.now().timestamp()), 0)
                # Добавляем токен в черный список

                if expires_in > 0:
                    redis_service.blacklist_token(token, expires_in)
                    print(f"Токен добавлен в черный список, истекает через {expires_in} сек")
            except Exception as e:
                print(f"Ошибка при получении expiration: {e}")
                redis_service.blacklist_token(token, 604800) # 7 дней

        if user_data:
            try:
                audit = AuditService(db)
                audit.log(
                    user_id=user_data.user_id,
                    action="LOGOUT",
                    entity="User",
                    entity_id=user_data.user_id,
                    ip_address=request.client.host if request.client else None
                )
            except Exception as e:
                print(f"Ошибка логирования выхода: {e}")
            print(f"Выход пользователя {user_data.user_id}")

        return {"message": "Выход выполнен успешно"}
    except Exception as e:
        print(f"Ошибка в logout: {e}")
        return {"message": "Выход выполнен успешно"}


@router.post("/logout-all")
async def logout_all_devices(request: Request, db: Session = Depends(get_db)):
    from middleware.auth import get_current_user

    user_data = await get_current_user(request)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не авторизован"
        )

    # Отзываем все токены пользователя

    if redis_service.is_available():
        redis_service.revoke_all_user_tokens(user_data.user_id)
    try:
        audit = AuditService(db)
        audit.log(
            user_id=user_data.user_id,
            action="LOGOUT_ALL",
            entity="User",
            entity_id=user_data.user_id,
            ip_address=request.client.host if request.client else None
        )
    except Exception as e:
        print(f"Ошибка логирования: {e}")

    return {"message": "Вы вышли из всех устройств"}


@router.get("/me", response_model=schemas.UserResponse)
async def get_current_user_info(
        request: Request,
        db: Session = Depends(get_db)
):
    from middleware.auth import get_current_user

    try:
        print("Запрос информации о текущем пользователе")
        user_data = await get_current_user(request)

        if not user_data:
            print("Пользователь не авторизован")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Не авторизован",
                headers={"WWW-Authenticate": "Bearer"},
            )

        print(f"Токен валиден. User ID: {user_data.user_id}")

        service = AuthService(db)
        user = service.get_user_by_id(user_data.user_id)

        if not user:
            print(f"Пользователь с ID {user_data.user_id} не найден в БД")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )

        print(f"Информация о пользователе получена: {user['email']}")

        return schemas.UserResponse(
            id=user["id"],
            email=user["email"],
            name=user.get("name", user["email"]),
            role=user["role"],
            created_at=user.get("created_at", datetime.utcnow())
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка в me: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )

@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
        request: Request,
        db: Session = Depends(get_db)
):
    try:
        body = await request.json()
        print(f"Получен запрос на регистрацию: {body}")

        email = body.get("email")
        password = body.get("password")
        name = body.get("name") or body.get("username") or email.split('@')[0]
        username = body.get("username") or name

        if not email or not password:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Email и пароль обязательны"
            )

        service = AuthService(db)

        existing = service.get_user_by_email(email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует"
            )

        user = service.create_user({
            "email": email,
            "password": password,
            "name": name,
            "username": username,
            "role": "user"
        })

        try:
            audit = AuditService(db)
            audit.log(
                user_id=user["id"],
                action="REGISTER",
                entity="User",
                entity_id=user["id"],
                ip_address=request.client.host if request.client else None
            )
        except Exception as e:
            print(f"Ошибка логирования: {e}")

        print(f"Пользователь зарегистрирован: {user['email']}")

        return schemas.UserResponse(
            id=user["id"],
            email=user["email"],
            name=user.get("name", user["email"]),
            role=user["role"],
            created_at=user.get("created_at", datetime.utcnow())
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка в register: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )


@router.post("/init")
async def init_database(db: Session = Depends(get_db)):
    try:
        print("Инициализация базы данных тестовыми пользователями")
        service = AuthService(db)
        result = service.init_database()
        print(f"Инициализация завершена: {result}")
        return {
            "message": "База данных инициализирована",
            "created_users": result.get("created_users", [])
        }
    except Exception as e:
        print(f"Ошибка в init: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )