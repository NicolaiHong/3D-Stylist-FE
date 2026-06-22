import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock3,
  Loader2,
  MapPin,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Truck,
} from "lucide-react";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { PhysicalPrintStatusPill } from "../features/physical-print/components/PhysicalPrintStatusPill";
import { physicalPrintApi } from "../features/physical-print/physical-print.api";
import { canRetryPhysicalPrintCheckout } from "../features/physical-print/physical-print.presentation";
import type {
  PhysicalPrintFulfillmentStatus,
  PhysicalPrintOrder,
} from "../features/physical-print/physical-print.types";
import {
  formatI18nCurrency,
  formatI18nDateTime,
} from "../i18n/formatters";
import { useI18n } from "../i18n/useI18n";
import {
  getApiErrorCode,
  getApiErrorMessage,
} from "../services/apiClient";

const fulfillmentRank: Record<PhysicalPrintFulfillmentStatus, number> = {
  NOT_STARTED: 0,
  WAITING_FULFILLMENT: 1,
  ASSIGNED_TO_PRINT_PARTNER: 1,
  PRINTING: 2,
  PRINTED: 3,
  SHIPPED: 4,
  COMPLETED: 5,
  CANCELLED: -1,
};

type TimelineState = "complete" | "current" | "pending";

interface TimelineItem {
  key: string;
  label: string;
  timestamp: string | null;
  state: TimelineState;
}

function buildTimeline(
  order: PhysicalPrintOrder,
  t: (key: string) => string,
): TimelineItem[] {
  const rank = fulfillmentRank[order.fulfillmentStatus];
  const isPaid = order.paymentStatus === "PAID";
  const stageState = (stage: number): TimelineState => {
    if (!isPaid || rank < 0) {
      return "pending";
    }

    if (rank > stage) {
      return "complete";
    }

    if (rank === stage) {
      return "current";
    }

    return "pending";
  };

  return [
    {
      key: "created",
      label: t("physicalPrint.tracking.timeline.created"),
      timestamp: order.createdAt,
      state: "complete",
    },
    {
      key: "payment",
      label: t("physicalPrint.tracking.timeline.payment"),
      timestamp: order.paidAt,
      state: isPaid ? "complete" : "current",
    },
    {
      key: "waiting",
      label: t("physicalPrint.tracking.timeline.waiting"),
      timestamp: order.assignedAt ?? order.paidAt,
      state: stageState(1),
    },
    {
      key: "printing",
      label: t("physicalPrint.tracking.timeline.printing"),
      timestamp: null,
      state: stageState(2),
    },
    {
      key: "printed",
      label: t("physicalPrint.tracking.timeline.printed"),
      timestamp: order.printedAt,
      state: stageState(3),
    },
    {
      key: "shipped",
      label: t("physicalPrint.tracking.timeline.shipped"),
      timestamp: order.shippedAt,
      state: stageState(4),
    },
    {
      key: "completed",
      label: t("physicalPrint.tracking.timeline.completed"),
      timestamp: order.completedAt,
      state: stageState(5),
    },
  ];
}

export function PhysicalPrintOrderDetailPage() {
  const { language, t } = useI18n();
  const { orderId } = useParams();
  const [order, setOrder] = useState<PhysicalPrintOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const loadOrder = useCallback(
    async (showLoading = true) => {
      if (!orderId) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setError(null);

      try {
        const result = await physicalPrintApi.getPhysicalPrintOrder(orderId);
        setOrder(result);
        setNotFound(false);
      } catch (loadError) {
        if (getApiErrorCode(loadError) === "PHYSICAL_PRINT_ORDER_NOT_FOUND") {
          setNotFound(true);
          setOrder(null);
        } else {
          setError(getApiErrorMessage(loadError));
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const timeline = useMemo(
    () => (order ? buildTimeline(order, t) : []),
    [order, t],
  );

  async function retryCheckout() {
    if (!order || !canRetryPhysicalPrintCheckout(order)) {
      return;
    }

    setIsRetrying(true);
    setError(null);

    try {
      const checkout =
        await physicalPrintApi.createPhysicalPrintPayosCheckout(order.id);
      window.location.assign(checkout.payment.checkoutUrl);
    } catch (retryError) {
      setError(getApiErrorMessage(retryError));
      setIsRetrying(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardShell>
        <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto grid w-full max-w-[1080px] gap-5">
            <div className="h-48 animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
            <div className="h-96 animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
          </div>
        </main>
      </DashboardShell>
    );
  }

  if (notFound || !order) {
    return (
      <DashboardShell>
        <main className="min-h-screen px-4 py-10 sm:px-6">
          <section className="mx-auto max-w-xl rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-8 text-center">
            <AlertTriangle className="mx-auto h-9 w-9 text-[#f3bf26]" />
            <h1 className="mt-4 font-display text-2xl font-semibold text-white">
              {t("physicalPrint.tracking.notFoundTitle")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
              {t("physicalPrint.tracking.notFoundBody")}
            </p>
            <Link
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24]"
              to="/physical-print/orders"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("physicalPrint.tracking.viewMyOrders")}
            </Link>
          </section>
        </main>
      </DashboardShell>
    );
  }

  const canRetry = canRetryPhysicalPrintCheckout(order);

  return (
    <DashboardShell>
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-[1080px] space-y-6">
          <header className="rounded-lg border border-[#262626] bg-[#121212] p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <Link
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#9cf0ff]"
                  to="/physical-print/orders"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("physicalPrint.tracking.viewMyOrders")}
                </Link>
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
                  {t("physicalPrint.tracking.eyebrow")}
                </p>
                <h1 className="mt-3 break-words font-display text-3xl font-semibold text-white sm:text-4xl">
                  {t("physicalPrint.tracking.orderTitle")}
                </h1>
                <p className="mt-2 break-all font-mono text-xs text-[#849396]">
                  {order.id}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PhysicalPrintStatusPill
                  kind="payment"
                  status={order.paymentStatus}
                />
                <PhysicalPrintStatusPill
                  kind="fulfillment"
                  status={order.fulfillmentStatus}
                />
              </div>
            </div>
          </header>

          {error ? (
            <section
              className="rounded-lg border border-[#ffb4ab]/30 bg-[#93000a]/25 p-4 text-sm text-[#ffdad6]"
              role="alert"
            >
              {error}
            </section>
          ) : null}

          <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-5">
              <div className="flex items-center gap-3">
                <PackageCheck className="h-5 w-5 text-[#00e5ff]" />
                <h2 className="font-display text-xl font-semibold text-white">
                  {t("physicalPrint.tracking.package")}
                </h2>
              </div>
              <h3 className="mt-5 text-2xl font-bold text-white">
                {order.package.name}
              </h3>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[#849396]">
                    {t("physicalPrint.estimatedSize")}
                  </dt>
                  <dd className="mt-1 font-semibold text-[#e5e2e1]">
                    {order.package.estimatedSizeLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#849396]">
                    {t("physicalPrint.productionTime")}
                  </dt>
                  <dd className="mt-1 font-semibold text-[#e5e2e1]">
                    {order.package.productionTimeLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#849396]">
                    {t("physicalPrint.quality")}
                  </dt>
                  <dd className="mt-1 font-semibold text-[#e5e2e1]">
                    {order.package.qualityLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#849396]">
                    {t("physicalPrint.tracking.total")}
                  </dt>
                  <dd className="mt-1 text-lg font-bold text-white">
                    {formatI18nCurrency(
                      order.price.finalPriceVnd,
                      language,
                      order.price.currency,
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-5">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-[#00e5ff]" />
                <h2 className="font-display text-xl font-semibold text-white">
                  {t("physicalPrint.tracking.shippingInformation")}
                </h2>
              </div>
              <div className="mt-5 space-y-3 text-sm">
                <p className="font-bold text-white">{order.shipping.name}</p>
                <p className="text-[#bac9cc]">{order.shipping.phone}</p>
                <p className="leading-6 text-[#bac9cc]">
                  {order.shipping.address}
                </p>
                {order.customerNote ? (
                  <p className="border-t border-[#3b494c]/70 pt-3 leading-6 text-[#bac9cc]">
                    {order.customerNote}
                  </p>
                ) : null}
              </div>
              <div className="mt-5 rounded-md border border-white/10 bg-[#0e0e0e] p-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#849396]">
                  {t("physicalPrint.tracking.trackingCode")}
                </p>
                <p className="mt-2 break-words font-mono text-sm font-bold text-white">
                  {order.trackingCode ??
                    t("physicalPrint.tracking.notAvailable")}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-5">
            <div className="flex items-center gap-3">
              <Clock3 className="h-5 w-5 text-[#00e5ff]" />
              <div>
                <h2 className="font-display text-xl font-semibold text-white">
                  {t("physicalPrint.tracking.timeline.title")}
                </h2>
                <p className="mt-1 text-sm text-[#bac9cc]">
                  {t("physicalPrint.tracking.timeline.body")}
                </p>
              </div>
            </div>
            <ol className="mt-6 grid gap-3">
              {timeline.map((item) => (
                <li
                  className={`grid min-w-0 grid-cols-[36px_minmax(0,1fr)] gap-3 rounded-md border p-3 ${
                    item.state === "complete"
                      ? "border-[#00e5ff]/25 bg-[#00e5ff]/[0.06]"
                      : item.state === "current"
                        ? "border-[#f3bf26]/30 bg-[#f3bf26]/[0.06]"
                        : "border-white/[0.08] bg-[#0e0e0e]"
                  }`}
                  key={item.key}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                      item.state === "complete"
                        ? "border-[#00e5ff]/35 text-[#00e5ff]"
                        : item.state === "current"
                          ? "border-[#f3bf26]/35 text-[#f3bf26]"
                          : "border-white/10 text-[#849396]"
                    }`}
                  >
                    {item.state === "complete" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Clock3 className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-white">{item.label}</p>
                    <p className="mt-1 text-sm text-[#849396]">
                      {formatI18nDateTime(
                        item.timestamp,
                        language,
                        item.state === "pending"
                          ? t("physicalPrint.tracking.timeline.pending")
                          : t("physicalPrint.tracking.timeline.inProgress"),
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {order.cancelledAt ||
          order.paymentStatus === "CANCELLED" ||
          order.fulfillmentStatus === "CANCELLED" ? (
            <section className="rounded-lg border border-[#ffb4ab]/30 bg-[#93000a]/20 p-4 text-sm text-[#ffdad6]">
              {t("physicalPrint.tracking.cancelledNotice")}
            </section>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/10 px-4 py-2.5 text-sm font-bold text-[#bac9cc] disabled:opacity-60"
              disabled={isRefreshing}
              type="button"
              onClick={() => void loadOrder(false)}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t("physicalPrint.tracking.refreshStatus")}
            </button>
            {canRetry ? (
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] disabled:opacity-60"
                disabled={isRetrying}
                type="button"
                onClick={() => void retryCheckout()}
              >
                {isRetrying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                {t("physicalPrint.tracking.retryCheckout")}
              </button>
            ) : null}
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff]"
              to="/studio"
            >
              <Truck className="h-4 w-4" />
              {t("physicalPrint.tracking.backToStudio")}
            </Link>
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}
