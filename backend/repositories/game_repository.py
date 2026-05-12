# repositories/game_repository.py - полная версия

from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from repositories.base_repository import BaseRepository


class GameRepository(BaseRepository):
    def __init__(self, db: Session):
        super().__init__(db)

    def get_all(self, status_filter: str = None, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        query = """
            SELECT 
                g.season_id,
                g.game_id,
                g.game_date,
                g.team_id_home,
                g.team_id_away,
                g.pts_home,
                g.pts_away,
                g.wl_home,
                g.wl_away,
                g.season_type,
                g.team_abbreviation_home as home_team_abbrev,
                g.team_name_home as home_team_name,
                g.team_abbreviation_away as away_team_abbrev,
                g.team_name_away as away_team_name
            FROM game g
            WHERE 1=1
        """
        params = {}

        if status_filter == "finished":
            query += " AND g.pts_home IS NOT NULL AND g.pts_away IS NOT NULL"
        elif status_filter == "scheduled":
            query += " AND (g.pts_home IS NULL OR g.pts_away IS NULL)"

        query += " ORDER BY g.game_date DESC NULLS LAST LIMIT :limit OFFSET :skip"
        params["limit"] = limit
        params["skip"] = skip

        return self._fetch_all(query, params)

    def get_by_id(self, game_id: str) -> Optional[Dict[str, Any]]:
        query = """
            SELECT 
                g.season_id,
                g.game_id,
                g.game_date,
                g.team_id_home,
                g.team_id_away,
                g.pts_home,
                g.pts_away,
                g.wl_home,
                g.wl_away,
                g.season_type,
                g.team_abbreviation_home as home_team_abbrev,
                g.team_name_home as home_team_name,
                g.team_abbreviation_away as away_team_abbrev,
                g.team_name_away as away_team_name
            FROM game g
            WHERE g.game_id = :game_id
        """
        return self._fetch_one(query, {"game_id": game_id})

    def count(self) -> int:
        """Общее количество матчей"""
        query = "SELECT COUNT(*) FROM game"
        return self._fetch_scalar(query) or 0

    def count_finished(self) -> int:
        """Количество завершенных матчей (с результатом)"""
        query = "SELECT COUNT(*) FROM game WHERE wl_home IS NOT NULL"
        return self._fetch_scalar(query) or 0

    def get_team_stats(self, team_id: str, limit: int = 30) -> Optional[Dict[str, Any]]:
        query = """
            SELECT 
                AVG(CAST(pts_home AS FLOAT)) as pts_pg,
                AVG(CAST(pts_away AS FLOAT)) as opp_pts_pg,
                COUNT(*) as games_played,
                SUM(CASE WHEN wl_home = 'W' THEN 1 ELSE 0 END) as wins
            FROM game 
            WHERE team_id_home = :team_id
            AND pts_home IS NOT NULL
            AND pts_home > 0
            ORDER BY game_date DESC
            LIMIT :limit
        """
        return self._fetch_one(query, {"team_id": team_id, "limit": limit})

    def get_team_history(self, team_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        query = """
            SELECT 
                team_id_home,
                team_id_away,
                team_name_home,
                team_name_away,
                wl_home,
                wl_away,
                pts_home,
                pts_away,
                game_date
            FROM game 
            WHERE (team_id_home = :team_id OR team_id_away = :team_id)
            AND pts_home IS NOT NULL
            ORDER BY game_date DESC 
            LIMIT :limit
        """
        return self._fetch_all(query, {"team_id": team_id, "limit": limit})

    def get_head_to_head(self, team1_id: str, team2_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        query = """
            SELECT 
                team_id_home,
                team_id_away,
                team_name_home,
                team_name_away,
                wl_home,
                wl_away,
                pts_home,
                pts_away,
                game_date
            FROM game 
            WHERE ((team_id_home = :team1 AND team_id_away = :team2) 
               OR (team_id_home = :team2 AND team_id_away = :team1))
            AND pts_home IS NOT NULL
            ORDER BY game_date DESC 
            LIMIT :limit
        """
        return self._fetch_all(query, {"team1": team1_id, "team2": team2_id, "limit": limit})

    def insert(self, game_data: Dict[str, Any]) -> bool:
        columns = ', '.join(game_data.keys())
        placeholders = ', '.join([f':{k}' for k in game_data.keys()])
        query = f"INSERT INTO game ({columns}) VALUES ({placeholders})"
        self._execute_with_commit(query, game_data)
        return True

    def exists(self, game_id: str) -> bool:
        query = "SELECT 1 FROM game WHERE game_id = :game_id"
        result = self._fetch_one(query, {"game_id": game_id})
        return result is not None