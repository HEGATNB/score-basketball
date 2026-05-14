import { useEffect, useState } from 'react';
import type { Match } from '@/shared/api/client';
import { liveApi, type LiveEvent, type LiveMatchDetails } from '@/shared/api/live';

interface MatchLiveStatsProps {
  match: Match;
}

function toEspnDate(iso: string): string | null {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  } catch {
    return null;
  }
}

/**
 * Look up the ESPN event matching this DB match (by date + home/away abbrev),
 * then fetch its detailed box-score and render quarters + team stats + leaders.
 *
 * Renders nothing if the lookup fails — match page still works with its own
 * basic data.
 */
export const MatchLiveStats = ({ match }: MatchLiveStatsProps) => {
  const [details, setDetails] = useState<LiveMatchDetails | null>(null);
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'found' | 'not-found' | 'error'>(
    'loading',
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const date = toEspnDate(match.date);
      if (!date || !match.homeTeam?.abbrev || !match.awayTeam?.abbrev) {
        setStatus('not-found');
        return;
      }
      try {
        const sb = await liveApi.scoreboard(date);
        if (cancelled) return;
        const wanted = sb.events.find(
          (e) =>
            e.home.abbrev?.toUpperCase() === match.homeTeam.abbrev?.toUpperCase() &&
            e.away.abbrev?.toUpperCase() === match.awayTeam.abbrev?.toUpperCase(),
        );
        if (!wanted) {
          setStatus('not-found');
          return;
        }
        setEvent(wanted);
        const det = await liveApi.matchDetails(wanted.id);
        if (cancelled) return;
        setDetails(det);
        setStatus('found');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [match.date, match.homeTeam?.abbrev, match.awayTeam?.abbrev]);

  if (status === 'loading') {
    return (
      <div className="card p-6 text-center text-sm text-[var(--text-3)]">
        Подгружаем box-score из ESPN…
      </div>
    );
  }
  if (status !== 'found' || !details || !event) return null;

  const home = details.teams.find((t) => t.homeAway === 'home');
  const away = details.teams.find((t) => t.homeAway === 'away');
  const homeStats = details.teamStats.find((t) => t.abbrev === home?.abbrev);
  const awayStats = details.teamStats.find((t) => t.abbrev === away?.abbrev);

  return (
    <div className="space-y-6">
      {/* Line score (quarters) */}
      {home && away && (home.linescores?.length || away.linescores?.length) ? (
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-4">
            <span
              className="font-mono text-[10px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.22em' }}
            >
              По четвертям
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="px-6 py-3 text-left font-mono text-[10px] uppercase text-[var(--text-3)]" style={{ letterSpacing: '0.16em' }}>
                    Команда
                  </th>
                  {(home.linescores || []).map((_v, i) => (
                    <th
                      key={i}
                      className="px-3 py-3 text-center font-mono text-[10px] uppercase text-[var(--text-3)]"
                      style={{ letterSpacing: '0.16em' }}
                    >
                      {i < 4 ? `Q${i + 1}` : `OT${i - 3}`}
                    </th>
                  ))}
                  <th
                    className="px-6 py-3 text-right font-mono text-[10px] uppercase text-[var(--text-3)]"
                    style={{ letterSpacing: '0.16em' }}
                  >
                    Итог
                  </th>
                </tr>
              </thead>
              <tbody>
                {[home, away].map((t) => (
                  <tr key={t.abbrev} className="border-b border-[var(--line)] last:border-b-0">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="team-sq team-sq-sm"
                          style={{
                            background: `linear-gradient(135deg, ${t.color || '#ff5a1f'}, ${t.altColor || '#ffb800'})`,
                          }}
                        >
                          {t.abbrev}
                        </span>
                        <div>
                          <div className="text-sm font-semibold">{t.shortName || t.abbrev}</div>
                          {t.record && (
                            <div
                              className="font-mono text-[10px] text-[var(--text-3)]"
                              style={{ letterSpacing: '0.14em' }}
                            >
                              {t.record}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    {(t.linescores || []).map((v, i) => (
                      <td key={i} className="px-3 py-4 text-center font-mono tab-num text-[var(--text-2)]">
                        {v}
                      </td>
                    ))}
                    <td
                      className="px-6 py-4 text-right font-display text-2xl tab-num"
                      style={{ color: t.winner ? 'var(--accent)' : 'var(--text)' }}
                    >
                      {t.score ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Team stats comparison */}
      {homeStats && awayStats && Object.keys(homeStats.stats).length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-4">
            <span
              className="font-mono text-[10px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.22em' }}
            >
              Командная статистика
            </span>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {Object.keys(homeStats.stats).slice(0, 12).map((key) => (
              <div
                key={key}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-3"
              >
                <span className="font-display text-xl tab-num">{homeStats.stats[key]}</span>
                <span
                  className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                  style={{ letterSpacing: '0.16em' }}
                >
                  {key.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}
                </span>
                <span className="text-right font-display text-xl tab-num">
                  {awayStats.stats[key] ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaders */}
      {details.leaders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-4">
            <span
              className="font-mono text-[10px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.22em' }}
            >
              Лидеры матча
            </span>
          </div>
          <div className="grid grid-cols-1 gap-px bg-[var(--line)] sm:grid-cols-2 md:grid-cols-3">
            {details.leaders.slice(0, 9).map((l, i) => (
              <div
                key={`${l.team.abbrev}-${l.name}-${i}`}
                className="flex items-center gap-3 bg-[var(--surface)] px-5 py-4"
              >
                <span
                  className="team-sq team-sq-sm"
                  style={{
                    background: `linear-gradient(135deg, ${l.team.color || '#ff5a1f'}, ${l.team.altColor || '#ffb800'})`,
                  }}
                >
                  {l.team.abbrev}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                    style={{ letterSpacing: '0.14em' }}
                  >
                    {l.name}
                  </div>
                  <div className="truncate text-sm font-semibold">{l.athlete || '—'}</div>
                </div>
                <div className="font-display text-xl tab-num">{l.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Venue / broadcast meta */}
      {(details.venue || details.broadcast) && (
        <div
          className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-3)]"
          style={{ letterSpacing: '0.04em' }}
        >
          {details.venue && (
            <span className="tag">
              <span className="font-mono">{details.venue}</span>
            </span>
          )}
          {details.broadcast && (
            <span className="tag tag-info">
              📺 {details.broadcast}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchLiveStats;
