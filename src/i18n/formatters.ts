import type { Language } from "./types";

const localeByLanguage: Record<Language, string> = {
  en: "en-US",
  vi: "vi-VN",
};

export function formatI18nNumber(
  value: number | null | undefined,
  language: Language,
) {
  return new Intl.NumberFormat(localeByLanguage[language]).format(value ?? 0);
}

export function formatI18nCurrency(
  value: number | null | undefined,
  language: Language,
  currency = "VND",
) {
  return new Intl.NumberFormat(localeByLanguage[language], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function formatI18nDate(
  value: string | null | undefined,
  language: Language,
  fallback: string,
) {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat(localeByLanguage[language], {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatI18nDateTime(
  value: string | null | undefined,
  language: Language,
  fallback: string,
) {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat(localeByLanguage[language], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
