from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from hashlib import sha256
import logging
from math import ceil
from time import time
from starlette.concurrency import run_in_threadpool
from typing import Optional

from database import get_db
import schemas
from services.auth_service import AuthService
from services.audit_service import AuditService
from services.redis_service import redis_service
from scripts.auth import generate_token, TokenPayload, verify_password
from middleware.auth import enforce_rate_limit, get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/login", response_model=schemas.TokenResponse)
async def login(
        request: Request,
        db: Session = Depends(get_db)
):
    try:
        body = await request.json()

        identifier = body.get("identifier") or body.get("email")
        password = body.get("password")

        if not isinstance(identifier, str) or not identifier or not isinstance(password, str) or not password:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Email/identifier and password are required"
            )
        account_key = sha256(identifier.casefold().encode("utf-8")).hexdigest()
        client_ip = request.client.host if request.client else "unknown"
        await enforce_rate_limit(request, "login-ip", limit=30, period=300)
        await enforce_rate_limit(
            request, "login-account", limit=5, period=300, identity=f"{client_ip}:{account_key}",
        )

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
                if verify_password(password, user_data["password_hash"]):
                    user = {
                        "id": user_data["id"],
                        "email": user_data["email"],
                        "name": user_data["name"] or user_data["username"],
                        "username": user_data["username"],
                        "role": user_data["role"],
                        "is_blocked": user_data["is_blocked"],
                        "created_at": user_data["created_at"]
                    }

        if not user:
            from sqlalchemy import text
            blocked = db.execute(
                text("""
                    SELECT is_blocked FROM users
                    WHERE email = :identifier OR username = :identifier OR name = :identifier
                    LIMIT 1
                """),
                {"identifier": identifier}
            ).fetchone()
            if blocked and blocked._mapping.get("is_blocked"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User is blocked"
                )

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email/username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if user.get("is_blocked"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is blocked"
            )
        await run_in_threadpool(redis_service.reset_rate_limit, f"login-account:{client_ip}:{account_key}")
        payload = TokenPayload(
            user_id=user["id"],
            email=user["email"],
            role=user["role"]
        )
        token = generate_token(payload)


        try:
            audit = AuditService(db)
            audit.log(
                user_id=user["id"],
                action="LOGIN",
                entity="User",
                entity_id=user["id"],
                ip_address=request.client.host if request.client else None
            )
        except Exception:
            logger.warning("Could not write authentication audit record")

        user_response = schemas.UserResponse(
            id=user["id"],
            email=user["email"],
            name=user.get("name", user["email"]),
            username=user.get("username"),
            role=user["role"],
            created_at=user.get("created_at", datetime.now(timezone.utc))
        )

        return {
            "token": token,
            "token_type": "bearer",
            "user": user_response
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Authentication request failed", extra={"error_type": type(e).__name__})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/logout")
async def logout(request: Request, db: Session = Depends(get_db)):
    user_data = await get_current_user(request)
    if user_data:
        remaining = max(1, ceil(user_data.expires_at - time()))
        if not await run_in_threadpool(redis_service.blacklist_token, user_data.token_id, remaining):
            raise HTTPException(status_code=503, detail="Could not revoke session")
        try:
            AuditService(db).log(
                user_id=user_data.user_id,
                action="LOGOUT",
                entity="User",
                entity_id=user_data.user_id,
                ip_address=request.client.host if request.client else None,
            )
        except Exception:
            logger.warning("Could not write authentication audit record")

    return {"message": "Signed out successfully"}


@router.post("/logout-all")
async def logout_all_devices(request: Request, db: Session = Depends(get_db)):
    user_data = await get_current_user(request)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    # Отзываем все токены пользователя

    if not await run_in_threadpool(redis_service.revoke_all_user_tokens, user_data.user_id):
        raise HTTPException(status_code=503, detail="Could not revoke sessions")
    try:
        audit = AuditService(db)
        audit.log(
            user_id=user_data.user_id,
            action="LOGOUT_ALL",
            entity="User",
            entity_id=user_data.user_id,
            ip_address=request.client.host if request.client else None
        )
    except Exception:
        logger.warning("Could not write authentication audit record")

    return {"message": "You have been signed out on all devices"}


@router.get("/me", response_model=schemas.UserResponse)
async def get_current_user_info(
        request: Request,
        db: Session = Depends(get_db)
):
    try:
        user_data = await get_current_user(request)

        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )


        service = AuthService(db)
        user = service.get_user_by_id(user_data.user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User was not found"
            )


        return schemas.UserResponse(
            id=user["id"],
            email=user["email"],
            name=user.get("name", user["email"]),
            username=user.get("username"),
            role=user["role"],
            created_at=user.get("created_at", datetime.now(timezone.utc))
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Authentication request failed", extra={"error_type": type(e).__name__})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.patch("/me", response_model=schemas.UserResponse)
async def update_profile(
        request: Request,
        db: Session = Depends(get_db)
):
    """Обновляет профиль текущего пользователя (имя, имя пользователя, email)."""
    user_data = await get_current_user(request)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        body = await request.json()
    except Exception:
        body = {}

    name = body.get("name")
    username = body.get("username")
    email = body.get("email")

    service = AuthService(db)
    try:
        user = service.update_profile(
            user_data.user_id,
            name=name,
            username=username,
            email=email,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not update profile",
        )

    try:
        audit = AuditService(db)
        audit.log(
            user_id=user_data.user_id,
            action="UPDATE_PROFILE",
            entity="User",
            entity_id=user_data.user_id,
            ip_address=request.client.host if request.client else None,
        )
    except Exception:
        logger.warning("Could not write authentication audit record")

    return schemas.UserResponse(
        id=user["id"],
        email=user["email"],
        name=user.get("name", user["email"]),
        username=user.get("username"),
        role=user["role"],
        created_at=user.get("created_at", datetime.now(timezone.utc)),
    )


@router.post("/change-password")
async def change_password(
        request: Request,
        db: Session = Depends(get_db)
):
    """Меняет пароль текущего пользователя; требуется указать его текущий пароль."""
    user_data = await get_current_user(request)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        body = await request.json()
    except Exception:
        body = {}

    current_password = body.get("currentPassword") or body.get("current_password")
    new_password = body.get("newPassword") or body.get("new_password")

    if not current_password or not new_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Current and new password are required",
        )

    service = AuthService(db)
    try:
        service.change_password(user_data.user_id, current_password, new_password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not change password",
        )

    try:
        audit = AuditService(db)
        audit.log(
            user_id=user_data.user_id,
            action="CHANGE_PASSWORD",
            entity="User",
            entity_id=user_data.user_id,
            ip_address=request.client.host if request.client else None,
        )
    except Exception:
        logger.warning("Could not write authentication audit record")

    return {"message": "Password updated"}


@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
        request: Request,
        db: Session = Depends(get_db)
):
    try:
        body = await request.json()

        email = body.get("email")
        password = body.get("password")
        if not isinstance(email, str) or not email or not isinstance(password, str) or not password:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Email and password are required"
            )

        await enforce_rate_limit(request, "register", limit=10, period=300)
        name = body.get("name") or body.get("username") or email.split("@")[0]
        username = body.get("username") or name

        service = AuthService(db)

        existing = service.get_user_by_email(email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists"
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
        except Exception:
            logger.warning("Could not write authentication audit record")


        return schemas.UserResponse(
            id=user["id"],
            email=user["email"],
            name=user.get("name", user["email"]),
            username=user.get("username"),
            role=user["role"],
            created_at=user.get("created_at", datetime.now(timezone.utc))
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Authentication request failed", extra={"error_type": type(e).__name__})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
