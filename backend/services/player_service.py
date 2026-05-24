from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Dict, Any
import re

from repositories.player_repository import PlayerRepository


class PlayerService:
    def __init__(self, db: Session):
        self.db = db
        self.player_repo = PlayerRepository(db)

    def _format_height(self, height_cm: Optional[str]) -> Optional[str]:
        """Форматирует рост"""
        if not height_cm:
            return None
        try:
            height_num = float(height_cm)
            return f"{int(height_num)} cm"
        except:
            return str(height_cm)

    def _format_weight(self, weight_kg: Optional[str]) -> Optional[float]:
        """Возвращает вес как число (в кг)"""
        if not weight_kg:
            return None
        try:
            return float(weight_kg)
        except (ValueError, TypeError):
            return None

    def get_all_players(
            self,
            team_abbrev: Optional[str] = None,
            season: Optional[str] = None,
            search: Optional[str] = None,
            min_games: int = 5,
            sort_by: str = 'pts',
            sort_order: str = 'desc',
            skip: int = 0,
            limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Получение всех игроков с группировкой по имени
        """
        try:
            players_data = self.player_repo.get_all(
                team_abbrev=team_abbrev,
                season=season,
                search=search,
                min_games=min_games,
                sort_by=sort_by,
                sort_order=sort_order,
                skip=skip,
                limit=limit
            )

            # Группируем игроков по имени
            players_by_name = {}

            for player_data in players_data:
                name = player_data.get("player_name")
                if name not in players_by_name:
                    players_by_name[name] = []
                players_by_name[name].append(player_data)

            # Формируем итоговый список игроков (один игрок = все сезоны)
            players = []

            for name, seasons_data in players_by_name.items():
                # Сортируем сезоны по убыванию
                seasons_data.sort(key=lambda x: x.get("season", ""), reverse=True)

                # Берём самый новый сезон как основной
                latest = seasons_data[0]

                # Собираем список всех сезонов
                seasons_list = [s.get("season") for s in seasons_data if s.get("season")]

                # Разбиваем имя на части
                full_name = name
                name_parts = full_name.split(" ")
                first_name = name_parts[0] if name_parts else ""
                last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

                # Получаем номер из draft_number
                draft_number = latest.get("draft_number")
                number = None
                if draft_number:
                    match = re.search(r'\d+', str(draft_number))
                    if match:
                        number = match.group()

                position = latest.get("position")

                # Формируем объект команды
                team_obj = None
                if latest.get("team_id"):
                    team_obj = {
                        "id": latest.get("team_id"),
                        "name": latest.get("team_name") or latest.get("team_abbrev") or latest.get("team_abbreviation"),
                        "abbrev": latest.get("team_abbrev") or latest.get("team_abbreviation"),
                        "city": latest.get("team_city"),
                        "nickname": latest.get("team_nickname"),
                        "state": latest.get("team_state"),
                        "foundedYear": latest.get("team_founded_year")
                    }

                players.append({
                    "id": latest.get("id"),
                    "nba_person_id": latest.get("nba_person_id"),
                    "first_name": first_name,
                    "last_name": last_name,
                    "full_name": full_name,
                    "number": number,
                    "position": position,
                    "team_abbrev": latest.get("team_abbreviation"),
                    "team_abbreviation": latest.get("team_abbreviation"),
                    "team": team_obj,
                    "age": float(latest.get("age") or 0),
                    "height": self._format_height(latest.get("player_height")),
                    "weight": self._format_weight(latest.get("player_weight")),
                    "player_height": latest.get("player_height"),
                    "player_weight": latest.get("player_weight"),
                    "college": latest.get("college"),
                    "country": latest.get("country"),
                    "games_played": latest.get("games_played"),
                    "points_per_game": float(latest.get("points_per_game") or 0),
                    "rebounds_per_game": float(latest.get("rebounds_per_game") or 0),
                    "assists_per_game": float(latest.get("assists_per_game") or 0),
                    "net_rating": float(latest.get("net_rating") or 0),
                    "offensive_rebound_pct": float(latest.get("oreb_pct") or 0),
                    "defensive_rebound_pct": float(latest.get("dreb_pct") or 0),
                    "usage_rate": float(latest.get("usage_rate") or 0),
                    "true_shooting": float(latest.get("true_shooting") or 0),
                    "assist_percentage": float(latest.get("assist_percentage") or 0),
                    "draft_year": latest.get("draft_year"),
                    "draft_round": latest.get("draft_round"),
                    "draft_number": draft_number,
                    "season": latest.get("season"),
                    "seasons": seasons_list,
                    "minutes_per_game": 0,
                    "steals_per_game": 0,
                    "blocks_per_game": 0,
                })

            print(f"Сгруппировано {len(players)} игроков")
            return players

        except Exception as e:
            print(f"Ошибка получения игроков: {e}")
            import traceback
            traceback.print_exc()
            return []

    def get_player_by_id(self, player_id: int) -> Optional[Dict[str, Any]]:
        """Получение игрока по ID с группировкой сезонов"""
        try:
            player_data = self.player_repo.get_by_id(player_id)

            if not player_data:
                return None

            # Получаем все записи игрока с разными сезонами
            check_common = self.player_repo.check_common_player_info_exists()

            if check_common:
                all_results = self.player_repo.get_all_by_name_with_position(player_data["player_name"])
            else:
                all_results = self.player_repo.get_all_by_name(player_data["player_name"])

            if not all_results:
                return None

            seasons_data = list(all_results)
            seasons_data.sort(key=lambda x: x.get("season", ""), reverse=True)

            current = seasons_data[0]

            seasons_list = [s.get("season") for s in seasons_data if s.get("season")]

            full_name = current.get("player_name", "")
            name_parts = full_name.split(" ")
            first_name = name_parts[0] if name_parts else ""
            last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

            draft_number = current.get("draft_number")
            number = None
            if draft_number:
                match = re.search(r'\d+', str(draft_number))
                if match:
                    number = match.group()

            position = current.get("position")

            team_obj = None
            if current.get("team_id"):
                team_obj = {
                    "id": current.get("team_id"),
                    "name": current.get("team_name") or current.get("team_abbrev") or current.get("team_abbreviation"),
                    "abbrev": current.get("team_abbrev") or current.get("team_abbreviation"),
                    "city": current.get("team_city"),
                    "nickname": current.get("team_nickname"),
                    "state": current.get("team_state"),
                    "foundedYear": current.get("team_founded_year")
                }

            return {
                "id": current.get("id"),
                "nba_person_id": current.get("nba_person_id"),
                "first_name": first_name,
                "last_name": last_name,
                "full_name": full_name,
                "number": number,
                "position": position,
                "team_abbrev": current.get("team_abbreviation"),
                "team_abbreviation": current.get("team_abbreviation"),
                "team": team_obj,
                "age": float(current.get("age") or 0),
                "height": self._format_height(current.get("player_height")),
                "weight": self._format_weight(current.get("player_weight")),
                "player_height": current.get("player_height"),
                "player_weight": current.get("player_weight"),
                "college": current.get("college"),
                "country": current.get("country"),
                "games_played": current.get("games_played"),
                "points_per_game": float(current.get("points_per_game") or 0),
                "rebounds_per_game": float(current.get("rebounds_per_game") or 0),
                "assists_per_game": float(current.get("assists_per_game") or 0),
                "net_rating": float(current.get("net_rating") or 0),
                "offensive_rebound_pct": float(current.get("oreb_pct") or 0),
                "defensive_rebound_pct": float(current.get("dreb_pct") or 0),
                "usage_rate": float(current.get("usage_rate") or 0),
                "true_shooting": float(current.get("true_shooting") or 0),
                "assist_percentage": float(current.get("assist_percentage") or 0),
                "draft_year": current.get("draft_year"),
                "draft_round": current.get("draft_round"),
                "draft_number": draft_number,
                "season": current.get("season"),
                "seasons": seasons_list,
                "minutes_per_game": 0,
                "steals_per_game": 0,
                "blocks_per_game": 0,
            }

        except Exception as e:
            print(f"Ошибка получения игрока по ID: {e}")
            return None

    def get_player_seasons_breakdown(self, player_id: int) -> Optional[Dict[str, Any]]:
        """Per-season stats for the PlayerDetailModal on the frontend.

        Returns career averages, season-by-season rows, and the unique list
        of teams the player has appeared for.
        """
        try:
            player_data = self.player_repo.get_by_id(player_id)
            if not player_data:
                return None
            player_name = player_data["player_name"]

            check_common = self.player_repo.check_common_player_info_exists()
            rows = (
                self.player_repo.get_all_by_name_with_position(player_name)
                if check_common
                else self.player_repo.get_all_by_name(player_name)
            )
            if not rows:
                return None

            seasons = []
            career_pts = career_reb = career_ast = 0.0
            total_games = 0
            for d in rows:
                gp = int(d.get("games_played") or 0)
                pts = float(d.get("points_per_game") or 0)
                reb = float(d.get("rebounds_per_game") or 0)
                ast = float(d.get("assists_per_game") or 0)
                total_games += gp
                career_pts += pts * gp
                career_reb += reb * gp
                career_ast += ast * gp
                seasons.append({
                    "season": d.get("season"),
                    "team_abbrev": d.get("team_abbreviation"),
                    "team_name": d.get("team_name"),
                    "team_city": d.get("team_city"),
                    "games_played": gp,
                    "points_per_game": round(pts, 1),
                    "rebounds_per_game": round(reb, 1),
                    "assists_per_game": round(ast, 1),
                    "net_rating": float(d.get("net_rating") or 0),
                    "usage_rate": float(d.get("usage_rate") or 0),
                    "true_shooting": float(d.get("true_shooting") or 0),
                    "assist_percentage": float(d.get("assist_percentage") or 0),
                    "offensive_rebound_pct": float(d.get("oreb_pct") or 0),
                    "defensive_rebound_pct": float(d.get("dreb_pct") or 0),
                    "age": float(d.get("age") or 0),
                })

            career = {
                "seasons_count": len(seasons),
                "games": total_games,
                "points_per_game": round(career_pts / total_games, 1) if total_games else 0,
                "rebounds_per_game": round(career_reb / total_games, 1) if total_games else 0,
                "assists_per_game": round(career_ast / total_games, 1) if total_games else 0,
            }

            teams_seen: List[Dict[str, Any]] = []
            seen = set()
            for s in seasons:
                ab = s.get("team_abbrev")
                if ab and ab not in seen:
                    seen.add(ab)
                    teams_seen.append({
                        "abbrev": ab,
                        "name": s.get("team_name"),
                        "city": s.get("team_city"),
                        "first_season": s.get("season"),
                    })

            return {
                "player_name": player_name,
                "career": career,
                "seasons": seasons,
                "teams": teams_seen,
            }
        except Exception as e:
            print(f"Error in get_player_seasons_breakdown: {e}")
            import traceback
            traceback.print_exc()
            return None

    def get_players_by_team(self, team_abbrev: str) -> List[Dict[str, Any]]:
        return self.get_all_players(team_abbrev=team_abbrev)

    def get_seasons(self) -> List[str]:
        return self.player_repo.get_seasons()

    def get_top_players(
            self,
            category: str = 'pts',
            min_games: int = 10,
            limit: int = 50
    ) -> List[Dict[str, Any]]:
        return self.player_repo.get_top(category=category, min_games=min_games, limit=limit)