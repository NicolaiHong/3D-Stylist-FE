import {
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

const STUDIO_POLL_INTERVAL_MS = 3000;
type StudioViewMode = "2d" | "3d";

function isPollingStatus(status: FigureStatus) {
  return status === "queued" || status === "processing";
}

function formatStatus(status: FigureStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getPreviewUrl(figure: FigureDto) {
  return figure.previewUrl || figure.thumbnailUrl || null;
}

function getPromptSnippet(prompt: string | null | undefined, limit = 62) {
  const value = prompt?.trim() || "Untitled generation";

  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function getBasePrompt(prompt: string | null | undefined) {
  const value = prompt?.trim();

  if (!value) {
    return "Untitled generation";
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
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] ${getStatusTone(
        status,
      )}`}
    >
      {isPollingStatus(status) ? <Clock3 className="h-3.5 w-3.5" /> : null}
      {formatStatus(status)}
    </span>
  );
}

function StudioEmptyState() {
  return (
    <section className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-[#3b494c] bg-[#121212] p-8 text-center">
      <Sparkles className="h-9 w-9 text-[#3b494c]" />
      <h2 className="mt-4 font-display text-2xl font-semibold text-white">
        No generated assets yet.
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-[#bac9cc]">
        Generate an outfit from Dashboard to preview it here.
      </p>
      <Link
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
        to="/dashboard"
      >
        Go to Dashboard
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
}: {
  figure: FigureDto;
  viewMode: StudioViewMode;
  canOpenModel: boolean;
  canDownloadModel: boolean;
}) {
  const previewUrl = getPreviewUrl(figure);

  if (viewMode === "2d") {
    return previewUrl ? (
      <img
        alt={getPromptSnippet(figure.prompt)}
        className="h-full w-full object-contain"
        src={previewUrl}
      />
    ) : (
      <div className="flex h-full min-h-[440px] flex-col items-center justify-center p-8 text-center">
        <ImageIcon className="h-12 w-12 text-[#3b494c]" />
        <h3 className="mt-4 font-display text-2xl font-semibold text-white">
          2D preview pending
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#bac9cc]">
          The backend has not returned a preview image for this generation yet.
        </p>
      </div>
    );
  }

  if (!figure.modelUrl) {
    return (
      <div className="flex h-full min-h-[440px] flex-col items-center justify-center p-8 text-center">
        <Box className="h-12 w-12 text-[#3b494c]" />
        <h3 className="mt-4 font-display text-2xl font-semibold text-white">
          3D model pending or not available.
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#bac9cc]">
          This figure does not currently expose a GLB result. Refresh after the
          backend status changes or continue with the 2D preview.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[440px] flex-col items-center justify-center p-8 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-lg border border-[#00e5ff]/45 bg-[#00e5ff]/10 text-[#00e5ff] shadow-lg shadow-[#00e5ff]/10">
        <Box className="h-10 w-10" />
      </span>
      <h3 className="mt-5 font-display text-2xl font-semibold text-white">
        GLB output ready
      </h3>
      <p className="mt-2 max-w-lg text-sm leading-6 text-[#bac9cc]">
        Temporary model link. Access depends on backend-owned generation result.
      </p>
      {canOpenModel || canDownloadModel ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {canOpenModel ? (
            <a
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
              href={figure.modelUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open GLB
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
          {canDownloadModel ? (
            <a
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
              download
              href={figure.modelUrl}
            >
              Download GLB
              <Download className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 max-w-lg text-xs font-semibold leading-5 text-[#ffdf96]">
          Direct GLB access is restricted by your backend billing state.
        </p>
      )}
    </div>
  );
}

export function StudioPage() {
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
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-[1560px] space-y-6">
          <header className="flex flex-col gap-5 border-b border-[#3b494c]/70 pb-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
                Creator studio
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold text-white sm:text-4xl">
                Studio Preview
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bac9cc] sm:text-base">
                Review generated fashion concepts in 2D or interactive 3D
                before export.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div
                aria-label="Studio view mode"
                className="grid grid-cols-2 rounded-md border border-[#3b494c] bg-[#1c1b1b] p-1"
                role="group"
              >
                <button
                  aria-pressed={viewMode === "2d"}
                  className={`min-h-10 rounded px-3 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] ${
                    viewMode === "2d"
                      ? "bg-[#00e5ff] text-[#001f24]"
                      : "text-[#bac9cc] hover:text-white"
                  }`}
                  type="button"
                  onClick={() => setViewMode("2d")}
                >
                  2D Preview
                </button>
                <button
                  aria-pressed={viewMode === "3d"}
                  className={`min-h-10 rounded px-3 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] ${
                    viewMode === "3d"
                      ? "bg-[#00e5ff] text-[#001f24]"
                      : "text-[#bac9cc] hover:text-white"
                  }`}
                  type="button"
                  onClick={() => setViewMode("3d")}
                >
                  3D Model
                </button>
              </div>

              <label className="sr-only" htmlFor="studio-generation-selector">
                Select generation
              </label>
              <select
                className="min-h-11 min-w-0 rounded-md border border-[#3b494c] bg-[#1c1b1b] px-3 py-2 text-sm font-semibold text-[#e5e2e1] focus:border-[#00e5ff] focus:outline-none focus:ring-1 focus:ring-[#00e5ff] lg:w-64"
                disabled={figures.length === 0}
                id="studio-generation-selector"
                value={selectedFigureId ?? ""}
                onChange={(event) => handleSelectFigure(event.target.value)}
              >
                {figures.length === 0 ? (
                  <option value="">No generations yet</option>
                ) : (
                  figures.map((figure) => (
                    <option key={figure.id} value={figure.id}>
                      {getPromptSnippet(figure.prompt)}
                    </option>
                  ))
                )}
              </select>

              {selectedFigure ? (
                <FigureStatusBadge status={selectedFigure.status} />
              ) : null}

              <button
                aria-label="Refresh Studio assets"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#3b494c] px-3 py-2 text-sm font-bold text-[#bac9cc] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isRefreshing}
                type="button"
                onClick={() => void handleRefresh()}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
                Refresh
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

          {isLoading ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="h-[620px] animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
              <div className="h-[620px] animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
            </div>
          ) : figures.length === 0 ? (
            <StudioEmptyState />
          ) : selectedFigure ? (
            <>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <section className="space-y-4">
                  <div className="studio-grid relative min-h-[540px] overflow-hidden rounded-lg border border-[#3b494c] bg-[#121212] shadow-2xl shadow-black/40">
                    <div className="absolute left-4 top-4 z-10">
                      <span className="block h-0.5 w-14 bg-[#00e5ff]" />
                      <span className="mt-2 block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[#00e5ff]/75">
                        LOC: ST-04 // PREVIEW_ACTIVE
                      </span>
                    </div>
                    <div className="absolute right-4 top-4 z-10 rounded-sm bg-[#00e5ff] px-2 py-1 text-[0.65rem] font-black text-[#001f24]">
                      {viewMode === "3d" ? "GLB" : "IMG"}
                    </div>
                    <div className="relative flex min-h-[540px] items-center justify-center">
                      <StudioPreview
                        canDownloadModel={
                          summary?.capabilities.canDownloadModel === true
                        }
                        canOpenModel={
                          summary?.capabilities.canExportModel === true
                        }
                        figure={selectedFigure}
                        viewMode={viewMode}
                      />
                    </div>
                    <div className="absolute inset-x-4 bottom-4 z-10 grid gap-3 rounded-md border border-[#3b494c]/70 bg-[#0a0a0a]/90 p-4 backdrop-blur sm:grid-cols-2">
                      <div>
                        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#849396]">
                          Current prompt
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold italic text-[#e5e2e1]">
                          {getBasePrompt(selectedFigure.prompt)}
                        </p>
                      </div>
                      <div className="border-[#3b494c]/70 sm:border-l sm:pl-4">
                        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#849396]">
                          Style direction
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-[#e5e2e1]">
                          {getStyleDirection(selectedFigure.prompt) ??
                            "Not specified"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <section>
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#bac9cc]">
                      Recent assets
                    </h2>
                    <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                      {figures.map((figure) => {
                        const previewUrl = getPreviewUrl(figure);
                        const isSelected = figure.id === selectedFigure.id;

                        return (
                          <button
                            aria-pressed={isSelected}
                            className={`w-44 shrink-0 overflow-hidden rounded-md border bg-[#1c1b1b] text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] ${
                              isSelected
                                ? "border-[#00e5ff]/70"
                                : "border-[#3b494c] hover:border-[#00e5ff]/45"
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
                                {getPromptSnippet(figure.prompt, 36)}
                              </span>
                              <span className="flex flex-wrap gap-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
                                {previewUrl ? <span>2D</span> : null}
                                {figure.modelUrl ? (
                                  <span className="text-[#00e5ff]">3D</span>
                                ) : null}
                                <span>{formatStatus(figure.status)}</span>
                              </span>
                              <span className="block text-[0.65rem] text-[#849396]">
                                {formatDateTime(figure.createdAt)}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </section>

                <aside className="space-y-6 rounded-lg border border-[#3b494c] bg-[#121212] p-5">
                  <section>
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
                      Gen metadata
                    </h2>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="rounded-md border border-[#3b494c]/70 bg-[#1c1b1b] p-3">
                        <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
                          Prompt
                        </dt>
                        <dd className="mt-1 break-words leading-6 text-[#e5e2e1]">
                          {getBasePrompt(selectedFigure.prompt)}
                        </dd>
                      </div>
                      <div className="rounded-md border border-[#3b494c]/70 bg-[#1c1b1b] p-3">
                        <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
                          Style direction
                        </dt>
                        <dd className="mt-1 break-words leading-6 text-[#e5e2e1]">
                          {getStyleDirection(selectedFigure.prompt) ??
                            "Not specified"}
                        </dd>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                        <div className="rounded-md border border-[#3b494c]/70 bg-[#1c1b1b] p-3">
                          <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
                            Status
                          </dt>
                          <dd className="mt-2">
                            <FigureStatusBadge
                              status={selectedFigure.status}
                            />
                          </dd>
                        </div>
                        <div className="rounded-md border border-[#3b494c]/70 bg-[#1c1b1b] p-3">
                          <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
                            Provider
                          </dt>
                          <dd className="mt-1 font-mono text-[#e5e2e1]">
                            {selectedFigure.provider ?? "Not reported"}
                          </dd>
                        </div>
                      </div>
                      <div className="rounded-md border border-[#3b494c]/70 bg-[#1c1b1b] p-3">
                        <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[#849396]">
                          Created
                        </dt>
                        <dd className="mt-1 text-[#e5e2e1]">
                          {formatDateTime(selectedFigure.createdAt)}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section>
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
                      Asset manifest
                    </h2>
                    <div className="mt-3 divide-y divide-[#3b494c]/50 text-sm">
                      <div className="flex items-center justify-between gap-3 py-3">
                        <span className="text-[#bac9cc]">Master image (2D)</span>
                        <span className="text-xs font-bold uppercase tracking-wide text-[#c9fff6]">
                          {getPreviewUrl(selectedFigure) ? "Ready" : "Pending"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-3">
                        <span className="text-[#bac9cc]">Geometry (.GLB)</span>
                        <span className="text-xs font-bold uppercase tracking-wide text-[#c9fff6]">
                          {selectedFigure.modelUrl ? "Ready" : "Pending"}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section
                    className={`rounded-lg border p-4 ${
                      summary?.capabilities.canExportModel
                        ? "border-[#2cebcf]/30 bg-[#2cebcf]/10"
                        : "border-[#f3bf26]/35 bg-[#f3bf26]/10"
                    }`}
                  >
                    <div className="flex gap-3">
                      {summary?.capabilities.canExportModel ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2cebcf]" />
                      ) : (
                        <LockKeyhole className="h-5 w-5 shrink-0 text-[#f3bf26]" />
                      )}
                      <div>
                        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-white">
                          {summary?.capabilities.canExportModel
                            ? "Export available"
                            : "Export restricted"}
                        </h2>
                        <p className="mt-2 text-xs leading-5 text-[#bac9cc]">
                          {summary?.capabilities.canExportModel
                            ? "Backend billing state confirms model export access for this account."
                            : "Download and export are available on paid plans. Previewing remains available."}
                        </p>
                        {!summary?.capabilities.canExportModel ? (
                          <Link
                            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md border border-[#f3bf26]/50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#ffeac0] transition hover:bg-[#f3bf26]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffdf96]"
                            to="/credits"
                          >
                            View plans
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
