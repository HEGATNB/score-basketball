# repositories/backup_repository.py
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from repositories.base_repository import BaseRepository
from datetime import datetime


class BackupRepository(BaseRepository):
    # Репозиторий для работы с таблицей backups

    def __init__(self, db: Session):
        super().__init__(db)
        self._create_table_if_not_exists()

    def _create_table_if_not_exists(self):
        # Создание таблицы backups если она не существует
        query = """
            CREATE TABLE IF NOT EXISTS backups (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                size INTEGER,
                type VARCHAR(50) DEFAULT 'manual',
                status VARCHAR(50) DEFAULT 'completed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        self._execute(query)
        self.db.commit()

    def create(self, filename: str, size: int, backup_type: str = "manual",
               status: str = "completed") -> int:
        # Создание записи о бэкапе
        query = """
            INSERT INTO backups (filename, size, type, status, created_at)
            VALUES (:filename, :size, :type, :status, :created_at)
            RETURNING id
        """
        params = {
            "filename": filename,
            "size": size,
            "type": backup_type,
            "status": status,
            "created_at": datetime.now()
        }
        result = self._execute_with_commit(query, params)
        return result.scalar()

    def get_all(self) -> List[Dict[str, Any]]:
        # Получение всех бэкапов
        query = """
            SELECT id, filename, size, type, status, created_at
            FROM backups
            ORDER BY created_at DESC
        """
        return self._fetch_all(query)

    def get_by_id(self, backup_id: int) -> Optional[Dict[str, Any]]:
        # Получение бэкапа по ID
        query = "SELECT filename FROM backups WHERE id = :id"
        return self._fetch_one(query, {"id": backup_id})

    def get_count(self) -> int:
        # Получение количества бэкапов
        query = "SELECT COUNT(*) FROM backups"
        return self._fetch_scalar(query) or 0

    def get_last_backup(self) -> Optional[Dict[str, Any]]:
        # Получение последнего бэкапа
        query = """
            SELECT created_at FROM backups 
            ORDER BY created_at DESC 
            LIMIT 1
        """
        return self._fetch_one(query)