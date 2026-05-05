// src/pages/home/ui/HomePage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Clock3,
  Cpu,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { apiRequest, type Match, type Prediction, type Team } from '@/shared/api/client';
import { useAuth } from '@/app/providers/AuthProvider';
import { useLanguage } from '@/app/providers/LanguageProvider';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { TeamMark } from '@/shared/ui/TeamMark';

type HomeTab = 'overview' | 'schedule' | 'teams' | 'predictions';

const tabs: Array<{ id: HomeTab; labelKey: string }> = [
  { id: 'overview', labelKey: 'home.overview' },
  { id: 'schedule', labelKey: 'home.schedule' },
  { id: 'teams', labelKey: 'home.teams' },
  { id: 'predictions', labelKey: 'home.predictions' },
];

export const HomePage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<HomeTab>('overview');
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [stats, setStats] = useState<{ accuracy?: number; totalTrainingData?: number; totalPredictions?: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [teamsData, matchesData, statsData] = await Promise.all([
          apiRequest<Team[]>('/teams'),
          apiRequest<Match[]>('/matches?limit=8'),
          apiRequest<any>('/predict/stats'),
        ]);

        setTeams(teamsData.sort((left, right) => right.wins - left.wins));
        setMatches(matchesData);
        setStats(statsData);

        if (user) {
          const predictionData = await apiRequest<Prediction[]>('/predictions/my');
          setPredictions(predictionData.slice(0, 5));
        }
      } catch (error) {
        console.error('Failed to load dashboard', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  const featuredMatch = useMemo(() => matches.find((match) => match.status !== 'finished') || matches[0] || null, [matches]);
  const topTeams = useMemo(() => teams.slice(0, 6), [teams]);
  const upcomingMatches = useMemo(() => matches.filter((match) => match.status !== 'finished'), [matches]);
  const recentMatches = useMemo(() => matches.filter((match) => match.status === 'finished'), [matches]);

  const summary = useMemo(
    () => [
      {
        labelKey: 'home.accuracy',
        value: `${Math.round(stats?.accuracy ?? 0)}%`,
        detailKey: 'home.modelValidation',
        icon: Cpu,
      },
      {
        labelKey: 'home.teams',
        value: `${teams.length}`,
        detailKey: 'home.trackedProfiles',
        icon: Trophy,
      },
      {
        labelKey: 'home.games',
        value: `${matches.length}`,
        detailKey: 'home.loadedFixtures',
        icon: CalendarDays,
      },
      {
        labelKey: 'home.samples',
        value: `${stats?.totalTrainingData ?? 0}`,
        detailKey: 'home.historicalRecords',
        icon: Activity,
      },
    ],
    [matches.length, stats, teams.length],
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-full border-4 border-[rgba(216,180,106,0.22)] border-t-[#c96a2b] animate-spin" />
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <GlowingCard glowColor="orange" className="p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="data-chip">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('home.connected')}
            </span>
            <span className="data-chip">
              <Sparkles className="h-3.5 w-3.5" />
              {t('home.liveBasketball')}
            </span>
          </div>

          <div className="mt-5 max-w-3xl">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('nav.dashboard')}</p>
            <h1 className="mt-2 font-spacegrotesk text-3xl font-bold text-white sm:text-4xl">
              {t('home.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              {t('home.subtitle')}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => navigate(user ? '/prediction/new' : '/auth')} className="btn-primary">
              {user ? t('home.newPrediction') : t('common.signIn')}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={() => navigate('/matches')} className="btn-secondary">
              {t('home.openSchedule')}
            </button>
          </div>
        </GlowingCard>

        <GlowingCard glowColor="blue" className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('home.featuredGame')}</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {featuredMatch ? `${featuredMatch.homeTeam.abbrev} vs ${featuredMatch.awayTeam.abbrev}` : t('home.noGame')}
              </h2>
            </div>
            <span className="data-chip">{featuredMatch?.status === 'finished' ? t('home.final') : t('home.preview')}</span>
          </div>

          {featuredMatch ? (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <div className="surface-muted text-center">
                  <TeamMark team={featuredMatch.homeTeam} size="md" className="mx-auto" />
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{featuredMatch.homeTeam.city || t('common.home')}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{featuredMatch.homeTeam.name}</p>
                  <p className="mt-3 text-3xl font-bold tabular-nums text-[#ecd8ab]">{featuredMatch.homeScore ?? '--'}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('common.tipoff')}</p>
                  <p className="mt-2 text-sm font-medium text-slate-300">
                    {new Date(featuredMatch.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="surface-muted text-center">
                  <TeamMark team={featuredMatch.awayTeam} size="md" className="mx-auto" />
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{featuredMatch.awayTeam.city || t('common.away')}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{featuredMatch.awayTeam.name}</p>
                  <p className="mt-3 text-3xl font-bold tabular-nums text-[#d6e1eb]">{featuredMatch.awayScore ?? '--'}</p>
                </div>
              </div>

              <div className="surface-muted">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>{t('home.modelConfidence')}</span>
                  <span className="tabular-nums">{Math.round(stats?.accuracy ?? 0)}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900/70">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#c96a2b,#d8b46a)]"
                    style={{ width: `${Math.max(18, Math.round(stats?.accuracy ?? 0))}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-slate-400">{t('home.nextFixture')}</p>
          )}
        </GlowingCard>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => (
          <GlowingCard key={item.labelKey} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t(item.labelKey)}</p>
                <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
                <p className="mt-2 text-sm text-slate-400">{t(item.detailKey)}</p>
              </div>
              <div className="rounded-lg border border-white/8 bg-white/[0.04] p-2.5 text-slate-200">
                <item.icon className="h-4 w-4" />
              </div>
            </div>
          </GlowingCard>
        ))}
      </section>

      <section className="space-y-4">
        <div className="segmented-bar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`segmented-item ${activeTab === tab.id ? 'segmented-item-active' : ''}`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <GlowingCard glowColor="orange" className="p-6">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('home.notes')}</p>
              <div className="mt-4 grid gap-3">
                <div className="surface-muted">
                  <p className="text-sm font-semibold text-white">{t('home.predictionEngine')}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {t('home.predictionEngineDesc')}
                  </p>
                </div>
                <div className="surface-muted">
                  <p className="text-sm font-semibold text-white">{t('home.scheduleWindow')}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {t('home.scheduleWindowDesc', { upcoming: upcomingMatches.length, recent: recentMatches.length })}
                  </p>
                </div>
                <div className="surface-muted">
                  <p className="text-sm font-semibold text-white">{t('home.navigationCleanup')}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {t('home.navigationCleanupDesc')}
                  </p>
                </div>
              </div>
            </GlowingCard>

            <GlowingCard glowColor="green" className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('home.standingsSnapshot')}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{t('home.topTeams')}</h2>
                </div>
                <button onClick={() => navigate('/teams')} className="btn-secondary">
                  {t('home.fullStandings')}
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {topTeams.map((team, index) => (
                  <button
                    key={team.id}
                    onClick={() => navigate(`/teams/${team.id}`)}
                    className="flex w-full items-center justify-between rounded-[14px] border border-white/8 bg-white/[0.03] px-4 py-4 text-left transition hover:bg-white/[0.05]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-6 text-sm font-semibold text-slate-500">{index + 1}</div>
                      <TeamMark team={team} size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-white">{team.name}</p>
                        <p className="text-xs text-slate-400">{team.division?.name || t('teams.division')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">
                        {team.wins}-{team.losses}
                      </p>
                      <p className="text-xs text-slate-400">{team.avgPointsFor.toFixed(1)} PPG</p>
                    </div>
                  </button>
                ))}
              </div>
            </GlowingCard>
          </div>
        )}

        {activeTab === 'schedule' && (
          <GlowingCard glowColor="blue" className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('home.schedule')}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{t('home.recentUpcoming')}</h2>
              </div>
              <button onClick={() => navigate('/matches')} className="btn-secondary">
                {t('home.allGames')}
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {matches.map((match) => (
                <button
                  key={match.id}
                  onClick={() => navigate(`/matches/${match.id}`)}
                    className="grid w-full gap-3 rounded-[14px] border border-white/8 bg-white/[0.03] px-4 py-4 text-left transition hover:bg-white/[0.05] md:grid-cols-[160px_1fr_auto]"
                >
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Clock3 className="h-4 w-4" />
                    {new Date(match.date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-3 text-sm font-semibold text-white">
                    <TeamMark team={match.homeTeam} size="sm" />
                    <span className="truncate">{match.homeTeam.abbrev}</span>
                    <span className="text-slate-500">vs</span>
                    <TeamMark team={match.awayTeam} size="sm" />
                    <span className="truncate">{match.awayTeam.abbrev}</span>
                  </div>
                  <div className="text-right text-sm tabular-nums text-slate-300">
                    {match.homeScore ?? '--'} : {match.awayScore ?? '--'}
                  </div>
                </button>
              ))}
            </div>
          </GlowingCard>
        )}

        {activeTab === 'teams' && (
          <GlowingCard glowColor="green" className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('home.teamBoard')}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{t('home.leagueLeaders')}</h2>
              </div>
              <button onClick={() => navigate('/teams')} className="btn-secondary">
                {t('home.teamIndex')}
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {topTeams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => navigate(`/teams/${team.id}`)}
                  className="rounded-[14px] border border-white/8 bg-white/[0.03] px-4 py-4 text-left transition hover:bg-white/[0.05]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <TeamMark team={team} size="sm" />
                      <div>
                      <p className="text-lg font-semibold text-white">{team.name}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {team.city || 'City'} / {team.conference?.shortName || team.conference?.name || 'League'}
                      </p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-white/[0.04] px-3 py-2 text-sm font-semibold tabular-nums text-white">
                      {team.wins}-{team.losses}
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-900/70">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#c96a2b,#607d96)]"
                      style={{ width: `${Math.max(14, (team.wins / Math.max(1, team.wins + team.losses)) * 100)}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </GlowingCard>
        )}

        {activeTab === 'predictions' && (
          <GlowingCard glowColor="purple" className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('home.predictionLane')}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {user ? t('home.recentRuns') : t('home.predictionWorkspace')}
                </h2>
              </div>
              <button onClick={() => navigate(user ? '/history' : '/auth')} className="btn-secondary">
                {user ? t('home.history') : t('common.signIn')}
              </button>
            </div>

            {user && predictions.length > 0 ? (
              <div className="mt-5 grid gap-3">
                {predictions.map((prediction) => (
                  <button
                    key={prediction.id}
                    onClick={() => navigate(`/prediction/${prediction.id}`)}
                    className="flex w-full items-center justify-between rounded-[14px] border border-white/8 bg-white/[0.03] px-4 py-4 text-left transition hover:bg-white/[0.05]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {prediction.team1?.abbrev} vs {prediction.team2?.abbrev}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {prediction.expectedScoreTeam1}:{prediction.expectedScoreTeam2} expected score
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-[#ecd8ab]">{prediction.confidence}%</p>
                      <p className="text-xs text-slate-500">{new Date(prediction.createdAt).toLocaleDateString()}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[14px] border border-white/8 bg-white/[0.03] px-5 py-6">
                <p className="text-sm leading-6 text-slate-300">
                  {user
                    ? t('home.noPredictions')
                    : t('home.signInPrompt')}
                </p>
              </div>
            )}
          </GlowingCard>
        )}
      </section>
    </div>
  );
};

export default HomePage;