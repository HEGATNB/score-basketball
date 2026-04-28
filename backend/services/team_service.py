from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import List, Optional, Dict


class TeamService:
    def __init__(self, db: Session):
        self.db = db

    def get_all_teams(self, skip: int = 0, limit: int = 100):
        try:
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
                    t.conference as team_conference,  
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

            result = self.db.execute(text(query), {"limit": limit, "skip": skip}).fetchall()

            teams = []
            for row in result:
                team_data = dict(row._mapping)
                conference = team_data.get('stats_conference') or team_data.get('team_conference')
                conference_id = 0
                if conference == 'Eastern':
                    conference_id = 1
                elif conference == 'Western':
                    conference_id = 2

                teams.append({
                    "id": team_data["id"],
                    "name": team_data["name"],
                    "abbrev": team_data["abbrev"],
                    "full_name": team_data["full_name"],
                    "nickname": team_data.get("nickname", ""),
                    "city": team_data.get("city", ""),
                    "state": team_data.get("state", ""),
                    "arena": team_data.get("arena", f"{team_data['name']} Arena"),
                    "arena_capacity": team_data.get("arena_capacity", 0),
                    "founded_year": team_data.get("founded_year", 1970),
                    "head_coach": team_data.get("head_coach", "Unknown"),
                    "general_manager": team_data.get("general_manager", "Unknown"),
                    "owner": team_data.get("owner", "Unknown"),
                    "conference": conference,
                    "conference_id": conference_id,
                    "division": team_data.get("division", "Unknown"),
                    "wins": team_data.get("wins", 0) or 0,
                    "losses": team_data.get("losses", 0) or 0,
                    "win_pct": float(team_data.get("win_pct", 0) or 0),
                    "points_per_game": float(team_data.get("points_per_game", 0) or 0),
                    "points_against": float(team_data.get("points_against", 0) or 0),
                    "rebounds_per_game": float(team_data.get("rebounds_per_game", 0) or 0),
                    "assists_per_game": float(team_data.get("assists_per_game", 0) or 0),
                    "championships": 0
                })

            return teams

        except Exception as e:
            self.db.rollback()
            print(f"Ошибка получения команд: {e}")
            return []

    def get_team_by_id(self, team_id: int) -> Optional[Dict]:
        try:
            team_id_str = str(team_id)
            query = """
                SELECT 
                    t.id,
                    t.full_name as name,
                    t.abbreviation as abbrev,
                    t.nickname,
                    t.city,
                    t.state,
                    t.year_founded as founded_year,
                    t.conference as team_conference
                FROM team t
                WHERE t.id = :team_id
            """

            result = self.db.execute(text(query), {"team_id": team_id_str}).fetchone()

            if result:
                team_data = dict(result._mapping)
                team_conference = team_data.get('team_conference')

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

                stats = self.db.execute(text(stats_query), {"team_id": team_id_str}).fetchone()

                conference = None
                division = None
                wins = 0
                losses = 0
                win_pct = 0
                points_per_game = 0
                points_against = 0
                rebounds_per_game = 0
                assists_per_game = 0

                if stats:
                    stats_data = dict(stats._mapping)
                    conference = stats_data.get('conference') or team_conference
                    division = stats_data.get('division')
                    wins = stats_data.get('w', 0) or 0
                    losses = stats_data.get('l', 0) or 0
                    win_pct = float(stats_data.get('pct', 0) or 0)
                    points_per_game = float(stats_data.get('pts_pg', 0) or 0)
                    points_against = float(stats_data.get('opp_pts_pg', 0) or 0)
                    rebounds_per_game = float(stats_data.get('reb_pg', 0) or 0)
                    assists_per_game = float(stats_data.get('ast_pg', 0) or 0)
                else:
                    conference = team_conference

                details_query = """
                    SELECT arena, arenacapacity as arena_capacity, headcoach as head_coach,
                           generalmanager as general_manager, owner
                    FROM team_details
                    WHERE team_id = :team_id
                """
                details = self.db.execute(text(details_query), {"team_id": team_id_str}).fetchone()

                arena = None
                arena_capacity = 0
                head_coach = "Unknown"
                general_manager = "Unknown"
                owner = "Unknown"

                if details:
                    details_data = dict(details._mapping)
                    arena = details_data.get('arena')
                    arena_capacity = details_data.get('arena_capacity', 0)
                    head_coach = details_data.get('head_coach', "Unknown")
                    general_manager = details_data.get('general_manager', "Unknown")
                    owner = details_data.get('owner', "Unknown")

                conference_id = 0
                if conference == 'Eastern':
                    conference_id = 1
                elif conference == 'Western':
                    conference_id = 2

                return {
                    "id": team_data["id"],
                    "name": team_data["name"],
                    "abbrev": team_data["abbrev"],
                    "full_name": team_data["name"],
                    "nickname": team_data.get("nickname", ""),
                    "city": team_data.get("city", ""),
                    "state": team_data.get("state", ""),
                    "arena": arena or f"{team_data['name']} Arena",
                    "arena_capacity": arena_capacity,
                    "founded_year": team_data.get("founded_year", 1970),
                    "head_coach": head_coach,
                    "general_manager": general_manager,
                    "owner": owner,
                    "conference": conference,
                    "conference_id": conference_id,
                    "division": division or "Unknown",
                    "wins": wins,
                    "losses": losses,
                    "win_pct": win_pct,
                    "points_per_game": points_per_game,
                    "points_against": points_against,
                    "rebounds_per_game": rebounds_per_game,
                    "assists_per_game": assists_per_game,
                    "championships": 0
                }

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

            result = self.db.execute(text(game_query), {"team_id": team_id_str}).fetchone()

            if result:
                team_data = dict(result._mapping)
                return {
                    "id": team_data["id"],
                    "name": team_data["name"],
                    "abbrev": team_data["abbrev"],
                    "full_name": team_data["name"],
                    "nickname": "",
                    "city": "",
                    "state": "",
                    "arena": f"{team_data['name']} Arena",
                    "arena_capacity": 0,
                    "founded_year": 1970,
                    "head_coach": "Unknown",
                    "general_manager": "Unknown",
                    "owner": "Unknown",
                    "conference": None,
                    "conference_id": 0,
                    "division": "Unknown",
                    "wins": 0,
                    "losses": 0,
                    "win_pct": 0,
                    "points_per_game": 0,
                    "points_against": 0,
                    "rebounds_per_game": 0,
                    "assists_per_game": 0,
                    "championships": 0
                }

            return None

        except Exception as e:
            self.db.rollback()
            print(f"Ошибка получения команды по ID {team_id}: {e}")
            import traceback
            traceback.print_exc()
            return None

    def get_team_by_name(self, name: str) -> Optional[Dict]:
        try:
            query = """
                SELECT id, full_name as name, abbreviation as abbrev
                FROM team
                WHERE full_name ILIKE :name OR abbreviation ILIKE :name
                LIMIT 1
            """
            result = self.db.execute(text(query), {"name": f"%{name}%"}).fetchone()

            if result:
                return dict(result._mapping)
            return None
        except Exception as e:
            print(f"Ошибка получения команды по названию: {e}")
            return None

    def create_team(self, team_data, user_id: int):
        try:
            check_table = self.db.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'team'
                )
            """)).scalar()

            if not check_table:
                return self._create_team_in_game(team_data, user_id)
            result = self.db.execute(
                text("""
                    INSERT INTO team (full_name, abbreviation, nickname, city, state, year_founded)
                    VALUES (:name, :abbrev, :nickname, :city, :state, :year_founded)
                    RETURNING id, full_name as name, abbreviation as abbrev
                """),
                {
                    "name": team_data.full_name,
                    "abbrev": team_data.abbrev,
                    "nickname": team_data.nickname,
                    "city": team_data.city,
                    "state": team_data.state,
                    "year_founded": team_data.founded_year
                }
            )
            self.db.commit()

            team = dict(result.fetchone()._mapping)
            return team

        except Exception as e:
            self.db.rollback()
            print(f"Ошибка создания команды: {e}")
            raise

    def _create_team_in_game(self, team_data, user_id: int):
        max_id = self.db.execute(text("SELECT COALESCE(MAX(team_id_home), 0) FROM game")).scalar()
        max_id = max(max_id, self.db.execute(text("SELECT COALESCE(MAX(team_id_away), 0) FROM game")).scalar())
        new_id = max_id + 1

        # Создаем пустой матч для регистрации команды
        result = self.db.execute(
            text("""
                INSERT INTO game (game_id, team_id_home, team_abbreviation_home, team_name_home, game_date)
                VALUES (:game_id, :team_id, :abbrev, :name, :date)
                RETURNING team_id_home as id, team_abbreviation_home as abbrev, team_name_home as name
            """),
            {
                "game_id": f"PLACEHOLDER_{new_id}",
                "team_id": new_id,
                "abbrev": team_data.abbrev,
                "name": team_data.full_name,
                "date": datetime.utcnow()
            }
        )
        self.db.commit()

        team = dict(result.fetchone()._mapping)
        return {
            "id": team["id"],
            "name": team["name"],
            "abbrev": team["abbrev"]
        }

    def update_team(self, team_id: int, team_data, user_id: int):
        try:
            team = self.get_team_by_id(team_id)
            if not team:
                raise ValueError(f"Team with id {team_id} not found")

            update_fields = []
            params = {"team_id": team_id}

            if team_data.name is not None:
                update_fields.append("full_name = :name")
                params["name"] = team_data.name
            if team_data.nickname is not None:
                update_fields.append("nickname = :nickname")
                params["nickname"] = team_data.nickname
            if team_data.city is not None:
                update_fields.append("city = :city")
                params["city"] = team_data.city
            if team_data.state is not None:
                update_fields.append("state = :state")
                params["state"] = team_data.state

            if update_fields:
                query = f"UPDATE team SET {', '.join(update_fields)} WHERE id = :team_id"
                self.db.execute(text(query), params)
                self.db.commit()

            if team_data.arena is not None or team_data.head_coach is not None:
                exists = self.db.execute(
                    text("SELECT 1 FROM team_details WHERE team_id = :team_id"),
                    {"team_id": team_id}
                ).fetchone()

                if exists:
                    update_details = []
                    if team_data.arena is not None:
                        update_details.append("arena = :arena")
                    if team_data.head_coach is not None:
                        update_details.append("headcoach = :head_coach")
                    if team_data.general_manager is not None:
                        update_details.append("generalmanager = :general_manager")
                    if team_data.owner is not None:
                        update_details.append("owner = :owner")

                    if update_details:
                        query = f"UPDATE team_details SET {', '.join(update_details)} WHERE team_id = :team_id"
                        self.db.execute(text(query), params)
                else:
                    self.db.execute(
                        text("""
                            INSERT INTO team_details (team_id, arena, headcoach, generalmanager, owner)
                            VALUES (:team_id, :arena, :head_coach, :general_manager, :owner)
                        """),
                        {
                            "team_id": team_id,
                            "arena": team_data.arena,
                            "head_coach": team_data.head_coach,
                            "general_manager": team_data.general_manager,
                            "owner": team_data.owner
                        }
                    )
                self.db.commit()

            return self.get_team_by_id(team_id)

        except Exception as e:
            self.db.rollback()
            print(f"Ошибка обновления команды: {e}")
            raise

    def delete_team(self, team_id: int, user_id: int):
        try:
            team = self.get_team_by_id(team_id)
            if not team:
                raise ValueError(f"Team with id {team_id} not found")

            matches_count = self.db.execute(
                text("""
                    SELECT COUNT(*) FROM game 
                    WHERE team_id_home = :team_id OR team_id_away = :team_id
                """),
                {"team_id": team_id}
            ).scalar()

            if matches_count > 0:
                raise ValueError(f"Cannot delete team with {matches_count} existing games")
            self.db.execute(
                text("DELETE FROM team_details WHERE team_id = :team_id"),
                {"team_id": team_id}
            )
            self.db.execute(
                text("DELETE FROM team WHERE id = :team_id"),
                {"team_id": team_id}
            )

            self.db.commit()
            return team

        except Exception as e:
            self.db.rollback()
            print(f"Ошибка удаления команды: {e}")
            raise