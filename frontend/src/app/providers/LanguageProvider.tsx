import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { localisation, type Language } from '../../localisation';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(localisation.getLanguage());

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localisation.setLanguage(lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    const newLang = language === 'en' ? 'ru' : 'en';
    setLanguage(newLang);
  }, [language, setLanguage]);

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return localisation.t(key, params);
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: translate,
        toggleLanguage,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return context;
};