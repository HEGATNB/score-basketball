import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import time
import sys
import io
import requests
import os
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from config import config

# Устанавливаем кодировку
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Используем параметры из config
DB_NAME = config.DB_NAME
DB_USER = config.DB_USER
DB_PASSWORD = config.DB_PASSWORD
DB_HOST = config.DB_HOST
DB_PORT = config.DB_PORT

# Расширенный маппинг названий команд из ESPN в аббревиатуры БД
TEAM_NAME_MAP = {
    # Полные названия
    'Atlanta Hawks': 'ATL',
    'Boston Celtics': 'BOS',
    'Brooklyn Nets': 'BKN',
    'Charlotte Hornets': 'CHA',
    'Chicago Bulls': 'CHI',
    'Cleveland Cavaliers': 'CLE',
    'Dallas Mavericks': 'DAL',
    'Denver Nuggets': 'DEN',
    'Detroit Pistons': 'DET',
    'Golden State Warriors': 'GSW',
    'Houston Rockets': 'HOU',
    'Indiana Pacers': 'IND',
    'LA Clippers': 'LAC',
    'Los Angeles Clippers': 'LAC',
    'Los Angeles Lakers': 'LAL',
    'Memphis Grizzlies': 'MEM',
    'Miami Heat': 'MIA',
    'Milwaukee Bucks': 'MIL',
    'Minnesota Timberwolves': 'MIN',
    'New Orleans Pelicans': 'NOP',
    'New York Knicks': 'NYK',
    'Oklahoma City Thunder': 'OKC',
    'Orlando Magic': 'ORL',
    'Philadelphia 76ers': 'PHI',
    'Phoenix Suns': 'PHX',
    'Portland Trail Blazers': 'POR',
    'Sacramento Kings': 'SAC',
    'San Antonio Spurs': 'SAS',
    'Toronto Raptors': 'TOR',
    'Utah Jazz': 'UTA',
    'Washington Wizards': 'WAS',

    # Сокращенные названия из ESPN
    'Atlanta': 'ATL',
    'Boston': 'BOS',
    'Brooklyn': 'BKN',
    'Charlotte': 'CHA',
    'Chicago': 'CHI',
    'Cleveland': 'CLE',
    'Dallas': 'DAL',
    'Denver': 'DEN',
    'Detroit': 'DET',
    'Golden State': 'GSW',
    'Houston': 'HOU',
    'Indiana': 'IND',
    'LA Clippers': 'LAC',
    'LA Lakers': 'LAL',
    'Memphis': 'MEM',
    'Miami': 'MIA',
    'Milwaukee': 'MIL',
    'Minnesota': 'MIN',
    'New Orleans': 'NOP',
    'New York': 'NYK',
    'Oklahoma City': 'OKC',
    'Orlando': 'ORL',
    'Philadelphia': 'PHI',
    'Phoenix': 'PHX',
    'Portland': 'POR',
    'Sacramento': 'SAC',
    'San Antonio': 'SAS',
    'Toronto': 'TOR',
    'Utah': 'UTA',
    'Washington': 'WAS',

    # Варианты с точкой
    'L.A. Clippers': 'LAC',
    'L.A. Lakers': 'LAL',

    # Специальные
    'Team Stars': 'ALL',
    'Team Stripes': 'ALL',
    'World': 'ALL',
    'USA': 'ALL',
}

SPECIAL_GAME_KEYWORDS = ['Team', 'World', 'USA', 'All-Star', 'All Star', 'Rising Stars', 'Celebrity']


def get_db_connection():
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
        cursor_factory=RealDictCursor
    )
    return conn


def find_team_abbrev(team_name: str) -> str:
    """Находит аббревиатуру команды по названию с частичным совпадением"""
    if not team_name:
        return None

    team_name_lower = team_name.lower()

    # 1. Точное совпадение
    for name, abbrev in TEAM_NAME_MAP.items():
        if name.lower() == team_name_lower:
            return abbrev

    # 2. Частичное совпадение (город или название)
    for name, abbrev in TEAM_NAME_MAP.items():
        name_parts = name.lower().split()
        for part in name_parts:
            if part in team_name_lower and len(part) > 3:
                return abbrev

    # 3. Поиск по аббревиатуре (если вдруг пришла аббревиатура)
    team_name_upper = team_name.upper()
    if team_name_upper in TEAM_NAME_MAP.values():
        return team_name_upper

    return None


def get_team_id_map(conn):
    """Создание словаря {team_abbreviation: team_id} из таблицы game"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT team_abbreviation_home as abbrev, team_id_home as team_id 
        FROM game 
        WHERE team_id_home IS NOT NULL
        UNION
        SELECT DISTINCT team_abbreviation_away as abbrev, team_id_away as team_id 
        FROM game 
        WHERE team_id_away IS NOT NULL
    """)
    rows = cursor.fetchall()
    team_map = {row['abbrev']: row['team_id'] for row in rows}
    cursor.close()
    team_map['ALL'] = 0
    print(f"  Found {len(team_map)} teams in database")
    return team_map


def is_special_game(away_name, home_name):
    combined = f"{away_name} {home_name}".lower()
    for keyword in SPECIAL_GAME_KEYWORDS:
        if keyword.lower() in combined:
            return True
    return False


def fetch_espn_games(date):
    """Получение списка игр с ESPN API"""
    date_str = date.strftime("%Y%m%d")
    url = "http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"
    params = {"dates": date_str, "limit": 100}

    try:
        response = requests.get(url, params=params, timeout=15)
        if response.status_code != 200:
            print(f"  ❌ ESPN API error: {response.status_code}")
            return []
        data = response.json()
        events = data.get('events', [])
        print(f"  📡 Fetched {len(events)} events from ESPN for {date}")
        return events
    except Exception as e:
        print(f"  ❌ Error fetching ESPN: {e}")
        return []


def fetch_detailed_stats(game_id):
    """Получение детальной статистики игры"""
    url = f"http://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary"
    params = {"event": game_id}

    try:
        response = requests.get(url, params=params, timeout=10)
        if response.status_code != 200:
            return None

        data = response.json()
        boxscore = data.get('boxscore', {})
        teams = boxscore.get('teams', [])

        result = {'home': {}, 'away': {}}
        for team in teams:
            team_stats = team.get('statistics', [])
            is_home = team.get('homeAway') == 'home'
            target = result['home'] if is_home else result['away']
            for stat in team_stats:
                for key, value in stat.items():
                    if isinstance(value, (int, float)) and key != 'label':
                        target[key] = value
        return result
    except Exception as e:
        return None


def parse_espn_game(event, team_id_map):
    """Парсит данные с API и приводит их к структуре как в базе"""
    try:
        game_id = event['id']
        game_date = datetime.strptime(event['date'], "%Y-%m-%dT%H:%MZ")

        competitions = event.get('competitions', [{}])[0]
        competitors = competitions.get('competitors', [])
        if len(competitors) < 2:
            return None

        # Определяем домашнюю и гостевую команды
        away_competitor = None
        home_competitor = None
        for comp in competitors:
            if comp.get('homeAway') == 'home':
                home_competitor = comp
            else:
                away_competitor = comp

        if not home_competitor or not away_competitor:
            return None

        away_team_name = away_competitor.get('team', {}).get('displayName', '')
        home_team_name = home_competitor.get('team', {}).get('displayName', '')

        # Также пробуем получить короткие названия
        away_team_short = away_competitor.get('team', {}).get('shortDisplayName', '')
        home_team_short = home_competitor.get('team', {}).get('shortDisplayName', '')

        # Проверка на специальные игры
        if is_special_game(away_team_name, home_team_name):
            print(f"  ⏭️ Skipping special game: {away_team_name} vs {home_team_name}")
            return None

        # Находим аббревиатуры
        away_abbrev = find_team_abbrev(away_team_name) or find_team_abbrev(away_team_short)
        home_abbrev = find_team_abbrev(home_team_name) or find_team_abbrev(home_team_short)

        if not away_abbrev or not home_abbrev:
            print(f"  ⚠️ Could not map teams: '{away_team_name}' -> {away_abbrev}, '{home_team_name}' -> {home_abbrev}")
            return None

        away_id = team_id_map.get(away_abbrev)
        home_id = team_id_map.get(home_abbrev)

        if not away_id or not home_id:
            print(f"  ⚠️ Team ID not found: {away_abbrev}={away_id}, {home_abbrev}={home_id}")
            return None

        away_score = int(away_competitor.get('score', 0) or 0)
        home_score = int(home_competitor.get('score', 0) or 0)
        home_win = home_score > away_score

        detailed_stats = fetch_detailed_stats(game_id)
        home_stats = detailed_stats.get('home', {}) if detailed_stats else {}
        away_stats = detailed_stats.get('away', {}) if detailed_stats else {}

        def safe_pct(made, att):
            return round(made / att, 3) if att and att > 0 else 0

        # Определяем season_id
        year = game_date.year
        season_id = f"2{year - 1 if game_date.month < 10 else year}"

        return {
            'game_id': f"ESPN_{game_id}",
            'game_date': game_date.strftime("%Y-%m-%d %H:%M:%S"),
            'season_id': season_id,
            'season_type': 'Regular Season',
            'team_id_home': home_id,
            'team_abbreviation_home': home_abbrev,
            'team_name_home': home_team_name,
            'matchup_home': f"{home_abbrev} vs. {away_abbrev}",
            'wl_home': 'W' if home_win else 'L' if home_score > 0 else None,
            'pts_home': home_score if home_score > 0 else None,
            'team_id_away': away_id,
            'team_abbreviation_away': away_abbrev,
            'team_name_away': away_team_name,
            'matchup_away': f"{away_abbrev} @ {home_abbrev}",
            'wl_away': 'L' if home_win else 'W' if away_score > 0 else None,
            'pts_away': away_score if away_score > 0 else None,
            'fgm_home': home_stats.get('fieldGoalsMade', 0),
            'fga_home': home_stats.get('fieldGoalsAttempted', 0),
            'fg_pct_home': safe_pct(home_stats.get('fieldGoalsMade', 0), home_stats.get('fieldGoalsAttempted', 0)),
            'fg3m_home': home_stats.get('threePointFieldGoalsMade', 0),
            'fg3a_home': home_stats.get('threePointFieldGoalsAttempted', 0),
            'fg3_pct_home': safe_pct(home_stats.get('threePointFieldGoalsMade', 0),
                                     home_stats.get('threePointFieldGoalsAttempted', 0)),
            'ftm_home': home_stats.get('freeThrowsMade', 0),
            'fta_home': home_stats.get('freeThrowsAttempted', 0),
            'ft_pct_home': safe_pct(home_stats.get('freeThrowsMade', 0), home_stats.get('freeThrowsAttempted', 0)),
            'oreb_home': home_stats.get('offensiveRebounds', 0),
            'dreb_home': home_stats.get('defensiveRebounds', 0),
            'reb_home': home_stats.get('rebounds', 0),
            'ast_home': home_stats.get('assists', 0),
            'stl_home': home_stats.get('steals', 0),
            'blk_home': home_stats.get('blocks', 0),
            'tov_home': home_stats.get('turnovers', 0),
            'pf_home': home_stats.get('fouls', 0),
            'fgm_away': away_stats.get('fieldGoalsMade', 0),
            'fga_away': away_stats.get('fieldGoalsAttempted', 0),
            'fg_pct_away': safe_pct(away_stats.get('fieldGoalsMade', 0), away_stats.get('fieldGoalsAttempted', 0)),
            'fg3m_away': away_stats.get('threePointFieldGoalsMade', 0),
            'fg3a_away': away_stats.get('threePointFieldGoalsAttempted', 0),
            'fg3_pct_away': safe_pct(away_stats.get('threePointFieldGoalsMade', 0),
                                     away_stats.get('threePointFieldGoalsAttempted', 0)),
            'ftm_away': away_stats.get('freeThrowsMade', 0),
            'fta_away': away_stats.get('freeThrowsAttempted', 0),
            'ft_pct_away': safe_pct(away_stats.get('freeThrowsMade', 0), away_stats.get('freeThrowsAttempted', 0)),
            'oreb_away': away_stats.get('offensiveRebounds', 0),
            'dreb_away': away_stats.get('defensiveRebounds', 0),
            'reb_away': away_stats.get('rebounds', 0),
            'ast_away': away_stats.get('assists', 0),
            'stl_away': away_stats.get('steals', 0),
            'blk_away': away_stats.get('blocks', 0),
            'tov_away': away_stats.get('turnovers', 0),
            'pf_away': away_stats.get('fouls', 0),
            'min': 240,
            'plus_minus_home': 0,
            'plus_minus_away': 0,
            'video_available_home': 0,
            'video_available_away': 0
        }
    except Exception as e:
        print(f"  ❌ Error parsing game: {e}")
        return None


def game_exists(conn, game_id):
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM game WHERE game_id = %s", (game_id,))
    exists = cursor.fetchone() is not None
    cursor.close()
    return exists


def insert_game(conn, game):
    cursor = conn.cursor()
    if game_exists(conn, game['game_id']):
        return False

    columns = ', '.join(game.keys())
    placeholders = ', '.join(['%s'] * len(game))
    query = f"INSERT INTO game ({columns}) VALUES ({placeholders})"

    try:
        cursor.execute(query, list(game.values()))
        conn.commit()
        return True
    except Exception as e:
        print(f"    ❌ Error inserting game: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()


def update_existing_games(conn, days_back=2):
    """Обновляет результаты существующих матчей за последние дни"""
    print(f"\n{'=' * 60}")
    print("🔄 UPDATING EXISTING GAMES")
    print(f"📅 Checking games from last {days_back} days")
    print(f"{'=' * 60}")

    cursor = conn.cursor()
    today = datetime.now().date()
    updated_count = 0

    for i in range(days_back):
        date = today - timedelta(days=i)
        print(f"\n📅 Checking games for {date}")

        cursor.execute("""
            SELECT game_id, team_id_home, team_id_away, team_abbreviation_home, team_abbreviation_away,
                   team_name_home, team_name_away, pts_home, pts_away, wl_home, wl_away
            FROM game
            WHERE DATE(game_date) = %s
              AND (pts_home IS NULL OR pts_away IS NULL)
        """, (date,))

        pending_games = cursor.fetchall()

        if not pending_games:
            print(f"   ✅ No pending games for {date}")
            continue

        print(f"   📋 Found {len(pending_games)} pending games")

        events = fetch_espn_games(date)
        if not events:
            print(f"   ⚠️ Could not fetch ESPN data")
            continue

        espn_games = {}
        for event in events:
            try:
                competitions = event.get('competitions', [{}])[0]
                competitors = competitions.get('competitors', [])
                if len(competitors) >= 2:
                    away_name = competitors[0].get('team', {}).get('displayName', '')
                    home_name = competitors[1].get('team', {}).get('displayName', '')
                    espn_games[f"{home_name}_{away_name}"] = event
                    espn_games[event.get('id')] = event
            except Exception:
                continue

        for game in pending_games:
            game_data = dict(game._mapping)
            home_name = game_data.get("team_name_home")
            away_name = game_data.get("team_name_away")
            game_id = game_data.get("game_id")

            espn_game = espn_games.get(f"{home_name}_{away_name}")
            if not espn_game:
                clean_id = game_id.replace("ESPN_", "")
                espn_game = espn_games.get(clean_id)

            if not espn_game:
                continue

            detailed_stats = fetch_detailed_stats(espn_game.get('id'))
            if not detailed_stats:
                continue

            competitions = espn_game.get('competitions', [{}])[0]
            competitors = competitions.get('competitors', [])
            home_score = 0
            away_score = 0

            for comp in competitors:
                if comp.get('homeAway') == 'home':
                    home_score = int(comp.get('score', 0) or 0)
                else:
                    away_score = int(comp.get('score', 0) or 0)

            if home_score == 0 and away_score == 0:
                continue

            home_win = home_score > away_score
            home_stats = detailed_stats.get('home', {})
            away_stats = detailed_stats.get('away', {})

            def safe_pct(made, att):
                return round(made / att, 3) if att and att > 0 else 0

            try:
                cursor.execute("""
                    UPDATE game SET
                        pts_home = %s, pts_away = %s,
                        wl_home = %s, wl_away = %s,
                        fgm_home = %s, fga_home = %s, fg_pct_home = %s,
                        fg3m_home = %s, fg3a_home = %s, fg3_pct_home = %s,
                        ftm_home = %s, fta_home = %s, ft_pct_home = %s,
                        oreb_home = %s, dreb_home = %s, reb_home = %s,
                        ast_home = %s, stl_home = %s, blk_home = %s,
                        tov_home = %s, pf_home = %s,
                        fgm_away = %s, fga_away = %s, fg_pct_away = %s,
                        fg3m_away = %s, fg3a_away = %s, fg3_pct_away = %s,
                        ftm_away = %s, fta_away = %s, ft_pct_away = %s,
                        oreb_away = %s, dreb_away = %s, reb_away = %s,
                        ast_away = %s, stl_away = %s, blk_away = %s,
                        tov_away = %s, pf_away = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE game_id = %s
                """, (
                    home_score, away_score,
                    'W' if home_win else 'L', 'L' if home_win else 'W',
                    home_stats.get('fieldGoalsMade', 0), home_stats.get('fieldGoalsAttempted', 0),
                    safe_pct(home_stats.get('fieldGoalsMade', 0), home_stats.get('fieldGoalsAttempted', 0)),
                    home_stats.get('threePointFieldGoalsMade', 0), home_stats.get('threePointFieldGoalsAttempted', 0),
                    safe_pct(home_stats.get('threePointFieldGoalsMade', 0),
                             home_stats.get('threePointFieldGoalsAttempted', 0)),
                    home_stats.get('freeThrowsMade', 0), home_stats.get('freeThrowsAttempted', 0),
                    safe_pct(home_stats.get('freeThrowsMade', 0), home_stats.get('freeThrowsAttempted', 0)),
                    home_stats.get('offensiveRebounds', 0), home_stats.get('defensiveRebounds', 0),
                    home_stats.get('rebounds', 0),
                    home_stats.get('assists', 0), home_stats.get('steals', 0), home_stats.get('blocks', 0),
                    home_stats.get('turnovers', 0), home_stats.get('fouls', 0),
                    away_stats.get('fieldGoalsMade', 0), away_stats.get('fieldGoalsAttempted', 0),
                    safe_pct(away_stats.get('fieldGoalsMade', 0), away_stats.get('fieldGoalsAttempted', 0)),
                    away_stats.get('threePointFieldGoalsMade', 0), away_stats.get('threePointFieldGoalsAttempted', 0),
                    safe_pct(away_stats.get('threePointFieldGoalsMade', 0),
                             away_stats.get('threePointFieldGoalsAttempted', 0)),
                    away_stats.get('freeThrowsMade', 0), away_stats.get('freeThrowsAttempted', 0),
                    safe_pct(away_stats.get('freeThrowsMade', 0), away_stats.get('freeThrowsAttempted', 0)),
                    away_stats.get('offensiveRebounds', 0), away_stats.get('defensiveRebounds', 0),
                    away_stats.get('rebounds', 0),
                    away_stats.get('assists', 0), away_stats.get('steals', 0), away_stats.get('blocks', 0),
                    away_stats.get('turnovers', 0), away_stats.get('fouls', 0),
                    game_data["game_id"]
                ))

                if cursor.rowcount > 0:
                    updated_count += 1
                    print(f"      ✅ Updated: {home_name} {home_score} - {away_score} {away_name}")
            except Exception as e:
                print(f"      ❌ Update error: {e}")

        conn.commit()

    print(f"\n📊 UPDATE STATS: {updated_count} games updated")
    return updated_count


def update_db_with_new_games(db_path=None, days_back=2):
    """Обновляет данные для scheduled матчей и добавляет новые матчи"""
    print(f"\n{'=' * 60}")
    print(f"🔄 DATABASE UPDATE")
    print(f"📅 Last {days_back} days")
    print(f"⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'=' * 60}")

    conn = get_db_connection()
    print(f"✅ Connected to database")

    # Обновляем результаты существующих матчей
    updated_results = update_existing_games(conn, days_back)

    # Добавляем новые матчи
    print(f"\n{'=' * 60}")
    print("➕ ADDING NEW GAMES")
    print(f"{'=' * 60}")

    team_id_map = get_team_id_map(conn)
    today = datetime.now().date()
    new_count = 0
    failed_count = 0
    skipped_count = 0

    for i in range(days_back):
        date = today - timedelta(days=i)
        print(f"\n📅 Processing {date}")
        events = fetch_espn_games(date)

        for event in events:
            game_record = parse_espn_game(event, team_id_map)
            if game_record is None:
                failed_count += 1
            elif insert_game(conn, game_record):
                new_count += 1
                print(f"  ✅ Added: {game_record['team_abbreviation_away']} @ {game_record['team_abbreviation_home']}")
            else:
                skipped_count += 1
            time.sleep(0.3)

        if i < days_back - 1:
            time.sleep(1)

    conn.close()

    print(f"\n{'=' * 60}")
    print(f"📊 FINAL STATISTICS:")
    print(f"   • Updated results: {updated_results}")
    print(f"   • New games added: {new_count}")
    print(f"   • Failed to add: {failed_count}")
    print(f"   • Skipped (already exist): {skipped_count}")
    print(f"{'=' * 60}")

    return {
        "updated_results": updated_results,
        "new_games": new_count,
        "failed": failed_count,
        "skipped": skipped_count
    }


if __name__ == "__main__":
    update_db_with_new_games(days_back=2)