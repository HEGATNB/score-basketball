# services/match_service.py
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import List, Optional, Dict, Any


class MatchService:
    def __init__(self, db: Session):
        self.db = db

    # services/match_service.py - исправленная генерация ID

    # services/match_service.py - только исправленный метод get_all_matches

    def get_all_matches(self, filters: Dict = None, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Получение всех матчей"""
        try:
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

            where_clauses = []
            params = {}

            if filters and filters.get("status"):
                if filters["status"] == "finished":
                    where_clauses.append("g.pts_home IS NOT NULL AND g.pts_away IS NOT NULL")
                elif filters["status"] == "scheduled":
                    where_clauses.append("g.pts_home IS NULL OR g.pts_away IS NULL")

            if where_clauses:
                query += " AND " + " AND ".join(where_clauses)

            query += " ORDER BY g.game_date DESC NULLS LAST LIMIT :limit OFFSET :skip"
            params["limit"] = limit
            params["skip"] = skip

            result = self.db.execute(text(query), params).fetchall()

            matches = []
            used_ids = set()

            for row in result:
                game = dict(row._mapping)

                # Определяем статус по наличию счета
                has_score = (game.get("pts_home") is not None and
                             game.get("pts_away") is not None and
                             game.get("pts_home") > 0 and
                             game.get("pts_away") > 0)

                status = "finished" if has_score else "scheduled"

                # Получаем счет (если есть)
                home_score = None
                away_score = None
                if has_score:
                    home_score = int(float(game.get("pts_home"))) if game.get("pts_home") else None
                    away_score = int(float(game.get("pts_away"))) if game.get("pts_away") else None

                # Парсим дату
                game_date = game.get("game_date")
                date_str = None
                if game_date:
                    if isinstance(game_date, datetime):
                        date_str = game_date.isoformat()
                    elif isinstance(game_date, str):
                        try:
                            if ' ' in game_date:
                                date_obj = datetime.strptime(game_date, "%Y-%m-%d %H:%M:%S")
                            else:
                                date_obj = datetime.fromisoformat(game_date)
                            date_str = date_obj.isoformat()
                        except:
                            date_str = game_date

                # Генерируем уникальный ID
                game_id_val = game.get("game_id")
                season_id_val = game.get("season_id")
                unique_key = f"{game_id_val}_{season_id_val}"
                match_id = abs(hash(unique_key)) % (10 ** 8)

                original_id = match_id
                counter = 1
                while match_id in used_ids:
                    match_id = (original_id + counter) % (10 ** 8)
                    counter += 1
                used_ids.add(match_id)

                home_team_name = game.get("home_team_name")
                away_team_name = game.get("away_team_name")

                if not home_team_name:
                    home_team_name = game.get("home_team_abbrev", f"Team {game.get('team_id_home')}")
                if not away_team_name:
                    away_team_name = game.get("away_team_abbrev", f"Team {game.get('team_id_away')}")

                match = {
                    "id": match_id,
                    "game_id": game.get("game_id"),
                    "date": date_str,
                    "status": status,
                    "home_team_id": int(float(game.get("team_id_home"))) if game.get("team_id_home") else 0,
                    "away_team_id": int(float(game.get("team_id_away"))) if game.get("team_id_away") else 0,
                    "home_team": {
                        "id": int(float(game.get("team_id_home"))) if game.get("team_id_home") else 0,
                        "name": home_team_name,
                        "abbrev": game.get("home_team_abbrev", f"T{game.get('team_id_home')}")
                    },
                    "away_team": {
                        "id": int(float(game.get("team_id_away"))) if game.get("team_id_away") else 0,
                        "name": away_team_name,
                        "abbrev": game.get("away_team_abbrev", f"T{game.get('team_id_away')}")
                    },
                    "home_score": home_score,
                    "away_score": away_score,
                    "season": game.get("season_id"),
                    "season_type": game.get("season_type")
                }
                matches.append(match)

            return matches

        except Exception as e:
            print(f"Error getting matches: {e}")
            import traceback
            traceback.print_exc()
            return []

    def get_match_by_id(self, match_id: int) -> Optional[Dict[str, Any]]:
        """Получение матча по ID"""
        try:
            # Получаем конкретный матч по ID
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

            # Так как у нас нет прямого соответствия, получаем все и фильтруем
            matches = self.get_all_matches(limit=10000)
            for match in matches:
                if match["id"] == match_id:
                    return match
            return None

        except Exception as e:
            print(f"❌ Ошибка получения матча по ID: {e}")
            return None

    def create_match(self, match_data, user_id: int) -> Dict[str, Any]:
        """Создание нового матча"""
        raise NotImplementedError("Метод create_match еще не реализован")

    def update_match_result(self, match_id: int, home_score: int, away_score: int, user_id: int) -> Dict[str, Any]:
        """Обновление результата матча"""
        raise NotImplementedError("Метод update_match_result еще не реализован")

    def delete_match(self, match_id: int, user_id: int) -> Dict[str, Any]:
        """Удаление матча"""
        raise NotImplementedError("Метод delete_match еще не реализован")