import { useEffect, useRef, useState } from 'react';
import { liveApi, type LiveEvent } from '@/shared/api/live';
import { TeamLogo } from './TeamLogo';

interface LivePanelProps {
  /** How often to refetch (ms). Default 30s for live games, longer otherwise. */
  refreshMs?: number;
  maxRows?: number;
  className?: string;
}

const REFRESH_MS_DEFAULT = 30_000;

function TeamMini({ team, score, winning }: { team: LiveEvent['home']; score: number | null | undefined; winning: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <TeamLogo
        team={{
          abbrev: team.abbrev,
          name: team.name,
          logoUrl: team.logo,
          brandColor: team.color,
          accentColor: team.altColor,
        }}
        size={34}
      />
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-[13px] font-semibold text-[var(--text)]">
          {team.shortName || team.abbrev || team.name}
        </div>
        <div className="truncate text-[10px] uppercase text-[var(--text-3)]" style={{ letterSpacing: '0.08em' }}>
          {team.abbrev || team.name}
        </div>
      </div>
      <div
        className="font-display text-2xl leading-none tab-num"
        style={{ color: winning ? 'var(--accent)' : 'var(--text)' }}
      >
        {score ?? '—'}
      </div>
    </div>
  );
}

function TeamMiniAway({ team, score, winning }: { team: LiveEvent['away']; score: number | null | undefined; winning: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <TeamLogo
        team={{
          abbrev: team.abbrev,
          name: team.name,
          logoUrl: team.logo,
          brandColor: team.color,
          accentColor: team.altColor,
        }}
        size={34}
      />
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-[13px] font-semibold text-[var(--text)]">
          {team.shortName || team.abbrev || team.name}
        </div>
        <div className="truncate text-[10px] uppercase text-[var(--text-3)]" style={{ letterSpacing: '0.08em' }}>
          {team.abbrev || team.name}
        </div>
      </div>
      <div
        className="font-display text-2xl leading-none tab-num"
        style={{ color: winning ? 'var(--accent)' : 'var(--text)' }}
      >
        {score ?? '—'}
      </div>
    </div>
  );
}

export const LivePanel = ({ refreshMs = REFRESH_MS_DEFAULT, maxRows = 4, className = '' }: LivePanelProps) => {
  const [scoreboard, setScoreboard] = useState<{
    live: LiveEvent[];
    upcoming: LiveEvent[];
    finished: LiveEvent[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await liveApi.scoreboard();
        if (cancelled) return;
        setScoreboard({
          live: data.live || [],
          upcoming: data.upcoming || [],
          finished: data.finished || [],
        });
        lastFetchedRef.current = Date.now();
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Не удалось загрузить live данные');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    // Pick interval — fastest when there are live games, slower otherwise.
    const interval = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshMs]);

  // Prefer live games; fill from upcoming if there are no live ones.
  const live = scoreboard?.live || [];
  const upcoming = scoreboard?.upcoming || [];
  const rows = (live.length > 0 ? live : upcoming).slice(0, maxRows);

  const heading =
    live.length > 0 ? 'Live сейчас' : upcoming.length > 0 ? 'Сегодня в эфире' : 'Расписание';

  return (
    <aside className={`panel ${className}`}>
      <h3
        className="m-0 mb-4 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase text-[var(--text-3)]"
        style={{ letterSpacing: '0.12em' }}
      >
        <span className="min-w-0">{heading}</span>
        {live.length > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[var(--danger)]">
            <span className="pulse-dot" />
            LIVE · {live.length}
          </span>
        ) : (
          <span className="shrink-0 text-[var(--text-3)]">{rows.length} игр</span>
        )}
      </h3>

      {loading ? (
        <div className="py-8 text-center text-sm text-[var(--text-3)]">Загружаем…</div>
      ) : error ? (
        <div className="py-4 text-center text-xs text-[var(--text-3)]">{error}</div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--text-3)]">Сегодня матчей нет.</p>
      ) : (
        rows.map((e) => {
          const homeScore = e.home.score;
          const awayScore = e.away.score;
          const homeWinning =
            homeScore != null && awayScore != null ? homeScore > awayScore : false;
          const awayWinning =
            homeScore != null && awayScore != null ? awayScore > homeScore : false;

          let midLine: string;
          if (e.state === 'in') midLine = e.shortDetail || `Q${e.period ?? '?'} · ${e.clock || ''}`;
          else if (e.state === 'pre') {
            try {
              midLine = new Date(e.date).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              });
            } catch {
              midLine = 'TIP';
            }
          } else midLine = e.shortDetail || 'FINAL';

          return (
            <div
              key={e.id}
              className="w-full border-t border-[var(--line)] py-4 first:border-t-0 last:pb-0"
              title={e.venue || ''}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span
                  className="whitespace-nowrap rounded-full border border-[var(--line)] px-2.5 py-1 font-mono text-[10px] uppercase text-[var(--text-3)]"
                  style={{ letterSpacing: '0.1em' }}
                >
                  {midLine}
                </span>
                {e.state === 'in' && (
                  <span className="font-mono text-[9px] uppercase" style={{ color: 'var(--danger)' }}>
                    ● LIVE
                  </span>
                )}
                {e.state === 'post' && (
                  <span className="font-mono text-[9px] uppercase" style={{ color: 'var(--gold)' }}>
                    FINAL
                  </span>
                )}
              </div>
              <div className="space-y-3">
                <TeamMiniAway team={e.away} score={awayScore} winning={awayWinning} />
                <TeamMini team={e.home} score={homeScore} winning={homeWinning} />
              </div>
            </div>
          );
        })
      )}

      <div className="mt-4 border-t border-[var(--line)] pt-4 text-center">
        <span
          className="font-mono text-[10px] uppercase text-[var(--text-3)]"
          style={{ letterSpacing: '0.18em' }}
        >
          Обновление каждые 30 сек · ESPN
        </span>
      </div>
    </aside>
  );
};

export default LivePanel;
