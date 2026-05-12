from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import json
import sys
import os
from typing import Optional, Any

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from repositories.audit_repository import AuditRepository


class AuditService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_repo = AuditRepository(db)

    def _create_audit_table(self):
        """Создает таблицу audit_logs в PostgreSQL если её нет"""
        # Таблица создается в репозитории автоматически
        pass

    def log(self, user_id: int, action: str, entity: str = None,
            entity_id: int = None, details: Any = None, ip_address: str = None):
        """Логирование действия пользователя"""
        return self.audit_repo.create(
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            details=details,
            ip_address=ip_address
        )

    def get_user_logs(self, user_id: int, limit: int = 100):
        """Получение логов пользователя"""
        return self.audit_repo.get_by_user(user_id, limit=limit)

    def get_all_logs(self, limit: int = 100):
        """Получение всех логов с информацией о пользователе"""
        logs = self.audit_repo.get_all(limit=limit)

        # Форматируем для ответа
        formatted_logs = []
        for log in logs:
            formatted_log = {
                "id": str(log["id"]),
                "action": log["action"],
                "entity": log.get("entity"),
                "details": log.get("details"),
                "createdAt": log["created_at"].isoformat() if hasattr(log["created_at"], 'isoformat') else str(
                    log["created_at"]),
            }

            if log.get("user_name"):
                formatted_log["user"] = {
                    "name": log["user_name"],
                    "email": log["user_email"]
                }

            formatted_logs.append(formatted_log)

        return formatted_logs