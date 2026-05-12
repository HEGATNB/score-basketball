from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import config


SQLALCHEMY_DATABASE_URL = config.DATABASE_URL

print(f"Подключение к БД: {config.DB_USER}@ {config.DB_HOST}:{config.DB_PORT}/{config.DB_NAME}")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()