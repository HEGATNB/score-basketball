from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from repositories.base_repository import BaseRepository


class TeamRepository(BaseRepository):
    """Репозиторий для работы с таблицами team, team_details, team_info_common"""

    def __init__(self, db: Session):
        super().__init__(db)

    def get_all(self, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        query = """
            WITH team_stats AS (
                SELECT DISTINCT ON (team_id)
                    team_id,
                    season_id,
                    team_conference,
                    team_division,
                    w,
                    l,
                    pct,
                    pts_pg,
                    opp_pts_pg,
                    reb_pg,
                    ast_pg
                FROM team_info_common
                ORDER BY team_id, season_id DESC
            )
            SELECT
                t.id,
                t.full_name as name,
                t.abbreviation as abbrev,
                t.full_name,
                t.nickname,
                t.city,
                t.state,
                t.year_founded as founded_year,
                td.arena,
                td.arenacapacity as arena_capacity,
                td.headcoach as head_coach,
                td.generalmanager as general_manager,
                td.owner,
                ts.team_conference as stats_conference,
                ts.team_division as division,
                ts.w as wins,
                ts.l as losses,
                ts.pct as win_pct,
                ts.pts_pg as points_per_game,
                ts.opp_pts_pg as points_against,
                ts.reb_pg as rebounds_per_game,
                ts.ast_pg as assists_per_game
            FROM team t
            LEFT JOIN team_details td ON t.id = td.team_id
            LEFT JOIN team_stats ts ON t.id = ts.team_id
            ORDER BY t.full_name
            LIMIT :limit OFFSET :skip
        """
        return self._fetch_all(query, {"limit": limit, "skip": skip})

    def get_by_id(self, team_id: int) -> Optional[Dict[str, Any]]:
        team_id_str = str(team_id)

        # Основная информация
        query = """
            SELECT
                t.id,
                t.full_name as name,
                t.abbreviation as abbrev,
                t.nickname,
                t.city,
                t.state,
                t.year_founded as founded_year
            FROM team t
            WHERE t.id = :team_id
        """
        team = self._fetch_one(query, {"team_id": team_id_str})

        if not team:
            # Поиск в таблице game
            game_query = """
                SELECT 
                    CASE 
                        WHEN team_id_home = :team_id THEN team_id_home
                        ELSE team_id_away
                    END as id,
                    CASE 
                        WHEN team_id_home = :team_id THEN team_name_home
                        ELSE team_name_away
                    END as name,
                    CASE 
                        WHEN team_id_home = :team_id THEN team_abbreviation_home
                        ELSE team_abbreviation_away
                    END as abbrev
                FROM game 
                WHERE team_id_home = :team_id OR team_id_away = :team_id 
                LIMIT 1
            """
            return self._fetch_one(game_query, {"team_id": team_id_str})

        # Статистика команды
        stats_query = """
            SELECT 
                w, l, pct, pts_pg, opp_pts_pg, reb_pg, ast_pg,
                team_conference as conference,
                team_division as division
            FROM team_info_common
            WHERE team_id = :team_id
            ORDER BY season_id DESC
            LIMIT 1
        """
        stats = self._fetch_one(stats_query, {"team_id": team_id_str})

        # Детали команды
        details_query = """
            SELECT arena, arenacapacity as arena_capacity, headcoach as head_coach,
                   generalmanager as general_manager, owner
            FROM team_details
            WHERE team_id = :team_id
        """
        details = self._fetch_one(details_query, {"team_id": team_id_str})

        result = {
            "id": team["id"],
            "name": team["name"],
            "abbrev": team["abbrev"],
            "full_name": team["name"],
            "nickname": team.get("nickname", ""),
            "city": team.get("city", ""),
            "state": team.get("state", ""),
            "arena": details.get("arena") if details else f"{team['name']} Arena",
            "arena_capacity": details.get("arena_capacity", 0) if details else 0,
            "founded_year": team.get("founded_year", 1970),
            "head_coach": details.get("head_coach", "Unknown") if details else "Unknown",
            "general_manager": details.get("general_manager", "Unknown") if details else "Unknown",
            "owner": details.get("owner", "Unknown") if details else "Unknown",
            "conference": stats.get("conference") or team.get("team_conference") if stats else team.get(
                "team_conference"),
            "division": stats.get("division", "Unknown") if stats else "Unknown",
            "wins": stats.get("w", 0) or 0 if stats else 0,
            "losses": stats.get("l", 0) or 0 if stats else 0,
            "win_pct": float(stats.get("pct", 0) or 0) if stats else 0,
            "points_per_game": float(stats.get("pts_pg", 0) or 0) if stats else 0,
            "points_against": float(stats.get("opp_pts_pg", 0) or 0) if stats else 0,
            "rebounds_per_game": float(stats.get("reb_pg", 0) or 0) if stats else 0,
            "assists_per_game": float(stats.get("ast_pg", 0) or 0) if stats else 0,
            "championships": 0
        }
        return result

    def get_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        query = """
            SELECT id, full_name as name, abbreviation as abbrev
            FROM team
            WHERE full_name ILIKE :name OR abbreviation ILIKE :name
            LIMIT 1
        """
        return self._fetch_one(query, {"name": f"%{name}%"})

    def create(self, full_name: str, abbrev: str, nickname: str = None,
               city: str = None, state: str = None, year_founded: int = None) -> Dict[str, Any]:
        query = """
            INSERT INTO team (full_name, abbreviation, nickname, city, state, year_founded)
            VALUES (:name, :abbrev, :nickname, :city, :state, :year_founded)
            RETURNING id, full_name as name, abbreviation as abbrev
        """
        params = {
            "name": full_name,
            "abbrev": abbrev,
            "nickname": nickname,
            "city": city,
            "state": state,
            "year_founded": year_founded
        }
        result = self._execute_with_commit(query, params)
        return dict(result.fetchone()._mapping)

    def update(self, team_id: int, **kwargs) -> bool:
        update_fields = []
        params = {"team_id": team_id}

        field_mapping = {
            "full_name": "full_name",
            "nickname": "nickname",
            "city": "city",
            "state": "state"
        }

        for key, db_field in field_mapping.items():
            if key in kwargs and kwargs[key] is not None:
                update_fields.append(f"{db_field} = :{key}")
                params[key] = kwargs[key]

        if update_fields:
            query = f"UPDATE team SET {', '.join(update_fields)} WHERE id = :team_id"
            self._execute_with_commit(query, params)

        return True

    def delete(self, team_id: int) -> bool:
        query = "DELETE FROM team WHERE id = :team_id"
        self._execute_with_commit(query, {"team_id": str(team_id)})
        return True

    def count(self) -> int:
        query = "SELECT COUNT(*) FROM team"
        return self._fetch_scalar(query) or 0