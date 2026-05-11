from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from repositories.base_repository import BaseRepository


class PlayerRepository(BaseRepository):
    """Репозиторий для работы с таблицами players и common_player_info"""

    def __init__(self, db: Session):
        super().__init__(db)

    def get_all(self, team_abbrev: str = None, season: str = None, search: str = None,
                min_games: int = 5, sort_by: str = 'pts', sort_order: str = 'desc',
                skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:

        query = """
            SELECT 
                p.id,
                p.player_name,
                p.team_abbreviation,
                p.age,
                p.player_height,
                p.player_weight,
                p.college,
                p.country,
                p.draft_year,
                p.draft_round,
                p.draft_number,
                p.gp as games_played,
                p.pts as points_per_game,
                p.reb as rebounds_per_game,
                p.ast as assists_per_game,
                p.net_rating,
                p.oreb_pct,
                p.dreb_pct,
                p.usg_pct as usage_rate,
                p.ts_pct as true_shooting,
                p.ast_pct as assist_percentage,
                p.season,
                t.id as team_id,
                t.full_name as team_name,
                t.abbreviation as team_abbrev,
                t.nickname as team_nickname,
                t.city as team_city,
                t.state as team_state,
                t.year_founded as team_founded_year
            FROM players p
            LEFT JOIN team t ON p.team_abbreviation = t.abbreviation
            WHERE p.gp >= :min_games
        """
        params = {"min_games": min_games}

        if team_abbrev:
            query += " AND p.team_abbreviation = :team_abbrev"
            params["team_abbrev"] = team_abbrev.upper()

        if season:
            query += " AND p.season = :season"
            params["season"] = season

        if search:
            query += " AND p.player_name ILIKE :search"
            params["search"] = f"%{search}%"

        valid_sort = ['pts', 'reb', 'ast', 'player_name', 'gp', 'season']
        if sort_by not in valid_sort:
            sort_by = 'pts'
        sort_dir = 'DESC' if sort_order.lower() == 'desc' else 'ASC'

        query += f" ORDER BY p.{sort_by} {sort_dir} NULLS LAST"
        query += " LIMIT :limit OFFSET :skip"
        params["limit"] = limit
        params["skip"] = skip

        return self._fetch_all(query, params)

    def get_by_id(self, player_id: int) -> Optional[Dict[str, Any]]:
        query = """
            SELECT player_name FROM players WHERE id = :player_id
        """
        result = self._fetch_one(query, {"player_id": player_id})
        if not result:
            return None

        player_name = result["player_name"]

        query_all = """
            SELECT 
                p.id,
                p.player_name,
                p.team_abbreviation,
                p.age,
                p.player_height,
                p.player_weight,
                p.college,
                p.country,
                p.draft_year,
                p.draft_round,
                p.draft_number,
                p.gp as games_played,
                p.pts as points_per_game,
                p.reb as rebounds_per_game,
                p.ast as assists_per_game,
                p.net_rating,
                p.oreb_pct,
                p.dreb_pct,
                p.usg_pct as usage_rate,
                p.ts_pct as true_shooting,
                p.ast_pct as assist_percentage,
                p.season,
                t.id as team_id,
                t.full_name as team_name,
                t.abbreviation as team_abbrev,
                t.nickname as team_nickname,
                t.city as team_city,
                t.state as team_state,
                t.year_founded as team_founded_year
            FROM players p
            LEFT JOIN team t ON p.team_abbreviation = t.abbreviation
            WHERE p.player_name = :player_name
            ORDER BY p.season DESC
        """
        return self._fetch_one(query_all, {"player_name": player_name})

    def get_by_team(self, team_abbrev: str) -> List[Dict[str, Any]]:
        return self.get_all(team_abbrev=team_abbrev)

    def get_seasons(self) -> List[str]:
        query = "SELECT DISTINCT season FROM players ORDER BY season DESC"
        results = self._fetch_all(query)
        return [r["season"] for r in results if r["season"]]

    def get_top(self, category: str = 'pts', min_games: int = 10, limit: int = 50) -> List[Dict[str, Any]]:
        valid = ['pts', 'reb', 'ast', 'net_rating']
        if category not in valid:
            category = 'pts'

        query = f"""
            SELECT DISTINCT ON (p.player_name)
                p.id,
                p.player_name,
                p.team_abbreviation,
                p.gp,
                p.{category} as value,
                p.pts,
                p.reb,
                p.ast
            FROM players p
            WHERE p.gp >= :min_games
            ORDER BY p.player_name, p.season DESC
        """
        results = self._fetch_all(query, {"min_games": min_games})
        results.sort(key=lambda x: x.get("value", 0), reverse=True)
        return results[:limit]

    def count(self) -> int:
        query = "SELECT COUNT(*) FROM players"
        return self._fetch_scalar(query) or 0