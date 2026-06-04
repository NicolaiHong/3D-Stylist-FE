import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { I18nContext } from "./I18nContext";
import { messages } from "./messages";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  LANGUAGE_STORAGE_KEY,
} from "./types";
import type { Language, TranslationValues } from "./types";

function readInitialLanguage(): Language {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  try {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(storedLanguage)
      ? storedLanguage
      : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function interpolate(template: string, values?: TranslationValues) {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;

    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Language preference is a convenience; rendering should continue without storage.
    }
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    if (isSupportedLanguage(nextLanguage)) {
      setLanguageState(nextLanguage);
    }
  }, []);

  const t = useCallback(
    (key: string, values?: TranslationValues) => {
      const template = messages[language][key] ?? messages.en[key] ?? key;
      return interpolate(template, values);
    },
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
