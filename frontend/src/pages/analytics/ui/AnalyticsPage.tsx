import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight, BarChart3, Cpu, Radar as RadarIcon, Target, Trophy, Users } from 'lucide-react';
import { apiRequest, type Match, type Player, type Team } from '@/shared/api/client';
import { Glass } from '@/shared/ui/Glass';
import { Chip } from '@/shared/ui/Chip';
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

export const AnalyticsPage = () => {
  const [stats, setStats] = useState<PredictStats | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AnalyticsTab>('model');

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
      const label = new Date(m.date).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
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
      <section className="relative isolate overflow-hidden border-b border-cream-100/6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(125,211,252,0.08),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 court-grid opacity-25" />

        <div className="relative mx-auto w-full max-w-[1400px] px-4 pb-16 pt-32 sm:px-6 lg:px-10 lg:pt-40">
          <Chip variant="court" icon={<BarChart3 className="h-3 w-3" />}>
            Аналитика · {stats?.modelVersion || 'v1.0'}
          </Chip>
          <h1 className="display mt-6 text-6xl text-balance text-cream-50 sm:text-7xl lg:text-8xl">
            Пульс <span className="text-gradient-court">модели</span> и лиги.
          </h1>
          <p className="mt-6 max-w-2xl font-sans-display text-base leading-relaxed text-cream-300">
            Состояние модели, контекст команд и плотность расписания в одном рабочем экране. Переключай панели,
            чтобы смотреть только нужный слой данных.
          </p>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Glass rounded="xl" className="p-5">
              <div className="flex items-center justify-between">
                <p className="stat-label">Точность</p>
                <Target className="h-4 w-4 text-cream-300" />
              </div>
              <p className="stat-value mt-3 text-3xl text-signal-gold">{trackedAccuracy}%</p>
            </Glass>
            <Glass rounded="xl" className="p-5">
              <div className="flex items-center justify-between">
                <p className="stat-label">Прогнозы</p>
                <Cpu className="h-4 w-4 text-cream-300" />
              </div>
              <p className="stat-value mt-3 text-3xl text-cream-50">
                {(stats?.totalPredictions ?? 0).toLocaleString('ru-RU')}
              </p>
            </Glass>
            <Glass rounded="xl" className="p-5">
              <div className="flex items-center justify-between">
                <p className="stat-label">Матчи в базе</p>
                <RadarIcon className="h-4 w-4 text-cream-300" />
              </div>
              <p className="stat-value mt-3 text-3xl text-cream-50">
                {(stats?.totalTrainingGames ?? 0).toLocaleString('ru-RU')}
              </p>
            </Glass>
            <Glass rounded="xl" className="p-5">
              <div className="flex items-center justify-between">
                <p className="stat-label">Игроки</p>
                <Activity className="h-4 w-4 text-cream-300" />
              </div>
              <p className="stat-value mt-3 text-3xl text-cream-50">{players.length}</p>
            </Glass>
          </div>
        </div>
      </section>

      <section className="sticky top-[68px] z-20 border-b border-cream-100/6 bg-ink-950/85 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
          <div className="seg">
            {(
              [
                ['model', 'Модель'],
                ['league', 'Лига'],
                ['schedule', 'Расписание'],
              ] as Array<[AnalyticsTab, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`seg-item ${tab === value ? 'seg-item-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-[1400px] px-4 py-16 sm:px-6 lg:px-10">
        {tab === 'model' && (
          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <Glass rounded="3xl" className="h-full p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-court-500/12 text-court-300">
                  <Activity className="h-4 w-4" />
                </div>
                <p className="font-sans-display text-[10px] uppercase tracking-[0.32em] text-cream-400">
                  Состояние модели
                </p>
              </div>

              <div className="mt-8 space-y-6">
                <ProgressBar value={trackedAccuracy} label="Точность прогнозов" />
                <ProgressBar value={dataDepth} label="Глубина исторических данных" color="#7DD3FC" />
                <ProgressBar value={rosterCoverage} label="Покрытие игроков" color="#86EFAC" />
                <ProgressBar value={scheduleReadiness} label="Готовность расписания" color="#D4AF37" />
              </div>

              <div className="mt-8 space-y-3">
                <div className="rounded-2xl border border-cream-100/8 bg-cream-100/[0.02] p-4">
                  <p className="stat-label">Версия модели</p>
                  <p className="display mt-2 text-xl text-cream-50">{stats?.modelVersion || 'v1.0'}</p>
                </div>
                <div className="rounded-2xl border border-cream-100/8 bg-cream-100/[0.02] p-4">
                  <p className="stat-label">Команды подключены</p>
                  <p className="stat-value mt-2 text-xl text-cream-50">{teams.length}</p>
                </div>
                <div className="rounded-2xl border border-cream-100/8 bg-cream-100/[0.02] p-4">
                  <p className="stat-label">Факторы отслеживаются</p>
                  <p className="stat-value mt-2 text-xl text-cream-50">{featureWeights.length}</p>
                </div>
              </div>
            </Glass>

            <div className="grid gap-6 lg:grid-cols-2">
              <PieChartComponent title="Вес факторов" data={featureWeights} nameKey="name" valueKey="value" />
              <BarChartComponent
                title="Снимок здоровья"
                data={[
                  { metric: 'Точность', value: trackedAccuracy },
                  { metric: 'Игроки', value: rosterCoverage },
                  { metric: 'База', value: dataDepth },
                  { metric: 'Матчи', value: scheduleReadiness },
                ]}
                dataKey="value"
                xAxisKey="metric"
              />
            </div>
          </div>
        )}

        {tab === 'league' && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="grid gap-6">
              <LineChartComponent
                title="Процент побед лидеров"
                data={contenderTrend}
                dataKey="winRate"
                xAxisKey="team"
                color="#E76F2E"
              />
              <BarChartComponent
                title="Атака топ-команд"
                data={offenseBoard}
                dataKey="points"
                xAxisKey="team"
              />
            </div>

            <Glass rounded="3xl" className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-signal-gold/12 text-signal-gold">
                  <Trophy className="h-4 w-4" />
                </div>
                <p className="font-sans-display text-[10px] uppercase tracking-[0.32em] text-cream-400">
                  Топ команд
                </p>
              </div>

              <div className="mt-6 space-y-3">
                {topTeams.map((team, idx) => (
                  <Link
                    key={team.id}
                    to={`/teams/${team.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-cream-100/6 bg-cream-100/[0.02] p-3 transition hover:bg-cream-100/[0.04]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 font-mono text-xs text-cream-400">{String(idx + 1).padStart(2, '0')}</span>
                      <TeamMark team={team} size="sm" />
                      <div className="min-w-0">
                        <p className="display truncate text-base text-cream-50">{team.name}</p>
                        <p className="font-mono text-xs text-cream-400">
                          {team.wins}-{team.losses}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="stat-value text-sm text-cream-50">{getWinRate(team).toFixed(1)}%</p>
                      <p className="font-mono text-[10px] text-cream-400">{team.avgPointsFor.toFixed(1)} очк.</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Glass>
          </div>
        )}

        {tab === 'schedule' && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <LineChartComponent
              title="Плотность расписания"
              data={scheduleIntensity}
              dataKey="count"
              xAxisKey="day"
              color="#D4AF37"
            />

            <Glass rounded="3xl" className="overflow-hidden p-0">
              <div className="border-b border-cream-100/6 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-court-500/12 text-court-300">
                    <Users className="h-4 w-4" />
                  </div>
                  <p className="font-sans-display text-[10px] uppercase tracking-[0.32em] text-cream-400">
                    Последние матчи
                  </p>
                </div>
              </div>

              <div className="divide-y divide-cream-100/6">
                {matches.slice(0, 10).map((m) => (
                  <Link
                    key={m.id}
                    to={`/matches/${m.id}`}
                    className="flex items-center justify-between gap-3 p-4 transition hover:bg-cream-100/[0.03]"
                  >
                    <div className="flex items-center gap-3">
                      <TeamMark team={m.homeTeam} size="xs" />
                      <span className="font-mono text-xs text-cream-300">{m.homeTeam.abbrev}</span>
                      <span className="text-xs text-cream-400">против</span>
                      <span className="font-mono text-xs text-cream-300">{m.awayTeam.abbrev}</span>
                      <TeamMark team={m.awayTeam} size="xs" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm tab-num text-cream-50">
                        {m.homeScore ?? '-'}-{m.awayScore ?? '-'}
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-cream-400" />
                    </div>
                  </Link>
                ))}
              </div>
            </Glass>
          </div>
        )}
      </section>
    </div>
  );
};

export default AnalyticsPage;
