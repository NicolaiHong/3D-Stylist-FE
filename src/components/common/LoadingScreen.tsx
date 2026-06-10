import { Loader2 } from "lucide-react";
import { useI18n } from "../../i18n/useI18n";

export function LoadingScreen() {
  const { t } = useI18n();

  return (
    <div className="atelier-grid graphite-theme relative flex min-h-screen items-center justify-center overflow-hidden px-4 text-text-primary">
      <div
        className="relative z-10 flex w-full max-w-sm flex-col items-center rounded-lg border border-border-soft bg-surface-raised p-8 text-center shadow-[0_24px_72px_rgba(0,0,0,0.28)]"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-8 w-8 animate-spin text-accent-cyan" />
        <p className="mt-4 text-sm font-semibold text-text-primary">
          {t("loading.title")}
        </p>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          {t("loading.subtitle")}
        </p>
      </div>
    </div>
  );
}
