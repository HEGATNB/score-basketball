import { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';
import { GlowingCard } from './GlowingCard';

const COOKIE_CONSENT_KEY = 'cookie-consent';

export const CookieAccept = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (consent === null) {
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'declined');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-md">
      <GlowingCard glowColor="blue" className="overflow-hidden p-0">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[rgba(232,161,67,0.12)] p-2">
              <Cookie className="h-5 w-5 text-[var(--accent)]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Мы используем cookie</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Этот сайт использует файлы cookie для улучшения работы. Продолжая использовать сайт, вы соглашаетесь с их использованием.
              </p>
            </div>
            <button
              onClick={handleDecline}
              className="shrink-0 rounded-lg p-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Закрыть без согласия"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handleAccept}
              className="flex-1 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[rgba(232,161,67,0.8)]"
            >
              Принять
            </button>
            <button
              onClick={handleDecline}
              className="flex-1 rounded-xl border border-[var(--border-soft)] bg-[rgba(255,246,229,0.03)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:border-[rgba(232,161,67,0.22)] hover:bg-[rgba(232,161,67,0.06)] hover:text-white"
            >
              Отклонить
            </button>
          </div>

          <p className="mt-3 text-center text-xs text-slate-500">
            Нажимая «Принять», вы соглашаетесь с использованием cookie
          </p>
        </div>
      </GlowingCard>
    </div>
  );
};

export default CookieAccept;