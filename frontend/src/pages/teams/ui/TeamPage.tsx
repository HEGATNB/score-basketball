import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, CalendarRange, ChevronLeft, ChevronRight, MapPin, Trophy, Users } from 'lucide-react';
import { apiRequest, type Player, type Team } from '@/shared/api/client';
import { TeamMark } from '@/shared/ui/TeamMark';
import { PlayerCard } from '@/shared/ui/PlayerCard';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { liveApi, type LiveNewsItem, type RosterPlayer } from '@/shared/api/live';


export const TeamPage = () => {
  const { teamId } = useParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[] | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [news, setNews] = useState<LiveNewsItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const rosterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setTeam(null);
    setPlayers([]);
    setRoster(null);
    setNews(null);
    setRosterLoading(false);

    if (!teamId) {
      setError('Не указан id команды.');
      setLoading(false);
      return;
    }
    apiRequest<Team>('/teams/' + encodeURIComponent(teamId))
      .then((profile) => {
        if (!active) return;
        setTeam(profile);
        if (!profile.abbrev) return;
        const code = profile.abbrev;
        setRosterLoading(true);
        liveApi.roster(code).then((result) => {
          if (active) setRoster(result);
        }).catch(() => undefined).finally(() => { if (active) setRosterLoading(false); });
        if (profile.source !== 'espn' && profile.source !== 'catalog') {
          apiRequest<Player[]>('/players/team/' + encodeURIComponent(code))
            .then((result) => { if (active) setPlayers(result); })
            .catch(() => undefined);
        }
        liveApi.newsFeed(6, code).then((result) => { if (active) setNews(result.items); }).catch(() => undefined);
      })
      .catch(() => { if (active) setError('Не удалось загрузить команду.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [teamId]);

  const winRate = useMemo(() => {
    if (!team) return 0;
    const total = team.wins + team.losses;
    return total > 0 ? (team.wins / total) * 100 : 0;
  }, [team]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="md" label="Загружаем команду" />
      </div>
    );
  }

  if (!team || error) {
    return (
      <div className="container-x py-20">
        <Link to="/teams" className="btn btn-ghost mb-6">
          <ArrowLeft className="h-4 w-4" />
          Все команды
        </Link>
        <div className="card border-[rgba(255,56,88,0.25)] bg-[rgba(255,56,88,0.06)] p-8 text-[var(--danger)]">
          {error || 'Команда не найдена.'}
        </div>
      </div>
    );
  }

  const hasStats = team.hasStats !== false;
  const hasPoints = hasStats && team.avgPointsFor > 0 && team.avgPointsAgainst > 0;
  const diff = team.avgPointsFor - team.avgPointsAgainst;
  const displayPlayers = [...players].sort((a, b) => b.points_per_game - a.points_per_game);

  return (
    <section className="section">
      <div className="container-x">
        <Link to="/teams" className="btn btn-ghost mb-8">
          <ArrowLeft className="h-4 w-4" />
          Все команды
        </Link>

        <div className="grid items-end gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="tag tag-hot">
                {team.conference?.shortName || team.conference?.name || 'NBA'}
              </span>
              <span className="tag">{team.division?.name || (team.source === 'espn' ? 'ESPN' : 'NBA')}</span>
              {Boolean(team.championships) && (
                <span className="tag tag-gold">
                  <Trophy className="h-3 w-3" /> {team.championships} титулов
                </span>
              )}
            </div>

            <div
              className="font-mono text-[12px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.22em' }}
            >
              {team.city || team.abbrev}
            </div>
            <h1
              className="display-h mt-3"
              style={{ fontSize: 'clamp(32px, 7.5vw, 96px)', overflowWrap: 'anywhere', lineHeight: 0.88 }}
            >
              {team.name}
            </h1>
          </div>

          <TeamMark team={team} size="xl" showGlow className="!h-32 !w-32 !text-5xl" />
        </div>

        {/* Stats band */}
        <div
          className="mt-12 grid overflow-hidden rounded-lg border border-[var(--line)]"
          style={{ gap: 1, background: 'var(--line)', gridTemplateColumns: 'repeat(4, 1fr)' }}
        >
          <div className="bg-[var(--surface)] p-6">
            <div
              className="mb-2 font-mono text-[10px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.18em' }}
            >
              Победы–поражения
            </div>
            <div className="font-display text-5xl tab-num">
              {hasStats ? team.wins + '–' + team.losses : '—'}
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-sm bg-[var(--surface-3)]">
              <div
                className="h-full"
                style={{
                  width: `${Math.max(8, winRate)}%`,
                  background: 'linear-gradient(90deg, var(--accent-deep), var(--accent-strong))',
                }}
              />
            </div>
          </div>
          <div className="bg-[var(--surface)] p-6">
            <div
              className="mb-2 font-mono text-[10px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.18em' }}
            >
              % побед
            </div>
            <div className="font-display text-5xl tab-num">{hasStats ? winRate.toFixed(1) : '—'}%</div>
            <div className="mt-2 text-xs text-[var(--text-3)]">Позиция в лиге</div>
          </div>
          <div className="bg-[var(--surface)] p-6">
            <div
              className="mb-2 font-mono text-[10px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.18em' }}
            >
              Атака
            </div>
            <div
              className="font-display text-5xl tab-num"
              style={{ color: 'var(--accent)' }}
            >
              {hasPoints ? team.avgPointsFor.toFixed(1) : '—'}
            </div>
            <div className="mt-2 text-xs text-[var(--text-3)]">Очков за игру</div>
          </div>
          <div className="bg-[var(--surface)] p-6">
            <div
              className="mb-2 font-mono text-[10px] uppercase text-[var(--text-3)]"
              style={{ letterSpacing: '0.18em' }}
            >
              Net
            </div>
            <div
              className="font-display text-5xl tab-num"
              style={{ color: diff >= 0 ? 'var(--ok)' : 'var(--danger)' }}
            >
              {hasPoints ? (diff >= 0 ? '+' : '') + diff.toFixed(1) : '—'}
            </div>
            <div className="mt-2 text-xs text-[var(--text-3)]">PF − PA</div>
          </div>
        </div>

        {/* Identity */}
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <div className="card p-8">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-md"
                style={{ background: 'rgba(210,106,52,0.12)', color: 'var(--accent)' }}
              >
                <MapPin className="h-4 w-4" />
              </div>
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                Арена
              </span>
            </div>
            <p className="mt-5 font-display text-2xl uppercase">{team.arena || '—'}</p>
            <p className="mt-2 text-sm text-[var(--text-3)]">
              {team.city || '—'}
              {team.foundedYear ? ` · с ${team.foundedYear}` : ''}
            </p>
          </div>

          <div className="card p-8">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-md"
                style={{ background: 'rgba(230,185,74,0.12)', color: 'var(--gold)' }}
              >
                <Building2 className="h-4 w-4" />
              </div>
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                Конференция
              </span>
            </div>
            <p className="mt-5 font-display text-2xl uppercase">{team.conference?.name || 'NBA'}</p>
            <p className="mt-2 text-sm text-[var(--text-3)]">Дивизион · {team.division?.name || '—'}</p>
          </div>

          <div className="card p-8">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-md"
                style={{ background: 'rgba(46,230,138,0.12)', color: 'var(--ok)' }}
              >
                <CalendarRange className="h-4 w-4" />
              </div>
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                Состав
              </span>
            </div>
            <p className="mt-5 font-display text-2xl uppercase">{roster ? roster.length + ' игроков' : rosterLoading ? 'Загрузка…' : '—'}</p>
            <p className="mt-2 text-sm text-[var(--text-3)]">Текущий состав ESPN</p>
          </div>
        </div>

        {team.abbrev && (
          <div className="mt-10 grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
            <section className="score-panel p-5">
              <h2 className="mb-4 font-display text-3xl">Текущий состав</h2>
              {roster?.length ? (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {roster.map((player) => (
                    <li key={player.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--line)] p-2.5">
                      {player.photo && (
                        <img src={player.photo} alt="" loading="lazy" width="40" height="40"
                          className="h-10 w-10 shrink-0 rounded-full bg-[var(--surface-2)] object-cover" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{player.name}</p>
                        <p className="text-xs text-[var(--text-2)]">{[player.number && '#' + player.number, player.position].filter(Boolean).join(' · ')}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-[var(--text-2)]" role="status">
                {rosterLoading ? 'Загружаем состав…' : 'Текущий состав временно недоступен.'}
              </p>}
            </section>
            <section className="score-panel p-5">
              <h2 className="mb-4 font-display text-3xl">Новости команды</h2>
              {news?.length ? (
                <ul className="space-y-3">
                  {news.map((item) => <li key={item.id}>
                    <Link className="text-sm text-[var(--accent-strong)]"
                      to={'/news?' + new URLSearchParams({ team: team.abbrev ?? '', article: item.id })}>
                      {item.title}
                    </Link>
                  </li>)}
                </ul>
              ) : <p className="text-sm text-[var(--text-2)]">
                {news ? 'Свежих материалов в ленте нет.' : 'Лента команды пока недоступна.'}
              </p>}
              <Link className="btn btn-secondary mt-4" to={'/news?team=' + team.abbrev}>Открыть ленту</Link>
            </section>
          </div>
        )}

        {/* Team players */}
        {displayPlayers.length > 0 && (
          <div className="mt-12">
            <div className="mb-7 flex items-center gap-4">
              <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <h3 className="m-0 font-display text-3xl uppercase">
                Игроки в архиве
              </h3>
              <span className="font-mono text-xs uppercase text-[var(--text-3)]">
                {displayPlayers.length} в базе
              </span>
              {/* Scroll controls — the roster is a horizontal rail; without
                  visible arrows there was no obvious way to page through it. */}
              <div className="ml-auto flex gap-2">
                <button
                  className="btn btn-icon"
                  onClick={() => rosterRef.current?.scrollBy({ left: -360, behavior: 'smooth' })}
                  aria-label="Назад"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  className="btn btn-icon"
                  onClick={() => rosterRef.current?.scrollBy({ left: 360, behavior: 'smooth' })}
                  aria-label="Вперёд"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div
              ref={rosterRef}
              className="flex gap-5 overflow-x-auto pb-2 no-scrollbar"
              style={{ scrollSnapType: 'x mandatory', scrollBehavior: 'smooth' }}
            >
              {displayPlayers.map((p, i) => (
                <PlayerCard key={p.id} player={p} highlight={i === 0} />
              ))}
            </div>
          </div>
        )}

        {players.length === 0 && (
          <div className="mt-12 card p-12 text-center">
            <p className="font-display text-2xl uppercase">Архив статистики игроков</p>
            <p className="mt-2 text-sm text-[var(--text-3)]">
              Данные по игрокам {team.name} ещё не загружены.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default TeamPage;
