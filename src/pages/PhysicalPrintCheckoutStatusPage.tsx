import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { PhysicalPrintStatusPill } from "../features/physical-print/components/PhysicalPrintStatusPill";
import { physicalPrintApi } from "../features/physical-print/physical-print.api";
import { canRetryPhysicalPrintCheckout } from "../features/physical-print/physical-print.presentation";
import type { PhysicalPrintOrder } from "../features/physical-print/physical-print.types";
import { formatI18nCurrency } from "../i18n/formatters";
import { useI18n } from "../i18n/useI18n";
import { getApiErrorMessage } from "../services/apiClient";

interface PhysicalPrintCheckoutStatusPageProps {
  mode: "return" | "cancel";
}

function normalizeResultHint(value: string | null): string {
  if (
    value === "paid" ||
    value === "pending" ||
    value === "cancelled" ||
    value === "failed" ||
    value === "expired" ||
    value === "refunded"
  ) {
    return value;
  }

  return "unknown";
}

function getStatusIcon(order: PhysicalPrintOrder | null) {
  if (order?.paymentStatus === "PAID") {
    return CheckCircle2;
  }

  if (
    order?.paymentStatus === "FAILED" ||
    order?.paymentStatus === "CANCELLED" ||
    order?.paymentStatus === "EXPIRED"
  ) {
    return XCircle;
  }

  if (order?.paymentStatus === "PENDING") {
    return Clock3;
  }

  return AlertTriangle;
}

export function PhysicalPrintCheckoutStatusPage({
  mode,
}: PhysicalPrintCheckoutStatusPageProps) {
  const { language, t } = useI18n();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const resultHint = normalizeResultHint(searchParams.get("result"));
  const [order, setOrder] = useState<PhysicalPrintOrder | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(orderId));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrder = useCallback(
    async (showLoading = true) => {
      if (!orderId) {
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
        setOrder(await physicalPrintApi.getPhysicalPrintOrder(orderId));
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
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

  const Icon = getStatusIcon(order);
  const terminalCopy =
    order?.paymentStatus === "FAILED"
      ? {
          title: "physicalPrint.tracking.checkout.failedTitle",
          body: "physicalPrint.tracking.checkout.failedBody",
        }
      : order?.paymentStatus === "EXPIRED"
        ? {
            title: "physicalPrint.tracking.checkout.expiredTitle",
            body: "physicalPrint.tracking.checkout.expiredBody",
          }
        : order?.paymentStatus === "REFUNDED"
          ? {
              title: "physicalPrint.tracking.checkout.refundedTitle",
              body: "physicalPrint.tracking.checkout.refundedBody",
            }
          : order?.paymentStatus === "CANCELLED"
            ? {
                title: "physicalPrint.tracking.checkout.cancelTitle",
                body: "physicalPrint.tracking.checkout.cancelBody",
              }
            : null;
  const titleKey =
    order?.paymentStatus === "PAID"
      ? "physicalPrint.tracking.checkout.paidTitle"
      : terminalCopy?.title ??
        (mode === "cancel"
          ? "physicalPrint.tracking.checkout.cancelTitle"
          : "physicalPrint.tracking.checkout.returnTitle");
  const bodyKey =
    order?.paymentStatus === "PAID"
      ? "physicalPrint.tracking.checkout.paidBody"
      : order?.paymentStatus === "PENDING"
        ? "physicalPrint.tracking.checkout.pendingBody"
        : terminalCopy?.body ??
          (mode === "cancel"
            ? "physicalPrint.tracking.checkout.cancelBody"
            : "physicalPrint.tracking.checkout.returnBody");
  const canRetry = order ? canRetryPhysicalPrintCheckout(order) : false;

  return (
    <DashboardShell>
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-[860px] space-y-5">
          <header className="rounded-lg border border-[#262626] bg-[#121212] p-5 text-center sm:p-8">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-md border border-[#00e5ff]/25 bg-[#00e5ff]/10 text-[#00e5ff]">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Icon className="h-6 w-6" />
              )}
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
              {t("physicalPrint.tracking.checkout.eyebrow")}
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold text-white sm:text-4xl">
              {t(titleKey)}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#bac9cc] sm:text-base">
              {t(bodyKey)}
            </p>
          </header>

          {error ? (
            <section
              className="rounded-lg border border-[#ffb4ab]/30 bg-[#93000a]/25 p-4 text-sm text-[#ffdad6]"
              role="alert"
            >
              {error}
            </section>
          ) : null}

          {!orderId ? (
            <section className="rounded-lg border border-[#f3bf26]/30 bg-[#f3bf26]/10 p-5 text-[#ffeac0]">
              <h2 className="font-bold text-white">
                {t("physicalPrint.tracking.checkout.unknownTitle")}
              </h2>
              <p className="mt-2 text-sm leading-6">
                {t("physicalPrint.tracking.checkout.unknownBody")}
              </p>
            </section>
          ) : null}

          {order ? (
            <section className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <PackageCheck className="mt-1 h-5 w-5 shrink-0 text-[#00e5ff]" />
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-semibold text-white">
                      {order.package.name}
                    </h2>
                    <p className="mt-1 text-sm text-[#bac9cc]">
                      {order.package.estimatedSizeLabel} ·{" "}
                      {order.package.productionTimeLabel}
                    </p>
                  </div>
                </div>
                <p className="text-xl font-bold text-white">
                  {formatI18nCurrency(
                    order.price.finalPriceVnd,
                    language,
                    order.price.currency,
                  )}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <PhysicalPrintStatusPill
                  kind="payment"
                  status={order.paymentStatus}
                />
                <PhysicalPrintStatusPill
                  kind="fulfillment"
                  status={order.fulfillmentStatus}
                />
              </div>

              {order.paymentStatus === "PENDING" ? (
                <p className="mt-5 rounded-md border border-[#f3bf26]/25 bg-[#f3bf26]/10 p-4 text-sm leading-6 text-[#ffeac0]">
                  {t("physicalPrint.tracking.checkout.verifying")}
                </p>
              ) : null}

              <p className="mt-4 text-xs text-[#849396]">
                {t("physicalPrint.tracking.checkout.queryHint", {
                  result: resultHint,
                })}
              </p>
            </section>
          ) : null}

          <section className="rounded-lg border border-white/10 bg-[#0e0e0e] p-4 text-sm leading-6 text-[#bac9cc]">
            {t("physicalPrint.tracking.checkout.authorityNote")}
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            {order ? (
              <Link
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24]"
                to={`/physical-print/orders/${order.id}`}
              >
                {t("physicalPrint.tracking.viewOrder")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff]"
              to="/physical-print/orders"
            >
              {t("physicalPrint.tracking.viewMyOrders")}
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/10 px-4 py-2.5 text-sm font-bold text-[#bac9cc]"
              to="/studio"
            >
              {t("physicalPrint.tracking.backToStudio")}
            </Link>
            {orderId ? (
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
            ) : null}
            {canRetry ? (
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] disabled:opacity-60 sm:col-span-2"
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
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}
