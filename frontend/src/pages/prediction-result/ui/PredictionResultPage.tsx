// src/pages/prediction-result/ui/PredictionResultPage.tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { apiRequest, type Prediction } from '@/shared/api/client';
import { useLanguage } from '@/app/providers/LanguageProvider';
import { GlowingCard } from '@/shared/ui/GlowingCard';
import { TeamMark } from '@/shared/ui/TeamMark';
import { hexToRgba } from '@/shared/lib/teamBrand';

function formatFactorLabel(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase());
}

export const PredictionResultPage = () => {
  const { id } = useParams();
  const { t } = useLanguage();
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError(t('prediction.missingId'));
      setLoading(false);
      return;
    }

    apiRequest<Prediction>(`/predictions/${id}`, undefined, false)
      .then(setPrediction)
      .catch((predictionError: any) => setError(predictionError.message || t('prediction.notFound')))
      .finally(() => setLoading(false));
  }, [id, t]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-[rgba(216,180,106,0.22)] border-t-[#c96a2b]" />
      </div>
    );
  }

  if (!prediction || error) {
    return (
      <div className="space-y-6">
        <Link to="/prediction/new" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          {t('prediction.backToBuilder')}
        </Link>
        <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100">{error || t('prediction.notFound')}</p>
      </div>
    );
  }

  const winner = prediction.probabilityTeam1 >= prediction.probabilityTeam2 ? prediction.team1 : prediction.team2;

  return (
    <div className="space-y-8">
      <Link to="/prediction/new" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        {t('prediction.backToBuilder')}
      </Link>

      <GlowingCard glowColor="orange" className="p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="data-chip">
            <Sparkles className="h-3.5 w-3.5" />
            {t('prediction.aiResult')}
          </span>
          <span className="data-chip">{t('prediction.confidence', { value: prediction.confidence })}</span>
        </div>

        <h1 className="mt-5 font-spacegrotesk text-4xl font-bold text-white sm:text-5xl">
          {prediction.team1?.name} vs {prediction.team2?.name}
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-300">
          {t('prediction.modelLeans', { team: winner?.name })}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {prediction.modelVersion && <span className="data-chip">{prediction.modelVersion}</span>}
          {prediction.trainingDataPoints ? <span className="data-chip">{t('prediction.trainingRows', { count: prediction.trainingDataPoints })}</span> : null}
        </div>

        <div className="mt-8 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="surface-muted text-center">
            <TeamMark team={prediction.team1} size="lg" className="mx-auto" />
            <p className="mt-5 text-2xl font-semibold text-white">{prediction.team1?.name}</p>
            <p className="mt-4 font-spacegrotesk text-5xl font-bold text-white">{prediction.probabilityTeam1}%</p>
            <p className="mt-2 text-sm text-slate-400">{t('prediction.expectedScore')} {prediction.expectedScoreTeam1}</p>
          </div>

          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{t('prediction.modelSplit')}</p>
            <p className="mt-3 font-spacegrotesk text-5xl font-bold text-white">
              {prediction.expectedScoreTeam1} : {prediction.expectedScoreTeam2}
            </p>
            <p className="mt-2 text-sm text-slate-400">{new Date(prediction.createdAt).toLocaleString()}</p>
          </div>

          <div className="surface-muted text-center">
            <TeamMark team={prediction.team2} size="lg" className="mx-auto" />
            <p className="mt-5 text-2xl font-semibold text-white">{prediction.team2?.name}</p>
            <p className="mt-4 font-spacegrotesk text-5xl font-bold text-white">{prediction.probabilityTeam2}%</p>
            <p className="mt-2 text-sm text-slate-400">{t('prediction.expectedScore')} {prediction.expectedScoreTeam2}</p>
          </div>
        </div>

        <div className="surface-muted mt-8">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>{prediction.team1?.abbrev}</span>
            <span>{prediction.team2?.abbrev}</span>
          </div>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-900/70">
            <div
              className="h-full"
              style={{
                width: `${prediction.probabilityTeam1}%`,
                background: `linear-gradient(90deg, ${prediction.team1?.brandColor || '#c96a2b'}, ${hexToRgba(
                  prediction.team1?.accentColor || '#d8b46a',
                  0.9,
                )})`,
              }}
            />
            <div
              className="h-full"
              style={{
                width: `${prediction.probabilityTeam2}%`,
                background: `linear-gradient(90deg, ${prediction.team2?.brandColor || '#607d96'}, ${hexToRgba(
                  prediction.team2?.accentColor || '#d6e1eb',
                  0.9,
                )})`,
              }}
            />
          </div>
        </div>

        {prediction.factors && (
          <div className="mt-8 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Object.entries(prediction.factors).map(([key, value]) => (
              <div key={key} className="surface-muted">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{formatFactorLabel(key)}</p>
                <p className="mt-2 text-lg font-semibold text-white">{(value * 100).toFixed(0)}%</p>
              </div>
            ))}
          </div>
        )}
      </GlowingCard>
    </div>
  );
};

export default PredictionResultPage;