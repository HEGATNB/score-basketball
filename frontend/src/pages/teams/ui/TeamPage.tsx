import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, CalendarRange, MapPin, Trophy, Users } from 'lucide-react';
import { apiRequest, type Player, type Team } from '@/shared/api/client';
import { TeamMark } from '@/shared/ui/TeamMark';
import { PlayerCard } from '@/shared/ui/PlayerCard';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';

export const TeamPage = () => {
  const { teamId } = useParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!teamId) {
      setError('Не указан id команды.');
      setLoading(false);
      return;
    }
    apiRequest<Team>(`/teams/${teamId}`)
      .then(async (t) => {
        setTeam(t);
        if (t.abbrev) {
          const list = await apiRequest<Player[]>(`/players/team/${t.abbrev}`);
          setPlayers(list);
        }
      })
      .catch(() => setError('Не удалось загрузить команду.'))
      .finally(() => setLoading(false));
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
              <span className="tag">{team.division?.name || 'Дивизион'}</span>
              {team.championships && team.championships > 0 && (
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
              style={{ fontSize: 'clamp(56px, 8vw, 130px)', lineHeight: 0.88 }}
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
              Запись
            </div>
            <div className="font-display text-5xl tab-num">
              {team.wins}–{team.losses}
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-sm bg-[var(--surface-3)]">
              <div
                className="h-full"
                style={{
                  width: `${Math.max(8, winRate)}%`,
                  background: 'linear-gradient(90deg, var(--accent), var(--gold))',
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
            <div className="font-display text-5xl tab-num">{winRate.toFixed(1)}%</div>
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
              {team.avgPointsFor.toFixed(1)}
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
              {diff >= 0 ? '+' : ''}
              {diff.toFixed(1)}
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
                style={{ background: 'rgba(255,90,31,0.12)', color: 'var(--accent)' }}
              >
                <MapPin className="h-4 w-4" />
              </div>
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                Домашняя
              </span>
            </div>
            <p className="mt-5 font-display text-2xl uppercase">{team.arena || 'Арена'}</p>
            <p className="mt-2 text-sm text-[var(--text-3)]">
              {team.city || '—'}
              {team.foundedYear ? ` · с ${team.foundedYear}` : ''}
            </p>
          </div>

          <div className="card p-8">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-md"
                style={{ background: 'rgba(255,184,0,0.12)', color: 'var(--gold)' }}
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
            <p className="mt-5 font-display text-2xl uppercase">{players.length} игроков</p>
            <p className="mt-2 text-sm text-[var(--text-3)]">Активный roster — клик для деталей.</p>
          </div>
        </div>

        {/* Team players */}
        {displayPlayers.length > 0 && (
          <div className="mt-12">
            <div className="mb-7 flex items-center gap-4">
              <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <h3 className="m-0 font-display text-3xl uppercase">
                Лучшие <em style={{ color: 'var(--accent)', fontStyle: 'normal' }}>игроки</em>
              </h3>
              <span className="font-mono text-xs uppercase text-[var(--text-3)]">
                {displayPlayers.length} в составе
              </span>
            </div>
            <div className="flex gap-5 overflow-x-auto pb-2 no-scrollbar">
              {displayPlayers.map((p, i) => (
                <PlayerCard key={p.id} player={p} highlight={i === 0} />
              ))}
            </div>
          </div>
        )}

        {players.length === 0 && (
          <div className="mt-12 card p-12 text-center">
            <p className="font-display text-2xl uppercase">Состав индексируется.</p>
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
