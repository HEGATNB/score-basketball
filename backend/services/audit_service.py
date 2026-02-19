from sqlalchemy.orm import Session
import sqlite3
from datetime import datetime
import json
import sys
import os
from typing import Optional, Any

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DB_PATH = "./nba.sqlite"


class AuditService:
    def __init__(self, db: Session):
        self.db = db
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row

    def log(self, user_id: int, action: str, entity: str = None,
            entity_id: int = None, details: Any = None, ip_address: str = None):
        """Логирование действия пользователя"""
        cursor = self.conn.cursor()

        # Создаем таблицу если нет
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT,
                entity TEXT,
                entity_id INTEGER,
                details TEXT,
                ip_address TEXT,
                created_at TIMESTAMP
            )
        ''')

        audit_log = {
            "user_id": user_id,
            "action": action,
            "entity": entity,
            "entity_id": entity_id,
            "details": json.dumps(details, ensure_ascii=False) if details else None,
            "ip_address": ip_address,
            "created_at": datetime.utcnow().isoformat()
        }

        cursor.execute(
            """INSERT INTO audit_logs 
               (user_id, action, entity, entity_id, details, ip_address, created_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (audit_log["user_id"], audit_log["action"], audit_log["entity"],
             audit_log["entity_id"], audit_log["details"], audit_log["ip_address"],
             audit_log["created_at"])
        )
        self.conn.commit()

        log_id = cursor.lastrowid
        audit_log["id"] = log_id
        return audit_log

    def get_user_logs(self, user_id: int, limit: int = 100):
        """Получение логов пользователя"""
        cursor = self.conn.cursor()
        cursor.execute(
            """SELECT * FROM audit_logs 
               WHERE user_id = ? 
               ORDER BY created_at DESC 
               LIMIT ?""",
            (user_id, limit)
        )
        return [dict(row) for row in cursor.fetchall()]

    def get_all_logs(self, limit: int = 100):
        """Получение всех логов"""
        cursor = self.conn.cursor()
        cursor.execute(
            """SELECT a.*, u.name as user_name, u.email as user_email 
               FROM audit_logs a
               LEFT JOIN users u ON a.user_id = u.id
               ORDER BY a.created_at DESC 
               LIMIT ?""",
            (limit,)
        )
        logs = []
        for row in cursor.fetchall():
            log = dict(row)
            logs.append({
                "id": str(log["id"]),
                "action": log["action"],
                "entity": log["entity"],
                "details": json.loads(log["details"]) if log["details"] else None,
                "createdAt": log["created_at"],
                "user": {
                    "name": log["user_name"],
                    "email": log["user_email"]
                } if log["user_name"] else None
            })
        return logs