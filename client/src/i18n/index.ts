import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import { dynamicBackend } from './dynamic-backend';

export const defaultNS = 'translation';

// English is the single canonical source of truth for every UI string. Every
// other language is generated dynamically via the Google Cloud Translation
// API (see dynamic-backend.ts + server/services/translation.service.js)
// instead of maintaining a hand-written JSON dictionary per language.
void i18n
  .use(dynamicBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Bundling English directly means it never needs a network round trip —
    // it's also the fallback shown for other languages while their
    // translation is being fetched (or if translation ever fails).
    resources: { en: { translation: en } },
    partialBundledLanguages: true,
    fallbackLng: 'en',
    defaultNS,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'bloodnet.language',
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
