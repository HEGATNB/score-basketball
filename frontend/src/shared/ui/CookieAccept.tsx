import { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import { useT } from '@/shared/i18n';

const COOKIE_CONSENT_KEY = 'cookie-consent';

export const CookieAccept = () => {
  const [isVisible, setIsVisible] = useState(false);
  const t = useT();

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (consent === null) {
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveChoice = (choice: 'accepted' | 'declined') => {
    localStorage.setItem(COOKIE_CONSENT_KEY, choice);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside className="fixed bottom-3 left-3 right-3 z-50 rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-3 shadow-xl sm:left-6 sm:right-auto sm:max-w-md sm:p-4"
      aria-label={t('cookie.title')}>
      <p className="m-0 flex items-center gap-2 text-sm text-[var(--text-2)]">
        <Cookie size={18} className="shrink-0 text-[var(--accent)]" aria-hidden="true" />
        {t('cookie.description')}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary flex-1 justify-center" onClick={() => saveChoice('declined')}>{t('cookie.decline')}</button>
        <button type="button" className="btn btn-primary flex-1 justify-center" onClick={() => saveChoice('accepted')}>{t('cookie.accept')}</button>
      </div>
    </aside>
  );
};

export default CookieAccept;
