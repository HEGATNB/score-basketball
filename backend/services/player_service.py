# services/player_service.py

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Dict, Any
import re


class PlayerService:
    def __init__(self, db: Session):
        self.db = db

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
            # Проверяем наличие таблицы common_player_info
            check_common = self.db.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'common_player_info'
                )
            """)).scalar()

            # Формируем базовый запрос с JOIN на team для получения полной информации о команде
            base_query = """
                SELECT 
                    p.id as id,
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
                    t.year_founded as team_founded_year,
                    {position_select}
                FROM players p
                LEFT JOIN team t ON p.team_abbreviation = t.abbreviation
                {position_join}
                WHERE p.gp >= :min_games
            """

            position_select = "c.position" if check_common else "NULL as position"
            position_join = "LEFT JOIN common_player_info c ON p.player_name = c.display_first_last" if check_common else ""

            query = base_query.format(
                position_select=position_select,
                position_join=position_join
            )

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

            # Валидация сортировки
            valid_sort_columns = ['pts', 'reb', 'ast', 'player_name', 'gp', 'season']
            if sort_by not in valid_sort_columns:
                sort_by = 'pts'

            sort_direction = 'DESC' if sort_order.lower() == 'desc' else 'ASC'

            query += f" ORDER BY p.{sort_by} {sort_direction} NULLS LAST"
            query += " LIMIT :limit OFFSET :skip"

            params["limit"] = limit
            params["skip"] = skip

            print(f"Выполняем запрос players с параметрами: {params}")
            result = self.db.execute(text(query), params).fetchall()
            print(f"Найдено {len(result)} записей")

            # Группируем игроков по имени
            players_by_name = {}

            for row in result:
                player_data = dict(row._mapping)
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
                    "seasons": seasons_list,  # Список всех сезонов игрока
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
            # Сначала получаем имя игрока
            name_result = self.db.execute(
                text("SELECT player_name FROM players WHERE id = :player_id"),
                {"player_id": player_id}
            ).fetchone()

            if not name_result:
                return None

            player_name = name_result[0]

            # Получаем все записи игрока с разными сезонами
            check_common = self.db.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'common_player_info'
                )
            """)).scalar()

            if check_common:
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
                        t.year_founded as team_founded_year,
                        c.position
                    FROM players p
                    LEFT JOIN team t ON p.team_abbreviation = t.abbreviation
                    LEFT JOIN common_player_info c ON p.player_name = c.display_first_last
                    WHERE p.player_name = :player_name
                    ORDER BY p.season DESC
                """
            else:
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
                        t.year_founded as team_founded_year,
                        NULL as position
                    FROM players p
                    LEFT JOIN team t ON p.team_abbreviation = t.abbreviation
                    WHERE p.player_name = :player_name
                    ORDER BY p.season DESC
                """

            all_results = self.db.execute(text(query), {"player_name": player_name}).fetchall()

            if not all_results:
                return None

            seasons_data = [dict(row._mapping) for row in all_results]
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

    def get_players_by_team(self, team_abbrev: str) -> List[Dict[str, Any]]:
        return self.get_all_players(team_abbrev=team_abbrev)

    def get_seasons(self) -> List[str]:
        try:
            result = self.db.execute(
                text("SELECT DISTINCT season FROM players ORDER BY season DESC")
            ).fetchall()
            return [row[0] for row in result]
        except Exception as e:
            print(f"Ошибка получения сезонов: {e}")
            return []

    def get_top_players(
            self,
            category: str = 'pts',
            min_games: int = 10,
            limit: int = 50
    ) -> List[Dict[str, Any]]:
        valid_categories = ['pts', 'reb', 'ast', 'net_rating']
        if category not in valid_categories:
            category = 'pts'

        try:
            query = f"""
                SELECT DISTINCT ON (p.player_name)
                    p.id as id,
                    p.player_name,
                    p.team_abbreviation,
                    p.gp,
                    p.{category} as value,
                    p.pts,
                    p.reb,
                    p.ast,
                    p.season,
                    c.position
                FROM players p
                LEFT JOIN common_player_info c ON p.player_name = c.display_first_last
                WHERE p.gp >= :min_games
                ORDER BY p.player_name, p.season DESC
            """

            result = self.db.execute(
                text(query),
                {"min_games": min_games}
            ).fetchall()

            players_list = []
            for row in result:
                player_data = dict(row._mapping)
                players_list.append({
                    "id": player_data.get("id"),
                    "player_name": player_data.get("player_name"),
                    "team_abbrev": player_data.get("team_abbreviation"),
                    "games_played": player_data.get("gp"),
                    "value": float(player_data.get("value") or 0),
                    "points_per_game": float(player_data.get("pts") or 0),
                    "rebounds_per_game": float(player_data.get("reb") or 0),
                    "assists_per_game": float(player_data.get("ast") or 0),
                    "position": player_data.get("position"),
                    "season": player_data.get("season")
                })

            players_list.sort(key=lambda x: x.get("value", 0), reverse=True)

            return players_list[:limit]

        except Exception as e:
            print(f"Ошибка получения топ-игроков: {e}")
            return []