from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from repositories.base_repository import BaseRepository
import json
from datetime import datetime


class AuditRepository(BaseRepository):
    """Репозиторий для работы с таблицей audit_logs"""

    def __init__(self, db: Session):
        super().__init__(db)
        self._create_table_if_not_exists()

    def _create_table_if_not_exists(self):
        query = """
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                action VARCHAR(50),
                entity VARCHAR(50),
                entity_id INTEGER,
                details TEXT,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        self._execute(query)
        self.db.commit()

    def create(self, user_id: int, action: str, entity: str = None,
               entity_id: int = None, details: Any = None, ip_address: str = None) -> Dict[str, Any]:
        details_json = json.dumps(details, ensure_ascii=False) if details else None
        query = """
            INSERT INTO audit_logs 
            (user_id, action, entity, entity_id, details, ip_address, created_at) 
            VALUES (:user_id, :action, :entity, :entity_id, :details, :ip_address, NOW())
            RETURNING id
        """
        params = {
            "user_id": user_id,
            "action": action,
            "entity": entity,
            "entity_id": entity_id,
            "details": details_json,
            "ip_address": ip_address
        }
        result = self._execute_with_commit(query, params)
        return {
            "id": result.scalar(),
            "user_id": user_id,
            "action": action,
            "entity": entity,
            "entity_id": entity_id,
            "details": details,
            "ip_address": ip_address,
            "created_at": datetime.now().isoformat()
        }

    def get_all(self, limit: int = 100) -> List[Dict[str, Any]]:
        query = """
            SELECT a.*, u.name as user_name, u.email as user_email 
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC 
            LIMIT :limit
        """
        results = self._fetch_all(query, {"limit": limit})
        for log in results:
            if log.get("details"):
                try:
                    log["details"] = json.loads(log["details"])
                except:
                    pass
        return results

    def get_by_user(self, user_id: int, limit: int = 100) -> List[Dict[str, Any]]:
        query = """
            SELECT * FROM audit_logs 
            WHERE user_id = :user_id 
            ORDER BY created_at DESC 
            LIMIT :limit
        """
        return self._fetch_all(query, {"user_id": user_id, "limit": limit})