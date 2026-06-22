import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  ExternalLink,
  ImageIcon,
  LockKeyhole,
  Palette,
  RefreshCw,
  Rotate3D,
  Sparkles,
} from "lucide-react";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { billingApi } from "../features/billing/billing.api";
import type { BillingSummary } from "../features/billing/billing.types";
import { figuresApi } from "../features/figures/figures.api";
import type {
  FigureDto,
  FigureStatus,
} from "../features/figures/figures.types";
import { PhysicalPrintSection } from "../features/physical-print/components/PhysicalPrintSection";
import { getApiErrorMessage } from "../services/apiClient";
import { getDisplayLabel } from "../i18n/displayMaps";
import { formatI18nDateTime } from "../i18n/formatters";
import { useI18n } from "../i18n/useI18n";

const STUDIO_POLL_INTERVAL_MS = 3000;
const STUDIO_POLL_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_VARIATION_INSTRUCTION_LENGTH = 600;
const MAX_PREVIEW_VARIATION_INSTRUCTION_LENGTH = 1000;
const MAX_RETEXTURE_INSTRUCTION_LENGTH = 600;
type StudioViewMode = "2d" | "3d";
type ReadinessState = "ready" | "pending" | "unavailable";

const StudioModelViewer = lazy(
  () => import("../components/studio/StudioModelViewer"),
);

function isPollingStatus(status: FigureStatus) {
  return status === "queued" || status === "processing";
}

function getPreviewUrl(figure: FigureDto) {
  return figure.previewUrl || figure.thumbnailUrl || null;
}

function getPromptSnippet(
  prompt: string | null | undefined,
  limit = 62,
  fallback = "",
) {
  const value = prompt?.trim() || fallback;

  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function getBasePrompt(prompt: string | null | undefined, fallback: string) {
  const value = prompt?.trim();

  if (!value) {
    return fallback;
  }

  return value.split(/\n\n(?=Style direction:|Model source:)/i)[0].trim();
}

function getStyleDirection(prompt: string | null | undefined) {
  const match = prompt?.match(/(?:^|\n)Style direction:\s*(.+?)(?:\n|$)/i);

  return match?.[1]?.trim() || null;
}

function getStatusTone(status: FigureStatus) {
  if (status === "success") {
    return "border-[#2cebcf]/35 bg-[#2cebcf]/10 text-[#c9fff6]";
  }

  if (status === "failed" || status === "canceled") {
    return "border-[#ffb4ab]/30 bg-[#93000a]/25 text-[#ffdad6]";
  }

  return "border-[#00e5ff]/30 bg-[#00e5ff]/10 text-[#9cf0ff]";
}

function FigureStatusBadge({ status }: { status: FigureStatus }) {
  const { language } = useI18n();

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] ${getStatusTone(
        status,
      )}`}
    >
      {isPollingStatus(status) ? <Clock3 className="h-3.5 w-3.5" /> : null}
      {getDisplayLabel("figureStatus", status, language)}
    </span>
  );
}

function getPreviewReadinessState(figure: FigureDto): ReadinessState {
  if (getPreviewUrl(figure)) {
    return "ready";
  }

  return isPollingStatus(figure.status) ? "pending" : "unavailable";
}

function getModelReadinessState(figure: FigureDto): ReadinessState {
  if (figure.modelAssetReady) {
    return "ready";
  }

  return isPollingStatus(figure.status) ? "pending" : "unavailable";
}

function ReadinessPill({
  label,
  state,
  compact = false,
}: {
  label: string;
  state: ReadinessState;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const stateLabel =
    state === "ready"
      ? t("common.ready")
      : state === "pending"
        ? t("common.pending")
        : t("common.unavailable");
  const tone =
    state === "ready"
      ? "border-[#2cebcf]/25 bg-[#2cebcf]/10 text-[#c9fff6]"
      : state === "pending"
        ? "border-[#f3bf26]/25 bg-[#f3bf26]/10 text-[#ffeac0]"
        : "border-white/10 bg-white/[0.035] text-[#849396]";

  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 py-1 font-bold uppercase tracking-[0.1em] ${
        compact ? "text-[0.64rem]" : "text-[0.68rem]"
      } ${tone}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          state === "ready"
            ? "bg-[#2cebcf]"
            : state === "pending"
              ? "bg-[#f3bf26]"
              : "bg-[#849396]"
        }`}
      />
      <span>{label}</span>
      <span
        className={
          compact
            ? "sr-only sm:not-sr-only sm:text-current/70"
            : "text-current/70"
        }
      >
        {stateLabel}
      </span>
    </span>
  );
}

function StudioViewModeControl({
  viewMode,
  onChange,
}: {
  viewMode: StudioViewMode;
  onChange: (mode: StudioViewMode) => void;
}) {
  const { t } = useI18n();

  return (
    <div
      aria-label={t("studio.viewModeAria")}
      className="grid shrink-0 grid-cols-2 rounded-lg bg-[#0a0a0a]/80 p-1 ring-1 ring-white/10"
      role="group"
    >
      <button
        aria-pressed={viewMode === "2d"}
        className={`min-h-11 rounded-md px-3 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] ${
          viewMode === "2d"
            ? "bg-[#00e5ff] text-[#001f24]"
            : "text-[#bac9cc] hover:text-white"
        }`}
        type="button"
        onClick={() => onChange("2d")}
      >
        {t("studio.view.2d")}
      </button>
      <button
        aria-pressed={viewMode === "3d"}
        className={`min-h-11 rounded-md px-3 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] ${
          viewMode === "3d"
            ? "bg-[#00e5ff] text-[#001f24]"
            : "text-[#bac9cc] hover:text-white"
        }`}
        type="button"
        onClick={() => onChange("3d")}
      >
        {t("studio.view.3d")}
      </button>
    </div>
  );
}

function FigureSelector({
  figures,
  selectedFigure,
  onSelect,
}: {
  figures: FigureDto[];
  selectedFigure: FigureDto | null;
  onSelect: (figureId: string) => void;
}) {
  const { language, t } = useI18n();
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeFigureId, setActiveFigureId] = useState<string | null>(
    selectedFigure?.id ?? null,
  );
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isDisabled = figures.length === 0;
  const selectedPreviewUrl = selectedFigure
    ? getPreviewUrl(selectedFigure)
    : null;

  const openListbox = useCallback(() => {
    if (isDisabled) {
      return;
    }

    setActiveFigureId(selectedFigure?.id ?? figures[0].id);
    setIsOpen(true);
  }, [figures, isDisabled, selectedFigure]);

  const closeListbox = useCallback(() => {
    setIsOpen(false);
  }, []);

  const focusFigure = useCallback((figureId: string | null) => {
    if (!figureId) {
      return;
    }

    setActiveFigureId(figureId);
  }, []);

  const moveActiveFigure = useCallback(
    (offset: number) => {
      if (figures.length === 0) {
        return;
      }

      const currentIndex = Math.max(
        0,
        figures.findIndex((figure) => figure.id === activeFigureId),
      );
      const nextIndex =
        (currentIndex + offset + figures.length) % figures.length;

      focusFigure(figures[nextIndex].id);
    },
    [activeFigureId, figures, focusFigure],
  );

  const selectFigure = useCallback(
    (figureId: string) => {
      onSelect(figureId);
      closeListbox();
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    },
    [closeListbox, onSelect],
  );

  useEffect(() => {
    if (!isOpen || !activeFigureId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      optionRefs.current[activeFigureId]?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeFigureId, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        closeListbox();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [closeListbox, isOpen]);

  function handleButtonKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) {
    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openListbox();
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveFigureId(figures[figures.length - 1]?.id ?? null);
      setIsOpen(true);
    }

    if (event.key === "Escape") {
      closeListbox();
    }
  }

  function handleListboxKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeListbox();
      buttonRef.current?.focus();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveFigure(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveFigure(-1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusFigure(figures[0]?.id ?? null);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusFigure(figures[figures.length - 1]?.id ?? null);
      return;
    }

    if ((event.key === "Enter" || event.key === " ") && activeFigureId) {
      event.preventDefault();
      selectFigure(activeFigureId);
    }
  }

  return (
    <div
      className="min-w-0 border-t border-[#3b494c]/45 bg-[#0d1214]/88 p-3 sm:p-4"
      ref={wrapperRef}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget as Node | null;

        if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
          closeListbox();
        }
      }}
    >
      <button
        aria-controls={listboxId}
        aria-disabled={isDisabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={t("studio.selector.open")}
        className="flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-md bg-[#0a0a0a]/70 px-3 py-2 text-left ring-1 ring-white/10 transition hover:bg-[#121719] hover:ring-[#00e5ff]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isDisabled}
        ref={buttonRef}
        type="button"
        onClick={() => (isOpen ? closeListbox() : openListbox())}
        onKeyDown={handleButtonKeyDown}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-[#0a0a0a]">
          {selectedPreviewUrl ? (
            <img
              alt=""
              className="h-full w-full object-cover"
              src={selectedPreviewUrl}
            />
          ) : (
            <ImageIcon className="h-5 w-5 text-[#3b494c]" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#9aa8aa]">
            {t("studio.selector.current")}
          </span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-[#e5e2e1]">
            {selectedFigure
              ? getPromptSnippet(
                  selectedFigure.prompt,
                  86,
                  t("dashboard.figure.untitled"),
                )
              : t("studio.noGenerationsOption")}
          </span>
          {selectedFigure ? (
            <span className="mt-2 flex flex-wrap gap-1.5">
              <ReadinessPill
                compact
                label="IMG"
                state={getPreviewReadinessState(selectedFigure)}
              />
              <ReadinessPill
                compact
                label="GLB"
                state={getModelReadinessState(selectedFigure)}
              />
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#9cf0ff] transition ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen ? (
        <div
          aria-label={t("studio.selector.list")}
          className="internal-scroll-region mt-3 grid max-h-[26rem] grid-cols-1 gap-1 overflow-y-auto overscroll-contain rounded-lg border border-[#3b494c]/55 bg-[#111719] p-1.5 pr-2 sm:grid-cols-2"
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          onKeyDown={handleListboxKeyDown}
        >
          {figures.map((figure) => {
            const previewUrl = getPreviewUrl(figure);
            const isSelected = figure.id === selectedFigure?.id;
            const isActive = figure.id === activeFigureId;

            return (
              <button
                aria-selected={isSelected}
                className={`flex min-h-20 w-full min-w-0 items-center gap-3 rounded-md px-2.5 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] ${
                  isActive
                    ? "bg-[#00e5ff]/10"
                    : "hover:bg-white/[0.045]"
                }`}
                key={figure.id}
                ref={(node) => {
                  optionRefs.current[figure.id] = node;
                }}
                role="option"
                tabIndex={isActive ? 0 : -1}
                type="button"
                onClick={() => selectFigure(figure.id)}
                onMouseEnter={() => setActiveFigureId(figure.id)}
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-[#0a0a0a]">
                  {previewUrl ? (
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      src={previewUrl}
                    />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-[#3b494c]" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-white">
                    {getPromptSnippet(
                      figure.prompt,
                      74,
                      t("dashboard.figure.untitled"),
                    )}
                  </span>
                  <span className="mt-1 block truncate text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#849396]">
                    {formatI18nDateTime(
                      figure.createdAt,
                      language,
                      t("common.unknown"),
                    )}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    <ReadinessPill
                      compact
                      label="IMG"
                      state={getPreviewReadinessState(figure)}
                    />
                    <ReadinessPill
                      compact
                      label="GLB"
                      state={getModelReadinessState(figure)}
                    />
                  </span>
                </span>
                {isSelected ? (
                  <Check className="h-4 w-4 shrink-0 text-[#00e5ff]" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function StudioCommandSurface({
  selectedFigure,
  viewMode,
  canExportModel,
  canDownloadModel,
  onViewModeChange,
}: {
  selectedFigure: FigureDto;
  viewMode: StudioViewMode;
  canExportModel: boolean;
  canDownloadModel: boolean;
  onViewModeChange: (mode: StudioViewMode) => void;
}) {
  const { t } = useI18n();
  const isExportRestricted = !canExportModel && !canDownloadModel;

  return (
    <section className="relative z-30 border-b border-[#3b494c]/45 bg-[#121719]/95 px-3 py-3 sm:px-4">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StudioViewModeControl
          viewMode={viewMode}
          onChange={onViewModeChange}
        />

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <FigureStatusBadge status={selectedFigure.status} />
          <div
            aria-label={t("studio.assetReadiness")}
            className="flex flex-wrap gap-1.5"
          >
            <ReadinessPill
              compact
              label="2D"
              state={getPreviewReadinessState(selectedFigure)}
            />
            <ReadinessPill
              compact
              label="3D"
              state={getModelReadinessState(selectedFigure)}
            />
          </div>
          {viewMode === "3d" ? (
            <span className="inline-flex min-h-8 items-center gap-2 rounded-md bg-[#0a0a0a]/55 px-2.5 py-1 text-[0.68rem] font-semibold text-[#bac9cc] ring-1 ring-white/10">
              <Rotate3D className="h-3.5 w-3.5 text-[#00e5ff]" />
              {t("studio.viewer.interaction")}
            </span>
          ) : null}

          {viewMode === "3d" && isExportRestricted ? (
            <span className="inline-flex min-h-8 items-center gap-2 rounded-md bg-[#f3bf26]/10 px-2.5 py-1 text-[0.68rem] font-semibold text-[#ffeac0] ring-1 ring-[#f3bf26]/25">
              <LockKeyhole className="h-3.5 w-3.5" />
              {t("studio.exportRestricted")}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function StudioMetadataPanel({
  isCreatingPreviewVariation,
  isRegenerating,
  isRetexturing,
  previewVariationError,
  previewVariationInstruction,
  regenerationError,
  retextureError,
  retextureInstruction,
  retextureSucceeded,
  selectedFigure,
  summary,
  variationInstruction,
  onCreatePreviewVariation,
  onPreviewVariationInstructionChange,
  onRegenerate,
  onRetexture,
  onRetextureInstructionChange,
  onVariationInstructionChange,
}: {
  isCreatingPreviewVariation: boolean;
  isRegenerating: boolean;
  isRetexturing: boolean;
  previewVariationError: string | null;
  previewVariationInstruction: string;
  regenerationError: string | null;
  retextureError: string | null;
  retextureInstruction: string;
  retextureSucceeded: boolean;
  selectedFigure: FigureDto;
  summary: BillingSummary | null;
  variationInstruction: string;
  onCreatePreviewVariation: () => void;
  onPreviewVariationInstructionChange: (value: string) => void;
  onRegenerate: () => void;
  onRetexture: () => void;
  onRetextureInstructionChange: (value: string) => void;
  onVariationInstructionChange: (value: string) => void;
}) {
  const { language, t } = useI18n();
  const hasModelAccess =
    summary?.capabilities.canExportModel === true ||
    summary?.capabilities.canDownloadModel === true;
  const exportModelUrl = selectedFigure.modelUrl ?? null;
  const canOpenExport =
    summary?.capabilities.canExportModel === true && Boolean(exportModelUrl);
  const canDownloadExport =
    summary?.capabilities.canDownloadModel === true && Boolean(exportModelUrl);
  const canRegenerate =
    selectedFigure.status === "success" &&
    Boolean(selectedFigure.prompt?.trim());
  const canCreatePreviewVariation =
    selectedFigure.status === "success" && Boolean(selectedFigure.previewUrl);
  const canRetexture =
    selectedFigure.status === "success" &&
    selectedFigure.modelAssetReady === true;
  const isCreatingChild =
    isRegenerating || isCreatingPreviewVariation || isRetexturing;
  const isVariationInstructionTooLong =
    variationInstruction.length > MAX_VARIATION_INSTRUCTION_LENGTH;
  const isPreviewVariationInstructionTooLong =
    previewVariationInstruction.length >
    MAX_PREVIEW_VARIATION_INSTRUCTION_LENGTH;
  const isRetextureInstructionTooLong =
    retextureInstruction.length > MAX_RETEXTURE_INSTRUCTION_LENGTH;
  const isRetextureInstructionEmpty = !retextureInstruction.trim();

  return (
    <aside className="studio-metadata-panel internal-scroll-region min-h-0 min-w-0 max-w-full self-start rounded-lg border border-[#3b494c]/60 bg-[#111619]/88 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
      <section className="min-w-0">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#bac9cc]">
          {t("studio.metadata")}
        </h2>
        <dl className="mt-3 text-sm">
          <div className="pb-4">
            <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
              {t("dashboard.figure.prompt")}
            </dt>
            <dd className="mt-1 break-words text-sm leading-6 text-[#e5e2e1]">
              {getBasePrompt(
                selectedFigure.prompt,
                t("dashboard.figure.untitled"),
              )}
            </dd>
          </div>
          <div className="border-t border-[#3b494c]/35 py-4">
            <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
              {t("studio.styleDirection")}
            </dt>
            <dd className="mt-1 break-words text-sm leading-6 text-[#e5e2e1]">
              {getStyleDirection(selectedFigure.prompt) ??
                t("studio.notSpecified")}
            </dd>
          </div>
          <div className="border-t border-[#3b494c]/35 py-3">
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
                {t("studio.status")}
              </dt>
              <dd className="min-w-0 text-right">
                <FigureStatusBadge status={selectedFigure.status} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
                {t("studio.provider")}
              </dt>
              <dd className="min-w-0 truncate text-right font-mono text-xs text-[#e5e2e1]">
                {selectedFigure.provider ?? t("studio.notReported")}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
                {t("dashboard.figure.created")}
              </dt>
              <dd className="min-w-0 truncate text-right text-xs text-[#e5e2e1]">
                {formatI18nDateTime(
                  selectedFigure.createdAt,
                  language,
                  t("common.unknown"),
                )}
              </dd>
            </div>
          </div>
        </dl>
      </section>

      <section className="border-t border-[#3b494c]/35 pt-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#bac9cc]">
          {t("studio.assetManifest")}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <ReadinessPill
            label={t("studio.masterImage")}
            state={getPreviewReadinessState(selectedFigure)}
          />
          <ReadinessPill
            label={t("studio.geometry")}
            state={getModelReadinessState(selectedFigure)}
          />
        </div>
      </section>

      {canRegenerate ? (
        <section className="mt-4 border-t border-[#3b494c]/35 pt-4">
          <div className="flex gap-3 text-xs leading-5">
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-[#00e5ff]/85" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-white">
                {t("studio.regenerate.title")}
              </h2>
              <p className="mt-2 text-xs leading-5 text-[#bac9cc]">
                {t("studio.regenerate.body")}
              </p>
              <label
                className="mt-3 block text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]"
                htmlFor="studio-regenerate-prompt"
              >
                {t("studio.regenerate.promptLabel")}
              </label>
              <textarea
                className="mt-2 min-h-28 w-full resize-y rounded-md border border-[#3b494c] bg-[#0a0a0a]/70 px-3 py-2 text-sm leading-6 text-[#e5e2e1] outline-none transition placeholder:text-[#849396] focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isCreatingChild}
                id="studio-regenerate-prompt"
                maxLength={MAX_VARIATION_INSTRUCTION_LENGTH + 1}
                value={variationInstruction}
                onChange={(event) =>
                  onVariationInstructionChange(event.target.value)
                }
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[0.68rem] font-semibold">
                <span className="text-[#849396]">
                  {t("studio.regenerate.costNotice")}
                </span>
                <span
                  className={
                    isVariationInstructionTooLong
                      ? "text-[#ffb4ab]"
                      : "text-[#849396]"
                  }
                >
                  {t("studio.regenerate.promptCount", {
                    count: variationInstruction.length,
                    max: MAX_VARIATION_INSTRUCTION_LENGTH,
                  })}
                </span>
              </div>
              {regenerationError ? (
                <p
                  className="mt-3 rounded-md border border-[#ffb4ab]/30 bg-[#93000a]/20 px-3 py-2 text-xs leading-5 text-[#ffdad6]"
                  role="alert"
                >
                  {regenerationError}
                </p>
              ) : null}
              <button
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  isCreatingChild || isVariationInstructionTooLong
                }
                type="button"
                onClick={onRegenerate}
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    isRegenerating ? "animate-spin" : ""
                  }`}
                />
                {isRegenerating
                  ? t("studio.regenerate.starting")
                  : t("studio.regenerate.action")}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {canCreatePreviewVariation ? (
        <section className="mt-4 border-t border-[#3b494c]/35 pt-4">
          <div className="flex gap-3 text-xs leading-5">
            <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#00e5ff]/85" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-white">
                {t("studio.previewVariation.title")}
              </h2>
              <p className="mt-2 text-xs leading-5 text-[#bac9cc]">
                {t("studio.previewVariation.body")}
              </p>
              <label
                className="mt-3 block text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]"
                htmlFor="studio-preview-variation-instruction"
              >
                {t("studio.previewVariation.instructionLabel")}
              </label>
              <textarea
                className="mt-2 min-h-24 w-full resize-y rounded-md border border-[#3b494c] bg-[#0a0a0a]/70 px-3 py-2 text-sm leading-6 text-[#e5e2e1] outline-none transition placeholder:text-[#849396] focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isCreatingChild}
                id="studio-preview-variation-instruction"
                maxLength={MAX_PREVIEW_VARIATION_INSTRUCTION_LENGTH + 1}
                value={previewVariationInstruction}
                onChange={(event) =>
                  onPreviewVariationInstructionChange(event.target.value)
                }
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[0.68rem] font-semibold">
                <span className="text-[#849396]">
                  {t("studio.previewVariation.instructionHelp")}
                </span>
                <span
                  className={
                    isPreviewVariationInstructionTooLong
                      ? "text-[#ffb4ab]"
                      : "text-[#849396]"
                  }
                >
                  {t("studio.previewVariation.instructionCount", {
                    count: previewVariationInstruction.length,
                    max: MAX_PREVIEW_VARIATION_INSTRUCTION_LENGTH,
                  })}
                </span>
              </div>
              {previewVariationError ? (
                <p
                  className="mt-3 rounded-md border border-[#ffb4ab]/30 bg-[#93000a]/20 px-3 py-2 text-xs leading-5 text-[#ffdad6]"
                  role="alert"
                >
                  {previewVariationError}
                </p>
              ) : null}
              <button
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-[#00e5ff]/45 bg-[#00e5ff]/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#9cf0ff] transition hover:bg-[#00e5ff]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  isCreatingChild || isPreviewVariationInstructionTooLong
                }
                type="button"
                onClick={onCreatePreviewVariation}
              >
                <ImageIcon className="h-4 w-4" />
                {isCreatingPreviewVariation
                  ? t("studio.previewVariation.starting")
                  : t("studio.previewVariation.action")}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {canRetexture ? (
        <section className="mt-4 border-t border-[#3b494c]/35 pt-4">
          <div className="flex gap-3 text-xs leading-5">
            <Palette className="mt-0.5 h-4 w-4 shrink-0 text-[#00e5ff]/85" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-white">
                {t("studio.retexture.title")}
              </h2>
              <p className="mt-2 text-xs leading-5 text-[#bac9cc]">
                {t("studio.retexture.body")}
              </p>
              <label
                className="mt-3 block text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]"
                htmlFor="studio-retexture-instruction"
              >
                {t("studio.retexture.instructionLabel")}
              </label>
              <textarea
                className="mt-2 min-h-24 w-full resize-y rounded-md border border-[#3b494c] bg-[#0a0a0a]/70 px-3 py-2 text-sm leading-6 text-[#e5e2e1] outline-none transition placeholder:text-[#849396] focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isCreatingChild}
                id="studio-retexture-instruction"
                maxLength={MAX_RETEXTURE_INSTRUCTION_LENGTH + 1}
                value={retextureInstruction}
                onChange={(event) =>
                  onRetextureInstructionChange(event.target.value)
                }
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[0.68rem] font-semibold">
                <span className="text-[#849396]">
                  {t("studio.retexture.instructionHelp")}
                </span>
                <span
                  className={
                    isRetextureInstructionTooLong
                      ? "text-[#ffb4ab]"
                      : "text-[#849396]"
                  }
                >
                  {t("studio.retexture.instructionCount", {
                    count: retextureInstruction.length,
                    max: MAX_RETEXTURE_INSTRUCTION_LENGTH,
                  })}
                </span>
              </div>
              {retextureError ? (
                <p
                  className="mt-3 rounded-md border border-[#ffb4ab]/30 bg-[#93000a]/20 px-3 py-2 text-xs leading-5 text-[#ffdad6]"
                  role="alert"
                >
                  {retextureError}
                </p>
              ) : null}
              {retextureSucceeded ? (
                <p
                  className="mt-3 rounded-md border border-[#2cebcf]/30 bg-[#2cebcf]/10 px-3 py-2 text-xs leading-5 text-[#c9fff6]"
                  role="status"
                >
                  {t("studio.retexture.success")}
                </p>
              ) : null}
              <button
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-[#00e5ff]/45 bg-[#00e5ff]/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#9cf0ff] transition hover:bg-[#00e5ff]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  isCreatingChild ||
                  isRetextureInstructionEmpty ||
                  isRetextureInstructionTooLong
                }
                type="button"
                onClick={onRetexture}
              >
                <Palette
                  className={`h-4 w-4 ${isRetexturing ? "animate-pulse" : ""}`}
                />
                {isRetexturing
                  ? t("studio.retexture.starting")
                  : t("studio.retexture.action")}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-4 border-t border-[#3b494c]/35 pt-4">
        <div className="flex gap-3 text-xs leading-5">
          {hasModelAccess ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2cebcf]/80" />
          ) : (
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#f3bf26]/80" />
          )}
          <div className="min-w-0">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-white">
              {hasModelAccess
                ? t("studio.exportAvailable")
                : t("studio.exportRestricted")}
            </h2>
            <p className="mt-2 text-xs leading-5 text-[#bac9cc]">
              {hasModelAccess
                ? t("studio.exportAvailableBody")
                : t("studio.exportRestrictedBody")}
            </p>
            {!hasModelAccess ? (
              <Link
                className="mt-3 inline-flex min-h-9 items-center justify-center rounded-md border border-[#f3bf26]/35 px-3 py-2 text-[0.68rem] font-bold uppercase tracking-wide text-[#ffeac0] transition hover:bg-[#f3bf26]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffdf96]"
                to="/credits"
              >
                {t("landing.viewPlans")}
              </Link>
            ) : null}
            {canOpenExport || canDownloadExport ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {canOpenExport && exportModelUrl ? (
                  <a
                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-3 py-2 text-xs font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
                    href={exportModelUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {t("studio.openGlb")}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
                {canDownloadExport && exportModelUrl ? (
                  <a
                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 bg-[#0a0a0a]/70 px-3 py-2 text-xs font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                    download
                    href={exportModelUrl}
                  >
                    {t("studio.downloadGlb")}
                    <Download className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </aside>
  );
}

function StudioEmptyState() {
  const { t } = useI18n();

  return (
    <section className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-[#3b494c] bg-[#121212] p-8 text-center">
      <Sparkles className="h-9 w-9 text-[#3b494c]" />
      <h2 className="mt-4 font-display text-2xl font-semibold text-white">
        {t("studio.empty.title")}
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-[#bac9cc]">
        {t("studio.empty.body")}
      </p>
      <Link
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
        to="/dashboard"
      >
        {t("studio.empty.goDashboard")}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

function StudioPreview({
  figure,
  viewMode,
  onShow2d,
}: {
  figure: FigureDto;
  viewMode: StudioViewMode;
  onShow2d: () => void;
}) {
  const { t } = useI18n();
  const previewUrl = getPreviewUrl(figure);
  const modelAssetReady = figure.modelAssetReady === true;
  const promptSnippet = getPromptSnippet(
    figure.prompt,
    62,
    t("dashboard.figure.untitled"),
  );

  if (viewMode === "2d") {
    return previewUrl ? (
      <img
        alt={promptSnippet}
        className="h-full max-h-full w-full max-w-full object-contain"
        src={previewUrl}
      />
    ) : (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-8 text-center">
        <ImageIcon className="h-12 w-12 text-[#3b494c]" />
        <h3 className="mt-4 font-display text-2xl font-semibold text-white">
          {t("studio.preview2dPending")}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#bac9cc]">
          {t("studio.preview2dPendingBody")}
        </p>
      </div>
    );
  }

  if (!modelAssetReady) {
    const isPending = isPollingStatus(figure.status);

    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-8 text-center">
        <Box className="h-12 w-12 text-[#3b494c]" />
        <h3 className="mt-4 font-display text-2xl font-semibold text-white">
          {isPending
            ? t("studio.modelPending")
            : t("studio.modelUnavailable")}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#bac9cc]">
          {isPending
            ? t("studio.modelPendingBody")
            : t("studio.modelUnavailableBody")}
        </p>
      </div>
    );
  }

  if (!figure.modelViewerUrl) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-8 text-center">
        <Box className="h-12 w-12 text-[#3b494c]" />
        <h3 className="mt-4 font-display text-2xl font-semibold text-white">
          {t("studio.viewer.unavailable")}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#bac9cc]">
          {t("studio.viewer.unavailableBody")}
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full">
      <Suspense
        fallback={
          <div
            aria-live="polite"
            className="flex h-full min-h-0 items-center justify-center p-8 text-center text-sm font-semibold text-[#c3f5ff]"
            role="status"
          >
            {t("studio.viewer.loading")}
          </div>
        }
      >
        <StudioModelViewer
          modelUrl={figure.modelViewerUrl}
          onShow2d={onShow2d}
        />
      </Suspense>
    </div>
  );
}

export function StudioPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFigureId = searchParams.get("figureId");
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [figures, setFigures] = useState<FigureDto[]>([]);
  const [selectedFigureId, setSelectedFigureId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<StudioViewMode>("2d");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isCreatingPreviewVariation, setIsCreatingPreviewVariation] =
    useState(false);
  const [isRetexturing, setIsRetexturing] = useState(false);
  const [variationInstruction, setVariationInstruction] = useState("");
  const [previewVariationInstruction, setPreviewVariationInstruction] =
    useState("");
  const [retextureInstruction, setRetextureInstruction] = useState("");
  const [regenerationError, setRegenerationError] = useState<string | null>(
    null,
  );
  const [previewVariationError, setPreviewVariationError] = useState<
    string | null
  >(null);
  const [retextureError, setRetextureError] = useState<string | null>(null);
  const [retextureSuccessFigureId, setRetextureSuccessFigureId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const pollingStartedAtRef = useRef<number | null>(null);
  const pollingFigureIdRef = useRef<string | null>(null);

  const selectedFigure = useMemo(
    () => figures.find((figure) => figure.id === selectedFigureId) ?? null,
    [figures, selectedFigureId],
  );

  const loadFigures = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const result = await figuresApi.listFigures({ limit: 12 });

      if (isMountedRef.current) {
        setFigures(result.figures);
      }
    } catch (loadError) {
      if (isMountedRef.current) {
        setError(getApiErrorMessage(loadError));
      }
    } finally {
      if (showLoading && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const loadBillingSummary = useCallback(async () => {
    try {
      const billingSummary = await billingApi.getBillingMe();

      if (isMountedRef.current) {
        setSummary(billingSummary);
      }
    } catch {
      if (isMountedRef.current) {
        setSummary(null);
      }
    }
  }, []);

  const refreshSelectedFigure = useCallback(
    async (showRefreshing = true) => {
      if (!selectedFigureId) {
        return;
      }

      if (showRefreshing) {
        setIsRefreshing(true);
      }

      try {
        const updatedFigure =
          await figuresApi.getFigureStatus(selectedFigureId);

        if (isMountedRef.current) {
          setFigures((currentFigures) =>
            currentFigures.map((figure) =>
              figure.id === updatedFigure.id ? updatedFigure : figure,
            ),
          );
        }
      } catch (refreshError) {
        if (isMountedRef.current) {
          setError(getApiErrorMessage(refreshError));
        }
      } finally {
        if (showRefreshing && isMountedRef.current) {
          setIsRefreshing(false);
        }
      }
    },
    [selectedFigureId],
  );

  useEffect(() => {
    isMountedRef.current = true;
    void loadFigures();
    void loadBillingSummary();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadBillingSummary, loadFigures]);

  useEffect(() => {
    if (figures.length === 0) {
      setSelectedFigureId(null);
      return;
    }

    setSelectedFigureId((currentId) => {
      if (
        requestedFigureId &&
        figures.some((figure) => figure.id === requestedFigureId)
      ) {
        return requestedFigureId;
      }

      if (currentId && figures.some((figure) => figure.id === currentId)) {
        return currentId;
      }

      return figures[0].id;
    });
  }, [figures, requestedFigureId]);

  useEffect(() => {
    if (!selectedFigure || !isPollingStatus(selectedFigure.status)) {
      pollingStartedAtRef.current = null;
      pollingFigureIdRef.current = null;
      return;
    }

    if (pollingFigureIdRef.current !== selectedFigure.id) {
      pollingFigureIdRef.current = selectedFigure.id;
      pollingStartedAtRef.current = Date.now();
    }

    const intervalId = window.setInterval(() => {
      const startedAt = pollingStartedAtRef.current ?? Date.now();

      if (Date.now() - startedAt > STUDIO_POLL_TIMEOUT_MS) {
        window.clearInterval(intervalId);
        return;
      }

      void refreshSelectedFigure(false);
    }, STUDIO_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [refreshSelectedFigure, selectedFigure]);

  useEffect(() => {
    setVariationInstruction("");
    setPreviewVariationInstruction("");
    setRetextureInstruction("");
    setRegenerationError(null);
    setPreviewVariationError(null);
    setRetextureError(null);
  }, [selectedFigure?.id]);

  function handleSelectFigure(figureId: string) {
    setSelectedFigureId(figureId);
    setSearchParams({ figureId }, { replace: true });
  }

  async function handleRefresh() {
    setIsRefreshing(true);

    try {
      await Promise.all([
        loadFigures(false),
        loadBillingSummary(),
        refreshSelectedFigure(false),
      ]);
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }

  async function handleRegenerateSelectedFigure() {
    if (
      isRegenerating ||
      isCreatingPreviewVariation ||
      isRetexturing ||
      !selectedFigure ||
      selectedFigure.status !== "success" ||
      !selectedFigure.prompt?.trim()
    ) {
      return;
    }

    const instruction = variationInstruction.trim();

    if (instruction.length > MAX_VARIATION_INSTRUCTION_LENGTH) {
      return;
    }

    setIsRegenerating(true);
    setRegenerationError(null);

    try {
      const childFigure = await figuresApi.regenerateFigure(
        selectedFigure.id,
        instruction ? { variationInstruction: instruction } : {},
      );

      if (!isMountedRef.current) {
        return;
      }

      setFigures((currentFigures) => [
        childFigure,
        ...currentFigures.filter((figure) => figure.id !== childFigure.id),
      ]);
      setSelectedFigureId(childFigure.id);
      setSearchParams({ figureId: childFigure.id }, { replace: true });
      setViewMode("2d");
      void loadBillingSummary();
    } catch (regenerateError) {
      if (isMountedRef.current) {
        setRegenerationError(getApiErrorMessage(regenerateError));
      }
    } finally {
      if (isMountedRef.current) {
        setIsRegenerating(false);
      }
    }
  }

  async function handleCreatePreviewVariation() {
    if (
      isRegenerating ||
      isCreatingPreviewVariation ||
      isRetexturing ||
      !selectedFigure ||
      selectedFigure.status !== "success" ||
      !selectedFigure.previewUrl
    ) {
      return;
    }

    const instruction = previewVariationInstruction.trim();

    if (instruction.length > MAX_PREVIEW_VARIATION_INSTRUCTION_LENGTH) {
      return;
    }

    setIsCreatingPreviewVariation(true);
    setPreviewVariationError(null);

    try {
      const childFigure = await figuresApi.createPreviewVariation(
        selectedFigure.id,
        instruction ? { instruction } : {},
      );

      if (!isMountedRef.current) {
        return;
      }

      setFigures((currentFigures) => [
        childFigure,
        ...currentFigures.filter((figure) => figure.id !== childFigure.id),
      ]);
      setSelectedFigureId(childFigure.id);
      setSearchParams({ figureId: childFigure.id }, { replace: true });
      setViewMode("2d");
      void loadBillingSummary();
    } catch (variationError) {
      if (isMountedRef.current) {
        setPreviewVariationError(getApiErrorMessage(variationError));
      }
    } finally {
      if (isMountedRef.current) {
        setIsCreatingPreviewVariation(false);
      }
    }
  }

  async function handleRetextureSelectedFigure() {
    if (
      isRegenerating ||
      isCreatingPreviewVariation ||
      isRetexturing ||
      !selectedFigure ||
      selectedFigure.status !== "success" ||
      selectedFigure.modelAssetReady !== true
    ) {
      return;
    }

    const instruction = retextureInstruction.trim();

    if (
      !instruction ||
      instruction.length > MAX_RETEXTURE_INSTRUCTION_LENGTH
    ) {
      return;
    }

    setIsRetexturing(true);
    setRetextureError(null);

    try {
      const childFigure = await figuresApi.createRetexture(selectedFigure.id, {
        instruction,
      });

      if (!isMountedRef.current) {
        return;
      }

      setFigures((currentFigures) => [
        childFigure,
        ...currentFigures.filter((figure) => figure.id !== childFigure.id),
      ]);
      setRetextureSuccessFigureId(childFigure.id);
      setSelectedFigureId(childFigure.id);
      setSearchParams({ figureId: childFigure.id }, { replace: true });
      setViewMode("3d");
      void loadBillingSummary();
    } catch (createRetextureError) {
      if (isMountedRef.current) {
        setRetextureError(getApiErrorMessage(createRetextureError));
      }
    } finally {
      if (isMountedRef.current) {
        setIsRetexturing(false);
      }
    }
  }

  return (
    <DashboardShell planLabel={summary?.plan.name}>
      <main className="min-h-screen min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full min-w-0 max-w-[1560px] space-y-4">
          <header className="flex flex-col gap-3 border-b border-[#3b494c]/55 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
                {t("studio.header.title")}
              </h1>
            </div>

            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
              <button
                aria-label={t("studio.refreshAssets")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#3b494c] px-3 py-2 text-sm font-bold text-[#bac9cc] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isRefreshing}
                type="button"
                onClick={() => void handleRefresh()}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
                {t("common.refresh")}
              </button>
            </div>
          </header>

          {error ? (
            <section
              className="rounded-lg border border-[#ffb4ab]/30 bg-[#93000a]/25 p-4 text-[#ffdad6]"
              role="alert"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#ffb4ab]/35 px-3 py-2 text-xs font-bold text-[#ffdad6] transition hover:bg-[#ffb4ab]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffb4ab]"
                  type="button"
                  onClick={() => void loadFigures()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t("common.retry")}
                </button>
              </div>
            </section>
          ) : null}

          {isLoading ? (
            <div className="studio-layout grid min-h-0 min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="studio-workspace min-h-0 min-w-0 self-start overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                <div className="h-16 animate-pulse border-b border-white/10 bg-white/[0.05]" />
                <div className="studio-preview-stage animate-pulse bg-white/[0.035]" />
              </div>
              <div className="studio-metadata-panel internal-scroll-region h-72 min-h-0 min-w-0 self-start rounded-lg border border-white/10 bg-white/[0.04] xl:h-auto" />
            </div>
          ) : figures.length === 0 ? (
            <StudioEmptyState />
          ) : selectedFigure ? (
            <div className="studio-layout grid min-h-0 min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="studio-main-column min-w-0 space-y-4">
                <section className="studio-workspace min-h-0 min-w-0 max-w-full self-start overflow-hidden rounded-lg border border-[#3b494c]/60 bg-[#101417]/96 shadow-[0_22px_60px_rgba(0,0,0,0.22)]">
                  <StudioCommandSurface
                    canDownloadModel={
                      summary?.capabilities.canDownloadModel === true
                    }
                    canExportModel={
                      summary?.capabilities.canExportModel === true
                    }
                    selectedFigure={selectedFigure}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                  />

                  <div className="studio-grid studio-preview-stage relative w-full min-w-0 overflow-hidden">
                    <div className="relative flex h-full min-h-0 min-w-0 max-w-full items-center justify-center">
                      <StudioPreview
                        figure={selectedFigure}
                        onShow2d={() => setViewMode("2d")}
                        viewMode={viewMode}
                      />
                    </div>
                  </div>

                  <FigureSelector
                    figures={figures}
                    selectedFigure={selectedFigure}
                    onSelect={handleSelectFigure}
                  />
                </section>

                <PhysicalPrintSection
                  modelAssetReady={selectedFigure.modelAssetReady === true}
                  selectedFigureId={selectedFigure.id}
                  selectedFigurePrompt={selectedFigure.prompt}
                  selectedFigureStatus={selectedFigure.status}
                />
              </div>

              <StudioMetadataPanel
                isCreatingPreviewVariation={isCreatingPreviewVariation}
                isRegenerating={isRegenerating}
                isRetexturing={isRetexturing}
                previewVariationError={previewVariationError}
                previewVariationInstruction={previewVariationInstruction}
                regenerationError={regenerationError}
                retextureError={retextureError}
                retextureInstruction={retextureInstruction}
                retextureSucceeded={
                  retextureSuccessFigureId === selectedFigure.id
                }
                selectedFigure={selectedFigure}
                summary={summary}
                variationInstruction={variationInstruction}
                onCreatePreviewVariation={() =>
                  void handleCreatePreviewVariation()
                }
                onPreviewVariationInstructionChange={
                  setPreviewVariationInstruction
                }
                onRegenerate={() => void handleRegenerateSelectedFigure()}
                onRetexture={() => void handleRetextureSelectedFigure()}
                onRetextureInstructionChange={setRetextureInstruction}
                onVariationInstructionChange={setVariationInstruction}
              />
            </div>
          ) : null}
        </div>
      </main>
    </DashboardShell>
  );
}
