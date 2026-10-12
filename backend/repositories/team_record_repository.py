from sqlalchemy.orm import Session
from typing import Dict, Any, List
from repositories.base_repository import BaseRepository

class TeamRecordRepository(BaseRepository):
    # Репозиторий для работы с рекордами команд из team_info_common

    def __init__(self, db: Session):
        super().__init__(db)

    # Получение записей побед/поражений для всех команд
    def get_all_team_records(self) -> Dict[str, Dict[str, int]]:
        query = """
            SELECT DISTINCT ON (team_id)
                team_id, w, l
            FROM team_info_common
            WHERE w IS NOT NULL AND l IS NOT NULL
            ORDER BY team_id, season_id DESC
        """
        results = self._fetch_all(query)
        return {
            str(r["team_id"]): {
                "w": int(r["w"] or 0),
                "l": int(r["l"] or 0),
            }
            for r in results
        }