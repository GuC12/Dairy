import { createContext, useContext } from 'react';

export type AppLang = 'ru' | 'en';

export interface LanguageContextValue {
  lang: AppLang;
  setLang: (lang: AppLang) => void;
  toggleLang: () => void;
  t: (ru: string, en: string) => string;
}

export const LanguageContext = createContext<LanguageContextValue>({
  lang: 'ru',
  setLang: () => {},
  toggleLang: () => {},
  t: (ru) => ru,
});

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
