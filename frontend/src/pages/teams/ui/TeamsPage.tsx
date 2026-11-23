import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { apiRequest, type Team } from '@/shared/api/client';
import { TeamMark } from '@/shared/ui/TeamMark';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';

type TeamView = 'standings' | 'cards';
type ConferenceFilter = 'all' | 'Eastern' | 'Western';

function getWinRate(team: Team) {
  const total = team.wins + team.losses;
  return total > 0 ? (team.wins / total) * 100 : 0;
}

function getDifferential(team: Team) {
  return team.avgPointsFor - team.avgPointsAgainst;
}

export const TeamsPage = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [view, setView] = useState<TeamView>('cards');
  const [conference, setConference] = useState<ConferenceFilter>('all');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiRequest<Team[]>('/teams', undefined, false)
      .then((data) => {
        if (active) setTeams([...data].sort((a, b) => getWinRate(b) - getWinRate(a) || a.name.localeCompare(b.name)));
      })
      .catch(() => { if (active) setError('Не удалось загрузить команды.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((t) => {
      const okConf = conference === 'all' || t.conference?.name === conference;
      if (!okConf) return false;
      if (!q) return true;
      return [t.name, t.city, t.abbrev, t.division?.name, t.conference?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [search, conference, teams]);

  const measured = teams.filter((team) => team.hasStats !== false && team.wins + team.losses > 0);
  const offense = measured.filter((team) => team.avgPointsFor > 0 && team.avgPointsAgainst > 0);
  const avgOff = offense.length ? offense.reduce((sum, team) => sum + team.avgPointsFor, 0) / offense.length : null;
  const bestDiff = [...offense].sort((a, b) => getDifferential(b) - getDifferential(a))[0];
  const leader = measured[0];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="md" label="Загружаем команды" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="container-x py-20">
        <div className="card border-[rgba(255,56,88,0.25)] bg-[rgba(255,56,88,0.06)] p-8 text-[var(--danger)]">{error}
          <button type="button" className="btn btn-secondary ml-4" onClick={() => setRevision((value) => value + 1)}>Повторить</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="section">
        <div className="container-x">
          <div className="section-head">
            <div className="flex flex-col gap-3">
              <h1 className="display-h text-4xl sm:text-6xl">Команды NBA</h1>
            </div>
            <p className="lead">
              Составы, статистика и новости клубов. Выберите команду, чтобы открыть её профиль.
            </p>
          </div>

          {/* Stat band */}
          <div
            className="mb-8 grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--line)] sm:grid-cols-4"
            style={{ gap: 1, background: 'var(--line)' }}
          >
            <div className="bg-[var(--surface)] p-5">
              <div
                className="mb-1.5 font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.16em' }}
              >
                Лидер
              </div>
              <div className="font-display text-2xl uppercase">{leader?.abbrev || '—'}</div>
              <div className="mt-1 font-mono text-xs" style={{ color: 'var(--accent)' }}>
                {leader ? leader.wins + '–' + leader.losses : '—'}
              </div>
            </div>
            <div className="bg-[var(--surface)] p-5">
              <div
                className="mb-1.5 font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.16em' }}
              >
                Средняя атака
              </div>
              <div className="font-display text-3xl tab-num">{avgOff?.toFixed(1) ?? '—'}</div>
              <div className="mt-1 text-xs text-[var(--text-3)]">PPG среднее</div>
            </div>
            <div className="bg-[var(--surface)] p-5">
              <div
                className="mb-1.5 font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.16em' }}
              >
                Лучший net
              </div>
              <div className="font-display text-2xl uppercase">{bestDiff?.abbrev || '—'}</div>
              <div className="mt-1 font-mono text-xs" style={{ color: 'var(--ok)' }}>
                {bestDiff ? `+${getDifferential(bestDiff).toFixed(1)}` : '—'}
              </div>
            </div>
            <div className="bg-[var(--surface)] p-5">
              <div
                className="mb-1.5 font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.16em' }}
              >
                В выборке
              </div>
              <div className="font-display text-3xl tab-num">{filtered.length}</div>
              <div className="mt-1 text-xs text-[var(--text-3)]">после фильтров</div>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-[1_1_14rem] lg:max-w-md">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: 'var(--text-3)' }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск: Boston, Atlantic, BOS..."
                className="field pl-11 pr-11"
              />
              {search && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)]"
                  onClick={() => setSearch('')}
                  aria-label="Очистить"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex gap-1.5 rounded-pill border border-[var(--line)] bg-[var(--surface)] p-1">
              {(['all', 'Eastern', 'Western'] as ConferenceFilter[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setConference(c)}
                  className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold transition ${
                    conference === c
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {c === 'all' ? 'Все' : c === 'Eastern' ? 'Восток' : 'Запад'}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5 rounded-pill border border-[var(--line)] bg-[var(--surface)] p-1">
              {(['cards', 'standings'] as TeamView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold transition ${
                    view === v
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {v === 'cards' ? 'Карточки' : 'Таблица'}
                </button>
              ))}
            </div>
          </div>

          {teams.some((team) => team.source === 'catalog') && (
            <p className="score-feed-note mb-4" role="status">Каталог команд доступен. Часть сезонной статистики пока не загрузилась.</p>
          )}
          {!filtered.length && <p className="score-panel mb-5 p-5" role="status">По этим фильтрам команд нет.</p>}
          {view === 'cards' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((t, i) => {
                const winPct = getWinRate(t);
                const diff = getDifferential(t);
                return (
                  <Link key={t.id} to={`/teams/${t.id}`} className="block">
                    <div className="card group p-5">
                      <div className="flex items-start justify-between">
                        <TeamMark team={t} size="lg" showGlow={i < 3} />
                        <span className="font-display text-3xl text-[var(--text-mute)]">
                          #{String(i + 1).padStart(2, '0')}
                        </span>
                      </div>

                      <div className="mt-4">
                        <div
                          className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                          style={{ letterSpacing: '0.16em' }}
                        >
                          {t.conference?.shortName || t.conference?.name || 'NBA'} ·{' '}
                          {t.division?.name || '—'}
                        </div>
                        <div className="mt-1.5 font-display text-2xl uppercase">{t.name}</div>
                        <div className="mt-0.5 text-xs text-[var(--text-3)]">{t.city || '—'}</div>
                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-2">
                        <div className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] p-2.5">
                          <div
                            className="font-mono text-[9px] uppercase text-[var(--text-3)]"
                            style={{ letterSpacing: '0.14em' }}
                          >
                            ЗАП
                          </div>
                          <div className="mt-1 font-display text-lg tab-num">
                            {t.hasStats === false ? '—' : t.wins + '–' + t.losses}
                          </div>
                        </div>
                        <div className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] p-2.5">
                          <div
                            className="font-mono text-[9px] uppercase text-[var(--text-3)]"
                            style={{ letterSpacing: '0.14em' }}
                          >
                            WIN%
                          </div>
                          <div className="mt-1 font-display text-lg tab-num">{t.hasStats === false ? '—' : winPct.toFixed(1)}</div>
                        </div>
                        <div className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] p-2.5">
                          <div
                            className="font-mono text-[9px] uppercase text-[var(--text-3)]"
                            style={{ letterSpacing: '0.14em' }}
                          >
                            NET
                          </div>
                          <div
                            className="mt-1 font-display text-lg tab-num"
                            style={{ color: diff >= 0 ? 'var(--ok)' : 'var(--danger)' }}
                          >
                            {t.hasStats === false || !t.avgPointsFor || !t.avgPointsAgainst ? '—' : (diff >= 0 ? '+' : '') + diff.toFixed(1)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 h-1 overflow-hidden rounded-sm bg-[var(--surface-3)]">
                        <div
                          className="h-full"
                          style={{
                            width: winPct + '%',
                            background: 'linear-gradient(90deg, var(--accent-deep), var(--accent-strong))',
                          }}
                        />
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-3)]">
                        <span>{t.hasStats === false ? t.abbrev : winPct.toFixed(1) + '% побед'}</span>
                        <span className="flex items-center gap-1 text-[var(--text-2)] transition group-hover:text-[var(--accent)]">
                          Открыть <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="standings-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Команда</th>
                      <th>W</th>
                      <th>L</th>
                      <th>%</th>
                      <th>PF</th>
                      <th>PA</th>
                      <th>NET</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t, i) => {
                      const diff = getDifferential(t);
                      return (
                        <tr
                          key={t.id}
                          className={`${i < 3 ? 'hot ' : ''}cursor-pointer`}
                        >
                          <td className="font-mono">{String(i + 1).padStart(2, '0')}</td>
                          <td>
                            <Link to={'/teams/' + t.id} className="flex items-center gap-2.5">
                              <TeamMark team={t} size="sm" />
                              <span className="font-semibold">{t.name}</span>
                              <span className="text-xs text-[var(--text-3)]">{t.city || '—'}</span>
                            </Link>
                          </td>
                          <td className="pct">{t.hasStats === false ? '—' : t.wins}</td>
                          <td className="pct">{t.hasStats === false ? '—' : t.losses}</td>
                          <td className="pct">{t.hasStats === false ? '—' : getWinRate(t).toFixed(1) + '%'}</td>
                          <td className="pct">{t.avgPointsFor ? t.avgPointsFor.toFixed(1) : '—'}</td>
                          <td className="pct">{t.avgPointsAgainst ? t.avgPointsAgainst.toFixed(1) : '—'}</td>
                          <td
                            className="pct"
                            style={{ color: diff >= 0 ? 'var(--ok)' : 'var(--danger)' }}
                          >
                            {t.hasStats === false || !t.avgPointsFor || !t.avgPointsAgainst ? '—' : (diff >= 0 ? '+' : '') + diff.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default TeamsPage;
