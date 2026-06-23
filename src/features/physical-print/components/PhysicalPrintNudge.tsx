import { useCallback, useEffect, useState } from "react";
import { ArrowDown, Box, X } from "lucide-react";
import { useI18n } from "../../../i18n/useI18n";
import {
  markPhysicalPrintNudgeHandled,
  wasPhysicalPrintNudgeHandled,
} from "../physical-print-nudge-session";

type PhysicalPrintNudgeProps = {
  figureId: string;
  isEligible: boolean;
  onTry: () => void;
};

const PHYSICAL_PRINT_NUDGE_DELAY_MS = 20_000;

export function PhysicalPrintNudge({
  figureId,
  isEligible,
  onTry,
}: PhysicalPrintNudgeProps) {
  const { t } = useI18n();
  const [visibleFigureId, setVisibleFigureId] = useState<string | null>(null);
  const isVisible = isEligible && visibleFigureId === figureId;

  const dismiss = useCallback(() => {
    markPhysicalPrintNudgeHandled(figureId);
    setVisibleFigureId(null);
  }, [figureId]);

  useEffect(() => {
    setVisibleFigureId(null);

    if (!isEligible || wasPhysicalPrintNudgeHandled(figureId)) {
      return;
    }

    const timerFigureId = figureId;
    const timeoutId = window.setTimeout(() => {
      if (!wasPhysicalPrintNudgeHandled(timerFigureId)) {
        setVisibleFigureId(timerFigureId);
      }
    }, PHYSICAL_PRINT_NUDGE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [figureId, isEligible]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dismiss();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dismiss, isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <aside
      aria-describedby="physical-print-nudge-body"
      aria-labelledby="physical-print-nudge-title"
      aria-live="polite"
      className="physical-print-nudge overflow-hidden rounded-lg border border-[#00e5ff]/35 bg-[#0b1114]/[0.98] shadow-[0_24px_70px_rgba(0,0,0,0.48),0_0_32px_rgba(0,229,255,0.09)]"
      role="status"
    >
      <div className="h-0.5 bg-[#00e5ff]" />
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#00e5ff]/25 bg-[#00e5ff]/10 text-[#9cf0ff]">
            <Box aria-hidden="true" className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#00e5ff]">
                  {t("physicalPrint.nudge.badge")}
                </p>
                <h2
                  className="mt-1 font-display text-lg font-semibold leading-snug text-white"
                  id="physical-print-nudge-title"
                >
                  {t("physicalPrint.nudge.title")}
                </h2>
              </div>

              <button
                aria-label={t("physicalPrint.nudge.dismiss")}
                className="-mr-1 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#849396] transition hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                type="button"
                onClick={dismiss}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <p
              className="mt-2 text-sm leading-6 text-[#bac9cc]"
              id="physical-print-nudge-body"
            >
              {t("physicalPrint.nudge.body")}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#3b494c] px-3 py-2 text-sm font-bold text-[#bac9cc] transition hover:border-[#00e5ff]/35 hover:bg-[#00e5ff]/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
            type="button"
            onClick={dismiss}
          >
            {t("physicalPrint.nudge.dismiss")}
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-3 py-2 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff]"
            type="button"
            onClick={() => {
              markPhysicalPrintNudgeHandled(figureId);
              setVisibleFigureId(null);
              onTry();
            }}
          >
            {t("physicalPrint.nudge.try")}
            <ArrowDown aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
