import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarRange, Trophy, Radio, Clock, Flame } from 'lucide-react';
import { apiRequest, type Match } from '@/shared/api/client';
import { useT } from '@/shared/i18n';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { MatchCard } from '@/shared/ui/MatchCard';
import { liveApi, type LiveEvent } from '@/shared/api/live';
import { TeamLogo } from '@/shared/ui/TeamLogo';

type FilterMode = 'all' | 'live' | 'scheduled' | 'finished';

function groupByDay(matches: Match[]) {
  const groups = new Map<string, Match[]>();
  matches.forEach((m) => {
    let key = 'Дата';
    try {
      key = new Date(m.date).toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      key = 'Дата';
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  });
  return Array.from(groups.entries());
}

function formatClock(e: LiveEvent): string {
  if (e.state === 'in') return e.shortDetail || `Q${e.period ?? '?'} · ${e.clock || ''}`;
  if (e.state === 'pre') {
    try {
      return new Date(e.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'TIP';
    }
  }
  return e.shortDetail || 'ОКОНЧЕН';
}

export const MatchesPage = () => {
  const navigate = useNavigate();
  const t = useT();
  const [matches, setMatches] = useState<Match[]>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [aiByMatch, setAiByMatch] = useState<Record<number, { a: number; b: number }>>({});

  useEffect(() => {
    apiRequest<Match[]>('/matches')
      .then(setMatches)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));

    liveApi
      .scoreboard()
      .then((sb) => setLiveEvents([...(sb.live || []), ...(sb.upcoming || [])]))
      .catch(() => setLiveEvents([]));
  }, []);

  // Pre-fetch real AI probabilities for the first 18 scheduled matches.
  // /predict/preview is read-only, no auth, no DB writes.
  useEffect(() => {
    if (matches.length === 0) return;
    const targets = matches
      .filter((m) => m.status !== 'finished')
      .slice(0, 18)
      .filter((m) => m.homeTeam?.id && m.awayTeam?.id);
    if (targets.length === 0) return;
    let cancelled = false;
    Promise.all(
      targets.map((m) =>
        apiRequest<{ probabilityTeam1: number; probabilityTeam2: number }>(
          `/predict/preview?team1=${m.homeTeam.id}&team2=${m.awayTeam.id}`,
          undefined,
          false,
        )
          .then((p) => [m.id, { a: Math.round(p.probabilityTeam1), b: Math.round(p.probabilityTeam2) }] as const)
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;
      const map: Record<number, { a: number; b: number }> = {};
      for (const r of results) if (r) map[r[0]] = r[1];
      if (Object.keys(map).length > 0) setAiByMatch((prev) => ({ ...prev, ...map }));
    });
    return () => {
      cancelled = true;
    };
  }, [matches]);

  const filtered = useMemo(() => {
    if (filter === 'all') return matches;
    if (filter === 'live') return []; // live tab uses ESPN events instead
    return matches.filter((m) => m.status === filter);
  }, [filter, matches]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);
  const liveCount = liveEvents.filter((e) => e.state === 'in').length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="md" label={t('matches.loading')} />
      </div>
    );
  }

  return (
    <section className="section">
      <div className="container-x">
        <div className="section-head">
          <div className="flex flex-col gap-3">
            <span className="eyebrow">
              <span className="dot" />
              {t('matches.eyebrow')} · {matches.length} {t('common.games')}
            </span>
            <h2>
              {t('matches.h2a')} <em>NBA</em>.<br />
              {t('matches.h2b')}
            </h2>
          </div>
          <p className="lead">
            {t('matches.lead')}
          </p>
        </div>

        {/* ===== LIVE NOW BANNER ===== */}
        {liveEvents.length > 0 && (
          <div
            className="mb-8 overflow-hidden rounded-lg border"
            style={{
              borderColor: liveCount > 0 ? 'rgba(255,56,88,0.4)' : 'var(--line)',
              background:
                liveCount > 0
                  ? 'linear-gradient(135deg, rgba(255,56,88,0.10), rgba(210,106,52,0.04))'
                  : 'var(--surface)',
            }}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-3.5">
              <div className="flex items-center gap-3">
                {liveCount > 0 ? (
                  <span
                    className="inline-flex items-center gap-2 font-mono text-[11px] uppercase"
                    style={{ letterSpacing: '0.22em', color: 'var(--danger)' }}
                  >
                    <span className="pulse-dot" />
                    {t('matches.live.now')} · {liveCount}
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-2 font-mono text-[11px] uppercase"
                    style={{ letterSpacing: '0.22em', color: 'var(--accent)' }}
                  >
                    <Clock className="h-3 w-3" />
                    {t('matches.live.today')} · {liveEvents.length}
                  </span>
                )}
              </div>
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.18em' }}
              >
                {t('matches.live.espn')}
              </span>
            </div>
            <div className="grid divide-x divide-[var(--line)] sm:grid-cols-2 lg:grid-cols-3">
              {liveEvents.slice(0, 6).map((e) => {
                const isLive = e.state === 'in';
                return (
                  <div key={e.id} className="px-5 py-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className="font-mono text-[10px] uppercase"
                        style={{
                          letterSpacing: '0.16em',
                          color: isLive ? 'var(--danger)' : 'var(--text-3)',
                        }}
                      >
                        {isLive && <span className="pulse-dot mr-1.5" />}
                        {formatClock(e)}
                      </span>
                      {e.broadcast && (
                        <span
                          className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                          style={{ letterSpacing: '0.14em' }}
                        >
                          {e.broadcast}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamLogo
                          team={{
                            abbrev: e.away.abbrev,
                            name: e.away.name,
                            logoUrl: e.away.logo,
                            brandColor: e.away.color,
                            accentColor: e.away.altColor,
                          }}
                          size={28}
                        />
                        <span className="truncate text-sm font-semibold">
                          {e.away.abbrev || '?'}
                        </span>
                      </div>
                      <div className="text-center">
                        <span
                          className="font-display text-2xl tab-num"
                          style={{
                            color:
                              e.away.score != null && e.home.score != null
                                ? e.away.score > e.home.score
                                  ? 'var(--accent)'
                                  : 'var(--text)'
                                : 'var(--text-3)',
                          }}
                        >
                          {e.away.score ?? '—'}
                        </span>
                        <span className="mx-1.5 font-mono text-xs text-[var(--text-3)]">·</span>
                        <span
                          className="font-display text-2xl tab-num"
                          style={{
                            color:
                              e.home.score != null && e.away.score != null
                                ? e.home.score > e.away.score
                                  ? 'var(--accent)'
                                  : 'var(--text)'
                                : 'var(--text-3)',
                          }}
                        >
                          {e.home.score ?? '—'}
                        </span>
                      </div>
                      <div className="flex flex-row-reverse items-center gap-2 min-w-0">
                        <TeamLogo
                          team={{
                            abbrev: e.home.abbrev,
                            name: e.home.name,
                            logoUrl: e.home.logo,
                            brandColor: e.home.color,
                            accentColor: e.home.altColor,
                          }}
                          size={28}
                        />
                        <span className="truncate text-sm font-semibold">
                          {e.home.abbrev || '?'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter pills */}
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="flex gap-1.5 rounded-pill border border-[var(--line)] bg-[var(--surface)] p-1">
            {(
              [
                ['all', t('matches.filter.all'), null],
                ['live', t('matches.filter.live'), <Radio key="r" className="h-3 w-3" />],
                ['scheduled', t('matches.filter.scheduled'), null],
                ['finished', t('matches.filter.finished'), null],
              ] as Array<[FilterMode, string, React.ReactNode]>
            ).map(([v, label, icon]) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`flex items-center gap-1.5 rounded-pill px-4 py-2 text-xs font-semibold transition ${
                  filter === v
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          <span className="tag">
            <CalendarRange className="h-3 w-3" />{' '}
            {filter === 'live' ? liveEvents.length : filtered.length} {t('common.gamesShort')}
          </span>
        </div>

        {filter === 'live' ? (
          liveEvents.length === 0 ? (
            <div className="card p-16 text-center">
              <Radio className="mx-auto h-10 w-10 text-[var(--text-3)]" />
              <div className="mt-4 font-display text-3xl uppercase">{t('matches.empty.noLive')}</div>
              <p className="mt-2 text-sm text-[var(--text-3)]">
                {t('matches.empty.checkUpcoming')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {liveEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => navigate('/matches')}
                  className="card group p-6 text-left transition hover:-translate-y-1"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className="font-mono text-[10px] uppercase"
                      style={{
                        letterSpacing: '0.18em',
                        color: e.state === 'in' ? 'var(--danger)' : 'var(--accent)',
                      }}
                    >
                      {e.state === 'in' ? '● LIVE' : formatClock(e)}
                    </span>
                    {e.venue && (
                      <span
                        className="truncate font-mono text-[10px] uppercase text-[var(--text-3)]"
                        style={{ letterSpacing: '0.14em' }}
                      >
                        {e.venue}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <TeamLogo
                        team={{
                          abbrev: e.away.abbrev,
                          name: e.away.name,
                          logoUrl: e.away.logo,
                          brandColor: e.away.color,
                          accentColor: e.away.altColor,
                        }}
                        size={56}
                      />
                      <span className="text-sm font-semibold">{e.away.abbrev}</span>
                      <span
                        className="font-display text-4xl tab-num"
                        style={{
                          color:
                            e.away.score != null && e.home.score != null
                              ? e.away.score > e.home.score
                                ? 'var(--accent)'
                                : 'var(--text)'
                              : 'var(--text-3)',
                        }}
                      >
                        {e.away.score ?? '—'}
                      </span>
                    </div>
                    <span
                      className="font-mono text-xs uppercase text-[var(--text-3)]"
                      style={{ letterSpacing: '0.2em' }}
                    >
                      VS
                    </span>
                    <div className="flex flex-col items-center gap-2">
                      <TeamLogo
                        team={{
                          abbrev: e.home.abbrev,
                          name: e.home.name,
                          logoUrl: e.home.logo,
                          brandColor: e.home.color,
                          accentColor: e.home.altColor,
                        }}
                        size={56}
                      />
                      <span className="text-sm font-semibold">{e.home.abbrev}</span>
                      <span
                        className="font-display text-4xl tab-num"
                        style={{
                          color:
                            e.home.score != null && e.away.score != null
                              ? e.home.score > e.away.score
                                ? 'var(--accent)'
                                : 'var(--text)'
                              : 'var(--text-3)',
                        }}
                      >
                        {e.home.score ?? '—'}
                      </span>
                    </div>
                  </div>

                  {e.broadcast && (
                    <div
                      className="mt-4 border-t border-[var(--line)] pt-3 text-center font-mono text-[10px] uppercase text-[var(--text-3)]"
                      style={{ letterSpacing: '0.18em' }}
                    >
                      📺 {e.broadcast}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="card p-16 text-center">
            <Trophy className="mx-auto h-10 w-10 text-[var(--text-3)]" />
            <div className="mt-4 font-display text-3xl uppercase">{t('matches.empty.noFilter')}</div>
            <p className="mt-2 text-sm text-[var(--text-3)]">{t('matches.empty.changeFilter')}</p>
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map(([day, items]) => {
              const allFinished = items.every((m) => m.status === 'finished');
              const totalGames = items.length;
              const finishedItems = items.filter((m) => m.status === 'finished');
              // Parse short date for big display
              let dayNum = '';
              let dayMonth = '';
              let weekday = '';
              try {
                const firstMatch = items[0];
                const d = new Date(firstMatch.date);
                dayNum = String(d.getDate()).padStart(2, '0');
                dayMonth = d.toLocaleString('ru-RU', { month: 'short' }).toUpperCase().replace('.', '');
                weekday = d.toLocaleString('ru-RU', { weekday: 'short' }).toUpperCase();
              } catch {}

              return (
                <article key={day} className="day-block">
                  {/* Sidebar with day info — fills the "empty" area */}
                  <aside className="day-sidebar">
                    <div className="day-bignum">
                      <span className="num">{dayNum}</span>
                      <span className="mo">{dayMonth}</span>
                    </div>
                    <div className="day-name">{weekday}</div>
                    <div className="day-divider" />
                    <div className="day-fullname">{day}</div>

                    <div className="day-stats">
                      <div className="day-stat">
                        <div className="lbl">{t('matches.day.games')}</div>
                        <div className="val">{totalGames}</div>
                      </div>
                      {finishedItems.length > 0 && (
                        <div className="day-stat">
                          <div className="lbl">{t('matches.day.played')}</div>
                          <div className="val" style={{ color: 'var(--ok)' }}>
                            {finishedItems.length}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="day-status">
                      <span className={`tag ${allFinished ? '' : 'tag-hot'}`}>
                        {allFinished ? (
                          <Trophy className="h-3 w-3" />
                        ) : (
                          <Flame className="h-3 w-3" />
                        )}
                        {allFinished ? t('matches.day.finished') : t('matches.day.live')}
                      </span>
                    </div>
                  </aside>

                  <div className="day-grid">
                    {items.map((m) => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        aiHome={aiByMatch[m.id]?.a}
                        aiAway={aiByMatch[m.id]?.b}
                      />
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default MatchesPage;
