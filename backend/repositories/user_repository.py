from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from repositories.base_repository import BaseRepository


class UserRepository(BaseRepository):
    # Репозиторий для работы с таблицей users

    def __init__(self, db: Session):
        super().__init__(db)

    # Получение пользователя по email
    def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        query = """
            SELECT id, email, name, username, role, password_hash, is_blocked, created_at 
            FROM users WHERE email = :email
        """
        return self._fetch_one(query, {"email": email})

    # Получение пользователя по username
    def get_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        query = """
            SELECT id, email, name, username, role, password_hash, is_blocked, created_at 
            FROM users WHERE username = :username OR name = :name
        """
        return self._fetch_one(query, {"username": username, "name": username})

    # Получение пользователя по ID
    def get_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        query = """
            SELECT id, email, name, username, role, is_blocked, created_at 
            FROM users WHERE id = :id
        """
        return self._fetch_one(query, {"id": user_id})

    # Получение всех пользователей
    def get_all(self) -> List[Dict[str, Any]]:
        query = """
            SELECT id, email, name, username, role, is_blocked, created_at 
            FROM users ORDER BY id
        """
        return self._fetch_all(query)

    # Создание нового пользователя
    def create(self, email: str, name: str, username: str, password_hash: str,
               role: str = "user", is_blocked: bool = False) -> Dict[str, Any]:
        query = """
            INSERT INTO users (email, name, username, password_hash, role, created_at, is_blocked)
            VALUES (:email, :name, :username, :password_hash, :role, NOW(), :is_blocked)
            RETURNING id, email, name, username, role, created_at, is_blocked
        """
        params = {
            "email": email,
            "name": name,
            "username": username,
            "password_hash": password_hash,
            "role": role,
            "is_blocked": is_blocked
        }
        result = self._execute_with_commit(query, params)
        return dict(result.fetchone()._mapping)

    # Обновление статуса блокировки пользователя
    def update_block_status(self, user_id: int, is_blocked: bool) -> bool:
        query = "UPDATE users SET is_blocked = :is_blocked WHERE id = :user_id"
        self._execute_with_commit(query, {"is_blocked": is_blocked, "user_id": user_id})
        return True

    # Обновление профиля пользователя
    def update_profile(self, user_id: int, name: Optional[str] = None,
                       username: Optional[str] = None,
                       email: Optional[str] = None) -> Optional[Dict[str, Any]]:
        fields = []
        params: Dict[str, Any] = {"user_id": user_id}
        if name is not None:
            fields.append("name = :name")
            params["name"] = name
        if username is not None:
            fields.append("username = :username")
            params["username"] = username
        if email is not None:
            fields.append("email = :email")
            params["email"] = email
        if not fields:
            return self.get_by_id(user_id)
        query = f"UPDATE users SET {', '.join(fields)} WHERE id = :user_id"
        self._execute_with_commit(query, params)
        return self.get_by_id(user_id)

    # Обновление пароля пользователя
    def update_password(self, user_id: int, password_hash: str) -> bool:
        query = "UPDATE users SET password_hash = :hash WHERE id = :user_id"
        self._execute_with_commit(query, {"hash": password_hash, "user_id": user_id})
        return True

    # Получение хеша пароля пользователя
    def get_password_hash(self, user_id: int) -> Optional[str]:
        query = "SELECT password_hash FROM users WHERE id = :user_id"
        return self._fetch_scalar(query, {"user_id": user_id})

    # Проверка существования username
    def username_exists(self, username: str, except_user_id: Optional[int] = None) -> bool:
        if except_user_id is None:
            query = "SELECT EXISTS(SELECT 1 FROM users WHERE username = :u)"
            return self._fetch_scalar(query, {"u": username})
        query = "SELECT EXISTS(SELECT 1 FROM users WHERE username = :u AND id <> :uid)"
        return self._fetch_scalar(query, {"u": username, "uid": except_user_id})

    # Проверка существования email
    def email_exists(self, email: str, except_user_id: Optional[int] = None) -> bool:
        if except_user_id is None:
            query = "SELECT EXISTS(SELECT 1 FROM users WHERE email = :email)"
            return self._fetch_scalar(query, {"email": email})
        query = "SELECT EXISTS(SELECT 1 FROM users WHERE email = :email AND id <> :uid)"
        return self._fetch_scalar(query, {"email": email, "uid": except_user_id})

    # Общее количество пользователей
    def count(self) -> int:
        query = "SELECT COUNT(*) FROM users"
        return self._fetch_scalar(query) or 0