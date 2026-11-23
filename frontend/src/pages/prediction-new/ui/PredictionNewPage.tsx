import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Cpu, Swords, Zap } from 'lucide-react';
import { apiRequest, type Team, type PredictionContext } from '@/shared/api/client';
import { useAuth } from '@/app/providers/AuthProvider';
import { TeamMark } from '@/shared/ui/TeamMark';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { liveApi, type LiveNewsItem } from '@/shared/api/live';
import { PredictionContextSummary } from '@/shared/ui/PredictionContextSummary';

interface ForecastPreview {
  probabilityTeam1: number;
  probabilityTeam2: number;
  context?: PredictionContext | null;
}

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
  const [includeContext, setIncludeContext] = useState(searchParams.get('context') === '1');
  const [preview, setPreview] = useState<{ key: string; value?: ForecastPreview } | null>(null);
  const [news, setNews] = useState<LiveNewsItem[] | null | undefined>(undefined);
  const [retry, setRetry] = useState(0);
  const previewKey = [team1Id, team2Id, includeContext].join(':');

  useEffect(() => {
    if (!team1Id || !team2Id || team1Id === team2Id) return;
    const request = new AbortController();
    const params = new URLSearchParams({ team1: team1Id, team2: team2Id, include_context: String(includeContext) });
    apiRequest<ForecastPreview>('/predict/preview?' + params.toString(), { signal: request.signal }, false)
      .then((value) => setPreview({ key: previewKey, value }))
      .catch(() => { if (!request.signal.aborted) setPreview({ key: previewKey }); });
    return () => request.abort();
  }, [team1Id, team2Id, includeContext, previewKey, retry]);

  useEffect(() => {
    let active = true;
    liveApi.newsFeed().then((feed) => { if (active) setNews(feed.items); }).catch(() => { if (active) setNews(null); });
    return () => { active = false; };
  }, []);


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

    if (!user) {
      const query = new URLSearchParams({ team1: team1Id, team2: team2Id, context: includeContext ? '1' : '0' });
      navigate('/auth', { state: { from: { pathname: '/prediction/new', search: '?' + query.toString() } } });
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await apiRequest<{ id: string }>(
        '/predict',
        {
          method: 'POST',
          body: JSON.stringify({ team1Id: Number(team1Id), team2Id: Number(team2Id), includeContext }),
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

  if (loadingTeams) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="md" label="Загружаем команды" />
      </div>
    );
  }

  const hasMatchup = Boolean(selected.home && selected.away && team1Id !== team2Id);
  const canSubmit = hasMatchup && !submitting;
  const selectedPreview = preview?.key === previewKey ? preview : null;
  const teamCodes = [selected.home?.abbrev, selected.away?.abbrev];
  const related = (news ?? []).filter((item) => item.teams?.some((code) => teamCodes.includes(code))).slice(0, 4);


  return (
    <section className="section">
      <div className="container-x">
        <div className="section-head">
          <h1 className="display-h text-4xl sm:text-6xl">Прогноз на матч</h1>
          <p className="lead">Выберите команды, чтобы сравнить шансы и посмотреть новости перед игрой.</p>
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
                background: 'rgba(210,106,52,0.10)',
                border: '1px solid rgba(210,106,52,0.30)',
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

        {hasMatchup && (
          <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <section className="score-panel space-y-4 p-5 sm:p-6">
              <h2 className="m-0 font-display text-3xl">Вероятность победы</h2>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={includeContext} onChange={(event) => setIncludeContext(event.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]" />
                Учесть подтверждённые потери состава
              </label>
              {!selectedPreview && <p className="text-sm text-[var(--text-2)]" role="status">Рассчитываем оценку…</p>}
              {selectedPreview && !selectedPreview.value && (
                <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-2)]">
                  <p role="status">Оценка временно недоступна.</p>
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setPreview(null);
                    setRetry((value) => value + 1);
                  }}>Повторить</button>
                </div>
              )}
              {selectedPreview?.value?.context ? (
                <PredictionContextSummary context={selectedPreview.value.context} home={selected.home?.abbrev} away={selected.away?.abbrev} />
              ) : selectedPreview?.value && (
                <p className="font-mono text-lg">
                  {selected.home?.abbrev} {selectedPreview.value.probabilityTeam1}% · {selected.away?.abbrev} {selectedPreview.value.probabilityTeam2}%
                </p>
              )}
            </section>
            <section className="score-panel space-y-3 p-5 sm:p-6">
              <h2 className="m-0 font-display text-3xl">Новости команд</h2>
              {related.length ? (
                <ul className="space-y-3">
                  {related.map((item) => <li key={item.id}>
                    <Link className="text-sm text-[var(--accent-strong)]" to={'/news?article=' + item.id}>{item.title}</Link>
                  </li>)}
                </ul>
              ) : <p className="text-sm text-[var(--text-2)]">
                {news === undefined ? 'Загружаем новости…' : news === null ? 'Лента временно недоступна.' : 'В свежей ленте нет материалов по выбранным командам.'}
              </p>}
            </section>
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm text-[var(--text-2)]">Прогноз сохранится в истории аккаунта.</span>
          <button type="button" onClick={handlePredict} disabled={!canSubmit} className="btn btn-primary">
            <Zap size={17} aria-hidden="true" />
            {submitting ? 'Сохраняем…' : user ? 'Сохранить прогноз' : 'Войти и сохранить'}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
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
              <Stat label="В–П" value={selected.hasStats === false ? '—' : `${selected.wins}–${selected.losses}`} />
              <Stat label="PF" value={selected.avgPointsFor ? selected.avgPointsFor.toFixed(1) : '—'} />
              <Stat label="PA" value={selected.avgPointsAgainst ? selected.avgPointsAgainst.toFixed(1) : '—'} />
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
