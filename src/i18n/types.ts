export const SUPPORTED_LANGUAGES = ["en", "vi"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export type TranslationValues = Record<
  string,
  boolean | number | string | null | undefined
>;

export interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, values?: TranslationValues) => string;
}

export const DEFAULT_LANGUAGE: Language = "en";
export const LANGUAGE_STORAGE_KEY = "3d-stylist.ui-language";

export function isSupportedLanguage(value: unknown): value is Language {
  return (
    typeof value === "string" &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}
