import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  ImageIcon,
  LockKeyhole,
  RefreshCw,
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
import { getApiErrorMessage } from "../services/apiClient";
import { getDisplayLabel } from "../i18n/displayMaps";
import { formatI18nDateTime } from "../i18n/formatters";
import { useI18n } from "../i18n/useI18n";

const STUDIO_POLL_INTERVAL_MS = 3000;
type StudioViewMode = "2d" | "3d";

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
  canOpenModel,
  canDownloadModel,
  onShow2d,
}: {
  figure: FigureDto;
  viewMode: StudioViewMode;
  canOpenModel: boolean;
  canDownloadModel: boolean;
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
      <div className="flex h-full min-h-[440px] flex-col items-center justify-center p-8 text-center">
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
      <div className="flex h-full min-h-[440px] flex-col items-center justify-center p-8 text-center">
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
      <div className="flex h-full min-h-[440px] flex-col items-center justify-center p-8 text-center">
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

  const modelUrl = figure.modelUrl;
  const canOpenExport = canOpenModel && Boolean(modelUrl);
  const canDownloadExport = canDownloadModel && Boolean(modelUrl);

  return (
    <div className="relative h-full min-h-[440px] w-full">
      <Suspense
        fallback={
          <div
            aria-live="polite"
            className="flex h-full min-h-[440px] items-center justify-center p-8 text-center text-sm font-semibold text-[#c3f5ff]"
            role="status"
          >
            {t("studio.viewer.loading")}
          </div>
        }
      >
        <StudioModelViewer
          isExportRestricted={!canOpenModel && !canDownloadModel}
          modelUrl={figure.modelViewerUrl}
          onShow2d={onShow2d}
        />
      </Suspense>

      {modelUrl && (canOpenExport || canDownloadExport) ? (
        <div className="absolute right-4 top-4 z-20 flex flex-col gap-2 sm:flex-row">
          {canOpenExport ? (
            <a
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-3 py-2 text-xs font-bold text-[#001f24] shadow-lg transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
              href={modelUrl}
              rel="noreferrer"
              target="_blank"
            >
              {t("studio.openGlb")}
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
          {canDownloadExport ? (
            <a
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 bg-[#0a0a0a]/85 px-3 py-2 text-xs font-bold text-[#9cf0ff] shadow-lg backdrop-blur transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
              download
              href={modelUrl}
            >
              {t("studio.downloadGlb")}
              <Download className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function StudioPage() {
  const { language, t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFigureId = searchParams.get("figureId");
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [figures, setFigures] = useState<FigureDto[]>([]);
  const [selectedFigureId, setSelectedFigureId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<StudioViewMode>("2d");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

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
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshSelectedFigure(false);
    }, STUDIO_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [refreshSelectedFigure, selectedFigure]);

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

  return (
    <DashboardShell planLabel={summary?.plan.name}>
      <main className="min-h-screen min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full min-w-0 max-w-[1560px] space-y-6">
          <header className="flex flex-col gap-5 border-b border-[#3b494c]/70 pb-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
                {t("studio.header.eyebrow")}
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold text-white sm:text-4xl">
                {t("studio.header.title")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bac9cc] sm:text-base">
                {t("studio.header.body")}
              </p>
            </div>

            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
              <div
                aria-label={t("studio.viewModeAria")}
                className="grid grid-cols-2 rounded-md border border-[#3b494c] bg-[#1c1b1b] p-1"
                role="group"
              >
                <button
                  aria-pressed={viewMode === "2d"}
                  className={`min-h-11 rounded px-3 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] ${
                    viewMode === "2d"
                      ? "bg-[#00e5ff] text-[#001f24]"
                      : "text-[#bac9cc] hover:text-white"
                  }`}
                  type="button"
                  onClick={() => setViewMode("2d")}
                >
                  {t("studio.view.2d")}
                </button>
                <button
                  aria-pressed={viewMode === "3d"}
                  className={`min-h-11 rounded px-3 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] ${
                    viewMode === "3d"
                      ? "bg-[#00e5ff] text-[#001f24]"
                      : "text-[#bac9cc] hover:text-white"
                  }`}
                  type="button"
                  onClick={() => setViewMode("3d")}
                >
                  {t("studio.view.3d")}
                </button>
              </div>

              <label className="sr-only" htmlFor="studio-generation-selector">
                {t("studio.selectGeneration")}
              </label>
              <select
                className="min-h-11 min-w-0 rounded-md border border-[#3b494c] bg-[#1c1b1b] px-3 py-2 text-sm font-semibold text-[#e5e2e1] focus:border-[#00e5ff] focus:outline-none focus:ring-1 focus:ring-[#00e5ff] lg:w-64"
                disabled={figures.length === 0}
                id="studio-generation-selector"
                value={selectedFigureId ?? ""}
                onChange={(event) => handleSelectFigure(event.target.value)}
              >
                {figures.length === 0 ? (
                  <option value="">{t("studio.noGenerationsOption")}</option>
                ) : (
                  figures.map((figure) => (
                    <option key={figure.id} value={figure.id}>
                      {getPromptSnippet(
                        figure.prompt,
                        62,
                        t("dashboard.figure.untitled"),
                      )}
                    </option>
                  ))
                )}
              </select>

              {selectedFigure ? (
                <FigureStatusBadge status={selectedFigure.status} />
              ) : null}

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
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="h-[620px] animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
              <div className="h-[620px] animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
            </div>
          ) : figures.length === 0 ? (
            <StudioEmptyState />
          ) : selectedFigure ? (
            <>
              <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <section className="min-w-0 max-w-full space-y-4">
                  <div className="studio-grid relative mx-auto h-[clamp(400px,56vw,640px)] w-full min-w-0 max-w-[960px] overflow-hidden rounded-lg border border-[#3b494c] bg-[#121212] shadow-[0_18px_42px_rgba(0,0,0,0.2)]">
                    <div className="absolute right-4 top-4 z-10 rounded-sm border border-white/10 bg-[#0a0a0a]/75 px-2 py-1 text-[0.65rem] font-bold text-[#bac9cc] backdrop-blur">
                      {viewMode === "3d" ? "GLB" : "IMG"}
                    </div>
                    <div className="relative flex h-full min-h-0 min-w-0 max-w-full items-center justify-center overflow-hidden">
                      <StudioPreview
                        canDownloadModel={
                          summary?.capabilities.canDownloadModel === true
                        }
                        canOpenModel={
                          summary?.capabilities.canExportModel === true
                        }
                        figure={selectedFigure}
                        onShow2d={() => setViewMode("2d")}
                        viewMode={viewMode}
                      />
                    </div>
                  </div>

                  <section className="min-w-0 max-w-full">
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#bac9cc]">
                      {t("studio.recentAssets")}
                    </h2>
                    <div className="studio-asset-rail relative mt-3">
                      <div className="internal-scroll-region flex min-w-0 max-w-full gap-3 overflow-x-auto overscroll-x-contain pr-8">
                        {figures.map((figure) => {
                          const previewUrl = getPreviewUrl(figure);
                          const isSelected = figure.id === selectedFigure.id;

                          return (
                            <button
                              aria-pressed={isSelected}
                              className={`min-h-11 w-44 shrink-0 overflow-hidden rounded-md border bg-[#1c1b1b] text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] ${
                                isSelected
                                  ? "border-[#00e5ff]/55"
                                  : "border-[#3b494c] hover:border-[#00e5ff]/35"
                              }`}
                              key={figure.id}
                              type="button"
                              onClick={() => handleSelectFigure(figure.id)}
                            >
                              <span className="block h-24 bg-[#0e0e0e]">
                                {previewUrl ? (
                                  <img
                                    alt=""
                                    className="h-full w-full object-cover"
                                    src={previewUrl}
                                  />
                                ) : (
                                  <span className="flex h-full items-center justify-center">
                                    <ImageIcon className="h-6 w-6 text-[#3b494c]" />
                                  </span>
                                )}
                              </span>
                              <span className="block space-y-2 p-3">
                                <span className="block truncate text-xs font-bold text-white">
                                  {getPromptSnippet(
                                    figure.prompt,
                                    36,
                                    t("dashboard.figure.untitled"),
                                  )}
                                </span>
                                <span className="flex flex-wrap gap-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
                                  {previewUrl ? <span>2D</span> : null}
                                  {figure.modelAssetReady ? (
                                    <span className="text-[#9cf0ff]">3D</span>
                                  ) : null}
                                  <span>
                                    {getDisplayLabel(
                                      "figureStatus",
                                      figure.status,
                                      language,
                                    )}
                                  </span>
                                </span>
                                <span className="block text-[0.65rem] text-[#849396]">
                                  {formatI18nDateTime(
                                    figure.createdAt,
                                    language,
                                    t("common.unknown"),
                                  )}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                </section>

                <aside className="min-w-0 max-w-full rounded-lg border border-[#3b494c] bg-[#121212] p-5">
                  <section>
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#bac9cc]">
                      {t("studio.metadata")}
                    </h2>
                    <dl className="mt-3 divide-y divide-[#3b494c]/55 text-sm">
                      <div className="py-4 first:pt-2">
                        <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
                          {t("dashboard.figure.prompt")}
                        </dt>
                        <dd className="mt-1 break-words leading-6 text-[#e5e2e1]">
                          {getBasePrompt(
                            selectedFigure.prompt,
                            t("dashboard.figure.untitled"),
                          )}
                        </dd>
                      </div>
                      <div className="py-4">
                        <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
                          {t("studio.styleDirection")}
                        </dt>
                        <dd className="mt-1 break-words leading-6 text-[#e5e2e1]">
                          {getStyleDirection(selectedFigure.prompt) ??
                            t("studio.notSpecified")}
                        </dd>
                      </div>
                      <div className="grid gap-4 py-4 sm:grid-cols-2 xl:grid-cols-1">
                        <div>
                          <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
                            {t("studio.status")}
                          </dt>
                          <dd className="mt-2">
                            <FigureStatusBadge
                              status={selectedFigure.status}
                            />
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
                            {t("studio.provider")}
                          </dt>
                          <dd className="mt-1 font-mono text-[#e5e2e1]">
                            {selectedFigure.provider ?? t("studio.notReported")}
                          </dd>
                        </div>
                      </div>
                      <div className="py-4">
                        <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
                          {t("dashboard.figure.created")}
                        </dt>
                        <dd className="mt-1 text-[#e5e2e1]">
                          {formatI18nDateTime(
                            selectedFigure.createdAt,
                            language,
                            t("common.unknown"),
                          )}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="border-t border-[#3b494c]/60 pt-5">
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#bac9cc]">
                      {t("studio.assetManifest")}
                    </h2>
                    <div className="mt-3 divide-y divide-[#3b494c]/50 text-sm">
                      <div className="flex items-center justify-between gap-3 py-3">
                        <span className="text-[#bac9cc]">
                          {t("studio.masterImage")}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wide text-[#c9fff6]">
                          {getPreviewUrl(selectedFigure)
                            ? t("common.ready")
                            : t("common.pending")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-3">
                        <span className="text-[#bac9cc]">
                          {t("studio.geometry")}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wide text-[#c9fff6]">
                          {selectedFigure.modelAssetReady
                            ? t("common.ready")
                            : isPollingStatus(selectedFigure.status)
                              ? t("common.pending")
                              : t("common.unavailable")}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="mt-2 border-t border-[#3b494c]/60 pt-5">
                    <div className="flex gap-3">
                      {summary?.capabilities.canExportModel ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2cebcf]/80" />
                      ) : (
                        <LockKeyhole className="h-5 w-5 shrink-0 text-[#f3bf26]/80" />
                      )}
                      <div>
                        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-white">
                          {summary?.capabilities.canExportModel
                            ? t("studio.exportAvailable")
                            : t("studio.exportRestricted")}
                        </h2>
                        <p className="mt-2 text-xs leading-5 text-[#bac9cc]">
                          {summary?.capabilities.canExportModel
                            ? t("studio.exportAvailableBody")
                            : t("studio.exportRestrictedBody")}
                        </p>
                        {!summary?.capabilities.canExportModel ? (
                          <Link
                            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-[#f3bf26]/50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#ffeac0] transition hover:bg-[#f3bf26]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffdf96]"
                            to="/credits"
                          >
                            {t("landing.viewPlans")}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </section>
                </aside>
              </div>
            </>
          ) : null}
        </div>
      </main>
    </DashboardShell>
  );
}
