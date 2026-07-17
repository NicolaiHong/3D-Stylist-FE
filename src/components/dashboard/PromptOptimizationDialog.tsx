import { type KeyboardEvent, useEffect, useRef } from "react";
import { Sparkles, X } from "lucide-react";
import { useI18n } from "../../i18n/useI18n";

interface PromptOptimizationDialogProps {
  isStale: boolean;
  optimizedPrompt: string;
  originalPrompt: string;
  onAccept: () => void;
  onClose: () => void;
  onKeep: () => void;
}

export function PromptOptimizationDialog({
  isStale,
  optimizedPrompt,
  originalPrompt,
  onAccept,
  onClose,
  onKeep,
}: PromptOptimizationDialogProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const keepButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;

    keepButtonRef.current?.focus();

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
      previousActiveElement?.focus();
    };
  }, [onClose]);

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") {
      return;
    }

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );

    if (!focusable?.length) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        aria-describedby="prompt-optimization-dialog-body"
        aria-labelledby="prompt-optimization-dialog-title"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[#3b494c] bg-[#141313] shadow-2xl shadow-black/35"
        ref={dialogRef}
        role="dialog"
        onKeyDown={trapFocus}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#3b494c]/70 p-5 sm:p-6">
          <div className="min-w-0">
            <p className="dashboard-label inline-flex items-center gap-2 font-bold text-[#00e5ff]">
              <Sparkles className="h-4 w-4" />
              {t("dashboard.promptOptimization.eyebrow")}
            </p>
            <h2
              className="mt-2 font-display text-[1.6rem] font-semibold leading-[1.16] text-white sm:text-3xl"
              id="prompt-optimization-dialog-title"
            >
              {t("dashboard.promptOptimization.title")}
            </h2>
            <p
              className="dashboard-helper-copy mt-2 text-[#bac9cc]"
              id="prompt-optimization-dialog-body"
            >
              {t("dashboard.promptOptimization.body")}
            </p>
          </div>
          <button
            aria-label={t("dashboard.promptOptimization.close")}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/[0.12] text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff]"
            type="button"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 p-5 sm:p-6">
          {isStale ? (
            <div
              className="rounded-md border border-[#f3bf26]/30 bg-[#f3bf26]/10 px-4 py-3 text-sm leading-6 text-[#ffeac0]"
              role="alert"
            >
              <p className="font-bold text-white">
                {t("dashboard.promptOptimization.staleTitle")}
              </p>
              <p className="mt-1">
                {t("dashboard.promptOptimization.staleBody")}
              </p>
            </div>
          ) : null}

          <section className="rounded-md border border-white/[0.1] bg-[#0e0e0e] p-4">
            <h3 className="dashboard-utility-label font-bold text-[#849396]">
              {t("dashboard.promptOptimization.original")}
            </h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#e5e2e1]">
              {originalPrompt}
            </p>
          </section>

          <section className="rounded-md border border-[#00e5ff]/25 bg-[#00e5ff]/[0.06] p-4">
            <h3 className="dashboard-utility-label font-bold text-[#9cf0ff]">
              {t("dashboard.promptOptimization.improved")}
            </h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white">
              {optimizedPrompt}
            </p>
          </section>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-[#3b494c]/70 p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff]"
            ref={keepButtonRef}
            type="button"
            onClick={onKeep}
          >
            {t("dashboard.promptOptimization.keep")}
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isStale}
            type="button"
            onClick={onAccept}
          >
            <Sparkles className="h-4 w-4" />
            {t("dashboard.promptOptimization.use")}
          </button>
        </footer>
      </div>
    </div>
  );
}
