import englishTranslations from './english.json';
import russianTranslations from './russian.json';

export type Language = 'en' | 'ru';

const translations: Record<Language, Record<string, any>> = {
  en: englishTranslations,
  ru: russianTranslations,
};

class Localisation {
  private currentLanguage: Language;

  constructor() {
    this.currentLanguage = (localStorage.getItem('language') as Language) || 'en';
  }

  setLanguage(lang: Language) {
    this.currentLanguage = lang;
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;
  }

  getLanguage(): Language {
    return this.currentLanguage;
  }

  t(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: any = translations[this.currentLanguage];

    for (const k of keys) {
      if (value === undefined || value === null) break;
      value = value[k];
    }
    if (value === undefined || value === null) {
      value = translations['en'];
      for (const k of keys) {
        if (value === undefined || value === null) break;
        value = value[k];
      }
    }

    if (typeof value === 'string' && params) {
      return value.replace(/{(\w+)}/g, (_, key) => params[key]?.toString() ?? '');
    }

    return typeof value === 'string' ? value : key;
  }
}

export const localisation = new Localisation();
export const t = localisation.t.bind(localisation);