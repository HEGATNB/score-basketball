// src/pages/analytics/ui/AnalyticsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Activity, Cpu, Radar, Target } from 'lucide-react';
import { apiRequest, type Match, type Player, type Team } from '@/shared/api/client';
import { useLanguage } from '@/app/providers/LanguageProvider';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { BarChartComponent, LineChartComponent, PieChartComponent, ProgressBar } from '@/shared/ui/Charts';
import { TeamMark } from '@/shared/ui/TeamMark';

interface PredictStats {
  accuracy: number | null;
  totalPredictions: number;
  totalTrainingData: number;
  modelVersion: string;
  featureWeights?: Array<{ name: string; value: number }>;
}

type AnalyticsTab = 'model' | 'league' | 'schedule';

const MODEL_WEIGHTS = [
  { name: 'Season strength', value: 24 },
  { name: 'Recent form', value: 19 },
  { name: 'Head-to-head', value: 10 },
  { name: 'Offensive matchup', value: 13 },
  { name: 'Defensive matchup', value: 11 },
  { name: 'Roster quality', value: 10 },
  { name: 'Momentum', value: 8 },
  { name: 'Home edge', value: 5 },
];

function getWinRate(team: Team) {
  const totalGames = team.wins + team.losses;
  return totalGames > 0 ? (team.wins / totalGames) * 100 : 0;
}

function formatGameDay(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

function formatGameTime(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const AnalyticsPage = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<PredictStats | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AnalyticsTab>('model');

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const [statsData, teamsData, playersData, matchesData] = await Promise.all([
          apiRequest<PredictStats>('/predict/stats', undefined, false),
          apiRequest<Team[]>('/teams', undefined, false),
          apiRequest<Player[]>('/players', undefined, false),
          apiRequest<Match[]>('/matches?limit=18', undefined, false),
        ]);

        setStats(statsData);
        setTeams(teamsData);
        setPlayers(playersData);
        setMatches(matchesData);
      } catch (error) {
        console.error('Failed to load analytics', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  const topTeams = useMemo(
    () =>
      [...teams]
        .sort((left, right) => right.wins - left.wins)
        .slice(0, 6),
    [teams],
  );

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

    matches
      .slice()
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
      .forEach((match) => {
        const timestamp = new Date(match.date).getTime();
        const label = new Date(match.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const current = grouped.get(label);
        grouped.set(label, {
          count: (current?.count || 0) + 1,
          date: timestamp,
        });
      });

    return Array.from(grouped.entries())
      .sort((left, right) => left[1].date - right[1].date)
      .map(([day, entry]) => ({ day, count: entry.count }));
  }, [matches]);

  const finishedMatches = matches.filter((match) => match.status === 'finished').length;
  const trackedAccuracy = Math.round(stats?.accuracy ?? 0);
  const rosterCoverage = Math.min(100, Math.round((players.length / Math.max(1, teams.length * 8)) * 100));
  const scheduleReadiness = matches.length === 0 ? 0 : Math.round((finishedMatches / matches.length) * 100);
  const dataDepth = Math.min(100, Math.round(((stats?.totalTrainingData ?? 0) / 180) * 100));
  const modelHealth = [
    { metric: 'Accuracy', value: trackedAccuracy },
    { metric: 'Coverage', value: rosterCoverage },
    { metric: 'Depth', value: dataDepth },
    { metric: 'Schedule', value: scheduleReadiness },
  ];
  const featureWeights = stats?.featureWeights?.length ? stats.featureWeights : MODEL_WEIGHTS;
  const recentMatches = matches
    .slice()
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 8);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-[rgba(232,161,67,0.2)] border-t-[var(--accent)]" />
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{t('analytics.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_360px]">
        <GlowingCard glowColor="orange" className="p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="data-chip">{t('analytics.board')}</span>
            <span className="data-chip">{stats?.modelVersion || 'v3.1-signal-fusion'}</span>
          </div>

          <h1 className="mt-5 max-w-3xl font-spacegrotesk text-4xl font-bold leading-tight text-white sm:text-5xl">
            {t('analytics.title')}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
            {t('analytics.subtitle')}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            <div className="metric-panel">
              <Target className="h-5 w-5 text-slate-200" />
              <p className="mt-3 text-2xl font-semibold text-white">{trackedAccuracy}%</p>
              <p className="mt-1 text-sm text-slate-400">{t('home.accuracy')}</p>
            </div>
            <div className="metric-panel">
              <Cpu className="h-5 w-5 text-slate-200" />
              <p className="mt-3 text-2xl font-semibold text-white">{stats?.totalPredictions ?? 0}</p>
              <p className="mt-1 text-sm text-slate-400">{t('home.predictions')}</p>
            </div>
            <div className="metric-panel">
              <Radar className="h-5 w-5 text-slate-200" />
              <p className="mt-3 text-2xl font-semibold text-white">{stats?.totalTrainingData ?? 0}</p>
              <p className="mt-1 text-sm text-slate-400">{t('home.samples')}</p>
            </div>
            <div className="metric-panel">
              <Activity className="h-5 w-5 text-slate-200" />
              <p className="mt-3 text-2xl font-semibold text-white">{players.length}</p>
              <p className="mt-1 text-sm text-slate-400">{t('analytics.trackedPlayers')}</p>
            </div>
          </div>
        </GlowingCard>

        <GlowingCard glowColor="blue" className="p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-[rgba(214,225,235,0.72)]">{t('analytics.views')}</p>
          <div className="segmented-bar mt-5">
            {([
              ['model', t('analytics.model')],
              ['league', t('analytics.league')],
              ['schedule', t('analytics.schedule')],
            ] as Array<[AnalyticsTab, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`segmented-item ${tab === value ? 'segmented-item-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="surface-muted mt-6 text-sm leading-6 text-slate-300">
            {tab === 'model' && t('analytics.modelDesc')}
            {tab === 'league' && t('analytics.leagueDesc')}
            {tab === 'schedule' && t('analytics.scheduleDesc')}
          </div>

          <div className="mt-6 grid gap-3">
            <div className="surface-muted">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('analytics.topTeam')}</p>
              <p className="mt-2 text-base font-semibold text-white">{topTeams[0]?.name || t('analytics.unavailable')}</p>
            </div>
            <div className="surface-muted">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('analytics.loadedGames')}</p>
              <p className="mt-2 text-base font-semibold text-white">{matches.length}</p>
            </div>
            <div className="surface-muted">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('analytics.trackedPlayers')}</p>
              <p className="mt-2 text-base font-semibold text-white">{players.length}</p>
            </div>
          </div>
        </GlowingCard>
      </section>

      {tab === 'model' && (
        <div className="grid gap-6 2xl:grid-cols-[340px_minmax(0,1fr)]">
          <GlowingCard glowColor="blue" className="h-full p-6">
            <h2 className="text-2xl font-semibold text-white">{t('analytics.model')}</h2>
            <div className="mt-6 space-y-6">
              <ProgressBar value={trackedAccuracy} label={t('analytics.predictionAccuracy')} />
              <ProgressBar value={dataDepth} label={t('analytics.historicalDepth')} color="#1d428a" />
              <ProgressBar value={rosterCoverage} label={t('analytics.rosterCoverage')} color="#34d399" />
              <ProgressBar value={scheduleReadiness} label={t('analytics.scheduleReadiness')} color="#f59e0b" />
            </div>

            <div className="mt-8 grid gap-3">
              <div className="surface-muted">
                <p className="text-sm text-slate-400">{t('analytics.modelVersion')}</p>
                <p className="mt-2 text-lg font-semibold text-white">{stats?.modelVersion || t('analytics.unavailable')}</p>
              </div>
              <div className="surface-muted">
                <p className="text-sm text-slate-400">{t('analytics.teamsConnected')}</p>
                <p className="mt-2 text-lg font-semibold text-white">{teams.length}</p>
              </div>
              <div className="surface-muted">
                <p className="text-sm text-slate-400">{t('analytics.signalsTracked')}</p>
                <p className="mt-2 text-lg font-semibold text-white">{featureWeights.length}</p>
              </div>
            </div>
          </GlowingCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <BarChartComponent title={t('analytics.healthSnapshot')} data={modelHealth} dataKey="value" xAxisKey="metric" />
            <PieChartComponent title={t('analytics.factorDistribution')} data={featureWeights} nameKey="name" valueKey="value" />
          </div>
        </div>
      )}

      {tab === 'league' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-6 lg:grid-cols-2">
            <LineChartComponent title={t('analytics.contenderBoard')} data={contenderTrend} dataKey="winRate" xAxisKey="team" color="#1d428a" />
            <BarChartComponent title={t('analytics.offensiveOutput')} data={offenseBoard} dataKey="points" xAxisKey="team" />
          </div>

          <GlowingCard glowColor="green" className="overflow-hidden p-0">
            <div className="hidden lg:block">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: '52px' }} />
                  <col />
                  <col style={{ width: '84px' }} />
                  <col style={{ width: '84px' }} />
                </colgroup>
                <thead className="bg-white/[0.02]">
                  <tr className="border-b border-white/8">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {t('teams.rank')}
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {t('teams.team')}
                    </th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {t('teams.winRate')}
                    </th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      PPG
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topTeams.map((team, index) => (
                    <tr key={team.id} className="border-t border-white/6 transition-colors hover:bg-white/[0.03]">
                      <td className="px-5 py-4 align-middle text-sm font-semibold text-slate-500">#{index + 1}</td>
                      <td className="px-5 py-4 align-middle">
                        <div className="flex min-w-0 items-center gap-3">
                          <TeamMark team={team} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{team.name}</p>
                            <p className="truncate text-xs uppercase tracking-[0.16em] text-slate-500">
                              {team.wins}-{team.losses}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right align-middle text-sm tabular-nums text-white">
                        {getWinRate(team).toFixed(1)}%
                      </td>
                      <td className="px-5 py-4 text-right align-middle text-sm font-semibold tabular-nums text-white">
                        {team.avgPointsFor.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden">
              {topTeams.map((team, index) => (
                <div key={team.id} className="table-row px-5 py-4">
                  <div className="flex items-center gap-4">
                    <span className="w-7 text-sm font-semibold text-slate-500">#{index + 1}</span>
                    <TeamMark team={team} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{team.name}</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        {team.wins}-{team.losses}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-white">{team.avgPointsFor.toFixed(1)}</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{getWinRate(team).toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlowingCard>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <LineChartComponent title={t('analytics.scheduleIntensity')} data={scheduleIntensity} dataKey="count" xAxisKey="day" color="#f59e0b" />

          <GlowingCard glowColor="purple" className="overflow-hidden p-0">
            <div className="hidden lg:block">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: '104px' }} />
                  <col />
                  <col style={{ width: '88px' }} />
                </colgroup>
                <thead className="bg-white/[0.02]">
                  <tr className="border-b border-white/8">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {t('matches.date')}
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {t('matches.matchup')}
                    </th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {t('matches.score')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentMatches.map((match) => (
                    <tr key={match.id} className="border-t border-white/6 transition-colors hover:bg-white/[0.03]">
                      <td className="px-5 py-4 align-middle">
                        <p className="text-sm font-semibold text-white">{formatGameDay(match.date)}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{formatGameTime(match.date)}</p>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="space-y-2">
                          <div className="flex min-w-0 items-center gap-3">
                            <TeamMark team={match.homeTeam} size="sm" />
                            <span className="truncate text-sm font-semibold text-white">{match.homeTeam.name}</span>
                          </div>
                          <div className="flex min-w-0 items-center gap-3">
                            <TeamMark team={match.awayTeam} size="sm" />
                            <span className="truncate text-sm font-semibold text-white">{match.awayTeam.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right align-middle">
                        <p className="text-sm font-semibold tabular-nums text-white">
                          {match.homeScore ?? '--'} : {match.awayScore ?? '--'}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                          {match.status === 'finished' ? t('matches.final') : t('matches.scheduled')}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden">
              {recentMatches.map((match) => (
                <div key={match.id} className="table-row px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{formatGameDay(match.date)}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{formatGameTime(match.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-white">
                        {match.homeScore ?? '--'} : {match.awayScore ?? '--'}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        {match.status === 'finished' ? t('matches.final') : t('matches.scheduled')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <TeamMark team={match.homeTeam} size="sm" />
                      <span className="truncate text-sm font-semibold text-white">{match.homeTeam.name}</span>
                    </div>
                    <div className="flex min-w-0 items-center gap-3">
                      <TeamMark team={match.awayTeam} size="sm" />
                      <span className="truncate text-sm font-semibold text-white">{match.awayTeam.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlowingCard>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;