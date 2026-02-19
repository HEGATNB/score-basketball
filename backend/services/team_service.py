from sqlalchemy.orm import Session
import sqlite3
from datetime import datetime
import sys
import os
from typing import List, Optional, Dict

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import schemas

DB_PATH = "./nba.sqlite"


class TeamService:
    def __init__(self, db: Session):
        self.db = db
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row

    def get_all_teams(self, skip: int = 0, limit: int = 100):
        """Получение всех команд"""
        cursor = self.conn.cursor()

        # Проверяем есть ли таблица game с командами
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='game'")
        if cursor.fetchone():
            cursor.execute("""
                SELECT DISTINCT 
                    team_id_home as id, 
                    team_name_home as name, 
                    team_abbreviation_home as abbrev,
                    team_name_home as full_name,
                    '' as city,
                    '' as arena,
                    0 as founded_year,
                    0 as conference_id,
                    0 as division_id,
                    0 as championships,
                    0 as wins,
                    0 as losses,
                    0 as points_per_game,
                    0 as points_against
                FROM game 
                UNION 
                SELECT DISTINCT 
                    team_id_away as id, 
                    team_name_away as name, 
                    team_abbreviation_away as abbrev,
                    team_name_away as full_name,
                    '' as city,
                    '' as arena,
                    0 as founded_year,
                    0 as conference_id,
                    0 as division_id,
                    0 as championships,
                    0 as wins,
                    0 as losses,
                    0 as points_per_game,
                    0 as points_against
                FROM game
                LIMIT ? OFFSET ?
            """, (limit, skip))
        else:
            # Демо-данные
            cursor.execute("""
                SELECT 1 as id, 'Boston Celtics' as name, 'BOS' as abbrev, 'Boston Celtics' as full_name,
                       'Boston' as city, 'TD Garden' as arena, 1946 as founded_year,
                       1 as conference_id, 1 as division_id, 17 as championships,
                       48 as wins, 24 as losses, 118.5 as points_per_game, 112.3 as points_against
                UNION
                SELECT 2, 'Los Angeles Lakers', 'LAL', 'Los Angeles Lakers',
                       'Los Angeles', 'Crypto.com Arena', 1947, 1, 2, 17,
                       43, 29, 116.2, 114.1
                UNION
                SELECT 3, 'Golden State Warriors', 'GSW', 'Golden State Warriors',
                       'San Francisco', 'Chase Center', 1946, 1, 3, 7,
                       41, 31, 118.9, 115.2
                LIMIT ? OFFSET ?
            """, (limit, skip))

        return [dict(row) for row in cursor.fetchall()]

    def get_team_by_id(self, team_id: int):
        """Получение команды по ID"""
        cursor = self.conn.cursor()

        cursor.execute("""
            SELECT * FROM game WHERE team_id_home = ? OR team_id_away = ? LIMIT 1
        """, (team_id, team_id))

        row = cursor.fetchone()
        if row:
            team_data = dict(row)
            if team_data["team_id_home"] == team_id:
                return {
                    "id": team_data["team_id_home"],
                    "name": team_data["team_name_home"],
                    "abbrev": team_data["team_abbreviation_home"],
                    "full_name": team_data["team_name_home"],
                    "city": team_data["team_name_home"].split()[-1] if " " in team_data["team_name_home"] else "",
                    "arena": f"{team_data['team_name_home']} Arena",
                    "founded_year": 1970,
                    "conference_id": 1,
                    "division_id": 1,
                    "championships": 1,
                    "wins": 41,
                    "losses": 41,
                    "points_per_game": 110.5,
                    "points_against": 109.8
                }

        # Демо-данные для известных ID
        demo_teams = {
            1: {"name": "Boston Celtics", "abbrev": "BOS"},
            2: {"name": "Los Angeles Lakers", "abbrev": "LAL"},
            3: {"name": "Golden State Warriors", "abbrev": "GSW"},
        }

        if team_id in demo_teams:
            team = demo_teams[team_id]
            return {
                "id": team_id,
                "name": team["name"],
                "abbrev": team["abbrev"],
                "full_name": team["name"],
                "city": team["name"].split()[-1],
                "arena": f"{team['name']} Arena",
                "founded_year": 1970,
                "conference_id": 1,
                "division_id": 1,
                "championships": 1,
                "wins": 41,
                "losses": 41,
                "points_per_game": 110.5,
                "points_against": 109.8
            }

        return None

    def get_team_by_name(self, name: str):
        """Получение команды по названию"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM game WHERE team_name_home = ? OR team_name_away = ? LIMIT 1", (name, name))
        row = cursor.fetchone()
        if row:
            team_data = dict(row)
            return {
                "id": team_data["team_id_home"] if team_data["team_name_home"] == name else team_data["team_id_away"],
                "name": name
            }
        return None

    def create_team(self, team_data, user_id: int):
        """Создание новой команды"""
        # В реальном проекте здесь было бы добавление в БД
        return {
            "id": 999,
            "name": team_data.name,
            "abbrev": team_data.abbrev,
            "full_name": team_data.full_name,
            "city": team_data.city,
            "arena": team_data.arena,
            "founded_year": team_data.founded_year,
            "conference_id": team_data.conference_id,
            "division_id": team_data.division_id,
            "championships": 0,
            "wins": 0,
            "losses": 0,
            "points_per_game": 0,
            "points_against": 0
        }

    def update_team(self, team_id: int, team_data, user_id: int):
        """Обновление команды"""
        team = self.get_team_by_id(team_id)
        if not team:
            return None

        # Обновляем поля
        update_data = team_data.dict(exclude_unset=True)
        team.update(update_data)
        return team

    def delete_team(self, team_id: int, user_id: int):
        """Удаление команды"""
        team = self.get_team_by_id(team_id)
        return team