from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, Union
from datetime import datetime
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.auth import get_password_hash, verify_password
from repositories.user_repository import UserRepository


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)

    def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        # Аутентификация пользователя по email
        try:
            print(f"Попытка аутентификации по email: {email}")

            user = self.user_repo.get_by_email(email)

            if not user:
                print(f"Пользователь с email {email} не найден")
                return None

            return self._verify_and_return_user(user, password)

        except Exception as e:
            print(f"Ошибка аутентификации: {e}")
            import traceback
            traceback.print_exc()
            return None

    def authenticate_by_username(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        # Аутентификация пользователя по username
        try:
            print(f"Попытка аутентификации по username: {username}")

            user = self.user_repo.get_by_username(username)

            if not user:
                print(f"Пользователь с username {username} не найден")
                return None

            return self._verify_and_return_user(user, password)

        except Exception as e:
            print(f"Ошибка аутентификации: {e}")
            return None

    def _verify_and_return_user(self, user: Dict, password: str) -> Optional[Dict[str, Any]]:
        # Проверка пароля по хешу
        stored_hash = user.get("password_hash")
        if not stored_hash:
            print("У пользователя нет хеша пароля")
            return None

        is_valid = verify_password(password, stored_hash)
        print(f"Результат проверки пароля: {is_valid}")

        if not is_valid:
            return None

        if user.get("is_blocked"):
            print("Пользователь заблокирован")
            return None

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
        return self.user_repo.get_by_email(email)

    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        return self.user_repo.get_by_id(user_id)

    def create_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            # Хеширование пароль
            password_hash = get_password_hash(user_data["password"])
            print(f"Создан хеш пароля: {password_hash[:20]}...")

            username = user_data.get("username") or user_data.get("name") or user_data["email"].split('@')[0]

            # Создание пользователя через репозиторий
            user = self.user_repo.create(
                email=user_data["email"],
                name=user_data.get("name", username),
                username=username,
                password_hash=password_hash,
                role=user_data.get("role", "user")
            )

            print(f"Создан пользователь: {user['email']} с ID={user['id']}")
            return user

        except Exception as e:
            print(f"Ошибка создания пользователя: {e}")
            raise

    def update_profile(self, user_id: int, name: Optional[str] = None,
                       username: Optional[str] = None,
                       email: Optional[str] = None) -> Dict[str, Any]:
        if email is not None:
            email = email.strip().lower()
            if not email or "@" not in email:
                raise ValueError("Invalid email")
            if self.user_repo.email_exists(email, except_user_id=user_id):
                raise ValueError("This email is already in use")
        if username is not None:
            username = username.strip()
            if not username:
                raise ValueError("Username cannot be empty")
            if self.user_repo.username_exists(username, except_user_id=user_id):
                raise ValueError("This username is already taken")
        if name is not None:
            name = name.strip()
            if not name:
                raise ValueError("Name cannot be empty")
        updated = self.user_repo.update_profile(user_id, name=name, username=username, email=email)
        if not updated:
            raise ValueError("User was not found")
        return updated

    def change_password(self, user_id: int, current_password: str, new_password: str) -> bool:
        if not new_password or len(new_password) < 4:
            raise ValueError("New password must be at least 4 characters long")
        current_hash = self.user_repo.get_password_hash(user_id)
        if not current_hash:
            raise ValueError("User was not found")
        if not verify_password(current_password, current_hash):
            raise ValueError("Current password is incorrect")
        new_hash = get_password_hash(new_password)
        self.user_repo.update_password(user_id, new_hash)
        return True