import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Cpu, MapPin, Sparkles, Trophy } from 'lucide-react';
import { apiRequest, type Match } from '@/shared/api/client';
import { TeamMark } from '@/shared/ui/TeamMark';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';

function formatDate(date: string) {
  try {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatTime(date: string) {
  try {
    return new Date(date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export const MatchPage = () => {
  const { matchId } = useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return setLoading(false);
    apiRequest<Match>(`/matches/${matchId}`)
      .then(setMatch)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [matchId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="md" label="Загружаем матч" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="container-x py-20">
        <Link to="/matches" className="btn btn-ghost mb-6">
          <ArrowLeft className="h-4 w-4" />
          Все матчи
        </Link>
        <div className="card border-[rgba(255,56,88,0.25)] bg-[rgba(255,56,88,0.06)] p-8 text-[var(--danger)]">
          Матч не найден.
        </div>
      </div>
    );
  }

  const isFinished = match.status === 'finished';
  const winner =
    isFinished && match.homeScore != null && match.awayScore != null
      ? match.homeScore > match.awayScore
        ? 'home'
        : match.awayScore > match.homeScore
          ? 'away'
          : 'draw'
      : null;

  return (
    <section className="section">
      <div className="container-x">
        <Link to="/matches" className="btn btn-ghost mb-8">
          <ArrowLeft className="h-4 w-4" />
          Все матчи
        </Link>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className={`tag ${isFinished ? 'tag-gold' : 'tag-hot'}`}>
            {isFinished ? 'FINAL' : 'UPCOMING'}
          </span>
          <span className="tag">
            <Calendar className="h-3 w-3" />
            {formatDate(match.date)}
          </span>
          <span className="tag">{formatTime(match.date)}</span>
        </div>

        <h1
          className="display-h mb-12"
          style={{ fontSize: 'clamp(48px, 7vw, 100px)' }}
        >
          {match.homeTeam.city || match.homeTeam.name}
          <br />
          <span style={{ color: 'var(--accent)' }}>vs</span>
          <br />
          {match.awayTeam.city || match.awayTeam.name}
        </h1>

        {/* Scoreline */}
        <div className="card overflow-hidden p-10 lg:p-14">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
            <div className="flex flex-col items-center gap-5 text-center">
              <Link to={`/teams/${match.homeTeam.id}`}>
                <TeamMark team={match.homeTeam} size="xl" showGlow />
              </Link>
              <div>
                <div
                  className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                  style={{ letterSpacing: '0.22em' }}
                >
                  Дома
                </div>
                <div className="mt-2 font-display text-3xl uppercase">{match.homeTeam.name}</div>
                {winner === 'home' && (
                  <span className="tag tag-gold mt-3">
                    <Trophy className="h-3 w-3" /> Победа
                  </span>
                )}
              </div>
              <div
                className="font-mono text-7xl tab-num lg:text-8xl"
                style={{ fontWeight: 200 }}
              >
                {match.homeScore ?? '—'}
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <span className="font-display text-3xl lg:text-5xl" style={{ color: 'var(--accent)' }}>
                vs
              </span>
              <div className="h-12 w-px bg-[var(--line)] lg:h-24" />
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                tip-off
              </span>
              <span className="font-mono text-sm tab-num">{formatTime(match.date)}</span>
            </div>

            <div className="flex flex-col items-center gap-5 text-center">
              <Link to={`/teams/${match.awayTeam.id}`}>
                <TeamMark team={match.awayTeam} size="xl" showGlow />
              </Link>
              <div>
                <div
                  className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                  style={{ letterSpacing: '0.22em' }}
                >
                  Выезд
                </div>
                <div className="mt-2 font-display text-3xl uppercase">{match.awayTeam.name}</div>
                {winner === 'away' && (
                  <span className="tag tag-gold mt-3">
                    <Trophy className="h-3 w-3" /> Победа
                  </span>
                )}
              </div>
              <div
                className="font-mono text-7xl tab-num lg:text-8xl"
                style={{ fontWeight: 200 }}
              >
                {match.awayScore ?? '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Meta cards */}
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <div className="card p-8">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-md"
                style={{ background: 'rgba(255,90,31,0.12)', color: 'var(--accent)' }}
              >
                <Calendar className="h-4 w-4" />
              </div>
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                Когда
              </span>
            </div>
            <p className="mt-5 font-display text-2xl uppercase">{formatDate(match.date)}</p>
            <p className="mt-2 text-sm text-[var(--text-3)]">
              {formatTime(match.date)} · {isFinished ? 'Финальный счёт' : 'Ожидаем tip-off'}
            </p>
          </div>

          <div className="card p-8">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-md"
                style={{ background: 'rgba(255,184,0,0.12)', color: 'var(--gold)' }}
              >
                <MapPin className="h-4 w-4" />
              </div>
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                Площадка
              </span>
            </div>
            <p className="mt-5 font-display text-2xl uppercase">
              {match.homeTeam.arena || match.homeTeam.city || '—'}
            </p>
            <p className="mt-2 text-sm text-[var(--text-3)]">Дом {match.homeTeam.name}</p>
          </div>

          <div
            className="card p-8"
            style={{ background: 'linear-gradient(135deg, rgba(255,90,31,0.10), transparent), var(--surface)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-md"
                style={{ background: 'rgba(255,90,31,0.18)', color: 'var(--accent)' }}
              >
                <Cpu className="h-4 w-4" />
              </div>
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                ИИ-прогноз
              </span>
            </div>
            <p className="mt-5 font-display text-2xl uppercase">Сделай прогноз</p>
            <p className="mt-2 text-sm text-[var(--text-3)]">Запусти модель на этот матчап.</p>
            <Link
              to={`/prediction/new?team1=${match.homeTeam.id}&team2=${match.awayTeam.id}`}
              className="btn btn-primary mt-6"
            >
              <Sparkles className="h-4 w-4" />
              Прогноз
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MatchPage;
