/* Interface language: Russian or English, picked in the header and kept in the browser (the browser language on first visit, Russian outside a browser); bilingual strings and records read it, and the context re-renders the app on a switch. */
import { textIn, type Language, type LocalizedText } from '@standard-model/contracts';
import { createContext, useContext } from 'react';

const STORAGE_KEY = 'standard-model-language';

function initialLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'ru';
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'ru' || stored === 'en') {
      return stored;
    }
  } catch {
    return 'ru';
  }
  return window.navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

let active: Language = initialLanguage();

export function activeLanguage(): Language {
  return active;
}

export function setActiveLanguage(language: Language): void {
  active = language;
  if (typeof window === 'undefined') {
    return;
  }
  window.document.documentElement.lang = language;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    return;
  }
}

export function say(russian: string, english: string): string {
  return active === 'en' ? english : russian;
}

export function localize(text: LocalizedText | string): string {
  return textIn(text, active);
}

export function bilingual<Key extends string>(
  entries: Readonly<Record<Key, readonly [string, string]>>,
): Readonly<Record<Key, string>> {
  const record = {} as Record<Key, string>;
  (Object.keys(entries) as Key[]).forEach((key) => {
    Object.defineProperty(record, key, {
      enumerable: true,
      get: () => {
        const [russian, english] = entries[key];
        return say(russian, english);
      },
    });
  });
  return record;
}

export const LanguageContext = createContext<Language>(active);

export function useLanguage(): Language {
  return useContext(LanguageContext);
}
