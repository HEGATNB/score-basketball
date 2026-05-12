import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Cpu, Sparkles, Trophy, Zap } from 'lucide-react';
import { apiRequest, type Prediction } from '@/shared/api/client';
import { TeamMark } from '@/shared/ui/TeamMark';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';

function formatFactor(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

export const PredictionResultPage = () => {
  const { id } = useParams();
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError('Не указан ID прогноза.');
      setLoading(false);
      return;
    }
    apiRequest<Prediction>(`/predictions/${id}`, undefined, false)
      .then(setPrediction)
      .catch((e: any) => setError(e?.message || 'Прогноз не найден.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="md" label="Читаем выдачу модели" />
      </div>
    );
  }

  if (!prediction || error) {
    return (
      <section className="section">
        <div className="container-x">
          <Link to="/prediction/new" className="btn btn-ghost mb-6">
            <ArrowLeft className="h-4 w-4" />
            К билдеру
          </Link>
          <div
            className="card p-8 text-[var(--danger)]"
            style={{ borderColor: 'rgba(255,56,88,0.25)', background: 'rgba(255,56,88,0.06)' }}
          >
            {error || 'Прогноз не найден.'}
          </div>
        </div>
      </section>
    );
  }

  const aWins = prediction.probabilityTeam1 >= prediction.probabilityTeam2;
  const winner = aWins ? prediction.team1 : prediction.team2;
  const pA = Number(prediction.probabilityTeam1);
  const pB = Number(prediction.probabilityTeam2);

  return (
    <section className="section">
      <div className="container-x">
        <Link to="/prediction/new" className="btn btn-ghost mb-7">
          <ArrowLeft className="h-4 w-4" />
          Новый прогноз
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <span className="tag tag-hot">
            <Cpu className="h-3 w-3" />
            AI РЕЗУЛЬТАТ
          </span>
          <span className="tag tag-gold">
            <Sparkles className="h-3 w-3" />
            {prediction.confidence}% уверенность
          </span>
          {prediction.modelVersion && <span className="tag">v{prediction.modelVersion}</span>}
        </div>

        <h1
          className="display-h mt-6"
          style={{ fontSize: 'clamp(48px, 7vw, 100px)', lineHeight: 0.88 }}
        >
          {prediction.team1?.name}
          <br />
          <span style={{ color: 'var(--accent)' }}>vs</span>
          <br />
          {prediction.team2?.name}
        </h1>

        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-[var(--text-2)]">
          Модель склоняется к{' '}
          <span className="font-semibold text-[var(--text)]">{winner?.name}</span> на основе формы,
          EMA-сглаженных атаки и защиты и контекста матчапа.
        </p>

        {/* MAIN RESULT */}
        <div
          className="card mt-10 overflow-hidden p-8 lg:p-12"
          style={{
            background:
              'linear-gradient(120deg, rgba(255,90,31,0.10), transparent 50%), var(--surface)',
          }}
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
            <TeamProb
              team={prediction.team1}
              probability={pA}
              expectedScore={prediction.expectedScoreTeam1}
              isWinner={aWins}
            />

            <div className="flex flex-col items-center gap-2">
              <span className="font-display text-3xl lg:text-5xl" style={{ color: 'var(--accent)' }}>
                vs
              </span>
              <div className="h-12 w-px bg-[var(--line)] lg:h-20" />
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                выбор
              </span>
            </div>

            <TeamProb
              team={prediction.team2}
              probability={pB}
              expectedScore={prediction.expectedScoreTeam2}
              isWinner={!aWins}
            />
          </div>

          {/* Probability distribution bar */}
          <div className="mt-12">
            <div
              className="flex items-center justify-between font-mono text-[11px] uppercase"
              style={{ letterSpacing: '0.22em' }}
            >
              <span className="text-[var(--text-2)]">{prediction.team1?.abbrev || 'TEAM 1'}</span>
              <span className="text-[var(--text-3)]">распределение вероятности</span>
              <span className="text-[var(--text-2)]">{prediction.team2?.abbrev || 'TEAM 2'}</span>
            </div>

            <div
              className="mt-3 flex h-4 overflow-hidden rounded-md ring-1 ring-[var(--line-strong)]"
            >
              <div
                style={{
                  width: `${pA}%`,
                  background: prediction.team1?.brandColor || 'var(--accent)',
                }}
              />
              <div
                style={{
                  width: `${pB}%`,
                  background: prediction.team2?.brandColor || 'var(--info)',
                }}
              />
            </div>

            <div className="mt-3 flex justify-between font-mono text-sm tab-num">
              <span>{pA.toFixed(0)}%</span>
              <span>{pB.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* META */}
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <div className="card p-8">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-md"
                style={{ background: 'rgba(255,90,31,0.12)', color: 'var(--accent)' }}
              >
                <Award className="h-4 w-4" />
              </div>
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                Предполагаемый победитель
              </span>
            </div>
            <p className="mt-5 font-display text-2xl uppercase">{winner?.name || '—'}</p>
            <p className="mt-2 text-sm text-[var(--text-3)]">
              {Math.max(pA, pB).toFixed(0)}% вероятность
            </p>
          </div>

          <div className="card p-8">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-md"
                style={{ background: 'rgba(255,184,0,0.12)', color: 'var(--gold)' }}
              >
                <Trophy className="h-4 w-4" />
              </div>
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                Ожидаемый счёт
              </span>
            </div>
            <p className="mt-5 font-mono text-4xl tab-num">
              {prediction.expectedScoreTeam1} – {prediction.expectedScoreTeam2}
            </p>
            <p className="mt-2 text-sm text-[var(--text-3)]">Среднее по сэмплам модели</p>
          </div>

          <div className="card p-8">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-md"
                style={{ background: 'rgba(46,230,138,0.12)', color: 'var(--ok)' }}
              >
                <Zap className="h-4 w-4" />
              </div>
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                Модель
              </span>
            </div>
            <p className="mt-5 font-display text-2xl uppercase">{prediction.modelVersion || 'v1.0'}</p>
            <p className="mt-2 text-sm text-[var(--text-3)]">
              {prediction.trainingDataPoints
                ? `${prediction.trainingDataPoints.toLocaleString('ru')} обучающих игр`
                : new Date(prediction.createdAt).toLocaleString('ru-RU')}
            </p>
          </div>
        </div>

        {prediction.factors && typeof prediction.factors === 'object' ? (
          <div className="mt-12">
            <h3 className="display-h" style={{ fontSize: 28 }}>
              КЛЮЧЕВЫЕ <em>ФАКТОРЫ</em>
            </h3>
            <p className="mt-2 text-sm text-[var(--text-3)]">
              Вклад каждого сигнала в финальное распределение.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {Object.entries(prediction.factors as Record<string, unknown>).map(([key, v]) => {
                const num = typeof v === 'number' ? v : Number(v) || 0;
                return (
                  <div key={key} className="card p-4">
                    <div
                      className="font-mono text-[9px] uppercase text-[var(--text-3)]"
                      style={{ letterSpacing: '0.16em' }}
                    >
                      {formatFactor(key)}
                    </div>
                    <div className="mt-2 font-display text-2xl tab-num">
                      {(num * 100).toFixed(0)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-12 flex flex-wrap gap-3">
          <Link to="/prediction/new" className="btn btn-primary">
            <Sparkles className="h-4 w-4" />
            Ещё прогноз
          </Link>
          <Link to="/history" className="btn">
            История
          </Link>
        </div>
      </div>
    </section>
  );
};

interface TeamProbProps {
  team?: { id: number; name: string; abbrev?: string; brandColor?: string; accentColor?: string };
  probability: number;
  expectedScore: number;
  isWinner: boolean;
}

function TeamProb({ team, probability, expectedScore, isWinner }: TeamProbProps) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="relative">
        <TeamMark team={team} size="xl" showGlow />
        {isWinner && (
          <div
            className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, var(--gold), var(--accent))',
              boxShadow: '0 0 20px rgba(255,184,0,0.55)',
              color: '#0a0a0c',
            }}
          >
            <Trophy className="h-4 w-4" />
          </div>
        )}
      </div>

      <div>
        <p className="font-display text-2xl uppercase">{team?.name || '—'}</p>
        <p
          className="mt-1 font-mono text-[10px] uppercase text-[var(--text-3)]"
          style={{ letterSpacing: '0.22em' }}
        >
          {team?.abbrev || '—'}
        </p>
      </div>

      <div
        className="font-mono text-7xl tab-num lg:text-8xl"
        style={{
          fontWeight: 200,
          color: isWinner ? 'var(--gold)' : 'var(--text)',
        }}
      >
        {probability.toFixed(0)}%
      </div>

      <div className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-4 py-2">
        <p
          className="font-mono text-[10px] uppercase text-[var(--text-3)]"
          style={{ letterSpacing: '0.22em' }}
        >
          Ожидаемо
        </p>
        <p className="font-mono text-2xl tab-num">{expectedScore}</p>
      </div>
    </div>
  );
}

export default PredictionResultPage;
