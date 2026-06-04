import { PropsWithChildren } from "react";
import * as Sentry from "@sentry/react";
import { messages } from "../i18n/messages";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  LANGUAGE_STORAGE_KEY,
  type Language,
} from "../i18n/types";

function readErrorFallbackLanguage(): Language {
  try {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(storedLanguage)
      ? storedLanguage
      : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function ErrorFallback() {
  const language = readErrorFallbackLanguage();
  const t = (key: string) => messages[language][key] ?? messages.en[key] ?? key;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <section className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
        <h1 className="text-xl font-semibold">{t("errorBoundary.title")}</h1>
        <p className="mt-3 text-sm text-slate-400">
          {t("errorBoundary.body")}
        </p>
        <button
          className="mt-6 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          onClick={() => window.location.reload()}
          type="button"
        >
          {t("common.reloadPage")}
        </button>
      </section>
    </main>
  );
}

export function ErrorBoundary({ children }: PropsWithChildren) {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      {children}
    </Sentry.ErrorBoundary>
  );
}
