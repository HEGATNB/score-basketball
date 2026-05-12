// src/pages/prediction-new/ui/PredictionNewPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Cpu, Lock, Sparkles } from 'lucide-react';
import { apiRequest, type Team } from '@/shared/api/client';
import { useAuth } from '@/app/providers/AuthProvider';
import { useLanguage } from '@/app/providers/LanguageProvider';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { TeamMark } from '@/shared/ui/TeamMark';

export const PredictionNewPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
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
      .then((data) => setTeams(data.sort((left, right) => right.wins - left.wins)))
      .catch(() => setError('Could not load teams for prediction.'))
      .finally(() => setLoadingTeams(false));
  }, []);

  const selectedTeams = useMemo(() => {
    const home = teams.find((team) => String(team.id) === team1Id) || null;
    const away = teams.find((team) => String(team.id) === team2Id) || null;
    return { home, away };
  }, [team1Id, team2Id, teams]);

  const handlePredict = async () => {
    if (!team1Id || !team2Id) {
      setError(t('prediction.pickBoth'));
      return;
    }

    if (team1Id === team2Id) {
      setError(t('prediction.differentTeams'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const result = await apiRequest<{ id: string }>(
        '/predict',
        {
          method: 'POST',
          body: JSON.stringify({
            team1Id: Number(team1Id),
            team2Id: Number(team2Id),
          }),
        },
        false,
      );

      navigate(`/prediction/${result.id}`);
    } catch (predictionError: any) {
      setError(predictionError.message || 'Prediction failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <GlowingCard glowColor="purple" className="mx-auto max-w-3xl p-8 text-center">
        <Lock className="mx-auto h-10 w-10 text-[#ead9d1]" />
        <h1 className="mt-5 text-3xl font-semibold text-white">{t('prediction.signInRequired')}</h1>
        <p className="mt-3 text-slate-300">
          {t('prediction.signInDesc')}
        </p>
        <Link to="/auth" className="btn-primary mt-6">
          {t('prediction.unlock')}
        </Link>
      </GlowingCard>
    );
  }

  if (loadingTeams) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-[rgba(216,180,106,0.22)] border-t-[#c96a2b]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <GlowingCard glowColor="orange" className="p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="data-chip">
              <Cpu className="h-3.5 w-3.5" />
              {t('prediction.engine')}
            </span>
            <span className="data-chip">{t('prediction.teamsAvailable', { count: teams.length })}</span>
          </div>
          <h1 className="mt-5 max-w-3xl font-spacegrotesk text-4xl font-bold text-white sm:text-5xl">
            {t('prediction.buildMatchup')}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            {t('prediction.historicalContext')}
          </p>
        </GlowingCard>

        <GlowingCard glowColor="blue" className="p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-[rgba(214,225,235,0.72)]">{t('prediction.preview')}</p>
          <div className="mt-5 space-y-3">
            {[selectedTeams.home, selectedTeams.away].map((team, index) => (
              <div key={index} className="surface-muted flex items-center gap-4">
                <TeamMark team={team} size="md" />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{index === 0 ? t('prediction.homeSide') : t('prediction.awaySide')}</p>
                  <p className="mt-1 truncate text-lg font-semibold text-white">{team?.name || t('prediction.selectTeam')}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {team ? `${team.wins}-${team.losses} / ${team.avgPointsFor.toFixed(1)} PPG` : t('prediction.waitingSelection')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </GlowingCard>
      </section>

      <GlowingCard glowColor="green" className="p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="space-y-3">
            <label className="text-xs uppercase tracking-[0.26em] text-[rgba(236,216,171,0.72)]">{t('prediction.homeSide')}</label>
            <select
              value={team1Id}
              onChange={(event) => setTeam1Id(event.target.value)}
              className="field-shell w-full px-4 py-4 text-lg font-semibold text-white"
              style={{ backgroundColor: 'rgba(10, 14, 20, 0.8)' }}
            >
              <option value="" className="bg-[rgba(10,14,20,0.95)] text-slate-400">
                {t('prediction.chooseHome')}
              </option>
              {teams.map((team) => (
                <option
                  key={team.id}
                  value={team.id}
                  className="bg-[rgba(10,14,20,0.95)] text-white"
                >
                  {team.name} ({team.wins}-{team.losses})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-center mt-12 lg:mt-14">
            <div className="status-pill bg-white/5 text-slate-300 text-lg px-6 py-2">{t('common.vs')}</div>
          </div>
          <div className="space-y-3">
            <label className="text-xs uppercase tracking-[0.26em] text-[rgba(214,225,235,0.72)]">{t('prediction.awaySide')}</label>
            <select
              value={team2Id}
              onChange={(event) => setTeam2Id(event.target.value)}
              className="field-shell w-full px-4 py-4 text-lg font-semibold text-white"
              style={{ backgroundColor: 'rgba(10, 14, 20, 0.8)' }}
            >
              <option value="" className="bg-[rgba(10,14,20,0.95)] text-slate-400">
                {t('prediction.chooseAway')}
              </option>
              {teams.map((team) => (
                <option
                  key={team.id}
                  value={team.id}
                  className="bg-[rgba(10,14,20,0.95)] text-white"
                >
                  {team.name} ({team.wins}-{team.losses})
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="mt-5 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-slate-300">
            <p>{t('prediction.savedToAccount')}</p>
          </div>
          <button type="button" onClick={handlePredict} disabled={submitting} className="btn-primary disabled:cursor-not-allowed disabled:opacity-70">
            <Sparkles className="h-4 w-4" />
            {submitting ? t('prediction.running') : t('prediction.generate')}
          </button>
        </div>
      </GlowingCard>
    </div>
  );
};

export default PredictionNewPage;