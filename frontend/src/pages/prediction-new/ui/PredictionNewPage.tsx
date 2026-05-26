import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Cpu, Lock, Sparkles, Swords, Zap } from 'lucide-react';
import { apiRequest, type Team } from '@/shared/api/client';
import { useAuth } from '@/app/providers/AuthProvider';
import { TeamMark } from '@/shared/ui/TeamMark';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';

export const PredictionNewPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [teams, setTeams] = useState<Team[]>([]);
  const [team1Id, setTeam1Id] = useState(searchParams.get('team1') || '');
  const [team2Id, setTeam2Id] = useState(searchParams.get('team2') || '');
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<Team[]>('/teams')
      .then((data) => setTeams([...data].sort((a, b) => b.wins - a.wins)))
      .catch(() => setError('Не удалось загрузить команды.'))
      .finally(() => setLoadingTeams(false));
  }, []);

  const selected = useMemo(() => {
    const home = teams.find((t) => String(t.id) === team1Id) || null;
    const away = teams.find((t) => String(t.id) === team2Id) || null;
    return { home, away };
  }, [team1Id, team2Id, teams]);

  const handlePredict = async () => {
    if (!team1Id || !team2Id) {
      setError('Выбери обе команды.');
      return;
    }
    if (team1Id === team2Id) {
      setError('Команды должны быть разными.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await apiRequest<{ id: string }>(
        '/predict',
        {
          method: 'POST',
          body: JSON.stringify({ team1Id: Number(team1Id), team2Id: Number(team2Id) }),
        },
        false,
      );
      navigate(`/prediction/${result.id}`);
    } catch (err: any) {
      setError(err?.message || 'Прогноз не выполнен.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <section className="flex min-h-[80vh] items-center justify-center">
        <div className="container-x">
          <div className="card mx-auto max-w-2xl p-10 text-center sm:p-14">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-md"
              style={{ background: 'rgba(255,90,31,0.15)', color: 'var(--accent)' }}
            >
              <Lock className="h-6 w-6" />
            </div>
            <h1
              className="display-h mt-6"
              style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}
            >
              ВОЙДИ <em>ЧТОБЫ</em> ПРОГНОЗИРОВАТЬ
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm text-[var(--text-3)]">
              Прогнозы привязаны к аккаунту, чтобы сохранять историю и отслеживать точность.
            </p>
            <Link to="/auth" className="btn btn-primary mt-7">
              <Sparkles className="h-4 w-4" />
              Войти
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (loadingTeams) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="md" label="Загружаем команды" />
      </div>
    );
  }

  const canSubmit = team1Id && team2Id && team1Id !== team2Id && !submitting;

  return (
    <section className="section">
      <div className="container-x">
        <div className="section-head">
          <div className="flex flex-col gap-3">
            <span className="eyebrow"><span className="dot" />MODEL ENGINE · MATCHUP</span>
            <h2>
              СОБЕРИ <em>МАТЧАП</em>.<br />ПОЛУЧИ ОЦЕНКУ.
            </h2>
          </div>
          <p className="lead">
            Выбери две команды. Бэкенд рассчитает вероятность победы, ожидаемый счёт и сохранит прогноз
            в твоей истории.
          </p>
        </div>

        {/* Matchup builder */}
        <div className="grid items-stretch gap-5 lg:grid-cols-[1fr_auto_1fr]">
          <TeamSelector
            label="Дома"
            value={team1Id}
            onChange={setTeam1Id}
            teams={teams}
            selected={selected.home}
            disabledTeamId={team2Id}
          />

          <div className="flex flex-col items-center justify-center gap-3 px-2">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-md"
              style={{
                background: 'rgba(255,90,31,0.10)',
                border: '1px solid rgba(255,90,31,0.30)',
                color: 'var(--accent)',
              }}
            >
              <Swords className="h-6 w-6" />
            </div>
            <span className="font-display text-2xl" style={{ color: 'var(--accent)' }}>
              vs
            </span>
          </div>

          <TeamSelector
            label="Выезд"
            value={team2Id}
            onChange={setTeam2Id}
            teams={teams}
            selected={selected.away}
            disabledTeamId={team1Id}
          />
        </div>

        {error && (
          <div
            className="mt-5 rounded-md border p-4 text-sm"
            style={{
              borderColor: 'rgba(255,56,88,0.3)',
              background: 'rgba(255,56,88,0.08)',
              color: 'var(--danger)',
            }}
          >
            {error}
          </div>
        )}

        {/* Submit */}
        <div
          className="card mt-10 overflow-hidden p-8 sm:p-10"
          style={{
            background:
              'linear-gradient(120deg, rgba(255,90,31,0.10), transparent 50%), linear-gradient(240deg, rgba(255,184,0,0.06), transparent 60%), var(--surface)',
          }}
        >
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <span className="tag tag-gold">
                <Sparkles className="h-3 w-3" />
                ГОТОВ
              </span>
              <h3 className="display-h mt-5" style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}>
                ЗАПУСТИТЬ <em>МОДЕЛЬ</em>
              </h3>
              <p className="mt-3 max-w-[480px] text-sm leading-relaxed text-[var(--text-2)]">
                Результат будет привязан к аккаунту: история, точность и прогресс обновятся после завершения матча.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="tag">EMA features</span>
                <span className="tag">DNN classifier</span>
                <span className="tag">Калиброванная вероятность</span>
                <span className="tag">Ожидаемый счёт</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePredict}
              disabled={!canSubmit}
              className="btn btn-primary group"
              style={{ height: 64, padding: '0 30px', fontSize: 15 }}
            >
              {submitting ? (
                <>
                  <span
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current"
                    style={{ borderTopColor: 'transparent' }}
                  />
                  Считаем прогноз...
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  Получить прогноз
                  <ArrowRight className="h-5 w-5 arrow" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

interface TeamSelectorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  teams: Team[];
  selected: Team | null;
  disabledTeamId: string;
}

function TeamSelector({ label, value, onChange, teams, selected, disabledTeamId }: TeamSelectorProps) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <span
          className="font-mono text-[10px] uppercase text-[var(--text-3)]"
          style={{ letterSpacing: '0.22em' }}
        >
          {label}
        </span>
        {selected && (
          <span className="tag tag-hot">
            <Cpu className="h-3 w-3" />#{teams.findIndex((t) => t.id === selected.id) + 1}
          </span>
        )}
      </div>

      {selected ? (
        <div className="mt-5 flex items-start gap-5">
          <TeamMark team={selected} size="xl" showGlow />
          <div className="min-w-0">
            <div className="font-display text-2xl uppercase">{selected.name}</div>
            <div className="mt-0.5 text-xs text-[var(--text-3)]">{selected.city || '—'}</div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="REC" value={`${selected.wins}–${selected.losses}`} />
              <Stat label="PF" value={selected.avgPointsFor.toFixed(1)} />
              <Stat label="PA" value={selected.avgPointsAgainst.toFixed(1)} />
            </div>
          </div>
        </div>
      ) : (
        <div
          className="mt-5 rounded-md border border-dashed p-6 text-center text-sm text-[var(--text-3)]"
          style={{ borderColor: 'var(--line-strong)' }}
        >
          Выбери команду ниже
        </div>
      )}

      <div className="mt-5">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field cursor-pointer"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%238a8a92' stroke-width='2'%3E%3Cpath d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 16px center',
            backgroundSize: '14px',
            appearance: 'none',
            paddingRight: 40,
          }}
        >
          <option value="">Выбери команду…</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id} disabled={String(team.id) === disabledTeamId}>
              {team.name} ({team.wins}–{team.losses})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] p-2.5">
      <div
        className="font-mono text-[9px] uppercase text-[var(--text-3)]"
        style={{ letterSpacing: '0.14em' }}
      >
        {label}
      </div>
      <div className="mt-1 font-display text-base tab-num">{value}</div>
    </div>
  );
}

export default PredictionNewPage;
