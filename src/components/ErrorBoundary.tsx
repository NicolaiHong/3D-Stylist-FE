import { PropsWithChildren } from "react";
import * as Sentry from "@sentry/react";

export function ErrorBoundary({ children }: PropsWithChildren) {
  return (
    <Sentry.ErrorBoundary
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
          <section className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="mt-3 text-sm text-slate-400">
              Reload the page to continue. The unexpected error has been
              recorded.
            </p>
            <button
              className="mt-6 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload page
            </button>
          </section>
        </main>
      }
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
