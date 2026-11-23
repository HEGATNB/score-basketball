import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Crown,
  Flame,
  Gem,
  Lock,
  Target,
} from 'lucide-react';
import { apiRequest, type Match, type Player, type Team } from '@/shared/api/client';
import { useAuth } from '@/app/providers/AuthProvider';
import { useLanguage, useT } from '@/shared/i18n';
import { TeamMark } from '@/shared/ui/TeamMark';
import { TeamLogo } from '@/shared/ui/TeamLogo';
import { predictionLink, ScoreRow } from '@/shared/ui/ScoreRow';
import { PlayerCard } from '@/shared/ui/PlayerCard';
import { PlayerDetailModal } from '@/shared/ui/PlayerDetailModal';
import { LivePanel } from '@/shared/ui/LivePanel';
import { liveApi, type LiveNewsItem } from '@/shared/api/live';
import { NewsModal } from '@/shared/ui/NewsModal';
import { HighlightsCarousel } from '@/shared/ui/HighlightsCarousel';
import { NewsBentoCard, NewsBentoFeature } from '@/shared/ui/NewsBentoCard';

interface PredictStats {
  totalPredictions?: number;
  accuracy?: number | null;
}

interface HomeSummary {
  topTeams: Team[];
  topPlayers: Player[];
  upcomingMatches: Match[];
  recentMatches: Match[];
  scheduleUnavailable?: boolean;
}

interface ChallengeCardData {
  id: string;
  icon: 'streak' | 'accuracy' | 'underdog' | 'champion';
  title: string;
  desc: string;
  progress: number;
  value: string;
  reward: string;
  color: string;
  locked?: boolean;
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function buildChallengeCards(userStats: any, backendChallenges: any[] = []): ChallengeCardData[] {
  const completed = Number(userStats?.completedPredictions ?? 0);
  const accuracy = Number(userStats?.accuracy ?? 0);
  const streak = Number(userStats?.currentStreak ?? 0);
  const underdogCorrect = Number(userStats?.categories?.underdog?.correct ?? 0);
  const rank = Number(userStats?.rank ?? 0);

  if (!userStats && backendChallenges.length > 0) {
    return backendChallenges.slice(0, 4).map((challenge) => {
      const id = String(challenge.id || '');
      const isAccuracy = id.includes('accuracy');
      const isUnderdog = id.includes('underdog');
      const isTop = id.includes('top');
      return {
        id: id || String(challenge.title || 'challenge'),
        icon: isAccuracy ? 'accuracy' : isUnderdog ? 'underdog' : isTop ? 'champion' : 'streak',
        title: String(
          challenge.title ||
            (isAccuracy
              ? 'WEEKLY ACCURACY'
              : isUnderdog
                ? 'DIFFICULT MATCHUP'
                : isTop
                  ? 'WEEKLY TOP'
                  : 'DECISION STREAK'),
        ),
        desc: String(
          challenge.desc ||
            (isAccuracy
              ? '70% threshold on completed games'
              : isUnderdog
                ? '3 correct picks against the favorite'
                : isTop
                  ? 'Top 10 by prediction quality'
                  : '5 correct predictions without a miss'),
        ),
        progress: clampProgress(Number(challenge.progress ?? 0)),
        value: String(challenge.value || '0 / 0').replace('РАЗБЛОКИРОВАНО', 'UNLOCKED'),
        reward: String(challenge.reward || '').replace('XP', 'pts'),
        color: challenge.color || '#d26a34',
        locked: Boolean(challenge.locked),
      };
    });
  }

  const accuracyReady = completed >= 5;
  const accuracyProgress = accuracyReady ? (accuracy / 70) * 100 : (completed / 5) * 100;
  const topProgress = rank > 0 ? (rank <= 10 ? 100 : Math.max(0, ((50 - rank) / 40) * 100)) : 0;

  return [
    {
      id: 'streak_5',
      icon: 'streak',
      title: 'DECISION STREAK',
      desc: '5 correct predictions without a miss',
      progress: clampProgress((streak / 5) * 100),
      value: `${streak} / 5`,
      reward: '+250 pts',
      color: '#d26a34',
    },
    {
      id: 'accuracy_70',
      icon: 'accuracy',
      title: 'WEEKLY ACCURACY',
      desc: accuracyReady ? '70% threshold on completed games' : 'Requires at least 5 completed predictions',
      progress: clampProgress(accuracyProgress),
      value: accuracyReady ? `${Math.round(accuracy)}% / 70%` : `${completed} / 5 predictions`,
      reward: '+500 pts',
      color: '#d99a4f',
      locked: !accuracyReady,
    },
    {
      id: 'underdog_3',
      icon: 'underdog',
      title: 'DIFFICULT MATCHUP',
      desc: '3 correct picks against the favorite',
      progress: clampProgress((underdogCorrect / 3) * 100),
      value: `${underdogCorrect} / 3`,
      reward: '+700 pts',
      color: '#36d399',
    },
    {
      id: 'top_10',
      icon: 'champion',
      title: 'WEEKLY TOP',
      desc: 'Top 10 by prediction quality',
      progress: clampProgress(topProgress),
      value: rank > 0 ? `#${rank}${rank <= 10 ? ' · UNLOCKED' : ''}` : 'Make your first prediction',
      reward: '+1000 pts',
      color: '#e3b341',
      locked: rank <= 0,
    },
  ];
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  try {
    const ts = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - ts);
    const min = Math.floor(diff / 60_000);
    if (min < 1) return 'только что';
    if (min < 60) return `${min} мин назад`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} ч назад`;
    const d = Math.floor(hr / 24);
    return `${d} д назад`;
  } catch {
    return '';
  }
}

function ChallengeIcon({ icon }: { icon?: string }) {
  const cls = "h-6 w-6";
  if (icon === 'accuracy') return <Target className={cls} strokeWidth={1.8} />;
  if (icon === 'underdog') return <Gem className={cls} strokeWidth={1.8} />;
  if (icon === 'champion') return <Crown className={cls} strokeWidth={1.8} />;
  return <Flame className={cls} strokeWidth={1.8} />;
}

export const HomePage = () => {
  const { user } = useAuth();
  const t = useT();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<PredictStats | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [scheduleFailed, setScheduleFailed] = useState(false);
  const [news, setNews] = useState<LiveNewsItem[]>([]);
  const [myStats, setMyStats] = useState<any>(null);
  const [myChallenges, setMyChallenges] = useState<any[]>([]);
  const [activeNews, setActiveNews] = useState<LiveNewsItem | null>(null);
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const playersRailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const setTopTeams = (data: Team[]) => setTeams([...data].sort((a, b) => b.wins - a.wins));

    const load = async () => {
      try {
        const summary = await apiRequest<HomeSummary>('/home/summary');
        if (!active) return;
        setTopTeams(summary.topTeams);
        setMatches([...summary.upcomingMatches, ...summary.recentMatches]);
        setScheduleFailed(Boolean(summary.scheduleUnavailable));
        setPlayers(summary.topPlayers);
      } catch {
        const [teamsResponse, matchesResponse, playersResponse] = await Promise.allSettled([
          apiRequest<Team[]>('/teams'),
          apiRequest<Match[]>('/matches?limit=24'),
          apiRequest<Player[]>('/players?limit=16&sort_by=pts&sort_order=desc&min_games=5'),
        ]);
        if (!active) return;
        if (teamsResponse.status === 'fulfilled') setTopTeams(teamsResponse.value);
        if (matchesResponse.status === 'fulfilled') setMatches(matchesResponse.value);
        else setScheduleFailed(true);
        if (playersResponse.status === 'fulfilled') setPlayers(playersResponse.value);
      } finally {
        if (active) setLoadingSchedule(false);
      }
    };

    void load();
    apiRequest<PredictStats>('/predict/stats').then((data) => {
      if (active) setStats(data);
    }).catch(() => undefined);
    liveApi.newsFeed(6).then(({ items: data }) => {
      if (active) setNews(data);
    }).catch(() => undefined);

    return () => { active = false; };
  }, []);

  // Real user stats + challenges — only if signed in
  useEffect(() => {
    if (!user) {
      setMyStats(null);
      setMyChallenges([]);
      return;
    }
    apiRequest<any>('/predictions/my/stats', undefined, false)
      .then(setMyStats)
      .catch(() => setMyStats(null));
    apiRequest<any[]>('/challenges/my', undefined, false)
      .then((d) => setMyChallenges(Array.isArray(d) ? d : []))
      .catch(() => setMyChallenges([]));
  }, [user]);

  const upcoming = matches
    .filter((match) => match.status === 'scheduled' && Date.parse(match.date) >= Date.now())
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const finished = matches
    .filter((match) => match.status === 'finished')
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const shortlist = (upcoming.length ? upcoming : finished).slice(0, 3);
  const topTeams = teams.filter((team) => team.hasStats !== false).slice(0, 8);
  const challengeCards = useMemo(() => buildChallengeCards(myStats, myChallenges), [myStats, myChallenges]);
  const today = new Date();
  const accuracy = typeof stats?.accuracy === 'number' ? Math.round(stats.accuracy) : null;
  const predictionCount = stats?.totalPredictions ?? 0;

  return (
    <>
      <div className="container-x score-home">
        <section className="score-hero">
          <img className="score-hero-photo" src={import.meta.env.BASE_URL + 'score-courtside-photo.webp'} alt="" width="1000" height="665" />
          <a className="score-photo-credit"
            href="https://www.dvidshub.net/image/624088/usa-vs-dominican-republic-exhibition-game"
            target="_blank" rel="noreferrer">Daniel Hughes · DVIDS</a>
          <div className="score-hero-content">
            <time className="score-hero-date" dateTime={today.toISOString()}>
              {today.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' })}
            </time>
            <h1>{t('score.title')}<br /><span>{t('score.headline')}</span></h1>
            <p>{t('score.heroDescription')}</p>
            <div className="score-hero-actions">
              <Link className="btn btn-primary" to="/matches">{t('score.openMatches')} <ArrowRight size={17} aria-hidden="true" /></Link>
              <Link className="btn btn-secondary" to={upcoming[0] ? predictionLink(upcoming[0]) : '/prediction/new'}>
                {t('hero.ctaPredict')}
              </Link>
            </div>
          </div>
          {(accuracy !== null || predictionCount > 0) && (
            <dl className="score-hero-metrics">
              {accuracy !== null && <div><dt>{t('hero.statAcc')}</dt><dd>{accuracy}%</dd></div>}
              {predictionCount > 0 && (
                <div><dt>{t('hero.statPred')}</dt><dd>{predictionCount.toLocaleString(language)}</dd></div>
              )}
            </dl>
          )}
        </section>

        <div className="score-home-panels">
          <LivePanel />
          <section className="score-panel" aria-labelledby="home-schedule-heading">
            <div className="score-panel-head">
              <h2 id="home-schedule-heading">{t(upcoming.length || !finished.length ? 'score.upcoming' : 'score.results')}</h2>
            </div>
            {shortlist.length ? shortlist.map((match) => <ScoreRow key={match.id} match={match} withDate />) : (
              <p className="score-panel-empty" role="status">
                {loadingSchedule ? t('score.loadingSchedule') : t(scheduleFailed ? 'score.archiveUnavailable' : 'score.noUpcoming')}
              </p>
            )}
            <Link className="score-panel-link" to={'/matches?status=' + (finished.length && !upcoming.length ? 'finished' : 'scheduled')}>
              {t('common.allMatches')} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>

      {/* ============== HIGHLIGHTS / MOMENTS ============== */}
      <HighlightsCarousel />

      {/* ============== STAR PLAYERS RAIL ============== */}
      {players.length > 0 && (
        <section className="section">
          <div className="container-x">
            <div className="section-head">
              <div className="flex flex-col gap-3">
                <span className="eyebrow"><span className="dot" />{t('home.players.eyebrow')}</span>
                <h2>
                  {t('home.players.h2a')}<br /><em>{t('home.players.h2em')}</em> {t('home.players.h2b')}
                </h2>
              </div>
              <div className="flex flex-col items-end gap-4">
                <p className="lead">
                  {t('home.players.lead')}
                </p>
                <div className="actions">
                  <button
                    className="btn btn-icon"
                    onClick={() => playersRailRef.current?.scrollBy({ left: -360, behavior: 'smooth' })}
                    aria-label="Назад"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    className="btn btn-icon"
                    onClick={() => playersRailRef.current?.scrollBy({ left: 360, behavior: 'smooth' })}
                    aria-label="Вперёд"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button onClick={() => navigate('/players')} className="btn">
                    {t('common.allPlayers')} <span className="arrow">→</span>
                  </button>
                </div>
              </div>
            </div>

            <div
              ref={playersRailRef}
              className="no-scrollbar flex gap-5 overflow-x-auto py-3.5"
              style={{ scrollSnapType: 'x mandatory', scrollBehavior: 'smooth', paddingBottom: 30 }}
            >
              {players.map((p) => (
                <PlayerCard key={p.id} player={p} onOpenDetails={() => setActivePlayer(p)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============== STANDINGS + LEADERBOARD ============== */}
      {topTeams.length > 0 && (
      <section className="section-tight">
        <div className="container-x">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="card p-6">
              <h3
                className="m-0 mb-5 font-display text-2xl uppercase"
                style={{ letterSpacing: '0.01em' }}
              >
                {t('home.standings.title')}
              </h3>
              <div className="overflow-x-auto">
                <table className="standings-table">
                  <thead>
                    <tr>
                      <th style={{ width: 24 }}>#</th>
                      <th>{t('home.standings.team')}</th>
                      <th>W</th>
                      <th>L</th>
                      <th>%</th>
                      <th>±</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topTeams.map((t, i) => {
                      const total = t.wins + t.losses;
                      const pct = total > 0 ? ((t.wins / total) * 100).toFixed(1) : '0.0';
                      const diff = (t.avgPointsFor || 0) - (t.avgPointsAgainst || 0);
                      return (
                        <tr
                          key={t.id}
                          className={i < 3 ? 'hot cursor-pointer' : 'cursor-pointer'}
                          onClick={() => navigate(`/teams/${t.id}`)}
                        >
                          <td className="font-mono text-sm">{String(i + 1).padStart(2, '0')}</td>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <TeamMark team={t} size="sm" />
                              <span className="font-semibold">{t.abbrev || t.name.slice(0, 3)}</span>
                              <span className="text-[11px] text-[var(--text-3)]">{t.city || ''}</span>
                            </div>
                          </td>
                          <td className="pct">{t.wins}</td>
                          <td className="pct">{t.losses}</td>
                          <td className="pct">{pct}</td>
                          <td
                            className="pct"
                            style={{ color: diff >= 0 ? 'var(--ok)' : 'var(--danger)' }}
                          >
                            {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="card p-6">
                <h3 className="m-0 mb-4 flex items-center justify-between font-display text-2xl uppercase">
                  <span>{t('home.leaders.title')}</span>
                  <span className="tag tag-gold">{t('home.leaders.winpct')}</span>
                </h3>
                {topTeams.slice(0, 5).map((t, i) => {
                  const total = t.wins + t.losses;
                  const pct = total > 0 ? (t.wins / total) * 100 : 0;
                  return (
                    <button
                      key={t.id}
                      onClick={() => navigate(`/teams/${t.id}`)}
                      className={`leader-row w-full text-left ${i === 0 ? 'gold' : ''}`}
                    >
                      <div className="rk">{i + 1}</div>
                      <div className="av flex items-center justify-center" style={{ padding: 0, background: 'transparent' }}>
                        <TeamLogo team={t} size={40} />
                      </div>
                      <div className="nm">{t.name}</div>
                      <div className="acc">{t.wins}–{t.losses}</div>
                      <div className="pts">{pct.toFixed(1)}%</div>
                    </button>
                  );
                })}
                <button
                  onClick={() => navigate('/teams')}
                  className="btn mt-4 w-full justify-center"
                >
                  {t('common.allTeams')} <span className="arrow">→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ============== CABINET (preview — only for signed-in users) ============== */}
      {user && (
        <section className="section-tight">
          <div className="container-x">
            <div className="section-head">
              <div className="flex flex-col gap-3">
                <span className="eyebrow"><span className="dot" />{t('home.account.eyebrow')}</span>
                <h2>
                  {t('home.account.h2a')}<br />{t('home.account.h2b')}
                </h2>
              </div>
              <p className="lead">
                {t('home.account.leadBefore')} <Link to="/history" className="underline" style={{ color: 'var(--accent)' }}>{t('home.account.history')}</Link>.
              </p>
            </div>

            <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] lg:grid-cols-[0.95fr_1.05fr]">
              <div
                className="p-8"
                style={{
                  background:
                    'radial-gradient(ellipse 80% 60% at 20% 0%, var(--accent-soft), transparent 60%), var(--surface)',
                }}
              >
                <div className="mb-6 flex items-center justify-between gap-4">
                  <h4 className="m-0 font-mono text-[11px] uppercase text-[var(--text-3)]" style={{ letterSpacing: '0.2em' }}>
                    {t('home.account.accuracy')}
                  </h4>
                  <span className="tag tag-gold">SCORE INDEX</span>
                </div>
                <div className="mb-2.5 flex items-end gap-4">
                  <div className="font-display text-7xl leading-[0.9]">
                    <span style={{ color: 'var(--accent)' }}>{Math.round(myStats?.accuracy ?? 0)}</span>
                    <span className="text-3xl text-[var(--text-3)]">%</span>
                  </div>
                  <div className="mb-2 h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${clampProgress(myStats?.accuracy ?? 0)}%`,
                        background: 'linear-gradient(90deg, var(--accent), var(--ok))',
                      }}
                    />
                  </div>
                </div>
                <p className="mb-7 max-w-[420px] text-sm text-[var(--text-3)]">
                  {(myStats?.completedPredictions ?? 0) > 0
                    ? `${myStats.correctPredictions}/${myStats.completedPredictions} ${t('home.account.accuracyReady')}`
                    : t('home.account.accuracyEmpty')}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { num: String(myStats?.totalPredictions ?? 0), lbl: t('home.account.total'), diff: `${myStats?.completedPredictions ?? 0} ${t('home.account.completed')}` },
                    { num: String(myStats?.currentStreak ?? 0), lbl: t('home.account.streak'), diff: `${t('home.account.record')}: ${myStats?.bestStreak ?? 0}` },
                    { num: myStats?.rank ? `#${myStats.rank}` : '-', lbl: t('home.account.rank'), diff: t('home.account.rankSub') },
                    { num: (myStats?.totalXp ?? 0).toLocaleString('ru'), lbl: t('home.account.points'), diff: t('home.account.pointsSub') },
                  ].map((s) => (
                    <div key={s.lbl} className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] p-4">
                      <div className="font-display text-3xl leading-none tab-num">{s.num}</div>
                      <div className="mt-1 font-mono text-[10px] uppercase text-[var(--text-3)]" style={{ letterSpacing: '0.14em' }}>{s.lbl}</div>
                      <div className="mt-1.5 font-mono text-[11px]" style={{ color: 'var(--ok)' }}>{s.diff}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-[var(--line)] bg-[var(--bg-2)] p-8 lg:border-l lg:border-t-0">
                <div className="grid gap-5 md:grid-cols-[1fr_0.85fr]">
                  <div>
                    <h4 className="m-0 mb-3.5 font-mono text-[11px] uppercase text-[var(--text-3)]" style={{ letterSpacing: '0.2em' }}>
                      {t('home.account.recent')} {myStats?.lastOutcomes?.length || 0} {t('home.account.predictions')}
                    </h4>
                    {(myStats?.lastOutcomes?.length ?? 0) === 0 ? (
                      <div className="mb-7 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-4 py-5 text-[13px] text-[var(--text-3)]">
                        {t('home.account.emptySpark')}
                      </div>
                    ) : (
                      <div className="spark mb-7">
                        {(myStats?.lastOutcomes || []).map((g: string, i: number) => (
                          <div
                            key={i}
                            className={`bar ${g === 'W' ? 'win' : ''}`}
                            style={{ height: g === 'W' ? `${50 + (i % 5) * 10}%` : g === 'L' ? `${20 + (i % 3) * 10}%` : '12%', opacity: g === '?' ? 0.35 : 1 }}
                            title={g === 'W' ? t('home.account.win') : g === 'L' ? t('home.account.loss') : t('home.account.pending')}
                          />
                        ))}
                      </div>
                    )}

                    <h4 className="m-0 mb-3.5 font-mono text-[11px] uppercase text-[var(--text-3)]" style={{ letterSpacing: '0.2em' }}>
                      {t('home.account.weak')}
                    </h4>
                    <div className="flex flex-col gap-2.5">
                      {(() => {
                        const cats = myStats?.categories;
                        const rows: Array<{ l: string; v: string; color: string }> = [];
                        if (cats) {
                          if (cats.underdog?.pct !== null && cats.underdog?.pct !== undefined) rows.push({ l: t('home.account.underdogs'), v: `${cats.underdog.pct}% · ${cats.underdog.correct}/${cats.underdog.n}`, color: cats.underdog.pct >= 50 ? 'var(--ok)' : 'var(--danger)' });
                          if (cats.favourite?.pct !== null && cats.favourite?.pct !== undefined) rows.push({ l: t('home.account.favorites'), v: `${cats.favourite.pct}% · ${cats.favourite.correct}/${cats.favourite.n}`, color: cats.favourite.pct >= 60 ? 'var(--ok)' : 'var(--gold)' });
                          if (cats.highConfidence?.pct !== null && cats.highConfidence?.pct !== undefined) rows.push({ l: t('home.account.highConfidence'), v: `${cats.highConfidence.pct}% · ${cats.highConfidence.correct}/${cats.highConfidence.n}`, color: cats.highConfidence.pct >= 65 ? 'var(--ok)' : 'var(--gold)' });
                        }
                        if (rows.length === 0) {
                          return <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3.5 text-[13px] text-[var(--text-3)]">{t('home.account.emptyWeak')}</div>;
                        }
                        return rows.map((r) => (
                          <div key={r.l} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3.5">
                            <span className="text-[13px]">{r.l}</span>
                            <span className="font-mono text-xs" style={{ color: r.color }}>{r.v}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="badge-icon" style={{ color: 'var(--ai)' }}>
                        <Target className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-display text-xl uppercase">{t('account.commandCenter')}</div>
                        <div className="text-xs text-[var(--text-3)]">{t('account.commandText')}</div>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {[t('account.mission1'), t('account.mission2'), t('account.mission3')].map((mission, index) => (
                        <div key={mission} className="flex items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5">
                          <span className="font-mono text-[10px] text-[var(--gold)]">0{index + 1}</span>
                          <span className="text-[13px] text-[var(--text-2)]">{mission}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => navigate('/account')} className="btn btn-primary mt-5 w-full justify-center">
                      {t('nav.account')} <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {false && user && (
      <section className="section-tight">
        <div className="container-x">
          <div className="section-head">
            <div className="flex flex-col gap-3">
              <span className="eyebrow"><span className="dot" />ЛИЧНЫЙ КАБИНЕТ</span>
              <h2>
                Твоя статистика<br />за сезон
              </h2>
            </div>
            <p className="lead">
              Реальные цифры на основе твоих прогнозов. Полная версия — в <a href="/history" className="underline" style={{ color: 'var(--accent)' }}>истории</a>.
            </p>
          </div>

          <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] lg:grid-cols-2">
            <div
              className="p-8"
              style={{
                background:
                  'radial-gradient(ellipse 80% 60% at 20% 0%, var(--accent-soft), transparent 60%), var(--surface)',
              }}
            >
              <h4
                className="m-0 mb-3.5 font-mono text-[11px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.2em' }}
              >
                Точность прогнозов
              </h4>
              <div className="mb-2.5 font-display text-7xl leading-[0.9]">
                <span style={{ color: 'var(--accent)' }}>{Math.round(myStats?.accuracy ?? 0)}</span>
                <span className="text-3xl text-[var(--text-3)]">%</span>
              </div>
              <p className="mb-7 max-w-[360px] text-sm text-[var(--text-3)]">
                {(myStats?.completedPredictions ?? 0) > 0
                  ? `${myStats.correctPredictions}/${myStats.completedPredictions} верных из завершённых матчей.`
                  : 'Сделай прогноз — после завершения матча здесь появится точность.'}
              </p>

              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    num: String(myStats?.totalPredictions ?? 0),
                    lbl: 'Всего прогнозов',
                    diff: `${myStats?.completedPredictions ?? 0} завершено`,
                  },
                  {
                    num: String(myStats?.currentStreak ?? 0),
                    lbl: 'Текущая серия',
                    diff: `Рекорд: ${myStats?.bestStreak ?? 0}`,
                  },
                  {
                    num: myStats?.rank ? `#${myStats.rank}` : '—',
                    lbl: 'Место в рейтинге',
                    diff: 'по качеству прогнозов',
                  },
                  {
                    num: (myStats?.totalXp ?? 0).toLocaleString('ru'),
                    lbl: 'Баллы профиля',
                    diff: 'за верные прогнозы',
                  },
                ].map((s) => (
                  <div key={s.lbl} className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] p-4">
                    <div className="font-display text-3xl leading-none tab-num">{s.num}</div>
                    <div
                      className="mt-1 font-mono text-[10px] uppercase text-[var(--text-3)]"
                      style={{ letterSpacing: '0.14em' }}
                    >
                      {s.lbl}
                    </div>
                    <div className="mt-1.5 font-mono text-[11px]" style={{ color: 'var(--ok)' }}>
                      {s.diff}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--line)] bg-[var(--bg-2)] p-8 lg:border-l lg:border-t-0">
              <h4
                className="m-0 mb-3.5 font-mono text-[11px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.2em' }}
              >
                Последние {myStats?.lastOutcomes?.length || 0} прогнозов
              </h4>
              {(myStats?.lastOutcomes?.length ?? 0) === 0 ? (
                <div className="mb-7 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-4 py-5 text-[13px] text-[var(--text-3)]">
                  Сделай хотя бы один прогноз — здесь появится спарк-чарт побед.
                </div>
              ) : (
                <div className="spark mb-7">
                  {(myStats?.lastOutcomes || []).map((g: string, i: number) => (
                    <div
                      key={i}
                      className={`bar ${g === 'W' ? 'win' : ''}`}
                      style={{
                        height:
                          g === 'W'
                            ? `${50 + (i % 5) * 10}%`
                            : g === 'L'
                              ? `${20 + (i % 3) * 10}%`
                              : '12%',
                        opacity: g === '?' ? 0.35 : 1,
                      }}
                      title={
                        g === 'W' ? 'Угадано' : g === 'L' ? 'Мимо' : 'Ожидает результата'
                      }
                    />
                  ))}
                </div>
              )}

              <h4
                className="m-0 mb-3.5 font-mono text-[11px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.2em' }}
              >
                Слабые стороны
              </h4>
              <div className="flex flex-col gap-2.5">
                {(() => {
                  const cats = myStats?.categories;
                  const rows: Array<{ l: string; v: string; color: string }> = [];
                  if (cats) {
                    if (cats.underdog?.pct !== null && cats.underdog?.pct !== undefined) {
                      rows.push({
                        l: 'Андердоги',
                        v: `${cats.underdog.pct}% · ${cats.underdog.correct}/${cats.underdog.n}`,
                        color: cats.underdog.pct >= 50 ? 'var(--ok)' : 'var(--danger)',
                      });
                    }
                    if (cats.favourite?.pct !== null && cats.favourite?.pct !== undefined) {
                      rows.push({
                        l: 'Фавориты',
                        v: `${cats.favourite.pct}% · ${cats.favourite.correct}/${cats.favourite.n}`,
                        color: cats.favourite.pct >= 60 ? 'var(--ok)' : 'var(--gold)',
                      });
                    }
                    if (cats.highConfidence?.pct !== null && cats.highConfidence?.pct !== undefined) {
                      rows.push({
                        l: 'ИИ уверен (≥65%)',
                        v: `${cats.highConfidence.pct}% · ${cats.highConfidence.correct}/${cats.highConfidence.n}`,
                        color: cats.highConfidence.pct >= 65 ? 'var(--ok)' : 'var(--gold)',
                      });
                    }
                  }
                  if (rows.length === 0) {
                    return (
                      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3.5 text-[13px] text-[var(--text-3)]">
                        Категории появятся, когда хотя бы один матч завершится.
                      </div>
                    );
                  }
                  return rows.map((r) => (
                    <div
                      key={r.l}
                      className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3.5"
                    >
                      <span className="text-[13px]">{r.l}</span>
                      <span className="font-mono text-xs" style={{ color: r.color }}>
                        {r.v}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ============== CHALLENGES (real user progress) ============== */}
      {user && (
      <section className="section-tight">
        <div className="container-x">
          <div className="section-head">
            <div className="flex flex-col gap-3">
                <span className="eyebrow"><span className="dot" />{t('home.pass.eyebrow')}</span>
              <h2>
                {t('home.pass.h2a')} <em>{t('home.pass.h2em')}</em>,<br />{t('home.pass.h2b')}
              </h2>
            </div>
            <p className="lead">
              {t('home.pass.lead')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {challengeCards.map((c) => (
              <article key={c.id} className={`challenge-card ${c.locked ? 'opacity-60' : ''}`}>
                <div
                  className="badge-icon"
                  style={{ color: c.color }}
                >
                  <ChallengeIcon icon={c.icon} />
                </div>
                <div className="font-display text-xl uppercase">{c.title}</div>
                <div className="mt-2 mb-4 min-h-[34px] text-xs leading-[1.4] text-[var(--text-3)]">
                  {c.desc}
                </div>
                <div className="mb-2 h-1 overflow-hidden rounded-sm bg-[var(--surface-3)]">
                  <div className="h-full" style={{ width: `${c.progress}%`, background: c.color }} />
                </div>
                <div
                  className="flex justify-between font-mono text-[10px] uppercase text-[var(--text-3)]"
                  style={{ letterSpacing: '0.1em' }}
                >
                  <span>{c.value}</span>
                  <span style={{ color: 'var(--gold)' }}>{c.reward}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ============== NEWS ============== */}
      {news.length > 0 && (
        <section className="section-tight">
          <div className="container-x">
            <div className="section-head">
              <div className="flex flex-col gap-3">
                <span className="eyebrow"><span className="dot" />{t('home.news.eyebrow')}</span>
                <h2>
                  {t('home.news.h2a')}<br /><em>{t('home.news.h2em')}</em> {t('home.news.h2b')}
                </h2>
              </div>
              <div className="flex flex-col items-end gap-4">
                <p className="lead">
                  {t('home.news.lead')}
                </p>
                <div className="actions">
                  <button onClick={() => navigate('/news')} className="btn">
                    {t('home.news.all')} <span className="arrow">→</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Premium bento — 1 feature + 4 cards. Magazine vibes, no
                cramped row layout with squished thumbs. */}
            <div className="news-bento">
              {news[0] && (
                <NewsBentoFeature
                  item={news[0]}
                  relTime={relativeTime(news[0].published)}
                  onOpen={() => setActiveNews(news[0])}
                />
              )}

              {news.slice(1, 5).map((n, i) => (
                <NewsBentoCard
                  key={n.id || i}
                  item={n}
                  relTime={relativeTime(n.published)}
                  tall={i < 2}
                  onOpen={() => setActiveNews(n)}
                />
              ))}
            </div>

            {/* Footer CTA */}
            <div className="mt-10 flex justify-center">
              <button onClick={() => navigate('/news')} className="btn btn-primary">
                {t('home.news.openAll')} <span className="arrow">→</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* News article modal */}
      <NewsModal article={activeNews} onClose={() => setActiveNews(null)} />

      {/* Player detail modal */}
      <PlayerDetailModal player={activePlayer} onClose={() => setActivePlayer(null)} />

      {/* ============== CTA: Sign-in invite ============== */}
      {!user && (
        <section className="section-tight">
          <div className="container-x">
            <div className="card p-10 text-center" style={{ background: 'linear-gradient(135deg, var(--accent-soft), transparent), var(--surface)' }}>
              <Lock className="mx-auto h-7 w-7" style={{ color: 'var(--accent)' }} />
              <h3 className="mt-4 font-display text-4xl uppercase">{t('home.cta.title')}</h3>
              <p className="mx-auto mt-3 max-w-[460px] text-sm text-[var(--text-3)]">
                {t('home.cta.desc')}
              </p>
              <button onClick={() => navigate('/prediction/new')} className="btn btn-primary mt-6">
                {t('home.cta.button')} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default HomePage;
