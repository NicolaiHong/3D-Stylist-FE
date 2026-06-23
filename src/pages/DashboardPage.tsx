import {
  type ChangeEvent,
  type FormEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createSearchParams, Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Box,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  Database,
  Download,
  Eye,
  ExternalLink,
  ImageIcon,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { PaywallModal } from "../components/billing/PaywallModal";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { billingApi } from "../features/billing/billing.api";
import type {
  BillingOrder,
  BillingSummary,
} from "../features/billing/billing.types";
import { useAuthStore } from "../features/auth/auth.store";
import { figuresApi } from "../features/figures/figures.api";
import type {
  FigureDto,
  FigureStatus,
  ReferenceImageAssetDto,
  ReferenceImageKind,
} from "../features/figures/figures.types";
import { getApiErrorCode, getApiErrorMessage } from "../services/apiClient";
import { getDisplayLabel } from "../i18n/displayMaps";
import { formatI18nDate } from "../i18n/formatters";
import { useI18n } from "../i18n/useI18n";

const GENERATION_POLL_INTERVAL_MS = 3000;
const GENERATION_POLL_TIMEOUT_MS = 5 * 60 * 1000;
const DASHBOARD_STUDIO_AUTO_OPEN_DELAY_MS = 500;
const MAX_GENERATION_PROMPT_LENGTH = 600;
const MAX_REFERENCE_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const PENDING_PAYMENT_BANNER_DISMISSED_PREFIX =
  "pendingPaymentBannerDismissed";
const PENDING_PAYMENT_BANNER_DONT_SHOW_PREFIX =
  "pendingPaymentBannerDontShow";
const STYLE_INTENTS = [
  {
    id: "minimal-luxury",
    labelKey: "dashboard.style.minimalLuxury",
    promptText:
      "minimal luxury, refined tailoring, premium materials, restrained details",
  },
  {
    id: "cyber-streetwear",
    labelKey: "dashboard.style.cyberStreetwear",
    promptText:
      "cyber streetwear, futuristic urban layering, restrained neon accents",
  },
  {
    id: "techwear",
    labelKey: "dashboard.style.techwear",
    promptText:
      "techwear, functional layers, technical fabrics, structured utility details",
  },
  {
    id: "formal-runway",
    labelKey: "dashboard.style.formalRunway",
    promptText:
      "formal runway, editorial tailoring, polished silhouette, elevated finish",
  },
  {
    id: "sporty-activewear",
    labelKey: "dashboard.style.sportyActivewear",
    promptText:
      "sporty activewear, performance fabrics, streamlined athletic silhouette",
  },
  {
    id: "vintage-editorial",
    labelKey: "dashboard.style.vintageEditorial",
    promptText:
      "vintage editorial, archival fashion mood, styled magazine silhouette",
  },
] as const;
type FigureAssetKind = "image" | "model";
type StyleIntent = (typeof STYLE_INTENTS)[number];
type StyleIntentId = StyleIntent["id"];
type ModelSource = "default" | "personal";
type ModelGender = "male" | "female" | "unisex";
type GenerationOutputType = "2d" | "3d";

const MODEL_GENDERS: Array<{ id: ModelGender; labelKey: string }> = [
  { id: "male", labelKey: "dashboard.setup.gender.male" },
  { id: "female", labelKey: "dashboard.setup.gender.female" },
  { id: "unisex", labelKey: "dashboard.setup.gender.unisex" },
];

const GENERATION_OUTPUT_TYPES: Array<{
  id: GenerationOutputType;
  labelKey: string;
  helperKey: string;
}> = [
  {
    id: "2d",
    labelKey: "dashboard.setup.output.2d",
    helperKey: "dashboard.setup.output.2dHelper",
  },
  {
    id: "3d",
    labelKey: "dashboard.setup.output.3d",
    helperKey: "dashboard.setup.output.3dHelper",
  },
];
const REFERENCE_IMAGE_KINDS: Array<{
  id: ReferenceImageKind;
  labelKey: string;
}> = [
  { id: "face", labelKey: "dashboard.reference.kind.face" },
  { id: "full_body", labelKey: "dashboard.reference.kind.fullBody" },
  { id: "clothing_style", labelKey: "dashboard.reference.kind.clothingStyle" },
  {
    id: "generic_reference",
    labelKey: "dashboard.reference.kind.genericReference",
  },
];

function getProductName(order: BillingOrder | null | undefined) {
  return order?.items[0]?.productName ?? "billing order";
}

function getPendingPaymentBannerScope(
  user: { email?: string | null; id?: string } | null | undefined,
) {
  return user?.id || user?.email || "anonymous";
}

function getPendingPaymentBannerDismissedKey(
  userScope: string,
  orderId: string,
) {
  return `${PENDING_PAYMENT_BANNER_DISMISSED_PREFIX}:${userScope}:${orderId}`;
}

function getPendingPaymentBannerDontShowKey(userScope: string) {
  return `${PENDING_PAYMENT_BANNER_DONT_SHOW_PREFIX}:${userScope}`;
}

type Translate = ReturnType<typeof useI18n>["t"];

function getPlanTone(summary: BillingSummary | null, t: Translate) {
  if (!summary) {
    return t("dashboard.plan.checking");
  }

  return summary.plan.status === "active"
    ? t("dashboard.plan.active")
    : t("dashboard.plan.free");
}

function isPollingStatus(status: FigureStatus) {
  return status === "queued" || status === "processing";
}

function isTerminalStatus(status: FigureStatus) {
  return status === "success" || status === "failed" || status === "canceled";
}

function getFigureStatusTone(status: FigureStatus) {
  if (status === "queued" || status === "processing") {
    return "border-[#00e5ff]/30 bg-[#00e5ff]/10 text-[#9cf0ff]";
  }

  if (status === "success") {
    return "border-[#2cebcf]/30 bg-[#2cebcf]/10 text-[#c9fff6]";
  }

  if (status === "failed" || status === "canceled") {
    return "border-[#ffb4ab]/30 bg-[#93000a]/25 text-[#ffdad6]";
  }

  return "border-white/10 bg-white/[0.05] text-[#bac9cc]";
}

function getFigureStatusExplanation(status: FigureStatus, t: Translate) {
  if (status === "queued") {
    return t("dashboard.figure.status.queued");
  }

  if (status === "processing") {
    return t("dashboard.figure.status.processing");
  }

  if (status === "success") {
    return t("dashboard.figure.status.success");
  }

  if (status === "failed") {
    return t("dashboard.figure.status.failed");
  }

  if (status === "canceled") {
    return t("dashboard.figure.status.canceled");
  }

  return t("dashboard.figure.status.draft");
}

function getFigureStatusExplanationTone(status: FigureStatus) {
  if (status === "success") {
    return "text-[#c9fff6]";
  }

  if (status === "failed" || status === "canceled") {
    return "text-[#ffdad6]";
  }

  return "text-[#bac9cc]";
}

function getFigurePreviewUrl(figure: FigureDto) {
  return figure.previewUrl || figure.thumbnailUrl || null;
}

function getFigureAssetAvailability(figure: FigureDto, t: Translate) {
  const availability: string[] = [];

  if (getFigurePreviewUrl(figure)) {
    availability.push(t("dashboard.figure.imageReady"));
  }

  if (figure.modelAssetReady === true) {
    availability.push(t("dashboard.figure.modelReady"));
  }

  if (
    availability.length === 0 &&
    figure.status !== "failed" &&
    figure.status !== "canceled"
  ) {
    availability.push(t("dashboard.figure.previewPending"));
  }

  return availability;
}

function composeGenerationPrompt(
  prompt: string,
  styleIntent: StyleIntent | undefined,
  modelGender: ModelGender,
  outputType: GenerationOutputType,
) {
  const details = [
    styleIntent ? `Style direction: ${styleIntent.promptText}.` : null,
    "Model source: default studio mannequin.",
    `Model gender: ${modelGender}.`,
    `Output request: ${
      outputType === "3d" ? "3D GLB model preview" : "2D fashion preview"
    }.`,
  ].filter((detail): detail is string => Boolean(detail));

  return `${prompt}\n\n${details.join("\n")}`;
}

function getFigureAssetKey(figure: FigureDto, kind: FigureAssetKind) {
  return `${figure.id}:${kind}`;
}

function isStudio3dReadyFigure(figure: FigureDto | null) {
  return (
    Boolean(figure?.id) &&
    figure?.status === "success" &&
    figure.modelAssetReady === true
  );
}

function getStudio3dRoute(figureId: string) {
  return {
    pathname: "/studio",
    search: createSearchParams({
      figureId,
      view: "3d",
      focus: "preview",
    }).toString(),
  };
}

function getDownloadFileName(figure: FigureDto, kind: FigureAssetKind) {
  if (kind === "model") {
    return `3d-stylist-model-${figure.id}.glb`;
  }

  return `3d-stylist-generation-${figure.id}.png`;
}

function getFigurePlaceholderCopy(figure: FigureDto, t: Translate) {
  if (figure.status === "queued" || figure.status === "processing") {
    return t("dashboard.figure.generating");
  }

  if (
    figure.status === "success" &&
    !getFigurePreviewUrl(figure) &&
    !figure.modelUrl
  ) {
    return t("dashboard.figure.completeNoAssets");
  }

  if (figure.status === "failed") {
    return figure.failureReason || t("dashboard.figure.failedFallback");
  }

  if (figure.status === "canceled") {
    return t("dashboard.figure.canceled");
  }

  return t("dashboard.figure.previewPending");
}

async function downloadUrlWithFallback(url: string, fileName: string) {
  try {
    const response = await fetch(url, { credentials: "include" });

    if (!response.ok) {
      throw new Error("Asset download failed");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.rel = "noreferrer";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  } catch {
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noreferrer";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }
}

function getPromptSnippet(
  prompt: string | null | undefined,
  fallback: string,
  limit = 92,
) {
  const value = prompt?.trim();

  if (!value) {
    return fallback;
  }

  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function mergeFigureIntoList(figures: FigureDto[], figure: FigureDto) {
  const exists = figures.some((item) => item.id === figure.id);

  if (exists) {
    return figures.map((item) => (item.id === figure.id ? figure : item));
  }

  return [figure, ...figures].slice(0, 6);
}

function getReferenceImageValidationError(file: File, t: Translate) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isJpeg = file.type === "image/jpeg";
  const isPng = file.type === "image/png";
  const isExtensionValid = isJpeg
    ? extension === "jpg" || extension === "jpeg"
    : extension === "png";

  if ((!isJpeg && !isPng) || !isExtensionValid) {
    return t("dashboard.reference.error.unsupportedType");
  }

  if (file.size > MAX_REFERENCE_IMAGE_FILE_SIZE_BYTES) {
    return t("dashboard.reference.error.fileTooLarge");
  }

  return null;
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="h-[430px] animate-pulse rounded-lg border border-white/10 bg-white/[0.05] lg:col-span-9" />
      <div className="h-64 animate-pulse rounded-lg border border-white/10 bg-white/[0.05] lg:col-span-3" />
      <div className="h-36 animate-pulse rounded-lg border border-white/10 bg-white/[0.04] lg:col-span-12" />
    </div>
  );
}

function FigureStatusBadge({ status }: { status: FigureStatus }) {
  const { language } = useI18n();

  return (
    <span
      className={`dashboard-utility-label inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-bold ${getFigureStatusTone(
        status,
      )}`}
    >
      {isPollingStatus(status) ? <Clock3 className="h-3.5 w-3.5" /> : null}
      {getDisplayLabel("figureStatus", status, language)}
    </span>
  );
}

function FigurePreview({ figure }: { figure: FigureDto }) {
  const { t } = useI18n();
  const previewUrl = getFigurePreviewUrl(figure);
  const promptSnippet = getPromptSnippet(
    figure.prompt,
    t("dashboard.figure.untitled"),
  );
  const placeholderCopy = getFigurePlaceholderCopy(figure, t);

  if (previewUrl) {
    return (
      <img
        alt={promptSnippet}
        className="h-full w-full object-cover"
        src={previewUrl}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#0e0e0e] p-4 text-center">
      <ImageIcon className="h-8 w-8 text-[#3b494c]" />
      <p className="mt-3 max-w-[220px] text-xs font-semibold leading-5 text-[#849396]">
        {placeholderCopy}
      </p>
    </div>
  );
}

function FigureCard({
  figure,
  downloadingAssetKey,
  onDownload,
  onView,
}: {
  figure: FigureDto;
  downloadingAssetKey: string | null;
  onDownload: (figure: FigureDto, kind: FigureAssetKind) => void;
  onView: (figure: FigureDto) => void;
}) {
  const { language, t } = useI18n();
  const fallbackPrompt = t("dashboard.figure.untitled");
  const promptSnippet = getPromptSnippet(figure.prompt, fallbackPrompt);
  const createdDate = formatI18nDate(
    figure.createdAt,
    language,
    t("common.unknown"),
  );
  const previewUrl = getFigurePreviewUrl(figure);
  const assetAvailability = getFigureAssetAvailability(figure, t);
  const canOpenStudio = isStudio3dReadyFigure(figure);
  const canViewImage = figure.status === "success" && Boolean(previewUrl);
  const isImageDownloading =
    downloadingAssetKey === getFigureAssetKey(figure, "image");
  const isModelDownloading =
    downloadingAssetKey === getFigureAssetKey(figure, "model");

  return (
    <article className="overflow-hidden rounded-lg border border-[#3b494c]/60 bg-[#1c1b1b]">
      <div className="aspect-[4/3] overflow-hidden border-b border-[#3b494c]/50 bg-[#0e0e0e]">
        <FigurePreview figure={figure} />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FigureStatusBadge status={figure.status} />
          <span className="text-xs font-semibold text-[#849396]">
            {createdDate}
          </span>
        </div>
        <div className="border-b border-[#3b494c]/45 pb-3">
          <p className="min-h-12 text-sm font-semibold leading-6 text-[#e5e2e1]">
            {promptSnippet}
          </p>
        </div>
        {assetAvailability.length > 0 ? (
          <p className="text-xs font-semibold leading-5 text-[#849396]">
            {assetAvailability.join(" · ")}
          </p>
        ) : null}
        {figure.status === "failed" && figure.failureReason ? (
          <p className="border-l-2 border-[#ffb4ab]/35 pl-3 text-xs leading-5 text-[#ffdad6]">
            {figure.failureReason}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {canOpenStudio ? (
            <Link
              aria-label={t("dashboard.figure.open3dStudioAria", {
                prompt: promptSnippet,
              })}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-3 py-2 text-xs font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
              to={getStudio3dRoute(figure.id)}
            >
              <Box className="h-3.5 w-3.5" />
              {t("dashboard.figure.open3dStudio")}
            </Link>
          ) : null}
          {canViewImage ? (
            <button
              aria-label={t("dashboard.figure.viewImageAria", {
                prompt: promptSnippet,
              })}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 ${
                canOpenStudio
                  ? "border border-white/[0.12] text-[#e5e2e1] hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline-[#00e5ff]"
                  : "bg-[#00e5ff] text-[#001f24] hover:bg-[#9cf0ff] focus-visible:outline-[#9cf0ff]"
              }`}
              type="button"
              onClick={() => onView(figure)}
            >
              <Eye className="h-3.5 w-3.5" />
              {t("dashboard.figure.viewImage")}
            </button>
          ) : null}
          {previewUrl ? (
            <button
              aria-label={t("dashboard.figure.downloadImageAria", {
                prompt: promptSnippet,
              })}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-3 py-2 text-xs font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isImageDownloading}
              type="button"
              onClick={() => onDownload(figure, "image")}
            >
              {isImageDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {t("dashboard.figure.downloadImage")}
            </button>
          ) : null}
          {figure.modelUrl ? (
            <a
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-3 py-2 text-xs font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
              href={figure.modelUrl}
              rel="noreferrer"
              target="_blank"
            >
              {t("dashboard.figure.openModel")}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          {figure.modelUrl ? (
            <button
              aria-label={t("dashboard.figure.downloadModelAria", {
                prompt: promptSnippet,
              })}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-3 py-2 text-xs font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isModelDownloading}
              type="button"
              onClick={() => onDownload(figure, "model")}
            >
              {isModelDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {t("dashboard.figure.downloadModel")}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function FigurePreviewDialog({
  downloadingAssetKey,
  figure,
  onClose,
  onDownload,
}: {
  downloadingAssetKey: string | null;
  figure: FigureDto;
  onClose: () => void;
  onDownload: (figure: FigureDto, kind: FigureAssetKind) => void;
}) {
  const { language, t } = useI18n();
  const previewUrl = getFigurePreviewUrl(figure);
  const fallbackPrompt = t("dashboard.figure.untitled");
  const promptSnippet = getPromptSnippet(figure.prompt, fallbackPrompt);
  const createdDate = formatI18nDate(
    figure.createdAt,
    language,
    t("common.unknown"),
  );
  const isImageDownloading =
    downloadingAssetKey === getFigureAssetKey(figure, "image");
  const isModelDownloading =
    downloadingAssetKey === getFigureAssetKey(figure, "model");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      aria-labelledby="figure-preview-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg border border-[#3b494c] bg-[#141313] shadow-2xl shadow-black/35">
        <div className="flex items-start justify-between gap-4 border-b border-[#3b494c]/70 p-4 sm:p-5">
          <div>
            <p className="dashboard-utility-label font-bold text-[#00e5ff]">
              {t("dashboard.dialog.generatedResult")}
            </p>
            <h2
              className="mt-2 font-display text-2xl font-semibold text-white"
              id="figure-preview-dialog-title"
            >
              {t("dashboard.dialog.imagePreview")}
            </h2>
          </div>
          <button
            aria-label={t("dashboard.dialog.closeImagePreview")}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/[0.12] text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
            type="button"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid max-h-[calc(92vh-82px)] overflow-y-auto lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
          <div className="min-h-[320px] bg-[#090909] lg:min-h-[560px]">
            {previewUrl ? (
              <img
                alt={promptSnippet}
                className="h-full w-full object-contain"
                src={previewUrl}
              />
            ) : (
              <FigurePreview figure={figure} />
            )}
          </div>
          <aside className="space-y-5 border-t border-[#3b494c]/70 p-5 lg:border-l lg:border-t-0">
            <div className="flex flex-wrap items-center gap-2">
              <FigureStatusBadge status={figure.status} />
              {createdDate ? (
                <span className="text-sm font-semibold text-[#849396]">
                  {createdDate}
                </span>
              ) : null}
            </div>
            <div>
              <p className="dashboard-utility-label font-bold text-[#849396]">
                {t("dashboard.figure.prompt")}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#e5e2e1]">
                {figure.prompt?.trim() || fallbackPrompt}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {previewUrl ? (
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isImageDownloading}
                  type="button"
                  onClick={() => onDownload(figure, "image")}
                >
                  {isImageDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {t("dashboard.figure.downloadImage")}
                </button>
              ) : null}
              {figure.modelUrl ? (
                <a
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                  href={figure.modelUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t("dashboard.figure.openModel")}
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
              {figure.modelUrl ? (
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isModelDownloading}
                  type="button"
                  onClick={() => onDownload(figure, "model")}
                >
                  {isModelDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {t("dashboard.figure.downloadModel")}
                </button>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ActiveFigurePanel({
  downloadingAssetKey,
  figure,
  isPolling,
  onDownload,
  onView,
}: {
  downloadingAssetKey: string | null;
  figure: FigureDto;
  isPolling: boolean;
  onDownload: (figure: FigureDto, kind: FigureAssetKind) => void;
  onView: (figure: FigureDto) => void;
}) {
  const { t } = useI18n();
  const promptSnippet = getPromptSnippet(
    figure.prompt,
    t("dashboard.figure.untitled"),
  );
  const previewUrl = getFigurePreviewUrl(figure);
  const canOpenStudio = isStudio3dReadyFigure(figure);
  const isImageDownloading =
    downloadingAssetKey === getFigureAssetKey(figure, "image");
  const isModelDownloading =
    downloadingAssetKey === getFigureAssetKey(figure, "model");

  return (
    <div className="grid gap-4 border-t border-[#3b494c]/60 pt-4 md:grid-cols-[160px_1fr]">
      <div className="aspect-square overflow-hidden rounded-md border border-[#3b494c] bg-[#090909]">
        <FigurePreview figure={figure} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <FigureStatusBadge status={figure.status} />
          {isPolling ? (
            <span className="dashboard-utility-label inline-flex items-center gap-2 font-bold text-[#bac9cc]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("dashboard.active.syncing")}
            </span>
          ) : null}
        </div>
        <h3 className="mt-3 font-display text-xl font-semibold text-white">
          {t("dashboard.active.currentGeneration")}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
          {promptSnippet}
        </p>
        <p
          className={`mt-3 text-sm font-semibold ${getFigureStatusExplanationTone(
            figure.status,
          )}`}
        >
          {getFigureStatusExplanation(figure.status, t)}
        </p>
        {figure.status === "failed" && figure.failureReason ? (
          <p className="mt-3 rounded-md border border-[#ffb4ab]/20 bg-[#93000a]/20 p-3 text-sm leading-6 text-[#ffdad6]">
            {figure.failureReason}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          {canOpenStudio ? (
            <Link
              aria-label={t("dashboard.figure.open3dStudioAria", {
                prompt: promptSnippet,
              })}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-3 py-2 text-xs font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
              to={getStudio3dRoute(figure.id)}
            >
              <Box className="h-3.5 w-3.5" />
              {t("dashboard.figure.open3dStudio")}
            </Link>
          ) : null}
          {previewUrl ? (
            <button
              aria-label={t("dashboard.figure.viewImageAria", {
                prompt: promptSnippet,
              })}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 ${
                canOpenStudio
                  ? "border border-white/[0.12] text-[#e5e2e1] hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline-[#00e5ff]"
                  : "bg-[#00e5ff] text-[#001f24] hover:bg-[#9cf0ff] focus-visible:outline-[#9cf0ff]"
              }`}
              type="button"
              onClick={() => onView(figure)}
            >
              <Eye className="h-3.5 w-3.5" />
              {t("dashboard.figure.viewImage")}
            </button>
          ) : null}
          {previewUrl ? (
            <button
              aria-label={t("dashboard.figure.downloadImageAria", {
                prompt: promptSnippet,
              })}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-3 py-2 text-xs font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
              disabled={isImageDownloading}
              type="button"
              onClick={() => onDownload(figure, "image")}
            >
              {isImageDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {t("dashboard.figure.downloadImage")}
            </button>
          ) : null}
          {figure.modelUrl ? (
            <a
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-3 py-2 text-xs font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
              href={figure.modelUrl}
              rel="noreferrer"
              target="_blank"
            >
              {t("dashboard.figure.openModel")}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          {figure.modelUrl ? (
            <button
              aria-label={t("dashboard.figure.downloadModelAria", {
                prompt: promptSnippet,
              })}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-3 py-2 text-xs font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isModelDownloading}
              type="button"
              onClick={() => onDownload(figure, "model")}
            >
              {isModelDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {t("dashboard.figure.downloadModel")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FigureEmptyState() {
  const { t } = useI18n();

  return (
    <div className="rounded-lg border border-dashed border-[#3b494c] bg-[#1c1b1b] p-8 text-center md:col-span-3">
      <Sparkles className="mx-auto h-8 w-8 text-[#3b494c]" />
      <p className="mt-3 text-sm font-bold text-white">
        {t("dashboard.empty.title")}
      </p>
      <p className="mt-1 text-sm text-[#bac9cc]">
        {t("dashboard.empty.body")}
      </p>
    </div>
  );
}

function ReferenceImagePanel({
  consentAccepted,
  fileInputRef,
  isUploading,
  previewUrl,
  referenceKind,
  selectedReferenceImage,
  uploadError,
  uploadProgress,
  onConsentChange,
  onFileChange,
  onReferenceKindChange,
  onRemove,
}: {
  consentAccepted: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  isUploading: boolean;
  previewUrl: string | null;
  referenceKind: ReferenceImageKind;
  selectedReferenceImage: ReferenceImageAssetDto | null;
  uploadError: string | null;
  uploadProgress: number | null;
  onConsentChange: (accepted: boolean) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onReferenceKindChange: (kind: ReferenceImageKind) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const selectedKind = selectedReferenceImage?.referenceKind ?? referenceKind;
  const selectedKindLabel =
    REFERENCE_IMAGE_KINDS.find((kind) => kind.id === selectedKind)?.labelKey ??
    "dashboard.reference.kind.genericReference";
  const dimensions = selectedReferenceImage?.dimensions;
  const canChooseFile = consentAccepted && !isUploading;
  const hasPreview = Boolean(previewUrl);
  const isUploaded = Boolean(selectedReferenceImage);
  const isReady = isUploaded && consentAccepted;
  const uploadedStatus = isReady
    ? t("dashboard.reference.uploaded", {
        kind: t(selectedKindLabel),
        dimensions: dimensions
          ? `${dimensions.width}×${dimensions.height}`
          : t("common.unknown"),
      })
    : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">
            {t("dashboard.reference.title")}
          </h3>
          <p className="mt-1 text-xs leading-5 text-[#bac9cc]">
            {t("dashboard.reference.body")}
          </p>
        </div>
        {uploadError ? (
          <span className="dashboard-utility-label inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md border border-[#ffb4ab]/25 bg-[#93000a]/20 px-2.5 py-1 font-bold text-[#ffdad6]">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t("dashboard.reference.statusError")}
          </span>
        ) : null}
      </div>

      <input
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        className="sr-only"
        disabled={!canChooseFile}
        ref={fileInputRef}
        type="file"
        onChange={onFileChange}
      />

      <div className="space-y-3 rounded-lg bg-white/[0.025] p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <label className="block text-xs font-bold leading-5 text-[#bac9cc]">
            {t("dashboard.reference.kindLabel")}
            <select
              className="mt-2 min-h-11 w-full rounded-md border border-white/[0.12] bg-[#141313] px-3 py-2 text-sm font-bold text-white outline-none transition focus:border-[#00e5ff]/60 focus:ring-2 focus:ring-[#00e5ff]/20 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={Boolean(selectedReferenceImage) || isUploading}
              value={referenceKind}
              onChange={(event) =>
                onReferenceKindChange(event.target.value as ReferenceImageKind)
              }
            >
              {REFERENCE_IMAGE_KINDS.map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {t(kind.labelKey)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-h-11 items-start gap-3 px-1 py-2 text-xs leading-5 text-[#bac9cc]">
            <input
              checked={consentAccepted}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#00e5ff]"
              disabled={Boolean(selectedReferenceImage) || isUploading}
              type="checkbox"
              onChange={(event) => onConsentChange(event.target.checked)}
            />
            <span>
              <span className="block font-semibold text-[#e5e2e1]">
                {t("dashboard.reference.consent")}
              </span>
              <span className="mt-0.5 block text-[#849396]">
                {t("dashboard.reference.retentionNotice")}
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-1 px-1 text-xs leading-5 text-[#849396] sm:flex-row sm:flex-wrap sm:gap-x-4">
          <p>{t("dashboard.reference.identityNotice")}</p>
          <p>{t("dashboard.reference.uploadHelp")}</p>
          {!consentAccepted && !isUploaded ? (
            <p>{t("dashboard.reference.uploadDisabledHelp")}</p>
          ) : null}
        </div>

        {hasPreview ? (
          <div
            className={`flex flex-col gap-3 rounded-lg border bg-[#0e0e0e]/80 p-3 sm:flex-row sm:items-center ${
              uploadError
                ? "border-[#ffb4ab]/35"
                : isReady
                  ? "border-[#2cebcf]/25"
                  : "border-white/[0.09]"
            }`}
          >
            <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-md border border-white/[0.1] bg-[#090909] sm:h-24 sm:w-32">
              <img
                alt={t("dashboard.reference.previewAlt")}
                className="h-full w-full object-cover"
                src={previewUrl ?? undefined}
              />
              {isUploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/65">
                  <Loader2 className="h-5 w-5 animate-spin text-[#00e5ff]" />
                </div>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              {uploadedStatus ? (
                <p
                  aria-live="polite"
                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#2cebcf]/25 bg-[#2cebcf]/8 px-2.5 py-1 text-xs font-semibold leading-5 text-[#c9fff6]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>{uploadedStatus}</span>
                </p>
              ) : isUploading ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#9cf0ff]">
                    {t("dashboard.reference.uploading", {
                      progress: uploadProgress ?? 0,
                    })}
                  </p>
                  <div className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-white/[0.12]">
                    <div
                      className="h-full rounded-full bg-[#00e5ff] transition-[width]"
                      style={{ width: `${uploadProgress ?? 5}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {!isUploading ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/30 px-3 py-2 text-xs font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:text-[#849396]"
                    disabled={!canChooseFile}
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {t("dashboard.reference.replace")}
                  </button>
                  <button
                    aria-label={t("dashboard.reference.remove")}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-bold text-[#bac9cc] transition hover:bg-[#ffb4ab]/10 hover:text-[#ffdad6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffb4ab]"
                    type="button"
                    onClick={onRemove}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("dashboard.reference.remove")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <button
            className="flex min-h-24 w-full items-center gap-3 rounded-lg border border-dashed border-[#3b494c]/70 bg-[#0e0e0e]/45 p-3 text-left transition hover:border-[#00e5ff]/35 hover:bg-[#00e5ff]/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-55"
            disabled={!canChooseFile}
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-[#9cf0ff]">
              <Upload className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[#e5e2e1]">
                {t("dashboard.reference.emptyPreview")}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-[#849396]">
                {t("dashboard.reference.emptyPreviewHelp")}
              </span>
            </span>
            <span className="hidden min-h-10 shrink-0 items-center rounded-md border border-white/[0.1] px-3 text-xs font-bold text-[#bac9cc] sm:inline-flex">
              {t("dashboard.reference.upload")}
            </span>
          </button>
        )}

        {uploadError ? (
          <p
            className="border-l-2 border-[#ffb4ab]/50 pl-3 text-xs font-semibold leading-5 text-[#ffdad6]"
            role="alert"
          >
            {uploadError}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function GenerationResultNotice({
  figure,
  isAutoOpeningStudio,
}: {
  figure: FigureDto;
  isAutoOpeningStudio: boolean;
}) {
  const { t } = useI18n();
  const isFailed = figure.status === "failed" || figure.status === "canceled";
  const message =
    figure.status === "success"
      ? t("dashboard.notice.success")
      : isFailed
        ? t("dashboard.notice.failed")
        : t("dashboard.notice.submitted");
  const actionLabel = isPollingStatus(figure.status)
    ? t("dashboard.notice.openStudioStatus")
    : t("dashboard.notice.openStudio");

  if (isAutoOpeningStudio) {
    return (
      <section
        aria-live="polite"
        className="flex flex-col gap-3 rounded-lg border border-[#2cebcf]/35 bg-[#2cebcf]/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        role="status"
      >
        <span className="flex gap-3">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[#2cebcf]" />
          <span>
            <span className="block text-sm font-bold text-white">
              {t("dashboard.notice.openingStudio3d")}
            </span>
            <span className="mt-1 block text-xs leading-5 text-[#bac9cc]">
              {t("dashboard.notice.backendSource")}
            </span>
          </span>
        </span>
      </section>
    );
  }

  return (
    <Link
      className={`group flex flex-col gap-3 rounded-lg border p-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] sm:flex-row sm:items-center sm:justify-between ${
        isFailed
          ? "border-[#ffb4ab]/30 bg-[#93000a]/20"
          : "border-[#2cebcf]/35 bg-[#2cebcf]/10 hover:border-[#00e5ff]/65 hover:bg-[#00e5ff]/12"
      }`}
      to={getStudio3dRoute(figure.id)}
    >
      <span className="flex gap-3">
        {isFailed ? (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#ffb4ab]" />
        ) : (
          <ArrowDown className="generation-result-arrow mt-0.5 h-5 w-5 shrink-0 text-[#2cebcf]" />
        )}
        <span>
          <span className="block text-sm font-bold text-white">{message}</span>
          <span className="mt-1 block text-xs leading-5 text-[#bac9cc]">
            {t("dashboard.notice.backendSource")}
          </span>
        </span>
      </span>
      <span className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-3 py-2 text-xs font-bold text-[#9cf0ff] transition group-hover:bg-[#00e5ff]/10">
        {actionLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

function GenerationSetupDialog({
  composedPromptCharacterCount,
  creditBalance,
  estimatedBalanceAfterSubmit,
  isGenerating,
  isPromptTooLong,
  isReferenceImageUploading,
  modelGender,
  modelSource,
  outputType,
  promptCharacterCount,
  referenceImageConsentAccepted,
  referenceImageError,
  referenceImageFileInputRef,
  referenceImagePreviewUrl,
  referenceImageUploadProgress,
  referenceKind,
  selectedStyleIntent,
  selectedReferenceImage,
  onClose,
  onGenerate,
  onGenerateWithReference,
  onModelGenderChange,
  onOutputTypeChange,
  onReferenceImageConsentChange,
  onReferenceImageFileChange,
  onReferenceImageKindChange,
  onRemoveReferenceImage,
}: {
  composedPromptCharacterCount: number;
  creditBalance: number;
  estimatedBalanceAfterSubmit: number;
  isGenerating: boolean;
  isPromptTooLong: boolean;
  isReferenceImageUploading: boolean;
  modelGender: ModelGender;
  modelSource: ModelSource;
  outputType: GenerationOutputType;
  promptCharacterCount: number;
  referenceImageConsentAccepted: boolean;
  referenceImageError: string | null;
  referenceImageFileInputRef: RefObject<HTMLInputElement>;
  referenceImagePreviewUrl: string | null;
  referenceImageUploadProgress: number | null;
  referenceKind: ReferenceImageKind;
  selectedStyleIntent: StyleIntent | undefined;
  selectedReferenceImage: ReferenceImageAssetDto | null;
  onClose: () => void;
  onGenerate: () => void;
  onGenerateWithReference: () => void;
  onModelGenderChange: (gender: ModelGender) => void;
  onOutputTypeChange: (outputType: GenerationOutputType) => void;
  onReferenceImageConsentChange: (accepted: boolean) => void;
  onReferenceImageFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onReferenceImageKindChange: (kind: ReferenceImageKind) => void;
  onRemoveReferenceImage: () => void;
}) {
  const { t } = useI18n();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const outputTypeLabel =
    t(
      GENERATION_OUTPUT_TYPES.find((option) => option.id === outputType)
        ?.labelKey ?? "dashboard.setup.output.2d",
    );
  const selectedReferenceKindLabel = selectedReferenceImage
    ? (REFERENCE_IMAGE_KINDS.find(
        (kind) => kind.id === selectedReferenceImage.referenceKind,
      )?.labelKey ?? "dashboard.reference.kind.genericReference")
    : null;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isGenerating) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGenerating, onClose]);

  return (
    <div
      aria-labelledby="generation-setup-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-[#3b494c] bg-[#141313] shadow-2xl shadow-black/35">
        <header className="flex items-start justify-between gap-4 border-b border-[#3b494c]/70 p-5 sm:p-6">
          <div>
            <p className="dashboard-label font-bold text-[#00e5ff]">
              {t("dashboard.setup.eyebrow")}
            </p>
            <h2
              className="mt-2 font-display text-[1.6rem] font-semibold leading-[1.16] text-white sm:text-3xl"
              id="generation-setup-dialog-title"
            >
              {t("dashboard.setup.title")}
            </h2>
            <p className="dashboard-helper-copy mt-2 max-w-2xl text-[#bac9cc]">
              {t("dashboard.setup.body")}
            </p>
          </div>
          <button
            aria-label={t("dashboard.setup.close")}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/[0.12] text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isGenerating}
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-bold text-white">
                {t("dashboard.setup.modelSource")}
              </h3>
              <div className="mt-3">
                <button
                  aria-pressed={modelSource === "default"}
                  className="w-full rounded-lg border border-[#00e5ff]/65 bg-[#00e5ff]/10 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                  type="button"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-[#c3f5ff]">
                    <Box className="h-4 w-4" />
                    {t("dashboard.setup.defaultModel")}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-[#bac9cc]">
                    {t("dashboard.setup.defaultModelBody")}
                  </span>
                </button>
              </div>
            </section>

            {modelSource === "default" ? (
              <section>
                <h3 className="text-sm font-bold text-white">
                  {t("dashboard.setup.defaultGender")}
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {MODEL_GENDERS.map((gender) => {
                    const isSelected = gender.id === modelGender;

                    return (
                      <button
                        aria-pressed={isSelected}
                        className={`min-h-11 rounded-md border px-3 py-2 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] ${
                          isSelected
                            ? "border-[#00e5ff]/65 bg-[#00e5ff]/12 text-[#c3f5ff]"
                            : "border-white/[0.12] text-[#bac9cc] hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10"
                        }`}
                        key={gender.id}
                        type="button"
                        onClick={() => onModelGenderChange(gender.id)}
                      >
                        {t(gender.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <ReferenceImagePanel
              consentAccepted={referenceImageConsentAccepted}
              fileInputRef={referenceImageFileInputRef}
              isUploading={isReferenceImageUploading}
              previewUrl={referenceImagePreviewUrl}
              referenceKind={referenceKind}
              selectedReferenceImage={selectedReferenceImage}
              uploadError={referenceImageError}
              uploadProgress={referenceImageUploadProgress}
              onConsentChange={onReferenceImageConsentChange}
              onFileChange={onReferenceImageFileChange}
              onReferenceKindChange={onReferenceImageKindChange}
              onRemove={onRemoveReferenceImage}
            />

            <section>
              <h3 className="text-sm font-bold text-white">
                {t("dashboard.setup.outputType")}
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {GENERATION_OUTPUT_TYPES.map((option) => {
                  const isSelected = option.id === outputType;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`rounded-lg border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] ${
                        isSelected
                          ? "border-[#00e5ff]/65 bg-[#00e5ff]/10"
                          : "border-white/[0.12] bg-white/[0.025] hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10"
                      }`}
                      key={option.id}
                      type="button"
                      onClick={() => onOutputTypeChange(option.id)}
                    >
                      <span className="flex items-center gap-2 text-sm font-bold text-[#e5e2e1]">
                        {option.id === "3d" ? (
                          <Box className="h-4 w-4" />
                        ) : (
                          <ImageIcon className="h-4 w-4" />
                        )}
                        {t(option.labelKey)}
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-[#849396]">
                        {t(option.helperKey)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="h-fit rounded-lg border border-[#3b494c]/70 bg-[#0e0e0e] p-4">
            <h3 className="text-sm font-bold text-white">
              {t("dashboard.setup.summary")}
            </h3>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-[#849396]">
                  {t("dashboard.generate.cost")}
                </dt>
                <dd className="font-bold text-white">
                  {t("dashboard.generate.oneCredit")}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#849396]">
                  {t("dashboard.setup.currentBalance")}
                </dt>
                <dd className="font-bold text-[#9cf0ff]">{creditBalance}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#849396]">
                  {t("dashboard.generate.balanceAfter")}
                </dt>
                <dd className="font-bold text-[#c9fff6]">
                  {estimatedBalanceAfterSubmit}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#849396]">
                  {t("dashboard.setup.promptLength")}
                </dt>
                <dd className="font-bold text-white">{promptCharacterCount}</dd>
              </div>
              <div className="border-t border-[#3b494c]/70 pt-3">
                <dt className="text-[#849396]">
                  {t("studio.styleDirection")}
                </dt>
                <dd className="mt-1 font-semibold leading-5 text-[#e5e2e1]">
                  {selectedStyleIntent
                    ? t(selectedStyleIntent.labelKey)
                    : t("dashboard.setup.noneSelected")}
                </dd>
              </div>
              <div>
                <dt className="text-[#849396]">
                  {t("dashboard.setup.modelSource")}
                </dt>
                <dd className="mt-1 font-semibold text-[#e5e2e1]">
                  {t("dashboard.setup.defaultModel")}
                </dd>
              </div>
              <div>
                <dt className="text-[#849396]">
                  {t("dashboard.reference.summaryLabel")}
                </dt>
                <dd className="mt-1 font-semibold leading-5 text-[#e5e2e1]">
                  {selectedReferenceImage &&
                  referenceImageConsentAccepted &&
                  selectedReferenceKindLabel
                    ? t("dashboard.reference.summarySelected", {
                        kind: t(selectedReferenceKindLabel),
                      })
                    : t("dashboard.setup.noneSelected")}
                </dd>
              </div>
              <div>
                <dt className="text-[#849396]">
                  {t("dashboard.setup.defaultGender")}
                </dt>
                <dd className="mt-1 font-semibold capitalize text-[#e5e2e1]">
                  {t(`dashboard.setup.gender.${modelGender}`)}
                </dd>
              </div>
              <div>
                <dt className="text-[#849396]">
                  {t("dashboard.setup.outputType")}
                </dt>
                <dd className="mt-1 font-semibold text-[#e5e2e1]">
                  {outputTypeLabel}
                </dd>
              </div>
            </dl>
            <p className="mt-4 border-t border-[#3b494c]/70 pt-3 text-xs leading-5 text-[#849396]">
              {t("dashboard.setup.composedRequest", {
                count: composedPromptCharacterCount,
                max: MAX_GENERATION_PROMPT_LENGTH,
              })}
            </p>
            {isPromptTooLong ? (
              <p
                className="mt-3 text-xs font-semibold leading-5 text-[#ffb4ab]"
                role="alert"
              >
                {t("dashboard.generate.error.promptTooLong")}
              </p>
            ) : null}
          </aside>
        </div>

        <footer className="border-t border-[#3b494c]/70 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {selectedReferenceImage && referenceImageConsentAccepted ? (
              <button
                aria-label={t(
                  "dashboard.reference.generateWithReferenceAria",
                )}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#2cebcf]/40 bg-[#2cebcf]/[0.06] px-4 py-2.5 text-sm font-bold text-[#c9fff6] transition hover:bg-[#2cebcf]/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2cebcf] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  isGenerating || isPromptTooLong || isReferenceImageUploading
                }
                type="button"
                onClick={onGenerateWithReference}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                {t("dashboard.reference.generateWithReference")}
              </button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isGenerating}
                type="button"
                onClick={onClose}
              >
                {t("common.cancel")}
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isGenerating || isPromptTooLong}
                type="button"
                onClick={onGenerate}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isGenerating
                  ? t("dashboard.setup.submitting")
                  : t("dashboard.setup.generateNow")}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { language, t } = useI18n();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const pendingBannerUserScope = getPendingPaymentBannerScope(user);
  const displayName =
    user?.displayName || user?.fullName || t("auth.hero.mobileBadge");
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [figures, setFigures] = useState<FigureDto[]>([]);
  const [activeFigure, setActiveFigure] = useState<FigureDto | null>(null);
  const [prompt, setPrompt] = useState("");
  const [selectedStyleIntentId, setSelectedStyleIntentId] =
    useState<StyleIntentId | null>(null);
  const [modelSource] = useState<ModelSource>("default");
  const [modelGender, setModelGender] = useState<ModelGender>("unisex");
  const [outputType, setOutputType] = useState<GenerationOutputType>("2d");
  const [referenceKind, setReferenceKind] =
    useState<ReferenceImageKind>("generic_reference");
  const [referenceImageConsentAccepted, setReferenceImageConsentAccepted] =
    useState(false);
  const [selectedReferenceImage, setSelectedReferenceImage] =
    useState<ReferenceImageAssetDto | null>(null);
  const [referenceImagePreviewUrl, setReferenceImagePreviewUrl] = useState<
    string | null
  >(null);
  const [referenceImageError, setReferenceImageError] = useState<string | null>(
    null,
  );
  const [referenceImageUploadProgress, setReferenceImageUploadProgress] =
    useState<number | null>(null);
  const [isReferenceImageUploading, setIsReferenceImageUploading] =
    useState(false);
  const [isGenerationSetupOpen, setIsGenerationSetupOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFiguresLoading, setIsFiguresLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [figuresError, setFiguresError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [selectedFigure, setSelectedFigure] = useState<FigureDto | null>(null);
  const [downloadingAssetKey, setDownloadingAssetKey] = useState<string | null>(
    null,
  );
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [pendingBannerDismissedKeys, setPendingBannerDismissedKeys] = useState<
    Record<string, boolean>
  >({});
  const [pendingBannerDontShow, setPendingBannerDontShow] = useState(false);
  const [autoOpeningStudioFigureId, setAutoOpeningStudioFigureId] = useState<
    string | null
  >(null);
  const isMountedRef = useRef(true);
  const pollingStartedAtRef = useRef<number | null>(null);
  const pollingFigureIdRef = useRef<string | null>(null);
  const hasAutoOpenedStudioRef = useRef(false);
  const autoOpenFigureIdRef = useRef<string | null>(null);
  const autoOpenStudioTimeoutRef = useRef<number | null>(null);
  const generateButtonRef = useRef<HTMLButtonElement | null>(null);
  const referenceImageFileInputRef = useRef<HTMLInputElement | null>(null);
  const referenceImageObjectUrlRef = useRef<string | null>(null);

  const clearAutoOpenStudioTimeout = useCallback(() => {
    if (autoOpenStudioTimeoutRef.current !== null) {
      window.clearTimeout(autoOpenStudioTimeoutRef.current);
      autoOpenStudioTimeoutRef.current = null;
    }
  }, []);

  const resetStudioAutoOpenGuard = useCallback(() => {
    clearAutoOpenStudioTimeout();
    hasAutoOpenedStudioRef.current = false;
    autoOpenFigureIdRef.current = null;
    setAutoOpeningStudioFigureId(null);
  }, [clearAutoOpenStudioTimeout]);

  const loadBillingSummary = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const billingSummary = await billingApi.getBillingMe();

      if (isMountedRef.current) {
        setSummary(billingSummary);
      }
    } catch (loadError) {
      if (isMountedRef.current) {
        setSummary(null);
        setError(getApiErrorMessage(loadError));
      }
    } finally {
      if (showLoading && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const loadFigures = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsFiguresLoading(true);
    }
    setFiguresError(null);

    try {
      const result = await figuresApi.listFigures({ limit: 6 });

      if (!isMountedRef.current) {
        return;
      }

      setFigures(result.figures);
      setActiveFigure((current) => {
        if (current && !isTerminalStatus(current.status)) {
          return current;
        }

        return result.figures.find((figure) => isPollingStatus(figure.status)) ?? current;
      });
    } catch (loadError) {
      if (isMountedRef.current) {
        setFiguresError(getApiErrorMessage(loadError));
      }
    } finally {
      if (showLoading && isMountedRef.current) {
        setIsFiguresLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    void loadBillingSummary();
    void loadFigures();

    return () => {
      isMountedRef.current = false;
      clearAutoOpenStudioTimeout();
    };
  }, [clearAutoOpenStudioTimeout, loadBillingSummary, loadFigures]);

  useEffect(() => {
    return () => {
      if (referenceImageObjectUrlRef.current) {
        URL.revokeObjectURL(referenceImageObjectUrlRef.current);
        referenceImageObjectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const dontShowKey =
      getPendingPaymentBannerDontShowKey(pendingBannerUserScope);

    setPendingBannerDontShow(
      window.localStorage.getItem(dontShowKey) === "true",
    );
    setPendingBannerDismissedKeys({});
  }, [pendingBannerUserScope]);

  useEffect(() => {
    if (!activeFigure || !isPollingStatus(activeFigure.status)) {
      setIsPolling(false);
      pollingStartedAtRef.current = null;
      pollingFigureIdRef.current = null;
      return;
    }

    if (pollingFigureIdRef.current !== activeFigure.id) {
      pollingFigureIdRef.current = activeFigure.id;
      pollingStartedAtRef.current = Date.now();
    }

    let isCancelled = false;
    let pollTimeoutId: number | undefined;

    async function pollFigureStatus() {
      if (!activeFigure || isCancelled || !isMountedRef.current) {
        return;
      }

      const startedAt = pollingStartedAtRef.current ?? Date.now();

      if (Date.now() - startedAt > GENERATION_POLL_TIMEOUT_MS) {
        if (!isCancelled && isMountedRef.current) {
          setIsPolling(false);
          setGenerationError(
            t("dashboard.generate.error.slow"),
          );
        }
        return;
      }

      setIsPolling(true);

      try {
        const updatedFigure = await figuresApi.getFigureStatus(activeFigure.id);

        if (isCancelled || !isMountedRef.current) {
          return;
        }

        setActiveFigure(updatedFigure);
        setFigures((currentFigures) =>
          mergeFigureIntoList(currentFigures, updatedFigure),
        );

        if (isTerminalStatus(updatedFigure.status)) {
          setIsPolling(false);
          pollingStartedAtRef.current = null;
          pollingFigureIdRef.current = null;
          void loadBillingSummary(false);
          void loadFigures(false);
          return;
        }
      } catch (pollError) {
        if (!isCancelled && isMountedRef.current) {
          setIsPolling(false);
          setGenerationError(
            getApiErrorCode(pollError) === "FIGURE_NOT_FOUND"
              ? t("dashboard.generate.error.notFound")
              : t("dashboard.generate.error.refreshFailed"),
          );
        }
        return;
      }

      pollTimeoutId = window.setTimeout(
        pollFigureStatus,
        GENERATION_POLL_INTERVAL_MS,
      );
    }

    pollTimeoutId = window.setTimeout(
      pollFigureStatus,
      GENERATION_POLL_INTERVAL_MS,
    );

    return () => {
      isCancelled = true;
      if (pollTimeoutId !== undefined) {
        window.clearTimeout(pollTimeoutId);
      }
    };
  }, [activeFigure, loadBillingSummary, loadFigures, t]);

  useEffect(() => {
    if (!activeFigure || !isStudio3dReadyFigure(activeFigure)) {
      return;
    }

    const figureId = activeFigure.id;

    if (
      autoOpenFigureIdRef.current === figureId &&
      hasAutoOpenedStudioRef.current
    ) {
      return;
    }

    if (autoOpenFigureIdRef.current === figureId) {
      return;
    }

    clearAutoOpenStudioTimeout();
    autoOpenFigureIdRef.current = figureId;
    setAutoOpeningStudioFigureId(figureId);

    autoOpenStudioTimeoutRef.current = window.setTimeout(() => {
      if (!isMountedRef.current || autoOpenFigureIdRef.current !== figureId) {
        return;
      }

      hasAutoOpenedStudioRef.current = true;
      autoOpenStudioTimeoutRef.current = null;
      navigate(getStudio3dRoute(figureId));
    }, DASHBOARD_STUDIO_AUTO_OPEN_DELAY_MS);

    return () => {
      if (
        autoOpenFigureIdRef.current === figureId &&
        !hasAutoOpenedStudioRef.current
      ) {
        clearAutoOpenStudioTimeout();
        autoOpenFigureIdRef.current = null;
        setAutoOpeningStudioFigureId(null);
      }
    };
  }, [activeFigure, clearAutoOpenStudioTimeout, navigate]);

  const pendingOrder = summary?.pendingOrders[0] ?? null;
  const isPendingOrderWaitingForAdminVerification =
    pendingOrder?.paymentVerification === "user_reported_transferred" ||
    pendingOrder?.paymentVerification === "pending_admin_verification";
  const pendingOrderTransferContent =
    pendingOrder?.bankTransferContent ?? pendingOrder?.orderCode;
  const pendingBannerDismissedKey = pendingOrder
    ? getPendingPaymentBannerDismissedKey(
        pendingBannerUserScope,
        pendingOrder.id,
      )
    : null;
  const pendingBannerDismissed =
    Boolean(
      pendingBannerDismissedKey &&
        pendingBannerDismissedKeys[pendingBannerDismissedKey],
    ) ||
    Boolean(
      pendingBannerDismissedKey &&
        window.localStorage.getItem(pendingBannerDismissedKey) === "true",
    );
  const shouldShowPendingOrderBanner =
    Boolean(pendingOrder) && !pendingBannerDontShow && !pendingBannerDismissed;
  const renewalDate = formatI18nDate(
    summary?.plan.currentPeriodEnd,
    language,
    "",
  );
  const latestPayment = summary?.latestPayment;
  const creditBalance = summary?.credits.balance ?? 0;
  const hasLoadedZeroCredits = Boolean(summary) && creditBalance <= 0;
  const trimmedPrompt = prompt.trim();
  const selectedStyleIntent = STYLE_INTENTS.find(
    (styleIntent) => styleIntent.id === selectedStyleIntentId,
  );
  const composedPrompt = composeGenerationPrompt(
    trimmedPrompt,
    selectedStyleIntent,
    modelGender,
    outputType,
  );
  const setupDetailsCharacterCount =
    composedPrompt.length - trimmedPrompt.length;
  const composedPromptCharacterCount = composedPrompt.length;
  const isComposedPromptTooLong =
    composedPromptCharacterCount > MAX_GENERATION_PROMPT_LENGTH;
  const estimatedBalanceAfterSubmit = Math.max(creditBalance - 1, 0);
  const canGenerate =
    trimmedPrompt.length > 0 &&
    !isGenerating &&
    !hasLoadedZeroCredits &&
    !isComposedPromptTooLong;
  const insufficientCreditsMessage = t(
    "dashboard.generate.error.insufficientCredits",
  );
  const promptTooLongMessage = t("dashboard.generate.error.promptTooLong");

  const recentFiguresTitle = useMemo(() => {
    if (isFiguresLoading) {
      return t("dashboard.recent.loading");
    }

    if (figures.length === 0) {
      return t("dashboard.recent.empty");
    }

    return t("dashboard.recent.count", {
      count: figures.length,
      plural: figures.length === 1 ? "" : "s",
    });
  }, [figures.length, isFiguresLoading, t]);

  const handleViewFigure = useCallback((figure: FigureDto) => {
    setSelectedFigure(figure);
  }, []);

  const handleCloseFigurePreview = useCallback(() => {
    setSelectedFigure(null);
  }, []);

  const handleCloseGenerationSetup = useCallback(() => {
    setIsGenerationSetupOpen(false);
    window.requestAnimationFrame(() => generateButtonRef.current?.focus());
  }, []);

  const clearReferenceImageObjectUrl = useCallback(() => {
    if (referenceImageObjectUrlRef.current) {
      URL.revokeObjectURL(referenceImageObjectUrlRef.current);
      referenceImageObjectUrlRef.current = null;
    }
  }, []);

  const handleDownloadFigureAsset = useCallback(
    async (figure: FigureDto, kind: FigureAssetKind) => {
      const url =
        kind === "image" ? getFigurePreviewUrl(figure) : figure.modelUrl;

      if (!url) {
        return;
      }

      const assetKey = getFigureAssetKey(figure, kind);

      setDownloadingAssetKey(assetKey);

      try {
        await downloadUrlWithFallback(url, getDownloadFileName(figure, kind));
      } finally {
        if (isMountedRef.current) {
          setDownloadingAssetKey((currentKey) =>
            currentKey === assetKey ? null : currentKey,
          );
        }
      }
    },
    [],
  );

  const handleReferenceImageKindChange = useCallback(
    (kind: ReferenceImageKind) => {
      setReferenceKind(kind);
      setReferenceImageError(null);
    },
    [],
  );

  const handleReferenceImageConsentChange = useCallback((accepted: boolean) => {
    setReferenceImageConsentAccepted(accepted);
    setReferenceImageError(null);
  }, []);

  const handleRemoveReferenceImage = useCallback(() => {
    clearReferenceImageObjectUrl();
    setSelectedReferenceImage(null);
    setReferenceImagePreviewUrl(null);
    setReferenceImageError(null);
    setReferenceImageUploadProgress(null);
    setIsReferenceImageUploading(false);

    if (referenceImageFileInputRef.current) {
      referenceImageFileInputRef.current.value = "";
    }
  }, [clearReferenceImageObjectUrl]);

  const handleReferenceImageFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;

      event.target.value = "";

      if (!file) {
        return;
      }

      if (!referenceImageConsentAccepted) {
        setReferenceImageError(t("dashboard.reference.error.consentRequired"));
        return;
      }

      const validationError = getReferenceImageValidationError(file, t);

      if (validationError) {
        clearReferenceImageObjectUrl();
        setSelectedReferenceImage(null);
        setReferenceImagePreviewUrl(null);
        setReferenceImageError(validationError);
        setReferenceImageUploadProgress(null);
        return;
      }

      clearReferenceImageObjectUrl();

      const localPreviewUrl = URL.createObjectURL(file);
      referenceImageObjectUrlRef.current = localPreviewUrl;
      setSelectedReferenceImage(null);
      setReferenceImagePreviewUrl(localPreviewUrl);
      setReferenceImageError(null);
      setReferenceImageUploadProgress(0);
      setIsReferenceImageUploading(true);

      try {
        const uploadedAsset = await figuresApi.uploadReferenceImageAsset({
          file,
          referenceKind,
          consentAccepted: true,
          onUploadProgress: (progress) => {
            if (isMountedRef.current) {
              setReferenceImageUploadProgress(progress);
            }
          },
        });

        if (!isMountedRef.current) {
          return;
        }

        setSelectedReferenceImage(uploadedAsset);
        setReferenceKind(uploadedAsset.referenceKind);
        setReferenceImageUploadProgress(100);

        if (uploadedAsset.previewUrl) {
          clearReferenceImageObjectUrl();
          setReferenceImagePreviewUrl(uploadedAsset.previewUrl);
        }
      } catch (uploadError) {
        if (isMountedRef.current) {
          setSelectedReferenceImage(null);
          setReferenceImageError(getApiErrorMessage(uploadError));
        }
      } finally {
        if (isMountedRef.current) {
          setIsReferenceImageUploading(false);
          setReferenceImageUploadProgress(null);
        }
      }
    },
    [
      clearReferenceImageObjectUrl,
      referenceImageConsentAccepted,
      referenceKind,
      t,
    ],
  );

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedPrompt || isGenerating) {
      return;
    }

    if (hasLoadedZeroCredits) {
      setGenerationError(insufficientCreditsMessage);
      return;
    }

    if (isComposedPromptTooLong) {
      setGenerationError(promptTooLongMessage);
      return;
    }

    setGenerationError(null);
    setIsGenerationSetupOpen(true);
  }

  async function handleGenerateNow() {
    if (!trimmedPrompt || isGenerating) {
      return;
    }

    if (hasLoadedZeroCredits) {
      handleCloseGenerationSetup();
      setGenerationError(insufficientCreditsMessage);
      return;
    }

    if (isComposedPromptTooLong) {
      setGenerationError(promptTooLongMessage);
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    resetStudioAutoOpenGuard();
    handleCloseGenerationSetup();

    try {
      const figure = await figuresApi.generateFigure({
        prompt: composedPrompt,
      });

      if (!isMountedRef.current) {
        return;
      }

      setPrompt("");
      setActiveFigure(figure);
      setFigures((currentFigures) => mergeFigureIntoList(currentFigures, figure));
      void loadBillingSummary(false);
      void loadFigures(false);
    } catch (generateError) {
      if (!isMountedRef.current) {
        return;
      }

      const errorCode = getApiErrorCode(generateError);

      if (errorCode === "INSUFFICIENT_GENERATION_CREDITS") {
        setGenerationError(insufficientCreditsMessage);
        void loadBillingSummary(false);
      } else if (errorCode === "GENERATION_PROVIDER_UNAVAILABLE") {
        setGenerationError(
          t("dashboard.generate.error.serviceUnavailable"),
        );
      } else if (errorCode === "GENERATION_FAILED") {
        setGenerationError(
          t("dashboard.generate.error.failedBeforeResult"),
        );
      } else {
        setGenerationError(getApiErrorMessage(generateError));
      }
    } finally {
      if (isMountedRef.current) {
        setIsGenerating(false);
      }
    }
  }

  async function handleGenerateWithReference() {
    if (!selectedReferenceImage || !trimmedPrompt || isGenerating) {
      return;
    }

    if (hasLoadedZeroCredits) {
      handleCloseGenerationSetup();
      setGenerationError(insufficientCreditsMessage);
      return;
    }

    if (isComposedPromptTooLong) {
      setGenerationError(promptTooLongMessage);
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    resetStudioAutoOpenGuard();
    handleCloseGenerationSetup();

    try {
      const figure = await figuresApi.generateFigureFromReference({
        inputAssetId: selectedReferenceImage.assetId,
        prompt: composedPrompt,
      });

      if (!isMountedRef.current) {
        return;
      }

      setPrompt("");
      setActiveFigure(figure);
      setFigures((currentFigures) => mergeFigureIntoList(currentFigures, figure));
      void loadBillingSummary(false);
      void loadFigures(false);
    } catch (generateError) {
      if (!isMountedRef.current) {
        return;
      }

      const errorCode = getApiErrorCode(generateError);

      if (errorCode === "INSUFFICIENT_GENERATION_CREDITS") {
        setGenerationError(insufficientCreditsMessage);
        void loadBillingSummary(false);
      } else if (errorCode === "GENERATION_MODE_UNSUPPORTED") {
        setGenerationError(t("dashboard.reference.error.unsupported"));
      } else if (errorCode === "GENERATION_PROVIDER_UNAVAILABLE") {
        setGenerationError(
          t("dashboard.generate.error.serviceUnavailable"),
        );
      } else if (errorCode === "GENERATION_FAILED") {
        setGenerationError(
          t("dashboard.generate.error.failedBeforeResult"),
        );
      } else {
        setGenerationError(getApiErrorMessage(generateError));
      }
    } finally {
      if (isMountedRef.current) {
        setIsGenerating(false);
      }
    }
  }

  function dismissPendingPaymentBanner() {
    if (!pendingBannerDismissedKey) {
      return;
    }

    window.localStorage.setItem(pendingBannerDismissedKey, "true");
    setPendingBannerDismissedKeys((currentKeys) => ({
      ...currentKeys,
      [pendingBannerDismissedKey]: true,
    }));
  }

  function dontShowPendingPaymentBannerAgain() {
    const dontShowKey =
      getPendingPaymentBannerDontShowKey(pendingBannerUserScope);

    window.localStorage.setItem(dontShowKey, "true");
    setPendingBannerDontShow(true);
  }

  return (
    <DashboardShell planLabel={summary?.plan.name}>
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-[1200px] space-y-6">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="dashboard-label font-bold text-[#00e5ff]">
                {t("dashboard.header.eyebrow")}
              </p>
              <h1 className="dashboard-page-title mt-3 font-display font-semibold text-white">
                {t("dashboard.header.greeting", { name: displayName })}
              </h1>
              <p className="dashboard-copy mt-3 max-w-2xl text-[#bac9cc]">
                {t("dashboard.header.body")}
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
              to="/credits"
            >
              {t("dashboard.header.creditsPlans")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </header>

          {shouldShowPendingOrderBanner && pendingOrder ? (
            <section className="rounded-md border border-[#f3bf26]/25 bg-[#f3bf26]/[0.07] px-4 py-3 text-[#ffeac0]">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 gap-3">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold leading-6 text-white">
                      {t("dashboard.pending.forProduct", {
                        state: isPendingOrderWaitingForAdminVerification
                          ? t("dashboard.pending.waiting")
                          : t("dashboard.pending.transferRequired"),
                        product: getProductName(pendingOrder),
                      })}
                    </h2>
                    <p className="mt-0.5 text-sm leading-6 text-[#ffeac0]/75">
                      {isPendingOrderWaitingForAdminVerification
                        ? t("dashboard.pending.waitingBody")
                        : t("dashboard.pending.transferBody")}
                    </p>
                    {pendingOrderTransferContent ? (
                      <p className="mt-2 break-all font-mono text-xs font-bold text-[#ffeac0]">
                        {t("dashboard.pending.transferContent")}{" "}
                        {pendingOrderTransferContent}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[380px]">
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#f3bf26] px-4 py-2.5 text-center text-sm font-bold leading-5 text-[#251a00] transition hover:bg-[#ffdf96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffdf96]"
                    to={`/credits/checkout/${pendingOrder.id}`}
                  >
                    {isPendingOrderWaitingForAdminVerification
                      ? t("dashboard.pending.viewStatus")
                      : t("dashboard.pending.continueCheckout")}
                  </Link>
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#f3bf26]/45 px-4 py-2.5 text-center text-sm font-bold leading-5 text-[#ffeac0] transition hover:bg-[#f3bf26]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffdf96]"
                    to="/payments"
                  >
                    {t("dashboard.pending.viewPayments")}
                  </Link>
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-bold text-[#ffeac0]/80 transition hover:bg-[#f3bf26]/10 hover:text-[#ffeac0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffdf96]"
                    type="button"
                    onClick={dontShowPendingPaymentBannerAgain}
                  >
                    {t("dashboard.pending.dontShowAgain")}
                  </button>
                  <button
                    aria-label={t("dashboard.pending.dismissAria")}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-bold text-[#ffeac0]/80 transition hover:bg-[#f3bf26]/10 hover:text-[#ffeac0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffdf96]"
                    type="button"
                    onClick={dismissPendingPaymentBanner}
                  >
                    <X className="h-3.5 w-3.5" />
                    {t("dashboard.pending.dismiss")}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {error ? (
            <section
              className="rounded-md border border-[#ffb4ab]/25 bg-[#93000a]/20 px-4 py-3 text-[#ffdad6]"
              role="alert"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      {t("dashboard.billingError.title")}
                    </h2>
                    <p className="mt-1 text-sm text-[#ffdad6]/80">{error}</p>
                  </div>
                </div>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#ffb4ab]/35 px-4 py-2.5 text-sm font-bold text-[#ffdad6] transition hover:bg-[#ffb4ab]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffb4ab]"
                  type="button"
                  onClick={() => void loadBillingSummary()}
                >
                  <RefreshCw className="h-4 w-4" />
                  {t("common.retry")}
                </button>
              </div>
            </section>
          ) : null}

          {isLoading ? (
            <DashboardSkeleton />
          ) : (
            <section className="grid gap-5 lg:grid-cols-12">
              <article className="relative overflow-hidden rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-5 lg:col-span-9 lg:p-6">
                <div className="absolute inset-x-0 top-0 h-px bg-[#00e5ff]/30" />
                <form
                  className="flex h-full min-h-[320px] flex-col gap-4 sm:gap-5"
                  onSubmit={(event) => void handleGenerate(event)}
                >
                  <div className="min-w-0">
                    <span className="dashboard-label inline-flex items-center gap-2 font-bold text-[#bac9cc]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#00e5ff]/70" />
                      {t("dashboard.generate.eyebrow")}
                    </span>
                    <h2 className="dashboard-generation-title mt-3 max-w-2xl font-display font-semibold text-white">
                      {t("dashboard.generate.title")}
                    </h2>
                    <p className="dashboard-copy mt-2 max-w-3xl text-[#bac9cc]">
                      {t("dashboard.generate.body")}
                    </p>
                  </div>

                  <div>
                    <label
                      className="text-sm font-bold text-[#e5e2e1]"
                      htmlFor="generation-prompt"
                    >
                      {t("dashboard.generate.promptLabel")}
                    </label>
                    <textarea
                      aria-describedby={`generation-prompt-help${
                        isComposedPromptTooLong
                          ? " generation-prompt-length-error"
                          : ""
                      }`}
                      aria-invalid={isComposedPromptTooLong}
                      className="mt-3 min-h-[150px] w-full resize-y rounded-md border border-[#3b494c] bg-[#0e0e0e] px-4 py-3 text-[0.96875rem] leading-7 text-white outline-none transition placeholder:text-[#849396] focus:border-[#00e5ff]/60 focus:ring-2 focus:ring-[#00e5ff]/20 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isGenerating}
                      id="generation-prompt"
                      maxLength={MAX_GENERATION_PROMPT_LENGTH}
                      placeholder={t("dashboard.generate.promptPlaceholder")}
                      value={prompt}
                      onChange={(event) => {
                        setPrompt(event.target.value);
                        setGenerationError(null);
                      }}
                    />
                    <div
                      className="mt-2 flex flex-col gap-2 text-[#849396] sm:flex-row sm:items-start sm:justify-between"
                      id="generation-prompt-help"
                    >
                      <span className="dashboard-helper-copy min-w-0">
                        {t("dashboard.generate.promptHelp")}
                      </span>
                      <span className="dashboard-utility-label font-semibold tabular-nums sm:max-w-[260px] sm:text-right">
                        {t("dashboard.generate.promptCount", {
                          promptCount: trimmedPrompt.length,
                          setupCount: setupDetailsCharacterCount,
                          maxCount: MAX_GENERATION_PROMPT_LENGTH,
                        })}
                      </span>
                    </div>
                    {isComposedPromptTooLong ? (
                      <p
                        className="mt-2 text-xs font-semibold leading-5 text-[#ffb4ab]"
                        id="generation-prompt-length-error"
                        role="alert"
                      >
                        {promptTooLongMessage}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <p className="text-[0.95rem] font-bold leading-6 text-[#e5e2e1]">
                      {t("dashboard.generate.styleIntent")}
                    </p>
                    <p className="dashboard-helper-copy mt-1 text-[#849396]">
                      {t("dashboard.generate.styleHelp")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {STYLE_INTENTS.map((styleIntent) => {
                        const isSelected =
                          styleIntent.id === selectedStyleIntentId;

                        return (
                          <button
                            aria-pressed={isSelected}
                            className={`dashboard-chip inline-flex min-h-11 max-w-full items-center justify-center rounded-md border px-3.5 py-2.5 text-left font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60 ${
                              isSelected
                                ? "border-[#00e5ff]/70 bg-[#00e5ff]/15 text-[#c3f5ff]"
                                : "border-white/[0.12] bg-white/[0.03] text-[#bac9cc] hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 hover:text-[#c3f5ff]"
                            }`}
                            disabled={isGenerating}
                            key={styleIntent.id}
                            type="button"
                            onClick={() => {
                              setSelectedStyleIntentId((current) =>
                                current === styleIntent.id
                                  ? null
                                  : styleIntent.id,
                              );
                              setGenerationError(null);
                            }}
                          >
                            {t(styleIntent.labelKey)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {hasLoadedZeroCredits ? (
                    <div className="rounded-lg border border-[#f3bf26]/30 bg-[#f3bf26]/10 p-4 text-sm leading-6 text-[#ffeac0]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p>{insufficientCreditsMessage}</p>
                        <Link
                          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-[#f3bf26] px-4 py-2.5 text-sm font-bold text-[#251a00] transition hover:bg-[#ffdf96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffdf96]"
                          to="/credits"
                        >
                          {t("dashboard.generate.buyCredits")}
                        </Link>
                      </div>
                    </div>
                  ) : null}

                  {generationError ? (
                    <div
                      className="rounded-lg border border-[#ffb4ab]/30 bg-[#93000a]/25 p-4 text-sm leading-6 text-[#ffdad6]"
                      role="alert"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex gap-3">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <p>{generationError}</p>
                        </div>
                        {generationError === insufficientCreditsMessage ? (
                          <Link
                            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
                            to="/credits"
                          >
                            {t("dashboard.generate.buyCredits")}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-md border-y border-[#3b494c]/70 py-3">
                    <dl className="grid gap-3 text-sm leading-6 text-[#bac9cc] sm:grid-cols-3">
                      <div className="flex min-w-0 items-center justify-between gap-3 sm:block">
                        <dt className="dashboard-utility-label font-bold text-[#849396]">
                          {t("dashboard.generate.cost")}
                        </dt>
                        <dd className="text-right font-bold text-white sm:mt-1 sm:text-left">
                          {t("dashboard.generate.oneCredit")}
                        </dd>
                      </div>
                      <div className="flex min-w-0 items-center justify-between gap-3 sm:block">
                        <dt className="dashboard-utility-label font-bold text-[#849396]">
                          {t("dashboard.generate.balance")}
                        </dt>
                        <dd className="text-right font-bold text-[#9cf0ff] sm:mt-1 sm:text-left">
                          {t("dashboard.generate.credits", {
                            count: creditBalance,
                          })}
                        </dd>
                      </div>
                      {summary && creditBalance > 0 ? (
                        <div className="flex min-w-0 items-center justify-between gap-3 sm:block">
                          <dt className="dashboard-utility-label font-bold text-[#849396]">
                            {t("dashboard.generate.balanceAfter")}
                          </dt>
                          <dd className="text-right font-bold text-[#c9fff6] sm:mt-1 sm:text-left">
                            {t("dashboard.generate.credits", {
                              count: estimatedBalanceAfterSubmit,
                            })}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                    <p className="mt-2 text-xs leading-5 text-[#849396]">
                      {t("dashboard.generate.estimate")}
                    </p>
                  </div>

                  <div>
                    <button
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-5 py-3 text-center text-sm font-bold leading-5 text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[220px]"
                      disabled={!canGenerate}
                      ref={generateButtonRef}
                      type="submit"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {isGenerating
                        ? t("dashboard.generate.generating")
                        : t("dashboard.generate.generate")}
                    </button>
                  </div>

                  {activeFigure ? (
                    <>
                      <GenerationResultNotice
                        figure={activeFigure}
                        isAutoOpeningStudio={
                          autoOpeningStudioFigureId === activeFigure.id
                        }
                      />
                      <ActiveFigurePanel
                        downloadingAssetKey={downloadingAssetKey}
                        figure={activeFigure}
                        isPolling={isPolling}
                        onDownload={(figure, kind) =>
                          void handleDownloadFigureAsset(figure, kind)
                        }
                        onView={handleViewFigure}
                      />
                    </>
                  ) : null}
                </form>
              </article>

              <article className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-5 lg:col-span-3 lg:p-6">
                <div className="flex items-start justify-between gap-4">
                  <Database className="h-6 w-6 text-[#bac9cc]" />
                  <Link
                    className="dashboard-utility-label inline-flex items-center gap-1 font-bold text-[#00e5ff] transition hover:text-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                    to="/credits"
                  >
                    {t("dashboard.card.topUp")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <p className="dashboard-label mt-5 font-bold text-[#bac9cc]">
                  {t("dashboard.card.creditBalance")}
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-5xl font-semibold leading-none text-white">
                    {creditBalance}
                  </span>
                  <span className="text-base font-semibold text-[#bac9cc]">
                    {t("shell.nav.credits").toLowerCase()}
                  </span>
                </div>
                <p className="dashboard-helper-copy mt-4 border-t border-[#3b494c]/70 pt-4 text-[#bac9cc]">
                  {t("dashboard.card.creditRule")}
                </p>
              </article>

              <article className="overflow-hidden rounded-lg border border-[#3b494c] bg-[#1c1b1b] lg:col-span-12">
                <div className="grid md:grid-cols-3 md:divide-x md:divide-[#3b494c]/60">
                  <div className="flex min-w-0 flex-col gap-3 border-b border-[#3b494c]/60 p-5 md:border-b-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white/[0.06] text-[#bac9cc]">
                        <CreditCard className="h-5 w-5" />
                      </span>
                      <span className="dashboard-utility-label font-bold text-[#849396]">
                        {getPlanTone(summary, t)}
                      </span>
                    </div>
                    <div>
                      <h2 className="font-display text-xl font-semibold text-white">
                        {summary?.plan.name ?? t("dashboard.card.free")}
                      </h2>
                      <p className="dashboard-helper-copy mt-1 text-[#bac9cc]">
                        {summary?.plan.status === "active"
                          ? t("dashboard.card.activePlanBody")
                          : t("dashboard.card.freePlanBody")}
                      </p>
                      {renewalDate ? (
                        <p className="mt-2 text-xs font-semibold text-[#e5e2e1]">
                          {t("dashboard.card.activeThrough", {
                            date: renewalDate,
                          })}
                        </p>
                      ) : null}
                    </div>
                    <Link
                      className="mt-auto inline-flex min-h-11 items-center justify-center rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/35 hover:bg-[#00e5ff]/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                      to="/credits"
                    >
                      {summary?.plan.status === "active"
                        ? t("dashboard.card.managePlan")
                        : t("dashboard.card.upgrade")}
                    </Link>
                  </div>

                  <div className="flex min-w-0 flex-col gap-3 border-b border-[#3b494c]/60 p-5 md:border-b-0">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-md ${
                        summary?.capabilities.canExportModel
                          ? "bg-[#2cebcf]/10 text-[#2cebcf]"
                          : "bg-[#f3bf26]/10 text-[#f3bf26]"
                      }`}
                    >
                      {summary?.capabilities.canExportModel ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <LockKeyhole className="h-5 w-5" />
                      )}
                    </span>
                    <div>
                      <h2 className="font-display text-xl font-semibold text-white">
                        {t("dashboard.card.exportAccess")}
                      </h2>
                      <p className="dashboard-helper-copy mt-1 text-[#bac9cc]">
                        {summary?.capabilities.canExportModel
                          ? t("dashboard.card.exportConfirmed")
                          : t("dashboard.card.exportBlocked")}
                      </p>
                    </div>
                    <button
                      className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/35 hover:bg-[#00e5ff]/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                      type="button"
                      onClick={() => {
                        if (!summary?.capabilities.canExportModel) {
                          setIsPaywallOpen(true);
                        }
                      }}
                    >
                      <Download className="h-4 w-4" />
                      {t("dashboard.card.downloadExportAccess")}
                    </button>
                  </div>

                  <div className="flex min-w-0 flex-col gap-3 p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white/[0.06] text-[#bac9cc]">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-display text-xl font-semibold text-white">
                        {t("dashboard.card.account")}
                      </h2>
                      <p className="mt-1 truncate text-sm font-semibold text-[#e5e2e1]">
                        {user?.email || t("dashboard.card.noEmail")}
                      </p>
                      <p className="dashboard-helper-copy mt-1 text-[#bac9cc]">
                        {t("dashboard.card.accountBody")}
                      </p>
                    </div>
                    <Link
                      className="mt-auto inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2.5 text-sm font-bold text-[#bac9cc] transition hover:bg-white/[0.05] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                      to="/profile"
                    >
                      {t("dashboard.card.viewProfile")}
                    </Link>
                  </div>
                </div>
              </article>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-[1.6rem] font-semibold leading-[1.16] text-white sm:text-2xl">
                  {t("dashboard.recent.title")}
                </h2>
                <p className="mt-1 text-sm text-[#bac9cc]">
                  {recentFiguresTitle}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {latestPayment ? (
                  <p className="text-sm font-semibold text-[#bac9cc]">
                    {t("dashboard.recent.latestPayment", {
                      status: getDisplayLabel(
                        "paymentStatus",
                        latestPayment.status,
                        language,
                      ),
                    })}
                  </p>
                ) : null}
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-3 py-2 text-xs font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                  type="button"
                  onClick={() => void loadFigures(false)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t("common.refresh")}
                </button>
              </div>
            </div>

            {figuresError ? (
              <section
                className="rounded-lg border border-[#ffb4ab]/30 bg-[#93000a]/25 p-4 text-[#ffdad6]"
                role="alert"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="text-sm">{figuresError}</p>
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

            {isFiguresLoading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    className="h-72 animate-pulse rounded-lg border border-white/10 bg-white/[0.05]"
                    key={index}
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {figures.length === 0 ? (
                  <FigureEmptyState />
                ) : (
                  figures.map((figure) => (
                    <FigureCard
                      downloadingAssetKey={downloadingAssetKey}
                      figure={figure}
                      key={figure.id}
                      onDownload={(selected, kind) =>
                        void handleDownloadFigureAsset(selected, kind)
                      }
                      onView={handleViewFigure}
                    />
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      </main>
      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
      />
      {isGenerationSetupOpen ? (
        <GenerationSetupDialog
          composedPromptCharacterCount={composedPromptCharacterCount}
          creditBalance={creditBalance}
          estimatedBalanceAfterSubmit={estimatedBalanceAfterSubmit}
          isGenerating={isGenerating}
          isPromptTooLong={isComposedPromptTooLong}
          isReferenceImageUploading={isReferenceImageUploading}
          modelGender={modelGender}
          modelSource={modelSource}
          outputType={outputType}
          promptCharacterCount={trimmedPrompt.length}
          referenceImageConsentAccepted={referenceImageConsentAccepted}
          referenceImageError={referenceImageError}
          referenceImageFileInputRef={referenceImageFileInputRef}
          referenceImagePreviewUrl={referenceImagePreviewUrl}
          referenceImageUploadProgress={referenceImageUploadProgress}
          referenceKind={referenceKind}
          selectedStyleIntent={selectedStyleIntent}
          selectedReferenceImage={selectedReferenceImage}
          onClose={handleCloseGenerationSetup}
          onGenerate={() => void handleGenerateNow()}
          onGenerateWithReference={() => void handleGenerateWithReference()}
          onModelGenderChange={(gender) => {
            setModelGender(gender);
            setGenerationError(null);
          }}
          onOutputTypeChange={(selectedOutputType) => {
            setOutputType(selectedOutputType);
            setGenerationError(null);
          }}
          onReferenceImageConsentChange={handleReferenceImageConsentChange}
          onReferenceImageFileChange={(event) =>
            void handleReferenceImageFileChange(event)
          }
          onReferenceImageKindChange={handleReferenceImageKindChange}
          onRemoveReferenceImage={handleRemoveReferenceImage}
        />
      ) : null}
      {selectedFigure ? (
        <FigurePreviewDialog
          downloadingAssetKey={downloadingAssetKey}
          figure={selectedFigure}
          onClose={handleCloseFigurePreview}
          onDownload={(figure, kind) =>
            void handleDownloadFigureAsset(figure, kind)
          }
        />
      ) : null}
    </DashboardShell>
  );
}
