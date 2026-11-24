-- =============================================================================
-- SCORE · Миграция 001: справочные индексы и аналитические представления
-- =============================================================================
-- Подготовленный скрипт по отчёту «Оптимизация» (редакция 2).
--
-- Это кандидаты, подтверждённые кодом, а не команды, которые уже применены к Neon.
-- Перед применением на рабочей БД рекомендуется:
--   1. снять инвентаризацию (pg_indexes, размеры таблиц, pg_stat_statements);
--   2. прогнать EXPLAIN (ANALYZE, BUFFERS) на реальных запросах приложения;
--   3. применить на staging и сравнить планы.
--
-- Скрипт идемпотентен: безопасен для повторного запуска (IF NOT EXISTS / DO-блоки).
--
-- Важно по game_date: столбец сейчас хранится как текст и в запросах встречается
-- и сравнение как timestamp, и NULLIF(g.game_date, '')::timestamp. Обычный B-tree
-- по тексту ускорит ORDER BY game_date DESC, но не сравнение через ::timestamp.
-- Правильный долгосрочный шаг — привести game_date к TIMESTAMP/DATE отдельной
-- миграцией, после чего индекс по этому столбцу станет полноценным.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Уникальность game_id (идемпотентный импорт)
--    update_data.py перешёл с SELECT-перед-INSERT на ON CONFLICT (game_id) DO
--    NOTHING; для этого требуется уникальное ограничение по game_id.
--
--    Перед созданием уникального индекса убираем точные дубли по game_id,
--    оставшиеся от повторного импорта: на целевой БД было 56 групп по 2
--    одинаковые строки. Удаляется лишняя копия, остаётся одна строка на game_id.
-- ---------------------------------------------------------------------------
DELETE FROM game a USING game b
WHERE a.ctid > b.ctid AND a.game_id = b.game_id;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'game' AND indexname = 'idx_game_game_id_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_game_game_id_unique ON game (game_id);
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Матчи: история команды (домашняя / гостевая сторона)
--    game_repository.get_team_history фильтрует по team_id_home OR team_id_away,
--    get_team_stats и get_head_to_head — аналогично.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_game_team_id_home ON game (team_id_home);
CREATE INDEX IF NOT EXISTS idx_game_team_id_away ON game (team_id_away);

-- game(game_date): ускоряет ORDER BY game_date DESC (ближайшие / последние матчи).
-- См. примечание в шапке про приведение типа.
CREATE INDEX IF NOT EXISTS idx_game_game_date ON game (game_date DESC);

-- ---------------------------------------------------------------------------
-- 3. Прогнозы пользователя
--    prediction_repository.get_by_user: WHERE user_id … ORDER BY created_at DESC.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_predictions_user_created
    ON predictions (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Журнал аудита
--    audit_repository.get_by_user / get_all: ORDER BY created_at DESC с фильтром
--    по user_id. При малом объёме журнала индекс можно не создавать.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
    ON audit_logs (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Игроки и справочники
--    player_repository.get_seasons: SELECT DISTINCT season FROM players ORDER BY
--    season DESC; get_all фильтрует по team_abbreviation.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_players_season ON players (season DESC);
CREATE INDEX IF NOT EXISTS idx_players_team_abbreviation ON players (team_abbreviation);

-- team JOIN по abbreviation (players → team), и поиск команды по id (текст).
CREATE INDEX IF NOT EXISTS idx_team_abbreviation ON team (abbreviation);

-- team_info_common: user_stats_service._team_records использует
-- DISTINCT ON (team_id) ... ORDER BY team_id, season_id DESC.
CREATE INDEX IF NOT EXISTS idx_team_info_common_team_season
    ON team_info_common (team_id, season_id DESC);

-- ---------------------------------------------------------------------------
-- 6. Представление: унификация домашней и гостевой стороны матча
--    Каждый матч раскрывается в две строки (home / away) с едиными полями.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_game_team_sides AS
SELECT
    g.game_id,
    g.season_id,
    g.game_date,
    'home' AS side,
    g.team_id_home       AS team_id,
    g.team_abbreviation_home AS team_abbreviation,
    g.team_name_home     AS team_name,
    g.pts_home           AS pts,
    g.pts_away           AS opp_pts,
    g.wl_home            AS wl
FROM game g
UNION ALL
SELECT
    g.game_id,
    g.season_id,
    g.game_date,
    'away' AS side,
    g.team_id_away       AS team_id,
    g.team_abbreviation_away AS team_abbreviation,
    g.team_name_away     AS team_name,
    g.pts_away           AS pts,
    g.pts_home           AS opp_pts,
    g.wl_away            AS wl
FROM game g;

-- ---------------------------------------------------------------------------
-- 7. Материализованная сезонная сводка по командам
--    Обновляется только через REFRESH (см. scripts/refresh_analytics_views.py)
--    после успешной загрузки данных. Не использовать для live-счёта.
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_team_season_summary AS
SELECT
    s.team_id,
    s.team_abbreviation,
    s.team_name,
    s.season_id,
    COUNT(*) FILTER (WHERE s.pts IS NOT NULL)              AS games_played,
    COUNT(*) FILTER (WHERE s.wl = 'W')                     AS wins,
    COUNT(*) FILTER (WHERE s.wl = 'L')                     AS losses,
    ROUND((AVG(s.pts)     FILTER (WHERE s.pts IS NOT NULL))::numeric, 1) AS pts_pg,
    ROUND((AVG(s.opp_pts) FILTER (WHERE s.opp_pts IS NOT NULL))::numeric, 1) AS opp_pts_pg
FROM v_game_team_sides s
WHERE s.team_id IS NOT NULL
  AND s.season_id IS NOT NULL
GROUP BY s.team_id, s.team_abbreviation, s.team_name, s.season_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_team_season_summary_pk
    ON mv_team_season_summary (team_id, season_id);

-- ---------------------------------------------------------------------------
-- 8. Материализованная сезонная сводка по игрокам
--    Таблица players уже хранит одну строку на (игрок, сезон); материализованное
--    представление фиксирует готовый набор полей для аналитических карточек.
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_player_season_summary AS
SELECT
    p.player_name,
    p.team_abbreviation,
    p.season,
    p.gp,
    p.pts,
    p.reb,
    p.ast,
    p.net_rating,
    p.ts_pct,
    p.usg_pct
FROM players p;

-- Таблица players может содержать несколько строк на (игрок, сезон) — по разным
-- командам, поэтому уникальный индекс по (player_name, season) не строится.
-- Для поиска карточек достаточно обычного индекса; REFRESH выполняется без
-- CONCURRENTLY (см. scripts/refresh_analytics_views.py).
CREATE INDEX IF NOT EXISTS idx_mv_player_season_summary
    ON mv_player_season_summary (player_name, season, team_abbreviation);

COMMIT;
