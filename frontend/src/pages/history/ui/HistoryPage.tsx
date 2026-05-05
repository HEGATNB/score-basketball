// src/pages/history/ui/HistoryPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, History, TrendingUp } from 'lucide-react';
import { apiRequest, type Prediction } from '@/shared/api/client';
import { useAuth } from '@/app/providers/AuthProvider';
import { useLanguage } from '@/app/providers/LanguageProvider';
import { GlowingCard } from '@/shared/ui/GlowingCard';

export const HistoryPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    apiRequest<Prediction[]>('/predictions/my', undefined, false)
      .then(setPredictions)
      .catch((error) => console.error('Failed to load prediction history', error))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <GlowingCard glowColor="purple" className="mx-auto max-w-3xl p-8 text-center">
        <History className="mx-auto h-10 w-10 text-[#ead9d1]" />
        <h1 className="mt-5 text-3xl font-semibold text-white">{t('history.signInRequired')}</h1>
        <p className="mt-3 text-slate-300">{t('history.signInDesc')}</p>
        <Link
          to="/auth"
          className="btn-primary mt-6"
        >
          {t('history.signIn')}
        </Link>
      </GlowingCard>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-16 w-16 rounded-full border-4 border-[rgba(216,180,106,0.22)] border-t-[#c96a2b] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <GlowingCard glowColor="orange" className="p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="data-chip">
            <TrendingUp className="h-3.5 w-3.5" />
            {t('history.savedRuns')}
          </span>
          <span className="data-chip">{t('history.items', { count: predictions.length })}</span>
        </div>
        <h1 className="mt-5 text-4xl font-bold text-white">{t('history.title')}</h1>
        <p className="mt-4 text-base leading-7 text-slate-300">
          {t('history.subtitle')}
        </p>
      </GlowingCard>

      {predictions.length === 0 ? (
        <GlowingCard glowColor="blue" className="p-8 text-center">
          <p className="text-white">{t('history.noPredictions')}</p>
          <Link
            to="/prediction/new"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
          >
            {t('history.startNew')}
          </Link>
        </GlowingCard>
      ) : (
        <section className="space-y-4">
          {predictions.map((prediction) => {
            const winner =
              prediction.probabilityTeam1 >= prediction.probabilityTeam2 ? prediction.team1 : prediction.team2;

            return (
              <Link key={prediction.id} to={`/prediction/${prediction.id}`}>
                <GlowingCard glowColor="green" className="p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 text-sm text-slate-400">
                        <CalendarRange className="h-4 w-4" />
                        {new Date(prediction.createdAt).toLocaleString()}
                      </div>
                      <h2 className="mt-3 text-xl font-semibold text-white">
                        {prediction.team1?.name} vs {prediction.team2?.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        Expected score {prediction.expectedScoreTeam1}:{prediction.expectedScoreTeam2}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-white">{winner?.name}</p>
                      <p className="mt-1 text-sm text-emerald-100">{Math.max(prediction.probabilityTeam1, prediction.probabilityTeam2)}% win probability</p>
                    </div>
                  </div>
                </GlowingCard>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
};

export default HistoryPage;