import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Award,
  CalendarRange,
  Cpu,
  Crown,
  Flame,
  Lock,
  LogOut,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { apiRequest, type Prediction } from '@/shared/api/client';
import { useAuth } from '@/app/providers/AuthProvider';
import { TeamMark } from '@/shared/ui/TeamMark';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';

interface CategoryStats {
  n: number;
  correct: number;
  pct: number | null;
}

interface UserStats {
  totalPredictions: number;
  completedPredictions: number;
  correctPredictions: number;
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
  totalXp: number;
  rank: number | null;
  lastOutcomes: Array<'W' | 'L' | '?'>;
  categories: {
    highConfidence: CategoryStats;
    lowConfidence: CategoryStats;
    underdog: CategoryStats;
    favourite: CategoryStats;
  };
}

export const HistoryPage = () => {
  const { user, logout } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const [preds, st] = await Promise.all([
        apiRequest<Prediction[]>('/predictions/my', undefined, false).catch(() => []),
        apiRequest<UserStats>('/predictions/my/stats', undefined, false).catch(() => null),
      ]);
      setPredictions(preds);
      setStats(st);
      setLoading(false);
    };
    load();
  }, [user]);

  if (!user) {
    return (
      <section className="flex min-h-[80vh] items-center justify-center">
        <div className="container-x">
          <div className="card mx-auto max-w-2xl p-10 text-center sm:p-14">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-md"
              style={{ background: 'rgba(255,90,31,0.15)', color: 'var(--accent)' }}
            >
              <Lock className="h-6 w-6" />
            </div>
            <h1
              className="display-h mt-6"
              style={{ fontSize: 'clamp(40px, 5vw, 64px)' }}
            >
              КАБИНЕТ <em>ЗАКРЫТ</em>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm text-[var(--text-3)]">
              История прогнозов привязана к аккаунту. Войди — увидишь точность, серии решений
              и персональную статистику.
            </p>
            <Link to="/auth" className="btn btn-primary mt-7">
              Войти <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="md" label="Загружаем кабинет" />
      </div>
    );
  }

  const displayName = user.name || user.username || 'Игрок';
  const accuracyPct = stats ? Math.round(stats.accuracy) : 0;
  const streak = stats?.currentStreak ?? 0;
  const bestStreak = stats?.bestStreak ?? 0;
  const totalXp = stats?.totalXp ?? 0;
  const rank = stats?.rank ?? null;
  const completed = stats?.completedPredictions ?? 0;
  const games = stats?.lastOutcomes ?? [];

  const ROLE_LABEL: Record<string, string> = {
    admin: 'Admin',
    operator: 'Operator',
    user: 'User',
  };

  // Weakness/strength rows from real category data. The whole `categories`
  // object can be missing on a fresh account, so guard each access.
  type CategoryRow = { l: string; v: string; color: string };
  const cats = stats?.categories;
  const u = cats?.underdog;
  const f = cats?.favourite;
  const h = cats?.highConfidence;
  const l = cats?.lowConfidence;
  const weaknesses: CategoryRow[] = stats
    ? [
        ...(u && u.pct !== null && u.pct !== undefined
          ? [{
              l: 'Андердоги',
              v: `${u.pct}% · ${u.correct}/${u.n}`,
              color: u.pct >= 50 ? 'var(--ok)' : 'var(--danger)',
            }]
          : []),
        ...(f && f.pct !== null && f.pct !== undefined
          ? [{
              l: 'Фавориты',
              v: `${f.pct}% · ${f.correct}/${f.n}`,
              color: f.pct >= 60 ? 'var(--ok)' : 'var(--gold)',
            }]
          : []),
        ...(h && h.pct !== null && h.pct !== undefined
          ? [{
              l: 'Высокая уверенность ИИ (≥65%)',
              v: `${h.pct}% · ${h.correct}/${h.n}`,
              color: h.pct >= 65 ? 'var(--ok)' : 'var(--gold)',
            }]
          : []),
        ...(l && l.pct !== null && l.pct !== undefined
          ? [{
              l: 'Низкая уверенность ИИ (≤55%)',
              v: `${l.pct}% · ${l.correct}/${l.n}`,
              color: l.pct >= 50 ? 'var(--gold)' : 'var(--danger)',
            }]
          : []),
      ]
    : [];

  return (
    <>
      {/* ============== PROFILE HERO ============== */}
      <section
        className="relative isolate overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 15% 0%, rgba(255,90,31,0.18), transparent 60%), radial-gradient(ellipse 60% 60% at 90% 100%, rgba(93,184,255,0.10), transparent 70%), var(--bg)',
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 4px)',
            mixBlendMode: 'overlay',
          }}
        />

        <div className="container-x relative pt-16 pb-12 lg:pt-24 lg:pb-16">
          <div
            className="font-mono text-[12px] uppercase text-[var(--text-3)]"
            style={{ letterSpacing: '0.22em' }}
          >
            <span
              className="mr-2.5 inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--accent)', boxShadow: '0 0 10px var(--accent-glow)' }}
            />
            КАБИНЕТ · СЕЗОН 2025/26
          </div>

          <div className="mt-6 grid items-end gap-10 lg:grid-cols-[1fr_auto]">
            <div>
              <h1
                className="display-h"
                style={{ fontSize: 'clamp(56px, 8vw, 130px)', lineHeight: 0.88 }}
              >
                ПРИВЕТ,
                <br />
                <em>{displayName.toUpperCase()}</em>
              </h1>
              <p className="mt-5 max-w-[520px] text-[15px] leading-relaxed text-[var(--text-2)]">
                Каждый прогноз сохраняется в профиле. Точность, серии решений и любимые команды показывают,
                где модель особенно полезна.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                <span className="tag tag-hot">
                  <Crown className="h-3 w-3" />
                  {ROLE_LABEL[user.role] || user.role}
                </span>
                <span className="tag">{user.email}</span>
                <span className="tag tag-gold">
                  <Flame className="h-3 w-3" />
                  Стрик {streak}
                </span>
              </div>
            </div>

            {/* Avatar block */}
            <div className="flex items-center gap-4">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-[var(--bg)] font-display text-5xl"
                style={{
                  background: 'linear-gradient(135deg, var(--accent), var(--gold))',
                  color: '#0a0a0c',
                  outline: '2px solid var(--line-strong)',
                  boxShadow: '0 20px 50px -15px var(--accent-glow)',
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden flex-col gap-2 sm:flex">
                <Link to="/prediction/new" className="btn btn-primary">
                  <Sparkles className="h-4 w-4" />
                  Новый прогноз
                </Link>
                <button onClick={logout} className="btn btn-ghost">
                  <LogOut className="h-4 w-4" />
                  Выйти
                </button>
              </div>
            </div>
          </div>

          {/* Hero stat band */}
          <div
            className="mt-12 grid overflow-hidden rounded-lg border border-[var(--line)]"
            style={{ gap: 1, background: 'var(--line)', gridTemplateColumns: 'repeat(4, 1fr)' }}
          >
            <div
              className="p-5"
              style={{
                background:
                  'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(255,90,31,0.18), transparent 60%), var(--surface)',
              }}
            >
              <div
                className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.18em' }}
              >
                <Target className="h-3 w-3" />
                Точность
              </div>
              <div className="font-display text-5xl tab-num">
                <span style={{ color: 'var(--accent)' }}>{accuracyPct || '—'}</span>
                {accuracyPct ? <span className="text-xl text-[var(--text-3)]">%</span> : null}
              </div>
              <div className="mt-2 font-mono text-[10px] text-[var(--text-3)]">
                {completed > 0
                  ? `${completed} матчей завершено`
                  : 'нет завершённых матчей'}
              </div>
            </div>
            <div className="bg-[var(--surface)] p-5">
              <div
                className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.18em' }}
              >
                <Cpu className="h-3 w-3" />
                Прогнозов
              </div>
              <div className="font-display text-5xl tab-num">{predictions.length}</div>
              <div className="mt-2 font-mono text-[10px] text-[var(--text-3)]">всего за сезон</div>
            </div>
            <div className="bg-[var(--surface)] p-5">
              <div
                className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.18em' }}
              >
                <Trophy className="h-3 w-3" />
                Рейтинг
              </div>
              <div className="font-display text-5xl tab-num">{rank ? `#${rank}` : '—'}</div>
              <div className="mt-2 font-mono text-[10px] text-[var(--text-3)]">
                {bestStreak > 0 ? `Лучшая серия: ${bestStreak}` : 'по качеству прогнозов'}
              </div>
            </div>
            <div className="bg-[var(--surface)] p-5">
              <div
                className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.18em' }}
              >
                <Award className="h-3 w-3" />
                Баллы
              </div>
              <div
                className="font-display text-5xl tab-num"
                style={{ color: 'var(--gold)' }}
              >
                {totalXp.toLocaleString('ru')}
              </div>
              <div className="mt-2 font-mono text-[10px] text-[var(--text-3)]">
                начисляются за верные прогнозы
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== ACTIVITY + WEAKNESSES ============== */}
      <section className="section-tight">
        <div className="container-x">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="card p-7">
              <h3
                className="m-0 mb-5 flex items-center justify-between font-mono text-[11px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                <span>Последние {games.length} прогнозов</span>
                <span className="tag">
                  W {games.filter((g) => g === 'W').length} · L {games.filter((g) => g === 'L').length}
                </span>
              </h3>
              <div className="spark mb-7">
                {games.map((g, i) => (
                  <div
                    key={i}
                    className={`bar ${g === 'W' ? 'win' : ''}`}
                    style={{
                      height: g === 'W' ? `${50 + (i % 5) * 10}%` : `${20 + (i % 3) * 10}%`,
                    }}
                    title={g === 'W' ? 'Угадано' : 'Мимо'}
                  />
                ))}
              </div>

              <h3
                className="m-0 mb-4 font-mono text-[11px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                Слабые и сильные стороны
              </h3>
              {weaknesses.length === 0 ? (
                <div className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3.5 text-[13px] text-[var(--text-3)]">
                  Категории появятся после нескольких завершённых матчей.
                </div>
              ) : (
              <div className="flex flex-col gap-2.5">
                {weaknesses.map((r) => (
                  <div
                    key={r.l}
                    className="flex items-center justify-between rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3.5"
                  >
                    <span className="text-[13px]">{r.l}</span>
                    <span
                      className="font-mono text-xs"
                      style={{ color: r.color, letterSpacing: '0.05em' }}
                    >
                      {r.v}
                    </span>
                  </div>
                ))}
              </div>
              )}
            </div>

            {/* Quick actions panel */}
            <div className="card p-7">
              <h3
                className="m-0 mb-5 font-mono text-[11px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                Быстрые действия
              </h3>
              <div className="flex flex-col gap-2.5">
                <Link
                  to="/prediction/new"
                  className="card group flex items-center justify-between gap-3 p-4 transition hover:border-[var(--accent)]"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-md"
                      style={{ background: 'rgba(255,90,31,0.15)', color: 'var(--accent)' }}
                    >
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-display text-lg uppercase">Новый прогноз</div>
                      <div className="text-[11px] text-[var(--text-3)]">Запусти ИИ на матчап</div>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-[var(--text-3)] transition group-hover:text-[var(--accent)]" />
                </Link>

                <Link
                  to="/matches"
                  className="card group flex items-center justify-between gap-3 p-4 transition hover:border-[var(--line-strong)]"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-md"
                      style={{ background: 'rgba(93,184,255,0.15)', color: 'var(--info)' }}
                    >
                      <CalendarRange className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-display text-lg uppercase">Все матчи</div>
                      <div className="text-[11px] text-[var(--text-3)]">Расписание сезона</div>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-[var(--text-3)] transition group-hover:text-[var(--text)]" />
                </Link>

                <Link
                  to="/analytics"
                  className="card group flex items-center justify-between gap-3 p-4 transition hover:border-[var(--line-strong)]"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-md"
                      style={{ background: 'rgba(255,184,0,0.15)', color: 'var(--gold)' }}
                    >
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-display text-lg uppercase">Аналитика</div>
                      <div className="text-[11px] text-[var(--text-3)]">Модель и метрики</div>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-[var(--text-3)] transition group-hover:text-[var(--text)]" />
                </Link>

                <div className="divider mt-2 h-px bg-[var(--line)]" />

                <button
                  className="card group flex items-center justify-between gap-3 p-4 transition hover:border-[var(--line-strong)]"
                  onClick={() => undefined}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-md"
                      style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
                    >
                      <Settings className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-display text-lg uppercase">Настройки</div>
                      <div className="text-[11px] text-[var(--text-3)]">Профиль, уведомления</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={logout}
                  className="card group flex items-center justify-between gap-3 p-4 transition hover:border-[rgba(255,56,88,0.4)]"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-md"
                      style={{ background: 'rgba(255,56,88,0.12)', color: 'var(--danger)' }}
                    >
                      <LogOut className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-display text-lg uppercase" style={{ color: 'var(--danger)' }}>
                        Выйти
                      </div>
                      <div className="text-[11px] text-[var(--text-3)]">Завершить сессию</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== PREDICTION HISTORY ============== */}
      <section className="section-tight">
        <div className="container-x">
          <div className="section-head">
            <div className="flex flex-col gap-3">
              <span className="eyebrow"><span className="dot" />ИСТОРИЯ ПРОГНОЗОВ</span>
              <h2>
                ТВОИ <em>ПРОГНОЗЫ</em>
              </h2>
            </div>
            <p className="lead">
              Каждый прогноз сохранён. Кликни — увидишь полную разрядку модели и причины.
            </p>
          </div>

          {predictions.length === 0 ? (
            <div className="card p-16 text-center">
              <TrendingUp className="mx-auto h-10 w-10 text-[var(--text-3)]" />
              <p className="display-h mt-5" style={{ fontSize: 32 }}>
                ПОКА ПУСТО
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-3)]">
                Сделай первый прогноз — он попадёт сюда и в недельный рейтинг.
              </p>
              <Link to="/prediction/new" className="btn btn-primary mt-7">
                <Sparkles className="h-4 w-4" />
                Сделать прогноз
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {predictions.map((pred) => {
                const aWins = pred.probabilityTeam1 >= pred.probabilityTeam2;
                const winner = aWins ? pred.team1 : pred.team2;
                return (
                  <Link
                    key={pred.id}
                    to={`/prediction/${pred.id}`}
                    className="card group flex flex-wrap items-center justify-between gap-4 p-5 transition hover:border-[var(--line-strong)]"
                  >
                    <div className="flex items-center gap-4">
                      <TeamMark team={pred.team1} size="md" showGlow={aWins} />
                      <span className="font-display text-2xl" style={{ color: 'var(--accent)' }}>
                        vs
                      </span>
                      <TeamMark team={pred.team2} size="md" showGlow={!aWins} />
                      <div className="ml-1">
                        <div className="font-display text-2xl uppercase">
                          {pred.team1?.abbrev} · {pred.team2?.abbrev}
                        </div>
                        <div
                          className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase text-[var(--text-3)]"
                          style={{ letterSpacing: '0.14em' }}
                        >
                          <CalendarRange className="h-3 w-3" />
                          {new Date(pred.createdAt).toLocaleString('ru-RU')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div
                          className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                          style={{ letterSpacing: '0.14em' }}
                        >
                          Выбор
                        </div>
                        <div className="mt-1 font-display text-xl">{winner?.abbrev || '—'}</div>
                      </div>
                      <div className="text-right">
                        <div
                          className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                          style={{ letterSpacing: '0.14em' }}
                        >
                          Счёт
                        </div>
                        <div className="mt-1 font-mono text-lg tab-num">
                          {pred.expectedScoreTeam1}–{pred.expectedScoreTeam2}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                          style={{ letterSpacing: '0.14em' }}
                        >
                          Уверенность
                        </div>
                        <div
                          className="mt-1 font-display text-xl"
                          style={{ color: 'var(--gold)' }}
                        >
                          {pred.confidence}%
                        </div>
                      </div>
                      <ArrowUpRight className="h-5 w-5 text-[var(--text-3)] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--accent)]" />
                    </div>

                    {/* Distribution bar */}
                    <div className="mt-3 h-1 w-full overflow-hidden rounded-sm bg-[var(--surface-3)]">
                      <div className="flex h-full">
                        <div
                          className="h-full"
                          style={{
                            width: `${pred.probabilityTeam1}%`,
                            background: pred.team1?.brandColor || 'var(--accent)',
                          }}
                        />
                        <div
                          className="h-full"
                          style={{
                            width: `${pred.probabilityTeam2}%`,
                            background: pred.team2?.brandColor || 'var(--info)',
                          }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default HistoryPage;
