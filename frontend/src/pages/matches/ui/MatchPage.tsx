import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarRange, Sparkles } from 'lucide-react';
import { apiRequest, type Match } from '@/shared/api/client';
import { useLanguage } from '@/app/providers/LanguageProvider';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { TeamMark } from '@/shared/ui/TeamMark';

export const MatchPage = () => {
  const { matchId } = useParams();
  const { t } = useLanguage();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) {
      setLoading(false);
      return;
    }

    apiRequest<Match>(`/matches/${matchId}`)
      .then(setMatch)
      .catch((error) => console.error('Failed to load match', error))
      .finally(() => setLoading(false));
  }, [matchId]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-[rgba(216,180,106,0.22)] border-t-[#c96a2b]" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="space-y-6">
        <Link to="/matches" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          {t('match.backToMatches')}
        </Link>
        <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100">{t('match.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link to="/matches" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        {t('match.backToSchedule')}
      </Link>

      <GlowingCard glowColor="orange" className="p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="data-chip">
            <CalendarRange className="h-3.5 w-3.5" />
            {new Date(match.date).toLocaleDateString()}
          </span>
          <span className="data-chip">{match.status === 'finished' ? t('match.finalScore') : t('match.upcomingFixture')}</span>
        </div>

        <div className="mt-8 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="surface-muted text-center">
            <TeamMark team={match.homeTeam} size="lg" className="mx-auto" />
            <p className="mt-5 text-2xl font-semibold text-white">{match.homeTeam.name}</p>
            <p className="mt-2 text-sm text-slate-400">{match.homeTeam.city}</p>
          </div>

          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{t('match.scoreline')}</p>
            <p className="mt-3 font-spacegrotesk text-5xl font-bold text-white">
              {match.homeScore ?? '--'} : {match.awayScore ?? '--'}
            </p>
            <p className="mt-3 text-sm text-slate-400">
              {new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="surface-muted text-center">
            <TeamMark team={match.awayTeam} size="lg" className="mx-auto" />
            <p className="mt-5 text-2xl font-semibold text-white">{match.awayTeam.name}</p>
            <p className="mt-2 text-sm text-slate-400">{match.awayTeam.city}</p>
          </div>
        </div>
      </GlowingCard>

      <GlowingCard glowColor="blue" className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[rgba(214,225,235,0.72)]">Action</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{t('match.useAI')}</h2>
            <p className="mt-2 max-w-2xl text-slate-300">
              {t('match.useAIDesc')}
            </p>
          </div>
          <Link to={`/prediction/new?team1=${match.homeTeam.id}&team2=${match.awayTeam.id}`} className="btn-primary">
            <Sparkles className="h-4 w-4" />
            {t('match.createPrediction')}
          </Link>
        </div>
      </GlowingCard>
    </div>
  );
};

export default MatchPage;