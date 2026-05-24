import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
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
} from "../features/figures/figures.types";
import { getApiErrorCode, getApiErrorMessage } from "../services/apiClient";

const GENERATION_POLL_INTERVAL_MS = 3000;
const GENERATION_POLL_TIMEOUT_MS = 5 * 60 * 1000;
const INSUFFICIENT_CREDITS_MESSAGE =
  "You’ve used all your generation credits. Buy more credits or upgrade your plan to continue.";
type FigureAssetKind = "image" | "model";

function formatDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getProductName(order: BillingOrder | null | undefined) {
  return order?.items[0]?.productName ?? "billing order";
}

function getPlanTone(summary: BillingSummary | null) {
  if (!summary) {
    return "Checking";
  }

  return summary.plan.status === "active" ? "Active plan" : "Free plan";
}

function isPollingStatus(status: FigureStatus) {
  return status === "queued" || status === "processing";
}

function isTerminalStatus(status: FigureStatus) {
  return status === "success" || status === "failed" || status === "canceled";
}

function formatStatus(status: FigureStatus) {
  if (status === "queued") {
    return "Queued";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
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

function getFigurePreviewUrl(figure: FigureDto) {
  return figure.previewUrl || figure.thumbnailUrl || null;
}

function getFigureAssetKey(figure: FigureDto, kind: FigureAssetKind) {
  return `${figure.id}:${kind}`;
}

function getDownloadFileName(figure: FigureDto, kind: FigureAssetKind) {
  if (kind === "model") {
    return `3d-stylist-model-${figure.id}.glb`;
  }

  return `3d-stylist-generation-${figure.id}.png`;
}

function getFigurePlaceholderCopy(figure: FigureDto) {
  if (figure.status === "queued" || figure.status === "processing") {
    return "Generating...";
  }

  if (
    figure.status === "success" &&
    !getFigurePreviewUrl(figure) &&
    !figure.modelUrl
  ) {
    return "Generation complete. Preview will appear when provider result is available.";
  }

  if (figure.status === "failed") {
    return figure.failureReason || "Generation failed. Please try again later.";
  }

  if (figure.status === "canceled") {
    return "Generation canceled.";
  }

  return "Preview pending";
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
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function getPromptSnippet(prompt: string | null | undefined) {
  const value = prompt?.trim();

  if (!value) {
    return "Untitled generation";
  }

  return value.length > 92 ? `${value.slice(0, 92)}...` : value;
}

function mergeFigureIntoList(figures: FigureDto[], figure: FigureDto) {
  const exists = figures.some((item) => item.id === figure.id);

  if (exists) {
    return figures.map((item) => (item.id === figure.id ? figure : item));
  }

  return [figure, ...figures].slice(0, 6);
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="h-72 animate-pulse rounded-lg border border-white/10 bg-white/[0.05] lg:col-span-8" />
      <div className="h-72 animate-pulse rounded-lg border border-white/10 bg-white/[0.05] lg:col-span-4" />
      <div className="h-52 animate-pulse rounded-lg border border-white/10 bg-white/[0.05] lg:col-span-4" />
      <div className="h-52 animate-pulse rounded-lg border border-white/10 bg-white/[0.05] lg:col-span-4" />
      <div className="h-52 animate-pulse rounded-lg border border-white/10 bg-white/[0.05] lg:col-span-4" />
    </div>
  );
}

function FigureStatusBadge({ status }: { status: FigureStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] ${getFigureStatusTone(
        status,
      )}`}
    >
      {isPollingStatus(status) ? <Clock3 className="h-3.5 w-3.5" /> : null}
      {formatStatus(status)}
    </span>
  );
}

function FigurePreview({ figure }: { figure: FigureDto }) {
  const previewUrl = getFigurePreviewUrl(figure);
  const placeholderCopy = getFigurePlaceholderCopy(figure);

  if (previewUrl) {
    return (
      <img
        alt={getPromptSnippet(figure.prompt)}
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
  const createdDate = formatDate(figure.createdAt);
  const previewUrl = getFigurePreviewUrl(figure);
  const canViewImage = figure.status === "success" && Boolean(previewUrl);
  const isImageDownloading =
    downloadingAssetKey === getFigureAssetKey(figure, "image");
  const isModelDownloading =
    downloadingAssetKey === getFigureAssetKey(figure, "model");

  return (
    <article className="overflow-hidden rounded-lg border border-[#3b494c]/70 bg-[#201f1f]">
      <div className="aspect-square overflow-hidden border-b border-[#3b494c]/70 bg-[#0e0e0e]">
        <FigurePreview figure={figure} />
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FigureStatusBadge status={figure.status} />
          {createdDate ? (
            <span className="text-xs font-semibold text-[#849396]">
              {createdDate}
            </span>
          ) : null}
        </div>
        <p className="min-h-12 text-sm font-semibold leading-6 text-[#e5e2e1]">
          {getPromptSnippet(figure.prompt)}
        </p>
        {figure.status === "failed" && figure.failureReason ? (
          <p className="rounded-md border border-[#ffb4ab]/20 bg-[#93000a]/20 p-3 text-xs leading-5 text-[#ffdad6]">
            {figure.failureReason}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {canViewImage ? (
            <button
              aria-label={`View image for ${getPromptSnippet(figure.prompt)}`}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-3 py-2 text-xs font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
              type="button"
              onClick={() => onView(figure)}
            >
              <Eye className="h-3.5 w-3.5" />
              View image
            </button>
          ) : null}
          {previewUrl ? (
            <button
              aria-label={`Download image for ${getPromptSnippet(
                figure.prompt,
              )}`}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-3 py-2 text-xs font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isImageDownloading}
              type="button"
              onClick={() => onDownload(figure, "image")}
            >
              {isImageDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download image
            </button>
          ) : null}
          {figure.modelUrl ? (
            <a
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-3 py-2 text-xs font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
              href={figure.modelUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open model
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          {figure.modelUrl ? (
            <button
              aria-label={`Download model for ${getPromptSnippet(
                figure.prompt,
              )}`}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-3 py-2 text-xs font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isModelDownloading}
              type="button"
              onClick={() => onDownload(figure, "model")}
            >
              {isModelDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download model
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
  const previewUrl = getFigurePreviewUrl(figure);
  const createdDate = formatDate(figure.createdAt);
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
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg border border-[#3b494c] bg-[#141313] shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-[#3b494c]/70 p-4 sm:p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00e5ff]">
              Generated result
            </p>
            <h2
              className="mt-2 font-display text-2xl font-semibold text-white"
              id="figure-preview-dialog-title"
            >
              Image preview
            </h2>
          </div>
          <button
            aria-label="Close image preview"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/[0.12] text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
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
                alt={getPromptSnippet(figure.prompt)}
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
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#849396]">
                Prompt
              </p>
              <p className="mt-2 text-sm leading-6 text-[#e5e2e1]">
                {figure.prompt?.trim() || "Untitled generation"}
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
                  Download image
                </button>
              ) : null}
              {figure.modelUrl ? (
                <a
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                  href={figure.modelUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open model
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
                  Download model
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
  const previewUrl = getFigurePreviewUrl(figure);
  const hasResultAsset = Boolean(previewUrl || figure.modelUrl);
  const isImageDownloading =
    downloadingAssetKey === getFigureAssetKey(figure, "image");
  const isModelDownloading =
    downloadingAssetKey === getFigureAssetKey(figure, "model");

  return (
    <div className="grid gap-4 rounded-lg border border-[#3b494c]/70 bg-[#0e0e0e] p-4 md:grid-cols-[160px_1fr]">
      <div className="aspect-square overflow-hidden rounded-md border border-[#3b494c] bg-[#090909]">
        <FigurePreview figure={figure} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <FigureStatusBadge status={figure.status} />
          {isPolling ? (
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#bac9cc]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Syncing
            </span>
          ) : null}
        </div>
        <h3 className="mt-3 font-display text-xl font-semibold text-white">
          Current generation
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
          {getPromptSnippet(figure.prompt)}
        </p>
        {figure.status === "success" ? (
          <p className="mt-3 text-sm font-semibold text-[#c9fff6]">
            {hasResultAsset
              ? "Generation complete. The result is available in recent generations."
              : "Generation complete. Preview will appear when provider result is available."}
          </p>
        ) : null}
        {figure.status === "failed" && figure.failureReason ? (
          <p className="mt-3 rounded-md border border-[#ffb4ab]/20 bg-[#93000a]/20 p-3 text-sm leading-6 text-[#ffdad6]">
            {figure.failureReason}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          {previewUrl ? (
            <button
              aria-label={`View image for ${getPromptSnippet(figure.prompt)}`}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-3 py-2 text-xs font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
              type="button"
              onClick={() => onView(figure)}
            >
              <Eye className="h-3.5 w-3.5" />
              View image
            </button>
          ) : null}
          {previewUrl ? (
            <button
              aria-label={`Download image for ${getPromptSnippet(
                figure.prompt,
              )}`}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-3 py-2 text-xs font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
              disabled={isImageDownloading}
              type="button"
              onClick={() => onDownload(figure, "image")}
            >
              {isImageDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download image
            </button>
          ) : null}
          {figure.modelUrl ? (
            <a
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-3 py-2 text-xs font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
              href={figure.modelUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open model
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          {figure.modelUrl ? (
            <button
              aria-label={`Download model for ${getPromptSnippet(
                figure.prompt,
              )}`}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-3 py-2 text-xs font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isModelDownloading}
              type="button"
              onClick={() => onDownload(figure, "model")}
            >
              {isModelDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download model
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FigureEmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-[#3b494c] bg-[#1c1b1b] p-8 text-center md:col-span-3">
      <Sparkles className="mx-auto h-8 w-8 text-[#3b494c]" />
      <p className="mt-3 text-sm font-bold text-white">
        No generated garments yet.
      </p>
      <p className="mt-1 text-sm text-[#bac9cc]">
        Submit a prompt above and your first result will appear here.
      </p>
    </div>
  );
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const displayName = user?.displayName || user?.fullName || "Creator";
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [figures, setFigures] = useState<FigureDto[]>([]);
  const [activeFigure, setActiveFigure] = useState<FigureDto | null>(null);
  const [prompt, setPrompt] = useState("");
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
  const isMountedRef = useRef(true);
  const pollingStartedAtRef = useRef<number | null>(null);
  const pollingFigureIdRef = useRef<string | null>(null);

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
    };
  }, [loadBillingSummary, loadFigures]);

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
            "Generation is taking longer than expected. Refresh recent generations in a moment.",
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
              ? "Generation status is no longer available."
              : "We could not refresh generation status. Try again in a moment.",
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
  }, [activeFigure, loadBillingSummary, loadFigures]);

  const pendingOrder = summary?.pendingOrders[0] ?? null;
  const renewalDate = formatDate(summary?.plan.currentPeriodEnd);
  const latestPayment = summary?.latestPayment;
  const creditBalance = summary?.credits.balance ?? 0;
  const hasLoadedZeroCredits = Boolean(summary) && creditBalance <= 0;
  const trimmedPrompt = prompt.trim();
  const canGenerate =
    trimmedPrompt.length > 0 && !isGenerating && !hasLoadedZeroCredits;
  const promptCharacterCount = prompt.length;

  const recentFiguresTitle = useMemo(() => {
    if (isFiguresLoading) {
      return "Loading generation history.";
    }

    if (figures.length === 0) {
      return "No generated garments yet.";
    }

    return `${figures.length} recent generation${figures.length === 1 ? "" : "s"}.`;
  }, [figures.length, isFiguresLoading]);

  const handleViewFigure = useCallback((figure: FigureDto) => {
    setSelectedFigure(figure);
  }, []);

  const handleCloseFigurePreview = useCallback(() => {
    setSelectedFigure(null);
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

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedPrompt || isGenerating) {
      return;
    }

    if (hasLoadedZeroCredits) {
      setGenerationError(INSUFFICIENT_CREDITS_MESSAGE);
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const figure = await figuresApi.generateFigure({
        prompt: trimmedPrompt,
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
        setGenerationError(INSUFFICIENT_CREDITS_MESSAGE);
      } else if (errorCode === "GENERATION_PROVIDER_UNAVAILABLE") {
        setGenerationError(
          "The generation service is temporarily unavailable. Try again later.",
        );
      } else if (errorCode === "GENERATION_FAILED") {
        setGenerationError(
          "Generation failed before a result was created. Try a shorter prompt or try again later.",
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

  return (
    <DashboardShell planLabel={summary?.plan.name}>
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <div className="mx-auto w-full max-w-[1200px] space-y-8">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
                Dashboard
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Good day, {displayName}.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bac9cc] sm:text-base">
                Generate a 3D fashion figure from a prompt, track its render
                state, and keep credits accurate as results complete.
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
              to="/credits"
            >
              Credits and plans
              <ArrowRight className="h-4 w-4" />
            </Link>
          </header>

          {pendingOrder ? (
            <section className="rounded-lg border border-[#f3bf26]/30 bg-[#f3bf26]/10 p-4 text-[#ffeac0]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Payment pending for {getProductName(pendingOrder)}.
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-[#ffeac0]/78">
                      Continue with VietQR checkout from the credits page. No
                      credits or plan access are granted until admin
                      verification marks the order paid.
                    </p>
                  </div>
                </div>
                <Link
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-[#f3bf26] px-4 py-2.5 text-sm font-bold text-[#251a00] transition hover:bg-[#ffdf96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffdf96]"
                  to="/credits"
                >
                  Continue payment
                </Link>
              </div>
            </section>
          ) : null}

          {error ? (
            <section
              className="rounded-lg border border-[#ffb4ab]/30 bg-[#93000a]/25 p-5 text-[#ffdad6]"
              role="alert"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Billing summary unavailable
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
                  Retry
                </button>
              </div>
            </section>
          ) : null}

          {isLoading ? (
            <DashboardSkeleton />
          ) : (
            <section className="grid gap-6 lg:grid-cols-12">
              <article className="relative overflow-hidden rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-6 lg:col-span-8 lg:p-8">
                <div className="absolute inset-x-0 top-0 h-px bg-[#00e5ff]/55" />
                <form
                  className="flex h-full min-h-[360px] flex-col gap-6"
                  onSubmit={(event) => void handleGenerate(event)}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <span className="inline-flex items-center gap-2 rounded-md border border-[#00e5ff]/25 bg-[#00e5ff]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#9cf0ff]">
                        <span className="h-2 w-2 rounded-full bg-[#00e5ff]" />
                        AI generation
                      </span>
                      <h2 className="mt-5 max-w-xl font-display text-3xl font-semibold leading-tight text-white">
                        Draft a new 3D garment direction.
                      </h2>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bac9cc]">
                        Describe silhouette, material, mood, and styling intent
                        for the result.
                      </p>
                    </div>
                    <div className="grid gap-2 rounded-lg border border-[#3b494c]/70 bg-[#0e0e0e] p-4 text-sm text-[#bac9cc] sm:min-w-[220px]">
                      <div className="flex items-center justify-between gap-4">
                        <span>Cost</span>
                        <span className="font-bold text-white">1 credit</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>Balance</span>
                        <span className="font-bold text-[#9cf0ff]">
                          {creditBalance} credits
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      className="text-sm font-bold text-[#e5e2e1]"
                      htmlFor="generation-prompt"
                    >
                      Generation prompt
                    </label>
                    <textarea
                      aria-describedby="generation-prompt-help"
                      className="mt-3 min-h-[150px] w-full resize-y rounded-md border border-[#3b494c] bg-[#0e0e0e] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-[#849396] focus:border-[#00e5ff]/60 focus:ring-2 focus:ring-[#00e5ff]/20 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isGenerating}
                      id="generation-prompt"
                      maxLength={1000}
                      placeholder="Example: oversized cropped bomber jacket, matte nylon, cyan stitch highlights, runway streetwear pose"
                      value={prompt}
                      onChange={(event) => {
                        setPrompt(event.target.value);
                        setGenerationError(null);
                      }}
                    />
                    <div
                      className="mt-2 flex flex-col gap-2 text-xs text-[#849396] sm:flex-row sm:items-center sm:justify-between"
                      id="generation-prompt-help"
                    >
                      <span>Tip: include fabric, color, fit, and scene.</span>
                      <span>{promptCharacterCount}/1000</span>
                    </div>
                  </div>

                  {hasLoadedZeroCredits ? (
                    <div className="rounded-lg border border-[#f3bf26]/30 bg-[#f3bf26]/10 p-4 text-sm leading-6 text-[#ffeac0]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p>{INSUFFICIENT_CREDITS_MESSAGE}</p>
                        <Link
                          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md bg-[#f3bf26] px-4 py-2 text-sm font-bold text-[#251a00] transition hover:bg-[#ffdf96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffdf96]"
                          to="/credits"
                        >
                          Buy credits
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
                        {generationError === INSUFFICIENT_CREDITS_MESSAGE ? (
                          <Link
                            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md bg-[#00e5ff] px-4 py-2 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
                            to="/credits"
                          >
                            Buy credits
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-5 py-3 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!canGenerate}
                      type="submit"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {isGenerating ? "Generating" : "Generate"}
                    </button>
                    <button
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-5 py-3 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                      type="button"
                      onClick={() => setIsPaywallOpen(true)}
                    >
                      <Download className="h-4 w-4" />
                      Check export gate
                    </button>
                  </div>

                  {activeFigure ? (
                    <ActiveFigurePanel
                      downloadingAssetKey={downloadingAssetKey}
                      figure={activeFigure}
                      isPolling={isPolling}
                      onDownload={(figure, kind) =>
                        void handleDownloadFigureAsset(figure, kind)
                      }
                      onView={handleViewFigure}
                    />
                  ) : null}
                </form>
              </article>

              <article className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-6 lg:col-span-4 lg:p-8">
                <div className="flex items-start justify-between gap-4">
                  <Database className="h-6 w-6 text-[#bac9cc]" />
                  <Link
                    className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.16em] text-[#00e5ff] transition hover:text-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                    to="/credits"
                  >
                    Top up
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-[#bac9cc]">
                  Credit balance
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-6xl font-semibold leading-none text-white">
                    {creditBalance}
                  </span>
                  <span className="text-base font-semibold text-[#bac9cc]">
                    credits
                  </span>
                </div>
                <p className="mt-5 border-t border-[#3b494c]/70 pt-5 text-sm leading-6 text-[#bac9cc]">
                  1 credit = 1 HD generation.
                </p>
              </article>

              <article className="rounded-lg border border-[#3b494c] bg-[#201f1f] p-6 lg:col-span-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#00e5ff]/10 text-[#00e5ff]">
                    <CreditCard className="h-5 w-5" />
                  </span>
                  <span className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#bac9cc]">
                    {getPlanTone(summary)}
                  </span>
                </div>
                <h2 className="mt-5 font-display text-3xl font-semibold text-white">
                  {summary?.plan.name ?? "Free"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                  {summary?.plan.status === "active"
                    ? "Download and export access is unlocked for this account."
                    : "Preview generation available. Download/export locked."}
                </p>
                {renewalDate ? (
                  <p className="mt-4 text-sm font-semibold text-[#e5e2e1]">
                    Active through {renewalDate}
                  </p>
                ) : null}
                <Link
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
                  to="/credits"
                >
                  {summary?.plan.status === "active" ? "Manage plan" : "Upgrade"}
                </Link>
              </article>

              <article className="rounded-lg border border-[#3b494c] bg-[#201f1f] p-6 lg:col-span-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#f3bf26]/12 text-[#f3bf26]">
                  {summary?.capabilities.canExportModel ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <LockKeyhole className="h-5 w-5" />
                  )}
                </div>
                <h2 className="mt-5 font-display text-2xl font-semibold text-white">
                  Export access
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                  {summary?.capabilities.canExportModel
                    ? "Paid plan capability confirmed by backend billing state."
                    : "PAYWALL_REQUIRED opens when export/download is blocked."}
                </p>
                <button
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                  type="button"
                  onClick={() => {
                    if (!summary?.capabilities.canExportModel) {
                      setIsPaywallOpen(true);
                    }
                  }}
                >
                  <Download className="h-4 w-4" />
                  Download/export access
                </button>
              </article>

              <article className="rounded-lg border border-[#3b494c] bg-[#201f1f] p-6 lg:col-span-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white/[0.08] text-[#bac9cc]">
                  <UserRound className="h-5 w-5" />
                </div>
                <h2 className="mt-5 font-display text-2xl font-semibold text-white">
                  Account
                </h2>
                <p className="mt-2 truncate text-sm font-semibold text-[#e5e2e1]">
                  {user?.email || "No email"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                  Profile and onboarding remain separate from paid plan state.
                </p>
                <Link
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                  to="/profile"
                >
                  View profile
                </Link>
              </article>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold text-white">
                  Recent generations
                </h2>
                <p className="mt-1 text-sm text-[#bac9cc]">
                  {recentFiguresTitle}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {latestPayment ? (
                  <p className="text-sm font-semibold text-[#bac9cc]">
                    Latest payment: {latestPayment.status}
                  </p>
                ) : null}
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-3 py-2 text-xs font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                  type="button"
                  onClick={() => void loadFigures(false)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
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
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#ffb4ab]/35 px-3 py-2 text-xs font-bold text-[#ffdad6] transition hover:bg-[#ffb4ab]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffb4ab]"
                    type="button"
                    onClick={() => void loadFigures()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </button>
                </div>
              </section>
            ) : null}

            {isFiguresLoading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    className="h-80 animate-pulse rounded-lg border border-white/10 bg-white/[0.05]"
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
