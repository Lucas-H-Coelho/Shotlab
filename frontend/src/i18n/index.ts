import { create } from 'zustand';
import { ptBR, Translations } from './pt-BR';
import { enUS } from './en-US';
import { esES } from './es-ES';

export type Locale = 'pt-BR' | 'en-US' | 'es-ES';

export interface LocaleOption {
  code: Locale;
  label: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleOption[] = [
  { code: 'pt-BR', label: 'Português', flag: 'BR' },
  { code: 'en-US', label: 'English', flag: 'US' },
  { code: 'es-ES', label: 'Español', flag: 'ES' },
];

const dictionaries: Record<Locale, Translations> = {
  'pt-BR': ptBR,
  'en-US': enUS,
  'es-ES': esES,
};

interface I18nState {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
}

const getInitialLocale = (): Locale => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('shotlab-locale') as Locale | null;
    if (saved && ['pt-BR', 'en-US', 'es-ES'].includes(saved)) {
      return saved;
    }
    // Auto-detect browser language if available
    const browserLang = navigator.language;
    if (browserLang.startsWith('en')) return 'en-US';
    if (browserLang.startsWith('es')) return 'es-ES';
  }
  return 'pt-BR';
};

const initialLocale = getInitialLocale();

export const useI18nStore = create<I18nState>((set) => ({
  locale: initialLocale,
  t: dictionaries[initialLocale],

  setLocale: (locale: Locale) => {
    localStorage.setItem('shotlab-locale', locale);
    set({
      locale,
      t: dictionaries[locale] || dictionaries['pt-BR'],
    });
  },
}));

export const useTranslation = () => {
  const { t, locale, setLocale } = useI18nStore();
  return { t, locale, setLocale };
};
