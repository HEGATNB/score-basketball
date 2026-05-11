from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from repositories.base_repository import BaseRepository


class UserRepository(BaseRepository):
    """Репозиторий для работы с таблицей users"""

    def __init__(self, db: Session):
        super().__init__(db)

    def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        query = """
            SELECT id, email, name, username, role, password_hash, is_blocked, created_at 
            FROM users WHERE email = :email
        """
        return self._fetch_one(query, {"email": email})

    def get_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        query = """
            SELECT id, email, name, username, role, password_hash, is_blocked, created_at 
            FROM users WHERE username = :username OR name = :name
        """
        return self._fetch_one(query, {"username": username, "name": username})

    def get_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        query = """
            SELECT id, email, name, username, role, is_blocked, created_at 
            FROM users WHERE id = :id
        """
        return self._fetch_one(query, {"id": user_id})

    def get_all(self) -> List[Dict[str, Any]]:
        query = """
            SELECT id, email, name, username, role, is_blocked, created_at 
            FROM users ORDER BY id
        """
        return self._fetch_all(query)

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

    def update_block_status(self, user_id: int, is_blocked: bool) -> bool:
        query = "UPDATE users SET is_blocked = :is_blocked WHERE id = :user_id"
        self._execute_with_commit(query, {"is_blocked": is_blocked, "user_id": user_id})
        return True

    def email_exists(self, email: str) -> bool:
        query = "SELECT EXISTS(SELECT 1 FROM users WHERE email = :email)"
        return self._fetch_scalar(query, {"email": email})

    def count(self) -> int:
        query = "SELECT COUNT(*) FROM users"
        return self._fetch_scalar(query) or 0