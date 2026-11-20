import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { readLocal, writeLocal } from '../services/supabaseClient';

/** Bahasa tampilan dashboard publik. Area admin selalu Bahasa Indonesia. */
export type Lang = 'id' | 'en';

const KEY = 'portal-cibubur:lang';

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue>({ lang: 'id', setLang: () => undefined });

export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => (readLocal<string>(KEY, 'id') === 'en' ? 'en' : 'id'));
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    writeLocal(KEY, next);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
};

export function useLang(): LangContextValue {
  return useContext(LangContext);
}

/** Tombol ID | EN di header. */
export const LangToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { lang, setLang } = useLang();
  return (
    <div
      role="group"
      aria-label="Bahasa / Language"
      translate="no"
      className={`notranslate inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-bold ${className ?? ''}`}
    >
      {(['id', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
            lang === l ? 'bg-slate-950 text-white' : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
};
