# services/auth_service.py
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, Any, Union
from datetime import datetime
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.auth import get_password_hash, verify_password


class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Аутентификация пользователя по email"""
        try:
            print(f"🔐 Попытка аутентификации по email: {email}")

            result = self.db.execute(
                text("""
                    SELECT id, email, name, username, role, password_hash, is_blocked, created_at 
                    FROM users WHERE email = :email
                """),
                {"email": email}
            ).fetchone()

            if not result:
                print(f"❌ Пользователь с email {email} не найден")
                return None

            user = dict(result._mapping)
            return self._verify_and_return_user(user, password)

        except Exception as e:
            print(f"❌ Ошибка аутентификации: {e}")
            import traceback
            traceback.print_exc()
            return None

    def authenticate_by_username(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """Аутентификация пользователя по username"""
        try:
            print(f"🔐 Попытка аутентификации по username: {username}")

            result = self.db.execute(
                text("""
                    SELECT id, email, name, username, role, password_hash, is_blocked, created_at 
                    FROM users WHERE username = :username OR name = :name
                """),
                {"username": username, "name": username}
            ).fetchone()

            if not result:
                print(f"❌ Пользователь с username {username} не найден")
                return None

            user = dict(result._mapping)
            return self._verify_and_return_user(user, password)

        except Exception as e:
            print(f"❌ Ошибка аутентификации: {e}")
            return None

    def _verify_and_return_user(self, user: Dict, password: str) -> Optional[Dict[str, Any]]:
        """Проверка пароля и возврат данных пользователя"""
        # Проверяем пароль
        stored_hash = user.get("password_hash")
        if not stored_hash:
            print("❌ У пользователя нет хеша пароля")
            return None

        is_valid = verify_password(password, stored_hash)
        print(f"🔐 Результат проверки пароля: {is_valid}")

        if not is_valid:
            return None

        # Проверяем блокировку
        if user.get("is_blocked"):
            print("❌ Пользователь заблокирован")
            return None

        # Возвращаем данные без хеша
        return {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("name") or user.get("username") or user["email"].split('@')[0],
            "username": user.get("username"),
            "role": user["role"],
            "is_blocked": user["is_blocked"],
            "created_at": user["created_at"]
        }

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Получение пользователя по email"""
        try:
            result = self.db.execute(
                text("""
                    SELECT id, email, name, username, role, is_blocked, created_at 
                    FROM users WHERE email = :email
                """),
                {"email": email}
            ).fetchone()

            if result:
                return dict(result._mapping)
            return None
        except Exception as e:
            print(f"❌ Ошибка получения пользователя: {e}")
            return None

    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Получение пользователя по ID"""
        try:
            result = self.db.execute(
                text("""
                    SELECT id, email, name, username, role, is_blocked, created_at 
                    FROM users WHERE id = :id
                """),
                {"id": user_id}
            ).fetchone()

            if result:
                return dict(result._mapping)
            return None
        except Exception as e:
            print(f"❌ Ошибка получения пользователя: {e}")
            return None

    def create_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создание нового пользователя"""
        try:
            # Хешируем пароль
            password_hash = get_password_hash(user_data["password"])
            print(f"🔐 Создан хеш пароля: {password_hash[:20]}...")

            # Определяем username
            username = user_data.get("username") or user_data.get("name") or user_data["email"].split('@')[0]

            # Вставляем пользователя
            result = self.db.execute(
                text("""
                    INSERT INTO users (email, name, username, password_hash, role, created_at, is_blocked)
                    VALUES (:email, :name, :username, :password_hash, :role, :created_at, :is_blocked)
                    RETURNING id, email, name, username, role, created_at, is_blocked
                """),
                {
                    "email": user_data["email"],
                    "name": user_data.get("name", username),
                    "username": username,
                    "password_hash": password_hash,
                    "role": user_data.get("role", "user"),
                    "created_at": datetime.utcnow(),
                    "is_blocked": False
                }
            )
            self.db.commit()

            user = dict(result.fetchone()._mapping)
            print(f"✅ Создан пользователь: {user['email']} с ID={user['id']}")
            return user

        except Exception as e:
            self.db.rollback()
            print(f"❌ Ошибка создания пользователя: {e}")
            raise

    def init_database(self) -> Dict[str, Any]:
        """Инициализация тестовыми пользователями"""
        created_users = []

        test_users = [
            {"email": "admin@sys.com", "name": "Admin", "username": "admin", "password": "admin", "role": "admin"},
            {"email": "operator@sys.com", "name": "Operator", "username": "operator", "password": "operator", "role": "operator"},
            {"email": "user@sys.com", "name": "User", "username": "user", "password": "user", "role": "user"},
        ]

        for user_data in test_users:
            try:
                # Проверяем, существует ли уже
                existing = self.get_user_by_email(user_data["email"])
                if existing:
                    print(f"⚠️ Пользователь {user_data['email']} уже существует")
                    created_users.append(user_data["email"])
                    continue

                # Создаем пользователя
                password_hash = get_password_hash(user_data["password"])

                self.db.execute(
                    text("""
                        INSERT INTO users (email, name, username, password_hash, role, created_at, is_blocked)
                        VALUES (:email, :name, :username, :password_hash, :role, :created_at, :is_blocked)
                    """),
                    {
                        "email": user_data["email"],
                        "name": user_data["name"],
                        "username": user_data["username"],
                        "password_hash": password_hash,
                        "role": user_data["role"],
                        "created_at": datetime.utcnow(),
                        "is_blocked": False
                    }
                )
                self.db.commit()
                created_users.append(user_data["email"])
                print(f"✅ Создан тестовый пользователь: {user_data['email']}")

            except Exception as e:
                self.db.rollback()
                print(f"❌ Ошибка создания {user_data['email']}: {e}")

        return {"created_users": created_users}