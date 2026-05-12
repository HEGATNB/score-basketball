from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
import os
from dotenv import load_dotenv
import bcrypt

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_EXPIRES_IN = os.getenv("JWT_EXPIRES_IN", "7d")

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception as e:
        print(f"Ошибка проверки пароля: {e}")
        return False

# Парсинг данных из базы

def parse_expires_in(expires_in: str) -> int:
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

# Генерация JWT

def generate_token(payload: TokenPayload) -> str:

    to_encode = payload.to_dict()
    minutes = parse_expires_in(JWT_EXPIRES_IN)
    expire = datetime.utcnow() + timedelta(minutes=minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")
    return encoded_jwt

# Проверка JWT

def verify_token(token: str) -> Optional[TokenPayload]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return TokenPayload.from_dict(payload)
    except JWTError:
        return None