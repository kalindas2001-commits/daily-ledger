import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import fr from './locales/fr.json';
import rw from './locales/rw.json';
import { captureTranslations } from '@/lib/capture/translations';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'rw', label: 'Kinyarwanda', flag: '🇷🇼' },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: { ...en, capture: captureTranslations.en } },
      fr: { translation: { ...fr, capture: captureTranslations.fr } },
      rw: { translation: { ...rw, capture: captureTranslations.rw } },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr', 'rw'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'cungacash_lang',
      caches: ['localStorage'],
    },
  });

export default i18n;
