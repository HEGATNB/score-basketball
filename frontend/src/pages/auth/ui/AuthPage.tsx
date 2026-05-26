import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, Trophy, User2, Zap } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';

// Background image for the auth screen. To use a custom image instead of the
// default, drop a file into `frontend/public/auth-bg.jpg` and change this to
// `/auth-bg.jpg`.
//
// Current default: Unsplash basketball hoop photo (verified, atmospheric).
const BG_IMG =
  'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1600&q=80&auto=format&fit=crop';

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        const ok = await login(identifier, password);
        if (!ok) {
          setError('Неверный логин или пароль.');
          return;
        }
      } else {
        const ok = await register({ email, password, name });
        if (!ok) {
          setError('Не удалось зарегистрироваться.');
          return;
        }
      }
      navigate('/');
    } catch (err: any) {
      setError(err?.message || 'Ошибка авторизации.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden" style={{ background: '#06070a' }}>
      {/* Layer 1: background photo */}
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${BG_IMG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 35%',
          filter: 'saturate(1.0) contrast(1.10) brightness(0.62)',
          transform: 'scale(1.03)',
        }}
      />
      {/* Layer 2: gradient overlay — left side opaque so headline reads, right side fades to reveal photo */}
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(100deg, rgba(6,7,10,0.94) 0%, rgba(6,7,10,0.74) 32%, rgba(6,7,10,0.42) 58%, rgba(6,7,10,0.80) 100%), radial-gradient(ellipse 60% 60% at 12% 22%, rgba(255,90,31,0.20), transparent 60%)',
        }}
      />
      {/* Layer 3: subtle scanlines for cinematic texture */}
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 4px)',
          mixBlendMode: 'overlay',
        }}
      />
      {/* Layer 4: vignette */}
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 110% 85% at 50% 50%, transparent 35%, rgba(0,0,0,0.50) 100%)',
        }}
      />

      <div className="container-x relative z-10 flex min-h-screen flex-col pb-16 pt-10 lg:pb-20 lg:pt-14">
        {/* ===== HEADLINE — full width ===== */}
        <div className="mb-10 lg:mb-14">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="tag tag-hot">
              <ShieldCheck className="h-3 w-3" />
              {isLogin ? 'ВХОД В КАБИНЕТ' : 'НОВЫЙ АККАУНТ'}
            </span>
            <span className="tag">SEASON 2025/26</span>
            <span className="tag tag-gold">
              <Trophy className="h-3 w-3" />
              MODEL ACCESS
            </span>
          </div>

          <h1
            className="display-h"
            style={{ fontSize: 'clamp(56px, 9vw, 144px)', lineHeight: 0.86 }}
          >
            {isLogin ? (
              <>
                <span className="stroked-text">КАБИНЕТ</span>
                <br />
                <em>АНАЛИТИКА</em> ОТКРЫТ.
              </>
            ) : (
              <>
                <span className="stroked-text">СОЗДАЙ</span>
                <br />
                <em>ПРОФИЛЬ</em> АНАЛИТИКА.
              </>
            )}
          </h1>
        </div>

        {/* ===== MAIN GRID: Pitch (left, 2-col features) + Form (right) ===== */}
        <div className="grid flex-1 items-start gap-8 lg:grid-cols-[1.15fr_minmax(0,440px)] lg:gap-14">
          {/* ===== LEFT: Pitch with feature list ===== */}
          <div className="flex flex-col gap-7">
            <p className="max-w-[520px] text-[16px] leading-relaxed text-[var(--text-2)]">
              {isLogin
                ? 'Войди и продолжи работу с историей прогнозов, точностью модели и персональной статистикой.'
                : 'Создай профиль, чтобы сохранять прогнозы, отслеживать точность и видеть динамику решений по матчам.'}
            </p>

            {/* Vertical feature list — replaces tiny chips */}
            <div className="flex flex-col gap-3 max-w-[560px]">
              {[
                {
                  icon: <Trophy className="h-5 w-5" />,
                  lbl: 'Статус профиля',
                  desc: 'Каждый прогноз сохраняется в истории и влияет на точность, статус и прогресс.',
                },
                {
                  icon: <Zap className="h-5 w-5" />,
                  lbl: 'ИИ-аналитика',
                  desc: 'Модель разбирает форму, темп, домашнюю площадку и травмы — за тебя.',
                },
                {
                  icon: <ShieldCheck className="h-5 w-5" />,
                  lbl: 'История прогнозов',
                  desc: 'Все прогнозы сохранены. Видишь точность, серии решений и зоны для улучшения.',
                },
              ].map((p) => (
                <div
                  key={p.lbl}
                  className="card flex items-start gap-4 p-5"
                  style={{ background: 'rgba(20,20,28,0.78)', backdropFilter: 'blur(14px)' }}
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
                    style={{ background: 'rgba(255,90,31,0.14)', color: 'var(--accent)' }}
                  >
                    {p.icon}
                  </div>
                  <div className="min-w-0">
                    <div
                      className="font-mono text-[11px] uppercase text-[var(--text)]"
                      style={{ letterSpacing: '0.18em' }}
                    >
                      {p.lbl}
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-3)]">
                      {p.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ===== RIGHT: Form ===== */}
          <div
            className="card p-7 sm:p-9"
            style={{ background: 'rgba(14,14,19,0.85)', backdropFilter: 'blur(20px)' }}
          >
          {/* Tabs */}
          <div className="flex gap-1.5 rounded-pill border border-[var(--line)] bg-[var(--surface-2)] p-1">
            {([
              [true, 'Вход'],
              [false, 'Регистрация'],
            ] as const).map(([v, label]) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => {
                  setIsLogin(v);
                  setError('');
                }}
                className={`flex-1 rounded-pill px-4 py-2 text-xs font-semibold transition ${
                  isLogin === v
                    ? 'bg-[var(--accent)] text-[#0a0a0c]'
                    : 'text-[var(--text-2)] hover:text-[var(--text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <label
                  className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                  style={{ letterSpacing: '0.22em' }}
                >
                  Имя
                </label>
                <div className="relative">
                  <User2
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: 'var(--text-3)' }}
                  />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Как тебя зовут"
                    className="field pl-11"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                {isLogin ? 'Email или логин' : 'Email'}
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: 'var(--text-3)' }}
                />
                <input
                  type={isLogin ? 'text' : 'email'}
                  value={isLogin ? identifier : email}
                  onChange={(e) =>
                    isLogin ? setIdentifier(e.target.value) : setEmail(e.target.value)
                  }
                  required
                  autoComplete={isLogin ? 'username' : 'email'}
                  placeholder={isLogin ? 'you@example.com' : 'you@example.com'}
                  className="field pl-11"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                className="font-mono text-[10px] uppercase text-[var(--text-3)]"
                style={{ letterSpacing: '0.22em' }}
              >
                Пароль
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: 'var(--text-3)' }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  placeholder={isLogin ? '••••••••' : 'Минимум 6 символов'}
                  className="field pl-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition hover:text-[var(--text)]"
                  style={{ color: 'var(--text-3)' }}
                  aria-label="Показать пароль"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="rounded-md border p-3 text-[13px]"
                style={{
                  borderColor: 'rgba(255,56,88,0.3)',
                  background: 'rgba(255,56,88,0.08)',
                  color: 'var(--danger)',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center"
              style={{ padding: '14px 24px', fontSize: 14 }}
            >
              {loading ? 'Загружаем…' : isLogin ? 'Войти' : 'Создать аккаунт'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>

            <p className="text-center text-[12px] text-[var(--text-3)]">
              {isLogin ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="font-semibold transition hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                {isLogin ? 'Регистрация' : 'Вход'}
              </button>
            </p>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}
