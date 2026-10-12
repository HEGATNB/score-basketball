from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from repositories.base_repository import BaseRepository

class TeamInfoRepository(BaseRepository):
    # Репозиторий для работы с таблицей team_info_common

    def __init__(self, db: Session):
        super().__init__(db)

    # Получение последней статистики команды по сезону
    def get_latest_stats_by_team(self, team_id: str) -> Optional[Dict[str, Any]]:
        query = """
            SELECT 
                w, l, pct, pts_pg, opp_pts_pg, reb_pg, ast_pg,
                team_conference, team_division, season_id
            FROM team_info_common
            WHERE team_id = :team_id
            ORDER BY season_id DESC
            LIMIT 1
        """
        return self._fetch_one(query, {"team_id": team_id})

    # Получение последней статистики для всех команд
    def get_all_latest_stats(self) -> List[Dict[str, Any]]:
        query = """
            SELECT DISTINCT ON (team_id)
                team_id, season_id, team_conference, team_division,
                w, l, pct, pts_pg, opp_pts_pg, reb_pg, ast_pg
            FROM team_info_common
            ORDER BY team_id, season_id DESC
        """
        return self._fetch_all(query)

    # Получение побед/поражений команды
    def get_team_record(self, team_id: str) -> Optional[Dict[str, Any]]:
        query = """
            SELECT w, l 
            FROM team_info_common 
            WHERE team_id = :team_id 
            ORDER BY season_id DESC 
            LIMIT 1
        """
        return self._fetch_one(query, {"team_id": team_id})

    # Получение побед/поражений для всех команд
    def get_all_records(self) -> List[Dict[str, Any]]:
        query = """
            SELECT DISTINCT ON (team_id)
                team_id, w, l
            FROM team_info_common
            WHERE w IS NOT NULL AND l IS NOT NULL
            ORDER BY team_id, season_id DESC
        """
        return self._fetch_all(query)