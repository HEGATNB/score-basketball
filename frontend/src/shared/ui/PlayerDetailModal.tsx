import { useEffect, useMemo, useState } from 'react';
import { X, Ruler, Weight, Calendar, GraduationCap, MapPin, Trophy } from 'lucide-react';
import type { Player } from '@/shared/api/client';
import { apiRequest } from '@/shared/api/client';
import { PlayerAvatar } from './PlayerAvatar';
import { TeamLogo } from './TeamLogo';
import { getTeamBrand } from '@/shared/lib/teamBrand';

interface SeasonRow {
  season: string;
  team_abbrev: string;
  team_name: string;
  team_city: string;
  games_played: number;
  points_per_game: number;
  rebounds_per_game: number;
  assists_per_game: number;
  net_rating: number;
  usage_rate: number;
  true_shooting: number;
  assist_percentage: number;
  offensive_rebound_pct: number;
  defensive_rebound_pct: number;
  age: number;
}

interface PlayerBreakdown {
  player_name: string;
  career: {
    seasons_count: number;
    games: number;
    points_per_game: number;
    rebounds_per_game: number;
    assists_per_game: number;
  };
  seasons: SeasonRow[];
  teams: Array<{ abbrev: string; name: string; city: string; first_season: string }>;
}

interface Props {
  player: Player | null;
  onClose: () => void;
}

function asText(v: unknown, fallback = '—'): string {
  if (v == null || v === '') return fallback;
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  return fallback;
}

export const PlayerDetailModal = ({ player, onClose }: Props) => {
  const [data, setData] = useState<PlayerBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy-load seasonal breakdown
  useEffect(() => {
    if (!player) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    apiRequest<PlayerBreakdown>(`/players/${player.id}/seasons`, undefined, false)
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Не удалось подгрузить карьеру.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [player?.id]);

  // Escape + body scroll lock
  useEffect(() => {
    if (!player) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [player, onClose]);

  const fullName = useMemo(() => {
    if (!player) return '';
    return (
      asText((player as any).full_name, '') ||
      `${asText(player.first_name, '')} ${asText(player.last_name, '')}`.trim() ||
      'Player'
    );
  }, [player]);

  const brand = useMemo(
    () =>
      getTeamBrand({
        abbrev: player?.team?.abbrev || player?.team_abbrev,
        name: player?.team?.name,
      }),
    [player],
  );

  if (!player) return null;

  // Best-season highlights
  const bestSeason = data?.seasons[0];
  const bestPts = data?.seasons.reduce((m, s) => Math.max(m, s.points_per_game), 0);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center px-3 py-6 sm:py-10"
      style={{ background: 'rgba(6,7,10,0.82)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <article className="player-modal" onClick={(e) => e.stopPropagation()}>
        {/* Hero — gradient + photo */}
        <div
          className="player-modal-hero"
          style={{
            background: `linear-gradient(135deg, ${brand.brandColor}, ${brand.accentColor})`,
          }}
        >
          <div className="player-modal-hero-noise" aria-hidden />
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="player-modal-close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="player-modal-hero-inner">
            <div className="player-modal-photo">
              <PlayerAvatar player={player} variant="card" />
            </div>
            <div className="player-modal-titles">
              <div
                className="player-modal-pretitle"
                style={{ color: 'rgba(0,0,0,0.7)' }}
              >
                {asText(player.position, 'PRO')} ·{' '}
                {asText(player.team_abbrev || player.team?.abbrev, 'NBA')}
                {player.number ? ` · #${asText(player.number)}` : ''}
              </div>
              <h2 className="player-modal-name">{fullName}</h2>
              {player.team && (
                <div className="player-modal-team">
                  <TeamLogo team={player.team} size={28} />
                  <span>{asText(player.team?.name, asText(player.team_abbrev, 'NBA'))}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Vitals strip */}
        <div className="player-modal-vitals">
          {player.height && (
            <div className="vitals-cell">
              <Ruler className="h-3 w-3" />
              <div>
                <div className="lbl">Рост</div>
                <div className="val">{asText(player.height)}</div>
              </div>
            </div>
          )}
          {player.weight ? (
            <div className="vitals-cell">
              <Weight className="h-3 w-3" />
              <div>
                <div className="lbl">Вес</div>
                <div className="val">{Number(player.weight).toFixed(0)} кг</div>
              </div>
            </div>
          ) : null}
          {player.age ? (
            <div className="vitals-cell">
              <Calendar className="h-3 w-3" />
              <div>
                <div className="lbl">Возраст</div>
                <div className="val">{Number(player.age).toFixed(0)}</div>
              </div>
            </div>
          ) : null}
          {player.country && (
            <div className="vitals-cell">
              <MapPin className="h-3 w-3" />
              <div>
                <div className="lbl">Страна</div>
                <div className="val">{asText(player.country)}</div>
              </div>
            </div>
          )}
          {player.college && (
            <div className="vitals-cell">
              <GraduationCap className="h-3 w-3" />
              <div>
                <div className="lbl">Колледж</div>
                <div className="val">{asText(player.college)}</div>
              </div>
            </div>
          )}
          {player.draft_year ? (
            <div className="vitals-cell">
              <Trophy className="h-3 w-3" />
              <div>
                <div className="lbl">Драфт</div>
                <div className="val">
                  {asText(player.draft_year)}
                  {player.draft_round ? ` · ${asText(player.draft_round)} раунд` : ''}
                  {player.draft_number ? ` #${asText(player.draft_number)}` : ''}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Career snapshot */}
        <div className="player-modal-stats">
          <div className="snap-cell">
            <div className="snap-lbl">PPG</div>
            <div className="snap-val" style={{ color: 'var(--accent)' }}>
              {Number(player.points_per_game || 0).toFixed(1)}
            </div>
            <div className="snap-sub">
              в этом сезоне
              {bestPts != null && bestPts > 0 && ` · max ${bestPts.toFixed(1)}`}
            </div>
          </div>
          <div className="snap-cell">
            <div className="snap-lbl">RPG</div>
            <div className="snap-val">{Number(player.rebounds_per_game || 0).toFixed(1)}</div>
            <div className="snap-sub">
              ORB% {Number(player.offensive_rebound_pct || 0).toFixed(1)} · DRB%{' '}
              {Number(player.defensive_rebound_pct || 0).toFixed(1)}
            </div>
          </div>
          <div className="snap-cell">
            <div className="snap-lbl">APG</div>
            <div className="snap-val">{Number(player.assists_per_game || 0).toFixed(1)}</div>
            <div className="snap-sub">
              AST% {Number(player.assist_percentage || 0).toFixed(1)}
            </div>
          </div>
          <div className="snap-cell">
            <div className="snap-lbl">TS%</div>
            <div className="snap-val">{Number(player.true_shooting || 0).toFixed(1)}</div>
            <div className="snap-sub">
              USG% {Number(player.usage_rate || 0).toFixed(1)} · NET{' '}
              {(player.net_rating || 0) >= 0 ? '+' : ''}
              {Number(player.net_rating || 0).toFixed(1)}
            </div>
          </div>
        </div>

        {/* Career summary card */}
        {data?.career && (
          <div className="player-modal-career">
            <div className="career-row">
              <span className="career-lbl">Карьера</span>
              <span className="career-val">
                {data.career.seasons_count} сезон{data.career.seasons_count === 1 ? '' : 'ов'} ·{' '}
                {data.career.games} матчей
              </span>
            </div>
            <div className="career-row">
              <span className="career-lbl">Среднее за матч</span>
              <span className="career-val">
                <span style={{ color: 'var(--accent)' }}>
                  {data.career.points_per_game.toFixed(1)}
                </span>{' '}
                · {data.career.rebounds_per_game.toFixed(1)} ·{' '}
                {data.career.assists_per_game.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {/* Team affiliations */}
        {data?.teams && data.teams.length > 0 && (
          <div className="player-modal-teams">
            <div
              className="mb-3 font-mono text-[10px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.22em' }}
            >
              Играл за
            </div>
            <div className="player-modal-teams-list">
              {data.teams.map((t) => (
                <div key={t.abbrev} className="player-modal-team-chip">
                  <TeamLogo
                    team={{ abbrev: t.abbrev, name: t.name }}
                    size={28}
                  />
                  <div>
                    <div className="team-chip-name">{t.name || t.abbrev}</div>
                    <div className="team-chip-sub">с {t.first_season}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-season table */}
        <div className="player-modal-table-wrap">
          <div className="mb-3 flex items-center justify-between">
            <div
              className="font-mono text-[10px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.22em' }}
            >
              По сезонам · {data?.seasons?.length ?? 0}
            </div>
            {bestSeason && (
              <span
                className="font-mono text-[10px] uppercase"
                style={{ letterSpacing: '0.18em', color: 'var(--accent)' }}
              >
                Последний: {bestSeason.season}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-9 animate-pulse rounded bg-[var(--surface-2)]"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--text-3)]">
              {error}
            </div>
          ) : (
            <div className="player-modal-table">
              <div className="table-head">
                <div>СЕЗОН</div>
                <div>КОМАНДА</div>
                <div className="num">G</div>
                <div className="num">PTS</div>
                <div className="num">REB</div>
                <div className="num">AST</div>
                <div className="num">TS%</div>
                <div className="num">USG</div>
              </div>
              {data?.seasons?.map((s) => (
                <div key={s.season + s.team_abbrev} className="table-row">
                  <div className="tab-num">{s.season}</div>
                  <div className="flex items-center gap-2">
                    <TeamLogo
                      team={{ abbrev: s.team_abbrev, name: s.team_name }}
                      size={20}
                    />
                    <span className="text-xs font-semibold">{s.team_abbrev}</span>
                  </div>
                  <div className="num tab-num">{s.games_played}</div>
                  <div
                    className="num tab-num font-display"
                    style={{
                      color: s.points_per_game === bestPts ? 'var(--accent)' : 'var(--text)',
                    }}
                  >
                    {s.points_per_game.toFixed(1)}
                  </div>
                  <div className="num tab-num">{s.rebounds_per_game.toFixed(1)}</div>
                  <div className="num tab-num">{s.assists_per_game.toFixed(1)}</div>
                  <div className="num tab-num text-[var(--text-3)]">
                    {s.true_shooting.toFixed(1)}
                  </div>
                  <div className="num tab-num text-[var(--text-3)]">
                    {s.usage_rate.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>
    </div>
  );
};

export default PlayerDetailModal;
