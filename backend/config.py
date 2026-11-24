import os
from dotenv import load_dotenv
from pathlib import Path
from typing import List

BASE_DIR = Path(__file__).resolve().parent
env_path = BASE_DIR / 'env'
if env_path.exists():
    load_dotenv(env_path)
    print(f" Загружен env файл: {env_path}")
else:
    print(f" env файл не найден: {env_path}")
    load_dotenv()


class Config:
    # База данных
    DB_NAME = os.getenv("DB_NAME", "nba")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")

    # Redis настройки
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
            return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

        return ""

    # JWT настройки
    # Единый источник секрета: берётся только из окружения, без fallback.
    # Fail-closed: если секрет не задан, приложение не запускается.
    JWT_SECRET = os.getenv("JWT_SECRET")
    if not JWT_SECRET:
        raise ValueError("JWT_SECRET must be set in the environment (see .env.example)!")

    JWT_EXPIRES_IN = os.getenv("JWT_EXPIRES_IN", "7d")

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
        # Источник один — переменная окружения (список через запятую). Без wildcard.
        raw = os.getenv("ALLOWED_ORIGINS")
        if raw:
            return [o.strip() for o in raw.split(",") if o.strip()]
        if self.ENVIRONMENT == "production":
            # В production origins задаются явно; отсутствие списка — пустой allowlist.
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
    if not config.DATABASE_URL:
        raise ValueError("DATABASE_URL must be set in production!")
    if "postgresql://postgres:12345678@" in config.DATABASE_URL:
        raise ValueError("Using default credentials in production is FORBIDDEN!")
