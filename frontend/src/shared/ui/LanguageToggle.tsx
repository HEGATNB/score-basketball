// src/shared/ui/LanguageToggle.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/app/providers/LanguageProvider';

export const LanguageToggle = () => {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className="relative flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[rgba(255,246,229,0.03)] px-3 py-2 text-sm font-semibold transition hover:border-[rgba(232,161,67,0.22)] hover:bg-[rgba(232,161,67,0.08)]"
      title={language === 'en' ? 'Switch to Russian' : 'Переключить на английский'}
    >
      <div className="flex h-6 w-8 items-center justify-center overflow-hidden rounded-md bg-white/10">
        <AnimatePresence mode="wait" initial={false}>
          {language === 'en' ? (
            <motion.div
              key="en"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center"
            >
              <span className="text-lg">🇬🇧</span>
            </motion.div>
          ) : (
            <motion.div
              key="ru"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center"
            >
              <span className="text-lg">🇷🇺</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <span className="text-[var(--text-muted)]">
        {language === 'en' ? 'EN' : 'RU'}
      </span>
    </button>
  );
};

export default LanguageToggle;