import hashlib
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from repositories.game_repository import GameRepository


class MatchService:
    def __init__(self, db: Session):
        self.db = db
        self.game_repo = GameRepository(db)

    def get_all_matches(self, filters: Dict = None, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Получение всех матчей"""
        try:
            status_filter = None
            if filters and filters.get("status"):
                status_filter = filters["status"]

            games = self.game_repo.get_all(
                status_filter=status_filter, skip=skip, limit=limit,
                upcoming_from=(filters or {}).get("upcoming_from"),
                team_id=(filters or {}).get("team_id"),
            )

            matches = []

            for game in games:
                game_id_val = game.get("game_id")
                source_is_espn = str(game_id_val).startswith("ESPN_")
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
                        if source_is_espn and game_date.tzinfo is None:
                            game_date = game_date.replace(tzinfo=timezone.utc)
                        date_str = game_date.isoformat()
                    elif isinstance(game_date, str):
                        try:
                            if ' ' in game_date:
                                date_obj = datetime.strptime(game_date, "%Y-%m-%d %H:%M:%S")
                            else:
                                date_obj = datetime.fromisoformat(game_date)
                            if source_is_espn and date_obj.tzinfo is None:
                                date_obj = date_obj.replace(tzinfo=timezone.utc)
                            date_str = date_obj.isoformat()
                        except:
                            date_str = game_date

                # Keep archive URLs consistent across workers and deployments.
                unique_key = f"{game_id_val}_{game.get('season_id')}".encode()
                match_id = int.from_bytes(hashlib.blake2b(unique_key, digest_size=6).digest(), "big")

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
            self.db.rollback()
            return []

    def get_match_by_id(self, match_id: int) -> Optional[Dict[str, Any]]:
        """Получение матча по ID"""
        try:
            # Получаем все матчи и фильтруем
            matches = self.get_all_matches(limit=10000)
            for match in matches:
                if match["id"] == match_id:
                    return match
                if match_id < 10 ** 8:
                    legacy_key = f"{match['game_id']}_{match['season']}"
                    if abs(hash(legacy_key)) % (10 ** 8) == match_id:
                        return match
            return None

        except Exception as e:
            print(f"Ошибка получения матча по ID: {e}")
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