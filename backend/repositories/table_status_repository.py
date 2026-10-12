from sqlalchemy.orm import Session
from typing import Dict, Any
from repositories.base_repository import BaseRepository


class TableStatusRepository(BaseRepository):
    # Репозиторий для проверки статуса таблиц

    def __init__(self, db: Session):
        super().__init__(db)

    # Проверка существования таблицы
    def table_exists(self, table_name: str) -> bool:
        query = """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = :table_name
            )
        """
        return self._fetch_scalar(query, {"table_name": table_name}) or False

    # Получение количества строк в таблице
    def get_table_row_count(self, table_name: str) -> int:
        query = f"SELECT COUNT(*) FROM {table_name}"
        return self._fetch_scalar(query) or 0

    # Получение количества строк во всех основных таблицах
    def get_all_table_counts(self) -> Dict[str, int]:
        tables = ["users", "team", "players", "game", "predictions", "backups"]
        result = {}
        for table in tables:
            if self.table_exists(table):
                result[f"total_{table}"] = self.get_table_row_count(table)
            else:
                result[f"total_{table}"] = 0
        return result