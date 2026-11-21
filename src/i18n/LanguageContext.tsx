import React, { useCallback, useState } from 'react';
import { LanguageContext, type AppLang } from './useLanguage';

const LANG_STORAGE_KEY = 'yourdiary_app_lang';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lang, setLangState] = useState<AppLang>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      return saved === 'en' ? 'en' : 'ru';
    } catch {
      return 'ru';
    }
  });

  const setLang = useCallback((next: AppLang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next = prev === 'ru' ? 'en' : 'ru';
      try {
        localStorage.setItem(LANG_STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const t = useCallback(
    (ru: string, en: string) => (lang === 'en' ? en : ru),
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
