from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
import os
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv()

# Конфигурация
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_EXPIRES_IN = os.getenv("JWT_EXPIRES_IN", "7d")

# Хеширование паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Хеширование пароля"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверка пароля"""
    return pwd_context.verify(plain_password, hashed_password)

def parse_expires_in(expires_in: str) -> int:
    """Парсинг строки типа '7d' в минуты"""
    if expires_in.endswith('d'):
        return int(expires_in[:-1]) * 24 * 60
    elif expires_in.endswith('h'):
        return int(expires_in[:-1]) * 60
    elif expires_in.endswith('m'):
        return int(expires_in[:-1])
    else:
        return 7 * 24 * 60

class TokenPayload:
    def __init__(self, user_id: int, email: str, role: str):
        self.user_id = user_id
        self.email = email
        self.role = role

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sub": str(self.user_id),
            "email": self.email,
            "role": self.role
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TokenPayload':
        return cls(
            user_id=int(data.get("sub", 0)),
            email=data.get("email", ""),
            role=data.get("role", "user")
        )

def generate_token(payload: TokenPayload) -> str:
    """Генерация JWT токена"""
    to_encode = payload.to_dict()
    minutes = parse_expires_in(JWT_EXPIRES_IN)
    expire = datetime.utcnow() + timedelta(minutes=minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")
    return encoded_jwt

def verify_token(token: str) -> Optional[TokenPayload]:
    """Проверка JWT токена"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return TokenPayload.from_dict(payload)
    except JWTError:
        return None