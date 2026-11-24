import { useLanguage } from '@/shared/i18n';

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const next = language === 'ru' ? 'en' : 'ru';
  return (
    <button
      type="button"
      className="btn"
      onClick={() => setLanguage(next)}
      aria-label={next === 'en' ? 'Switch to English' : 'Переключить на русский'}
    >
      {next.toUpperCase()}
    </button>
  );
}
