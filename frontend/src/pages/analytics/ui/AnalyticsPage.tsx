import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Cpu,
  Radar as RadarIcon,
  Target,
  Trophy,
  Users,
  Calendar,
} from 'lucide-react';
import { apiRequest, type Match, type Player, type Team } from '@/shared/api/client';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import {
  BarChartComponent,
  LineChartComponent,
  PieChartComponent,
  ProgressBar,
} from '@/shared/ui/Charts';
import { TeamMark } from '@/shared/ui/TeamMark';

interface PredictStats {
  accuracy: number | null;
  totalPredictions: number;
  totalTrainingGames: number;
  modelVersion: string;
  featureWeights?: Array<{ name: string; value: number }>;
}

type AnalyticsTab = 'model' | 'league' | 'schedule';

const MODEL_WEIGHTS = [
  { name: 'Сила сезона', value: 24 },
  { name: 'Текущая форма', value: 19 },
  { name: 'Личные встречи', value: 10 },
  { name: 'Атака', value: 13 },
  { name: 'Защита', value: 11 },
  { name: 'Глубина состава', value: 10 },
  { name: 'Темп', value: 8 },
  { name: 'Домашняя площадка', value: 5 },
];

function getWinRate(team: Team) {
  const total = team.wins + team.losses;
  return total > 0 ? (team.wins / total) * 100 : 0;
}

function formatRu(n: number) {
  return n.toLocaleString('ru-RU');
}

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  accent?: boolean;
  to?: string;
}

function KpiCard({ label, value, hint, icon, accent, to }: KpiCardProps) {
  const inner = (
    <div
      className={`relative h-full overflow-hidden p-5 ${to ? 'transition hover:bg-[var(--surface-2)]' : ''}`}
      style={{
        background: accent
          ? 'linear-gradient(135deg, rgba(210,106,52,0.12), transparent 55%), var(--surface)'
          : 'var(--surface)',
      }}
    >
      <div className="flex items-start justify-between">
        <span
          className="font-mono text-[10px] uppercase"
          style={{ color: 'var(--text-3)', letterSpacing: '0.18em' }}
        >
          {label}
        </span>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-md"
          style={{
            background: accent ? 'rgba(210,106,52,0.18)' : 'rgba(255,255,255,0.04)',
            border: '1px solid var(--line)',
            color: accent ? 'var(--accent-strong)' : 'var(--text-2)',
          }}
        >
          {icon}
        </div>
      </div>
      <div
        className="mt-3 font-display tab-num"
        style={{
          fontSize: 36,
          lineHeight: 1,
          color: accent ? 'var(--accent-strong)' : 'var(--text)',
        }}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-2 font-mono text-[11px]" style={{ color: 'var(--text-3)' }}>
          {hint}
        </div>
      )}
      {accent && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--accent-glow), transparent 65%)',
            opacity: 0.45,
          }}
        />
      )}
    </div>
  );
  return to ? (
    <Link to={to} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export const AnalyticsPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PredictStats | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AnalyticsTab>('model');

  // ----- Quick Predict widget state -----
  const [t1, setT1] = useState<number | ''>('');
  const [t2, setT2] = useState<number | ''>('');
  const [pred, setPred] = useState<{ a: number; b: number } | null>(null);
  const [predLoading, setPredLoading] = useState(false);

  const runPredict = async (a: number, b: number) => {
    if (!a || !b || a === b) return;
    setPredLoading(true);
    try {
      const p = await apiRequest<{ probabilityTeam1: number; probabilityTeam2: number }>(
        `/predict/preview?team1=${a}&team2=${b}`,
        undefined,
        false,
      );
      setPred({ a: Math.round(p.probabilityTeam1), b: Math.round(p.probabilityTeam2) });
    } catch {
      setPred(null);
    } finally {
      setPredLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [s, t, p, m] = await Promise.all([
          apiRequest<PredictStats>('/predict/stats', undefined, false).catch(() => null),
          apiRequest<Team[]>('/teams', undefined, false),
          apiRequest<Player[]>('/players?limit=80', undefined, false).catch(() => []),
          apiRequest<Match[]>('/matches?limit=24', undefined, false),
        ]);

        setStats(s);
        setTeams(t);
        setPlayers(p);
        setMatches(m);
      } catch (err) {
        console.error('Не удалось загрузить аналитику', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const topTeams = useMemo(() => [...teams].sort((a, b) => b.wins - a.wins).slice(0, 8), [teams]);
  const teamsByName = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams]);

  // Seed the Quick Predict widget with the two strongest teams + an initial run.
  useEffect(() => {
    if (teams.length >= 2 && t1 === '' && t2 === '') {
      const sorted = [...teams].sort((a, b) => b.wins - a.wins);
      setT1(sorted[0].id);
      setT2(sorted[1].id);
      runPredict(sorted[0].id, sorted[1].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  const contenderTrend = useMemo(
    () =>
      topTeams.map((team) => ({
        team: team.abbrev || team.name.slice(0, 3).toUpperCase(),
        winRate: Number(getWinRate(team).toFixed(1)),
      })),
    [topTeams],
  );

  const offenseBoard = useMemo(
    () =>
      topTeams.map((team) => ({
        team: team.abbrev || team.name.slice(0, 3).toUpperCase(),
        points: Number((team.avgPointsFor || team.pointsPerGame || 0).toFixed(1)),
      })),
    [topTeams],
  );

  const scheduleIntensity = useMemo(() => {
    const grouped = new Map<string, { count: number; date: number }>();
    matches.forEach((m) => {
      const ts = new Date(m.date).getTime();
      const label = new Date(m.date).toLocaleDateString('ru-RU', {
        month: 'short',
        day: 'numeric',
      });
      const cur = grouped.get(label);
      grouped.set(label, { count: (cur?.count || 0) + 1, date: ts });
    });
    return Array.from(grouped.entries())
      .sort((a, b) => a[1].date - b[1].date)
      .map(([day, e]) => ({ day, count: e.count }));
  }, [matches]);

  const finishedMatches = matches.filter((m) => m.status === 'finished').length;
  const trackedAccuracy = Math.round(stats?.accuracy ?? 0);
  const rosterCoverage = Math.min(100, Math.round((players.length / Math.max(1, teams.length * 8)) * 100));
  const scheduleReadiness = matches.length === 0 ? 0 : Math.round((finishedMatches / matches.length) * 100);
  const dataDepth = Math.min(100, Math.round(((stats?.totalTrainingGames ?? 0) / 180) * 100));
  const featureWeights = stats?.featureWeights?.length ? stats.featureWeights : MODEL_WEIGHTS;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="md" label="Загружаем аналитику" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* ===== Hero ===== */}
      <section className="section">
        <div className="container-x">
          <div className="section-head">
            <div className="flex flex-col gap-3">
              <span className="eyebrow">
                <span className="dot" />
                АНАЛИТИКА · {stats?.modelVersion || 'v1.0'}
              </span>
              <h2>
                ПУЛЬС <em>МОДЕЛИ</em>
                <br />
                И ЛИГИ
              </h2>
            </div>
            <p className="lead">
              Состояние нейросети, контекст команд и плотность расписания в одном рабочем экране.
              Переключай слои данных — модель, лига, расписание.
            </p>
          </div>

          {/* KPI band */}
          <div
            className="grid overflow-hidden rounded-lg border"
            style={{
              gap: 1,
              background: 'var(--line)',
              borderColor: 'var(--line)',
              gridTemplateColumns: 'repeat(4, 1fr)',
            }}
          >
            <KpiCard
              label="Точность"
              value={`${trackedAccuracy}%`}
              hint="по закрытым матчам"
              icon={<Target className="h-4 w-4" />}
              accent
              to="/history"
            />
            <KpiCard
              label="Прогнозы"
              value={formatRu(stats?.totalPredictions ?? 0)}
              hint="сделано пользователями"
              icon={<Cpu className="h-4 w-4" />}
              to="/prediction/new"
            />
            <KpiCard
              label="Матчи в базе"
              value={formatRu(stats?.totalTrainingGames ?? 0)}
              hint="обучающая выборка"
              icon={<RadarIcon className="h-4 w-4" />}
              to="/matches"
            />
            <KpiCard
              label="Игроки"
              value={formatRu(players.length)}
              hint={`по ${teams.length} командам`}
              icon={<Activity className="h-4 w-4" />}
              to="/players"
            />
          </div>

          {/* ===== Quick Predict — live AI matchup probability ===== */}
          <div
            className="mt-6 overflow-hidden rounded-lg border border-[var(--line)]"
            style={{
              background:
                'radial-gradient(ellipse 60% 100% at 100% 0%, rgba(210,106,52,0.10), transparent 60%), var(--surface)',
            }}
          >
            <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:gap-8">
              <div className="lg:w-[230px] shrink-0">
                <p
                  className="font-mono text-[10px] uppercase"
                  style={{ color: 'var(--text-3)', letterSpacing: '0.28em' }}
                >
                  AI Matchup
                </p>
                <h3 className="display-h mt-1.5" style={{ fontSize: 24, lineHeight: 1 }}>
                  БЫСТРЫЙ <em style={{ color: 'var(--accent)', fontStyle: 'normal' }}>ПРОГНОЗ</em>
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
                  Выбери две команды — модель оценит шансы прямо здесь.
                </p>
              </div>

              {/* Selectors + result */}
              <div className="flex-1">
                <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                  <select
                    className="field"
                    value={t1}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setT1(v);
                      if (v && t2) runPredict(v, Number(t2));
                    }}
                  >
                    <option value="">Команда дома…</option>
                    {teamsByName.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-center font-display text-sm" style={{ color: 'var(--text-3)' }}>
                    VS
                  </span>
                  <select
                    className="field"
                    value={t2}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setT2(v);
                      if (t1 && v) runPredict(Number(t1), v);
                    }}
                  >
                    <option value="">Гости…</option>
                    {teamsByName.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Probability bar */}
                <div className="mt-4">
                  {predLoading ? (
                    <div
                      className="flex h-10 items-center justify-center rounded-md border border-[var(--line)] font-mono text-[11px] uppercase"
                      style={{ color: 'var(--text-3)', letterSpacing: '0.2em' }}
                    >
                      Считаем…
                    </div>
                  ) : pred && t1 !== t2 ? (
                    <>
                      <div className="mb-1.5 flex justify-between font-mono text-[11px]">
                        <span style={{ color: 'var(--accent-strong)' }}>{pred.a}%</span>
                        <span style={{ color: 'var(--text-3)' }}>вероятность победы</span>
                        <span style={{ color: 'var(--text-2)' }}>{pred.b}%</span>
                      </div>
                      <div
                        className="flex h-3 overflow-hidden rounded-full"
                        style={{ background: 'var(--surface-3)' }}
                      >
                        <div
                          style={{
                            width: `${pred.a}%`,
                            background: 'linear-gradient(90deg, var(--accent-strong), var(--accent-deep))',
                          }}
                        />
                        <div style={{ width: `${pred.b}%`, background: 'var(--surface-2)' }} />
                      </div>
                    </>
                  ) : (
                    <div
                      className="flex h-10 items-center justify-center rounded-md border border-dashed border-[var(--line)] font-mono text-[11px] uppercase"
                      style={{ color: 'var(--text-3)', letterSpacing: '0.18em' }}
                    >
                      Выбери две разные команды
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => navigate('/prediction/new')}
                className="btn btn-primary shrink-0 justify-center"
              >
                <Target className="h-4 w-4" />
                Детальный прогноз
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Sticky tabs ===== */}
      <div
        className="sticky z-30 border-y"
        style={{
          top: 68,
          borderColor: 'var(--line)',
          background: 'rgba(8, 8, 11, 0.78)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div className="container-x flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex gap-1.5 rounded-pill border border-[var(--line)] bg-[var(--surface)] p-1">
            {(
              [
                ['model', 'Модель', BarChart3],
                ['league', 'Лига', Trophy],
                ['schedule', 'Расписание', Calendar],
              ] as Array<[AnalyticsTab, string, typeof BarChart3]>
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`flex items-center gap-2 rounded-pill px-4 py-2 text-xs font-semibold transition ${
                  tab === value
                    ? 'bg-[var(--accent)] text-white shadow-accent'
                    : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <span
            className="hidden font-mono text-[10px] uppercase sm:inline-flex"
            style={{ color: 'var(--text-3)', letterSpacing: '0.24em' }}
          >
            Обновлено · сейчас
          </span>
        </div>
      </div>

      {/* ===== Content ===== */}
      <section className="section-tight">
        <div className="container-x">
          {tab === 'model' && (
            <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
              {/* Left rail — model health */}
              <div className="panel h-full p-7">
                <div className="mb-7 flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-md"
                    style={{
                      background: 'rgba(210,106,52,0.14)',
                      color: 'var(--accent-strong)',
                      border: '1px solid rgba(210,106,52,0.3)',
                    }}
                  >
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <p
                      className="font-mono text-[10px] uppercase"
                      style={{ color: 'var(--text-3)', letterSpacing: '0.28em' }}
                    >
                      Состояние
                    </p>
                    <h3 className="display-h" style={{ fontSize: 22, lineHeight: 1, marginTop: 4 }}>
                      МОДЕЛЬ
                    </h3>
                  </div>
                </div>

                <div className="space-y-5">
                  <ProgressBar value={trackedAccuracy} label="Точность прогнозов" />
                  <ProgressBar value={dataDepth} label="Глубина данных" color="#d99a4f" />
                  <ProgressBar value={rosterCoverage} label="Покрытие игроков" color="#36d399" />
                  <ProgressBar value={scheduleReadiness} label="Готовность расписания" color="#e3b341" />
                </div>

                <div className="mt-8 space-y-1.5 border-t border-[var(--line)] pt-6">
                  <DetailRow label="Версия модели" value={stats?.modelVersion || 'v1.0'} accent />
                  <DetailRow label="Команды" value={String(teams.length)} />
                  <DetailRow label="Факторы" value={String(featureWeights.length)} />
                  <DetailRow
                    label="Прогнозов в базе"
                    value={formatRu(stats?.totalPredictions ?? 0)}
                  />
                </div>
              </div>

              {/* Right column — charts */}
              <div className="grid gap-6 lg:grid-cols-2">
                <PieChartComponent
                  title="ВЕС ФАКТОРОВ"
                  eyebrow="Структура решения"
                  data={featureWeights}
                  nameKey="name"
                  valueKey="value"
                />
                <BarChartComponent
                  title="СНИМОК ЗДОРОВЬЯ"
                  eyebrow="Метрики системы"
                  data={[
                    { metric: 'Точность', value: trackedAccuracy },
                    { metric: 'Игроки', value: rosterCoverage },
                    { metric: 'База', value: dataDepth },
                    { metric: 'Матчи', value: scheduleReadiness },
                  ]}
                  dataKey="value"
                  xAxisKey="metric"
                />
                <div className="panel p-6 lg:col-span-2">
                  <div className="mb-5">
                    <p
                      className="font-mono text-[10px] uppercase"
                      style={{ color: 'var(--text-3)', letterSpacing: '0.28em' }}
                    >
                      Топ-факторы решения
                    </p>
                    <h3
                      className="display-h mt-1.5"
                      style={{ fontSize: 22, lineHeight: 1 }}
                    >
                      ЧТО ВЛИЯЕТ НА ПРОГНОЗ
                    </h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {featureWeights.slice(0, 8).map((factor, idx) => (
                      <FactorRow
                        key={factor.name}
                        rank={idx + 1}
                        name={factor.name}
                        value={Number(factor.value)}
                        max={Math.max(...featureWeights.map((f) => Number(f.value)))}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'league' && (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="grid gap-6">
                <LineChartComponent
                  title="ПРОЦЕНТ ПОБЕД ЛИДЕРОВ"
                  eyebrow="Текущий сезон"
                  data={contenderTrend}
                  dataKey="winRate"
                  xAxisKey="team"
                />
                <BarChartComponent
                  title="АТАКА ТОП-КОМАНД"
                  eyebrow="Очки за игру"
                  data={offenseBoard}
                  dataKey="points"
                  xAxisKey="team"
                />
              </div>

              <div className="panel p-6">
                <div className="mb-6 flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-md"
                    style={{
                      background: 'rgba(230,185,74,0.12)',
                      color: 'var(--gold)',
                      border: '1px solid rgba(230,185,74,0.3)',
                    }}
                  >
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div>
                    <p
                      className="font-mono text-[10px] uppercase"
                      style={{ color: 'var(--text-3)', letterSpacing: '0.28em' }}
                    >
                      Рейтинг
                    </p>
                    <h3
                      className="display-h"
                      style={{ fontSize: 22, lineHeight: 1, marginTop: 4 }}
                    >
                      ТОП-8 КОМАНД
                    </h3>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {topTeams.map((team, idx) => (
                    <Link
                      key={team.id}
                      to={`/teams/${team.id}`}
                      className="group flex items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3 transition hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="w-7 text-center font-display tab-num"
                          style={{
                            fontSize: 18,
                            color: idx < 3 ? 'var(--accent-strong)' : 'var(--text-3)',
                          }}
                        >
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <TeamMark team={team} size="sm" />
                        <div className="min-w-0">
                          <p
                            className="font-display truncate uppercase"
                            style={{ fontSize: 15, color: 'var(--text)' }}
                          >
                            {team.name}
                          </p>
                          <p
                            className="font-mono text-[11px]"
                            style={{ color: 'var(--text-3)' }}
                          >
                            {team.wins}–{team.losses} · {team.avgPointsFor.toFixed(1)} PPG
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className="font-display tab-num"
                          style={{ fontSize: 18, color: 'var(--text)' }}
                        >
                          {getWinRate(team).toFixed(0)}%
                        </span>
                        <ArrowUpRight
                          className="h-4 w-4 transition group-hover:text-[var(--accent)]"
                          style={{ color: 'var(--text-3)' }}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'schedule' && (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <LineChartComponent
                title="ПЛОТНОСТЬ РАСПИСАНИЯ"
                eyebrow="Матчи по дням"
                data={scheduleIntensity}
                dataKey="count"
                xAxisKey="day"
                color="#e3b341"
              />

              <div className="panel overflow-hidden p-0">
                <div className="border-b border-[var(--line)] p-6">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-md"
                      style={{
                        background: 'rgba(217,154,79,0.12)',
                        color: 'var(--info)',
                        border: '1px solid rgba(217,154,79,0.3)',
                      }}
                    >
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p
                        className="font-mono text-[10px] uppercase"
                        style={{ color: 'var(--text-3)', letterSpacing: '0.28em' }}
                      >
                        Сетка
                      </p>
                      <h3
                        className="display-h"
                        style={{ fontSize: 22, lineHeight: 1, marginTop: 4 }}
                      >
                        ПОСЛЕДНИЕ МАТЧИ
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-[var(--line)]">
                  {matches.slice(0, 10).map((m) => (
                    <Link
                      key={m.id}
                      to={`/matches/${m.id}`}
                      className="flex items-center justify-between gap-3 p-4 transition hover:bg-[var(--surface-2)]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <TeamMark team={m.homeTeam} size="xs" />
                        <span
                          className="font-mono text-xs"
                          style={{ color: 'var(--text-2)' }}
                        >
                          {m.homeTeam.abbrev}
                        </span>
                        <span
                          className="font-mono text-[10px]"
                          style={{ color: 'var(--text-3)' }}
                        >
                          ·
                        </span>
                        <span
                          className="font-mono text-xs"
                          style={{ color: 'var(--text-2)' }}
                        >
                          {m.awayTeam.abbrev}
                        </span>
                        <TeamMark team={m.awayTeam} size="xs" />
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className="font-display tab-num"
                          style={{ fontSize: 16, color: 'var(--text)' }}
                        >
                          {m.homeScore ?? '–'}–{m.awayScore ?? '–'}
                        </span>
                        <ArrowUpRight
                          className="h-3.5 w-3.5"
                          style={{ color: 'var(--text-3)' }}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-2">
      <span
        className="font-mono text-[10px] uppercase"
        style={{ color: 'var(--text-3)', letterSpacing: '0.18em' }}
      >
        {label}
      </span>
      <span
        className="font-display tab-num"
        style={{
          fontSize: accent ? 18 : 15,
          color: accent ? 'var(--accent-strong)' : 'var(--text)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function FactorRow({
  rank,
  name,
  value,
  max,
}: {
  rank: number;
  name: string;
  value: number;
  max: number;
}) {
  const pct = Math.max(4, (value / max) * 100);
  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="font-display tab-num"
            style={{ fontSize: 14, color: 'var(--text-3)' }}
          >
            {String(rank).padStart(2, '0')}
          </span>
          <span
            className="font-mono text-[11px] uppercase"
            style={{ color: 'var(--text-2)', letterSpacing: '0.12em' }}
          >
            {name}
          </span>
        </div>
        <span
          className="font-display tab-num"
          style={{ fontSize: 16, color: 'var(--accent-strong)' }}
        >
          {value}%
        </span>
      </div>
      <div
        className="mt-2 h-1 overflow-hidden rounded-full"
        style={{ background: 'var(--surface-3)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background:
              'linear-gradient(90deg, var(--accent-strong), var(--accent-deep))',
          }}
        />
      </div>
    </div>
  );
}

export default AnalyticsPage;
