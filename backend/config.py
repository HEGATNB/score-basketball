import os
from dotenv import load_dotenv
from pathlib import Path
from typing import List
from urllib.parse import parse_qs, quote, urlsplit

BASE_DIR = Path(__file__).resolve().parent
env_path = BASE_DIR / 'env'
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()


class Config:
    # База данных
    DB_NAME = os.getenv("DB_NAME", "nba")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")

    # Redis настройки
    REDIS_URL = os.getenv("REDIS_URL")
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)
    REDIS_DB = int(os.getenv("REDIS_DB", 0))

    @property
    def DATABASE_URL(self) -> str:
        # Приоритет 1: готовая строка подключения из окружения (Render, Neon)
        url_from_env = os.getenv("DATABASE_URL")
        if url_from_env:
            return url_from_env

        # Приоритет 2: сборка из отдельных переменных (локальная разработка)
        if all([self.DB_NAME, self.DB_USER, self.DB_PASSWORD]):
            return (
                f"postgresql://{quote(self.DB_USER, safe='')}:{quote(self.DB_PASSWORD, safe='')}"
                f"@{self.DB_HOST}:{self.DB_PORT}/{quote(self.DB_NAME, safe='')}"
            )

        return ""

    JWT_SECRET = os.getenv("JWT_SECRET", "")
    JWT_EXPIRES_IN = os.getenv("JWT_EXPIRES_IN", "30m")

    # Пути
    BASE_DIR = Path(__file__).resolve().parent
    MODEL_DIR = os.getenv("MODEL_DIR", str(BASE_DIR / "models"))
    DB_PATH = os.getenv("DB_PATH", str(BASE_DIR / "nba.sqlite"))

    # Настройки нейросети
    STATS = ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fg_pct', 'fg3_pct', 'ft_pct']

    # Окружение
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        configured = os.getenv("ALLOWED_ORIGINS")
        if configured is not None:
            origins = [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]
            if any("*" in origin for origin in origins):
                raise ValueError("ALLOWED_ORIGINS must contain specific origins")
            return origins
        if not self.is_development:
            return []
        return [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8000",
        ]

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


config = Config()

if config.is_production:
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        raise ValueError("DATABASE_URL must be set in production")
    ssl_mode = parse_qs(urlsplit(database_url).query).get("sslmode", [""])[0]
    if ssl_mode not in {"require", "verify-ca", "verify-full"}:
        raise ValueError("Production DATABASE_URL must require TLS")
