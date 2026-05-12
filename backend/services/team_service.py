# services/team_service.py
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import List, Optional, Dict

from repositories.team_repository import TeamRepository


class TeamService:
    def __init__(self, db: Session):
        self.db = db
        self.team_repo = TeamRepository(db)

    def get_all_teams(self, skip: int = 0, limit: int = 100):
        try:
            teams = self.team_repo.get_all(skip=skip, limit=limit)

            # Преобразование данных для совместимости с фронтендом
            for team in teams:
                conference = team.get('stats_conference') or team.get('team_conference')
                conference_id = 0
                if conference == 'Eastern':
                    conference_id = 1
                elif conference == 'Western':
                    conference_id = 2

                team['conference_id'] = conference_id
                team['conference'] = conference

                # Преобразуем None в 0 для числовых полей
                team['points_per_game'] = float(team.get('points_per_game') or 0)
                team['points_against'] = float(team.get('points_against') or 0)
                team['win_pct'] = float(team.get('win_pct') or 0)
                team['wins'] = int(team.get('wins') or 0)
                team['losses'] = int(team.get('losses') or 0)
                team['rebounds_per_game'] = float(team.get('rebounds_per_game') or 0)
                team['assists_per_game'] = float(team.get('assists_per_game') or 0)

            return teams

        except Exception as e:
            print(f"Ошибка получения команд: {e}")
            import traceback
            traceback.print_exc()
            return []

    def get_team_by_id(self, team_id: int) -> Optional[Dict]:
        return self.team_repo.get_by_id(team_id)

    def get_team_by_name(self, name: str) -> Optional[Dict]:
        return self.team_repo.get_by_name(name)

    def create_team(self, team_data, user_id: int):
        try:
            team = self.team_repo.create(
                full_name=team_data.full_name,
                abbrev=team_data.abbrev,
                nickname=getattr(team_data, 'nickname', None),
                city=getattr(team_data, 'city', None),
                state=getattr(team_data, 'state', None),
                year_founded=getattr(team_data, 'founded_year', None)
            )
            return team

        except Exception as e:
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

            # Подготавливаем данные для обновления через репозиторий
            update_data = {}
            if hasattr(team_data, 'name') and team_data.name is not None:
                update_data['full_name'] = team_data.name
            if hasattr(team_data, 'nickname') and team_data.nickname is not None:
                update_data['nickname'] = team_data.nickname
            if hasattr(team_data, 'city') and team_data.city is not None:
                update_data['city'] = team_data.city
            if hasattr(team_data, 'state') and team_data.state is not None:
                update_data['state'] = team_data.state

            if update_data:
                self.team_repo.update(team_id, **update_data)

            # Обновление team_details
            if hasattr(team_data, 'arena') and team_data.arena is not None:
                self.team_repo.update_details(team_id, arena=team_data.arena)
            if hasattr(team_data, 'head_coach') and team_data.head_coach is not None:
                self.team_repo.update_details(team_id, headcoach=team_data.head_coach)
            if hasattr(team_data, 'general_manager') and team_data.general_manager is not None:
                self.team_repo.update_details(team_id, generalmanager=team_data.general_manager)
            if hasattr(team_data, 'owner') and team_data.owner is not None:
                self.team_repo.update_details(team_id, owner=team_data.owner)

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

            self.team_repo.delete(team_id)
            return team

        except Exception as e:
            self.db.rollback()
            print(f"Ошибка удаления команды: {e}")
            raise