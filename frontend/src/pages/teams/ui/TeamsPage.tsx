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
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [view, setView] = useState<TeamView>('cards');
  const [conference, setConference] = useState<ConferenceFilter>('all');

  useEffect(() => {
    apiRequest<Team[]>('/teams')
      .then((d) => setTeams([...d].sort((a, b) => b.wins - a.wins)))
      .catch(() => setError('Не удалось загрузить команды.'))
      .finally(() => setLoading(false));
  }, []);

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

  const avgOff = useMemo(
    () => (teams.length ? teams.reduce((s, t) => s + t.avgPointsFor, 0) / teams.length : 0),
    [teams],
  );
  const bestDiff = useMemo(
    () => (teams.length ? [...teams].sort((a, b) => getDifferential(b) - getDifferential(a))[0] : null),
    [teams],
  );

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
        <div className="card border-[rgba(255,56,88,0.25)] bg-[rgba(255,56,88,0.06)] p-8 text-[var(--danger)]">{error}</div>
      </div>
    );
  }

  return (
    <>
      <section className="section">
        <div className="container-x">
          <div className="section-head">
            <div className="flex flex-col gap-3">
              <span className="eyebrow"><span className="dot" />ЛИГА · ДАННЫЕ И ФОРМА</span>
              <h2>
                КОМАНДЫ <em>NBA</em><br />В ОДНОМ СЛОЕ
              </h2>
            </div>
            <p className="lead">
              Рейтинг, темп атаки, баланс очков и профиль каждой команды напрямую из базы. Открой клуб,
              чтобы увидеть состав и сезонные показатели.
            </p>
          </div>

          {/* Stat band */}
          <div
            className="mb-8 grid overflow-hidden rounded-lg border border-[var(--line)]"
            style={{ gap: 1, background: 'var(--line)', gridTemplateColumns: 'repeat(4, 1fr)' }}
          >
            <div className="bg-[var(--surface)] p-5">
              <div
                className="mb-1.5 font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.16em' }}
              >
                Лидер
              </div>
              <div className="font-display text-2xl uppercase">{teams[0]?.abbrev || '—'}</div>
              <div className="mt-1 font-mono text-xs" style={{ color: 'var(--accent)' }}>
                {teams[0] ? `${teams[0].wins}–${teams[0].losses}` : '—'}
              </div>
            </div>
            <div className="bg-[var(--surface)] p-5">
              <div
                className="mb-1.5 font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.16em' }}
              >
                Средняя атака
              </div>
              <div className="font-display text-3xl tab-num">{avgOff.toFixed(1)}</div>
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
            <div className="relative flex-1 lg:max-w-md">
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
                      ? 'bg-[var(--accent)] text-[#0a0a0c]'
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
                      ? 'bg-[var(--accent)] text-[#0a0a0c]'
                      : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {v === 'cards' ? 'Карточки' : 'Таблица'}
                </button>
              ))}
            </div>
          </div>

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
                            {t.wins}–{t.losses}
                          </div>
                        </div>
                        <div className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] p-2.5">
                          <div
                            className="font-mono text-[9px] uppercase text-[var(--text-3)]"
                            style={{ letterSpacing: '0.14em' }}
                          >
                            WIN%
                          </div>
                          <div className="mt-1 font-display text-lg tab-num">{winPct.toFixed(1)}</div>
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
                            {diff >= 0 ? '+' : ''}
                            {diff.toFixed(1)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 h-1 overflow-hidden rounded-sm bg-[var(--surface-3)]">
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.max(8, winPct)}%`,
                            background: 'linear-gradient(90deg, var(--accent), var(--gold))',
                          }}
                        />
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-3)]">
                        <span>{winPct.toFixed(1)}% побед</span>
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
                          onClick={() => (window.location.href = `/teams/${t.id}`)}
                        >
                          <td className="font-mono">{String(i + 1).padStart(2, '0')}</td>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <TeamMark team={t} size="sm" />
                              <span className="font-semibold">{t.name}</span>
                              <span className="text-xs text-[var(--text-3)]">{t.city || '—'}</span>
                            </div>
                          </td>
                          <td className="pct">{t.wins}</td>
                          <td className="pct">{t.losses}</td>
                          <td className="pct">{getWinRate(t).toFixed(1)}%</td>
                          <td className="pct">{t.avgPointsFor.toFixed(1)}</td>
                          <td className="pct">{t.avgPointsAgainst.toFixed(1)}</td>
                          <td
                            className="pct"
                            style={{ color: diff >= 0 ? 'var(--ok)' : 'var(--danger)' }}
                          >
                            {diff >= 0 ? '+' : ''}
                            {diff.toFixed(1)}
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
