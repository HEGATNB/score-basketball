from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import math
import re
from uuid import uuid4

import bcrypt
import jwt

from config import config

ALGORITHM = "HS256"


def parse_expires_in(value: str) -> int:
    duration = re.fullmatch(r"([1-9][0-9]*)([mhd])", value)
    if duration is None:
        raise ValueError("JWT_EXPIRES_IN must be a positive duration in minutes, hours or days")
    amount, unit = duration.groups()
    minutes = int(amount) * {"m": 1, "h": 60, "d": 1440}[unit]
    if minutes > 1440:
        raise ValueError("JWT_EXPIRES_IN must be at most one day")
    return minutes


def validate_jwt_config() -> None:
    if len(config.JWT_SECRET.strip().encode("utf-8")) < 32:
        raise ValueError("JWT_SECRET must be set to a random secret of at least 32 bytes")
    parse_expires_in(config.JWT_EXPIRES_IN)


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except (AttributeError, TypeError, ValueError):
        return False


@dataclass(frozen=True)
class TokenPayload:
    user_id: int
    email: str
    role: str
    issued_at: float = 0
    expires_at: int = 0
    token_id: str = ""


def generate_token(payload: TokenPayload) -> str:
    validate_jwt_config()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=parse_expires_in(config.JWT_EXPIRES_IN))
    return jwt.encode(
        {
            "sub": str(payload.user_id),
            "email": payload.email,
            "role": payload.role,
            "iat": now.timestamp(),
            "exp": expires,
            "jti": uuid4().hex,
        },
        config.JWT_SECRET,
        algorithm=ALGORITHM,
    )


def verify_token(token: str) -> TokenPayload | None:
    validate_jwt_config()
    try:
        claims = jwt.decode(
            token, config.JWT_SECRET, algorithms=[ALGORITHM],
            options={"require": ["sub", "iat", "exp", "jti"]},
        )
        issued_at = float(claims["iat"])
        user_id = int(claims["sub"])
        if not math.isfinite(issued_at) or user_id <= 0 or not claims["jti"]:
            return None
        return TokenPayload(
            user_id, claims.get("email", ""), claims.get("role", "user"),
            issued_at, int(claims["exp"]), claims["jti"],
        )
    except (jwt.InvalidTokenError, TypeError, ValueError, OverflowError):
        return None
