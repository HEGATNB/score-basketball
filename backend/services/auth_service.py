from sqlalchemy.orm import Session
import sqlite3
from datetime import datetime
import sys
import os

# Добавляем путь к корневой папке
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Импортируем функции напрямую, а не весь модуль
from scripts.auth import get_password_hash, verify_password, TokenPayload, generate_token
import schemas

DB_PATH = "./nba.sqlite"


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row

    def get_user_by_email(self, email: str):
        """Получение пользователя по email"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        return cursor.fetchone()

    def get_user_by_id(self, user_id: int):
        """Получение пользователя по ID"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        return cursor.fetchone()

    def create_user(self, user_data):
        """Создание нового пользователя"""
        hashed_password = get_password_hash(user_data.password)  # изменено
        cursor = self.conn.cursor()

        cursor.execute(
            "INSERT INTO users (email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_data.email, hashed_password, user_data.name,
             user_data.role or "user", datetime.utcnow().isoformat())
        )
        self.conn.commit()

        user_id = cursor.lastrowid
        return self.get_user_by_id(user_id)

    def authenticate_user(self, email: str, password: str):
        """Аутентификация пользователя"""
        user = self.get_user_by_email(email)
        if not user:
            return None
        if not verify_password(password, user["password_hash"]):  # изменено
            return None
        return user

    def init_database(self):
        """Инициализация БД тестовыми данными"""
        cursor = self.conn.cursor()

        # Создаем таблицу users если нет
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE,
                password_hash TEXT,
                name TEXT,
                role TEXT DEFAULT 'user',
                is_blocked INTEGER DEFAULT 0,
                created_at TIMESTAMP
            )
        ''')

        test_users = [
            ("admin@sys.com", get_password_hash("admin"), "Admin", "admin"),
            ("operator@sys.com", get_password_hash("operator"), "Operator", "operator"),
            ("user@sys.com", get_password_hash("user"), "User", "user"),
        ]

        created = []
        for email, pwd, name, role in test_users:
            try:
                cursor.execute(
                    "INSERT INTO users (email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?)",
                    (email, pwd, name, role, datetime.utcnow().isoformat())
                )
                created.append(email)
            except:
                pass

        self.conn.commit()
        return {"created_users": created}