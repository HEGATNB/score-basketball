// src/pages/auth/ui/AuthPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BarChart3, Eye, EyeOff, History, Lock, Mail, ShieldCheck, User2 } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useLanguage } from '@/app/providers/LanguageProvider';
import { GlowingCard } from '@/shared/ui/GlowingCard';

const DEMO_ACCOUNTS = [
  {
    role: 'Admin',
    email: 'admin@sys.com',
    password: 'admin',
    noteKey: 'auth.adminNote',
  },
  {
    role: 'Operator',
    email: 'operator@sys.com',
    password: 'operator',
    noteKey: 'auth.operatorNote',
  },
  {
    role: 'User',
    email: 'user@sys.com',
    password: 'user',
    noteKey: 'auth.userNote',
  },
];

const ACCESS_FEATURES = [
  {
    icon: History,
    titleKey: 'feature.history',
    descriptionKey: 'feature.historyDesc',
  },
  {
    icon: BarChart3,
    titleKey: 'feature.workspace',
    descriptionKey: 'feature.workspaceDesc',
  },
  {
    icon: ShieldCheck,
    titleKey: 'feature.auth',
    descriptionKey: 'feature.authDesc',
  },
];

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const applyDemoAccount = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setIsLogin(true);
    setIdentifier(account.email);
    setPassword(account.password);
    setEmail('');
    setName('');
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const success = await login(identifier, password);
        if (!success) {
          setError(t('auth.invalidCredentials'));
          return;
        }
      } else {
        const success = await register({ email, password, name });
        if (!success) {
          setError(t('auth.registrationFailed'));
          return;
        }
      }

      navigate('/');
    } catch (submissionError: any) {
      setError(submissionError.message || t('auth.authFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <GlowingCard glowColor="blue" className="p-8 md:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="data-chip">{t('auth.accessLayer')}</span>
          <span className="data-chip">{t('auth.nodeApi')}</span>
        </div>

        <div className="mt-6 flex items-start gap-4">
          <div className="brand-mark-cool flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[rgba(214,225,235,0.72)]">{t('auth.secureWorkspace')}</p>
            <h1 className="mt-2 max-w-xl text-4xl font-semibold leading-tight text-white">
              {t('auth.title')}
            </h1>
          </div>
        </div>

        <p className="mt-6 text-base leading-7 text-slate-300">
          {t('auth.subtitle')}
        </p>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {ACCESS_FEATURES.map((feature) => (
            <div key={feature.titleKey} className="surface-muted">
              <feature.icon className="h-5 w-5 text-slate-200" />
              <p className="mt-3 text-base font-semibold text-white">{t(feature.titleKey)}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{t(feature.descriptionKey)}</p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{t('auth.demoAccounts')}</p>
              <p className="mt-2 text-sm text-slate-400">{t('auth.clickToFill')}</p>
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('auth.readyProfiles')}</p>
          </div>

          <div className="mt-4 space-y-3">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => applyDemoAccount(account)}
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-left transition hover:border-white/16 hover:bg-white/[0.05]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="status-pill">{account.role}</span>
                    <span className="text-sm text-slate-500">{account.email}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{t(account.noteKey)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{t('auth.useDemo')}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{account.password}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </GlowingCard>

      <GlowingCard glowColor="orange" className="p-8 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[rgba(236,216,171,0.72)]">{t('auth.workspaceGate')}</p>
            <h2 className="mt-2 font-spacegrotesk text-4xl font-bold text-white">
              {isLogin ? t('auth.signInContinue') : t('auth.createAccount')}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
              {isLogin
                ? t('auth.signInHint')
                : t('auth.registerHint')}
            </p>
          </div>

          <div className="segmented-bar">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setError('');
              }}
              className={`segmented-item ${isLogin ? 'segmented-item-active' : ''}`}
            >
              {t('auth.signIn')}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setError('');
              }}
              className={`segmented-item ${!isLogin ? 'segmented-item-active' : ''}`}
            >
              {t('auth.register')}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <AnimatePresence initial={false}>
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <label className="text-sm font-medium text-slate-300">{t('auth.fullName')}</label>
                <div className="relative">
                  <User2 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required={!isLogin}
                      autoComplete="name"
                      placeholder="Alexey Analyst"
                      className="field-shell py-3 pl-4 pr-4"
                      style={{ textIndent: '26px' }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">{isLogin ? t('auth.emailOrLogin') : t('auth.email')}</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                  type={isLogin ? 'text' : 'email'}
                  value={isLogin ? identifier : email}
                  onChange={(event) => (isLogin ? setIdentifier(event.target.value) : setEmail(event.target.value))}
                  required
                  autoComplete={isLogin ? 'username' : 'email'}
                  placeholder={isLogin ? 'admin@sys.com or admin' : 'alex@example.com'}
                  className="field-shell py-3 pl-4 pr-4"
                  style={{ textIndent: '26px' }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">{t('auth.password')}</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  placeholder={isLogin ? t('auth.enterPassword') : t('auth.createPassword')}
                  className="field-shell py-3 pl-4 pr-12"
                  style={{ textIndent: '26px' }}
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-white"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? t('auth.processing') : isLogin ? t('auth.enterWorkspace') : t('auth.createAndContinue')}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>

          <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4 text-sm leading-6 text-slate-400">
            {isLogin
              ? t('auth.demoHint')
              : t('auth.newAccountHint')}
          </div>
        </form>
      </GlowingCard>
    </div>
  );
}