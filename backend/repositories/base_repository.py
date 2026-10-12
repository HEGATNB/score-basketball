from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from datetime import datetime


class BaseRepository:
    # Базовый класс для всех репозиториев

    def __init__(self, db: Session):
        self.db = db

    # Выполняет SQL запрос
    def _execute(self, query: str, params: Dict[str, Any] = None) -> Any:
        try:
            result = self.db.execute(text(query), params or {})
            return result
        except Exception as e:
            self.db.rollback()
            raise e

    # Выполняет SQL запрос с коммитом
    def _execute_with_commit(self, query: str, params: Dict[str, Any] = None) -> Any:
        result = self._execute(query, params)
        self.db.commit()
        return result

    # Возвращает одну запись в виде словаря
    def _fetch_one(self, query: str, params: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        result = self._execute(query, params)
        row = result.fetchone()
        return dict(row._mapping) if row else None

    # Возвращает все записи в виде списка словарей
    def _fetch_all(self, query: str, params: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        result = self._execute(query, params)
        return [dict(row._mapping) for row in result]

    # Возвращает скалярное значение
    def _fetch_scalar(self, query: str, params: Dict[str, Any] = None) -> Any:
        result = self._execute(query, params)
        return result.scalar()

    # Выполняет сырой запрос без обработки результата
    def _execute_raw(self, query: str, params: Dict[str, Any] = None) -> Any:
        return self._execute(query, params)