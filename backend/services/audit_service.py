from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import json
import sys
import os
from typing import Optional, Any

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class AuditService:
    def __init__(self, db: Session):
        self.db = db
        self._create_audit_table()

    def _create_audit_table(self):
        """Создает таблицу audit_logs в PostgreSQL если её нет"""
        try:
            self.db.execute(text("""
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
            """))
            self.db.commit()
            print("✅ Таблица audit_logs создана/проверена в PostgreSQL")
        except Exception as e:
            print(f"❌ Ошибка при создании таблицы audit_logs: {e}")
            self.db.rollback()

    def log(self, user_id: int, action: str, entity: str = None,
            entity_id: int = None, details: Any = None, ip_address: str = None):
        """Логирование действия пользователя"""
        try:
            details_json = json.dumps(details, ensure_ascii=False) if details else None

            result = self.db.execute(
                text("""
                    INSERT INTO audit_logs 
                    (user_id, action, entity, entity_id, details, ip_address, created_at) 
                    VALUES (:user_id, :action, :entity, :entity_id, :details, :ip_address, :created_at)
                    RETURNING id
                """),
                {
                    "user_id": user_id,
                    "action": action,
                    "entity": entity,
                    "entity_id": entity_id,
                    "details": details_json,
                    "ip_address": ip_address,
                    "created_at": datetime.utcnow()
                }
            )
            self.db.commit()

            log_id = result.scalar()
            return {
                "id": log_id,
                "user_id": user_id,
                "action": action,
                "entity": entity,
                "entity_id": entity_id,
                "details": details,
                "ip_address": ip_address,
                "created_at": datetime.utcnow().isoformat()
            }
        except Exception as e:
            print(f"❌ Ошибка логирования: {e}")
            self.db.rollback()
            return None

    def get_user_logs(self, user_id: int, limit: int = 100):
        """Получение логов пользователя"""
        try:
            result = self.db.execute(
                text("""
                    SELECT * FROM audit_logs 
                    WHERE user_id = :user_id 
                    ORDER BY created_at DESC 
                    LIMIT :limit
                """),
                {"user_id": user_id, "limit": limit}
            ).fetchall()

            logs = []
            for row in result:
                log = dict(row._mapping)
                if log.get("details"):
                    try:
                        log["details"] = json.loads(log["details"])
                    except:
                        pass
                logs.append(log)

            return logs
        except Exception as e:
            print(f"❌ Ошибка получения логов пользователя: {e}")
            return []

    def get_all_logs(self, limit: int = 100):
        """Получение всех логов с информацией о пользователе"""
        try:
            # Проверяем, существует ли таблица users
            self.db.execute(text("SELECT 1 FROM users LIMIT 1")).fetchone()
            has_users = True
        except:
            has_users = False

        try:
            if has_users:
                result = self.db.execute(
                    text("""
                        SELECT a.*, u.name as user_name, u.email as user_email 
                        FROM audit_logs a
                        LEFT JOIN users u ON a.user_id = u.id
                        ORDER BY a.created_at DESC 
                        LIMIT :limit
                    """),
                    {"limit": limit}
                ).fetchall()
            else:
                result = self.db.execute(
                    text("""
                        SELECT * FROM audit_logs 
                        ORDER BY created_at DESC 
                        LIMIT :limit
                    """),
                    {"limit": limit}
                ).fetchall()

            logs = []
            for row in result:
                log = dict(row._mapping)

                # Парсим details если есть
                if log.get("details"):
                    try:
                        log["details"] = json.loads(log["details"])
                    except:
                        pass

                # Форматируем для ответа
                formatted_log = {
                    "id": str(log["id"]),
                    "action": log["action"],
                    "entity": log["entity"],
                    "details": log.get("details"),
                    "createdAt": log["created_at"].isoformat() if hasattr(log["created_at"], 'isoformat') else str(
                        log["created_at"]),
                }

                if has_users and log.get("user_name"):
                    formatted_log["user"] = {
                        "name": log["user_name"],
                        "email": log["user_email"]
                    }

                logs.append(formatted_log)

            return logs
        except Exception as e:
            print(f"❌ Ошибка получения всех логов: {e}")
            return []