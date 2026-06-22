import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  Loader2,
  PackageSearch,
  RefreshCw,
  Truck,
} from "lucide-react";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { physicalPrintApi } from "../features/physical-print/physical-print.api";
import { PhysicalPrintStatusPill } from "../features/physical-print/components/PhysicalPrintStatusPill";
import {
  getPhysicalPrintFulfillmentLabel,
  getPhysicalPrintPaymentLabel,
} from "../features/physical-print/physical-print.presentation";
import type {
  PhysicalPrintFulfillmentStatus,
  PhysicalPrintOrderListItem,
  PhysicalPrintPackageCode,
  PhysicalPrintPaymentStatus,
} from "../features/physical-print/physical-print.types";
import {
  formatI18nCurrency,
  formatI18nDateTime,
} from "../i18n/formatters";
import { useI18n } from "../i18n/useI18n";
import { getApiErrorMessage } from "../services/apiClient";

const paymentStatuses: PhysicalPrintPaymentStatus[] = [
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
];

const fulfillmentStatuses: PhysicalPrintFulfillmentStatus[] = [
  "NOT_STARTED",
  "WAITING_FULFILLMENT",
  "ASSIGNED_TO_PRINT_PARTNER",
  "PRINTING",
  "PRINTED",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
];

const packageCodes: PhysicalPrintPackageCode[] = [
  "MINI_PRINT",
  "STANDARD_PRINT",
  "PREMIUM_PRINT",
];

function OrderCard({ order }: { order: PhysicalPrintOrderListItem }) {
  const { language, t } = useI18n();

  return (
    <article className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-4 sm:p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PhysicalPrintStatusPill
              kind="payment"
              status={order.paymentStatus}
            />
            <PhysicalPrintStatusPill
              kind="fulfillment"
              status={order.fulfillmentStatus}
            />
          </div>

          <div className="mt-4 flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#00e5ff]/20 bg-[#00e5ff]/10 text-[#00e5ff]">
              <Box className="h-5 w-5" />
            </span>
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

          <dl className="mt-5 grid gap-3 border-y border-[#3b494c]/70 py-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#849396]">
                {t("physicalPrint.tracking.total")}
              </dt>
              <dd className="mt-2 font-bold text-white">
                {formatI18nCurrency(
                  order.price.finalPriceVnd,
                  language,
                  order.price.currency,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#849396]">
                {t("physicalPrint.tracking.createdAt")}
              </dt>
              <dd className="mt-2 font-semibold text-[#e5e2e1]">
                {formatI18nDateTime(
                  order.createdAt,
                  language,
                  t("common.notReturned"),
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#849396]">
                {t("physicalPrint.tracking.paidAt")}
              </dt>
              <dd className="mt-2 font-semibold text-[#e5e2e1]">
                {formatI18nDateTime(
                  order.paidAt,
                  language,
                  t("common.notReturned"),
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#849396]">
                {t("physicalPrint.tracking.trackingCode")}
              </dt>
              <dd className="mt-2 break-words font-mono font-semibold text-[#e5e2e1]">
                {order.trackingCode ?? t("physicalPrint.tracking.notAvailable")}
              </dd>
            </div>
          </dl>
        </div>

        <Link
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
          to={`/physical-print/orders/${order.id}`}
        >
          {t("physicalPrint.tracking.viewOrder")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

export function PhysicalPrintOrdersPage() {
  const { t } = useI18n();
  const [orders, setOrders] = useState<PhysicalPrintOrderListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<
    PhysicalPrintPaymentStatus | ""
  >("");
  const [fulfillmentStatus, setFulfillmentStatus] = useState<
    PhysicalPrintFulfillmentStatus | ""
  >("");
  const [packageCode, setPackageCode] = useState<PhysicalPrintPackageCode | "">(
    "",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setError(null);

      try {
        const result = await physicalPrintApi.getPhysicalPrintOrders({
          page,
          limit: 10,
          ...(paymentStatus ? { paymentStatus } : {}),
          ...(fulfillmentStatus ? { fulfillmentStatus } : {}),
          ...(packageCode ? { packageCode } : {}),
        });

        setOrders(result.orders);
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [fulfillmentStatus, packageCode, page, paymentStatus],
  );

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  return (
    <DashboardShell>
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-[1180px] space-y-6">
          <header className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
                {t("physicalPrint.tracking.eyebrow")}
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                {t("physicalPrint.tracking.ordersTitle")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bac9cc] sm:text-base">
                {t("physicalPrint.tracking.ordersBody")}
              </p>
            </div>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading || isRefreshing}
              type="button"
              onClick={() => void loadOrders(false)}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t("physicalPrint.tracking.refreshStatus")}
            </button>
          </header>

          <section className="grid gap-3 rounded-lg border border-[#262626] bg-[#121212] p-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-bold text-[#e5e2e1]">
              {t("physicalPrint.tracking.paymentStatus")}
              <select
                className="min-h-11 min-w-0 rounded-md border border-[#3b494c] bg-[#0e0e0e] px-3 text-sm text-white outline-none focus:border-[#00e5ff]"
                value={paymentStatus}
                onChange={(event) => {
                  setPage(1);
                  setPaymentStatus(
                    event.target.value as PhysicalPrintPaymentStatus | "",
                  );
                }}
              >
                <option value="">{t("physicalPrint.tracking.all")}</option>
                {paymentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {getPhysicalPrintPaymentLabel(status, t)}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-bold text-[#e5e2e1]">
              {t("physicalPrint.tracking.fulfillmentStatus")}
              <select
                className="min-h-11 min-w-0 rounded-md border border-[#3b494c] bg-[#0e0e0e] px-3 text-sm text-white outline-none focus:border-[#00e5ff]"
                value={fulfillmentStatus}
                onChange={(event) => {
                  setPage(1);
                  setFulfillmentStatus(
                    event.target.value as PhysicalPrintFulfillmentStatus | "",
                  );
                }}
              >
                <option value="">{t("physicalPrint.tracking.all")}</option>
                {fulfillmentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {getPhysicalPrintFulfillmentLabel(status, t)}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-bold text-[#e5e2e1]">
              {t("physicalPrint.tracking.package")}
              <select
                className="min-h-11 min-w-0 rounded-md border border-[#3b494c] bg-[#0e0e0e] px-3 text-sm text-white outline-none focus:border-[#00e5ff]"
                value={packageCode}
                onChange={(event) => {
                  setPage(1);
                  setPackageCode(
                    event.target.value as PhysicalPrintPackageCode | "",
                  );
                }}
              >
                <option value="">{t("physicalPrint.tracking.all")}</option>
                {packageCodes.map((code) => (
                  <option key={code} value={code}>
                    {t(
                      `physicalPrint.tracking.packageCode.${code.toLowerCase()}`,
                    )}
                  </option>
                ))}
              </select>
            </label>
          </section>

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
                      {t("physicalPrint.tracking.errors.loadTitle")}
                    </h2>
                    <p className="mt-1 text-sm">{error}</p>
                  </div>
                </div>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#ffb4ab]/35 px-3 py-2 text-xs font-bold"
                  type="button"
                  onClick={() => void loadOrders()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t("common.retry")}
                </button>
              </div>
            </section>
          ) : null}

          {isLoading ? (
            <div className="grid gap-4" aria-label={t("common.loading")}>
              {[0, 1, 2].map((item) => (
                <div
                  className="h-60 animate-pulse rounded-lg border border-white/10 bg-white/[0.05]"
                  key={item}
                />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <section className="rounded-lg border border-dashed border-[#3b494c] bg-[#1c1b1b] p-8 text-center">
              <PackageSearch className="mx-auto h-9 w-9 text-[#849396]" />
              <h2 className="mt-4 font-display text-xl font-semibold text-white">
                {t("physicalPrint.tracking.emptyTitle")}
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#bac9cc]">
                {t("physicalPrint.tracking.emptyBody")}
              </p>
              <Link
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24]"
                to="/studio"
              >
                <Truck className="h-4 w-4" />
                {t("physicalPrint.tracking.backToStudio")}
              </Link>
            </section>
          ) : (
            <div className="grid gap-4">
              <p className="text-sm font-semibold text-[#849396]">
                {t("physicalPrint.tracking.orderCount", { count: total })}
              </p>
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}

          {!isLoading && totalPages > 1 ? (
            <nav
              aria-label={t("physicalPrint.tracking.pagination")}
              className="flex items-center justify-between gap-3"
            >
              <button
                className="min-h-11 rounded-md border border-white/10 px-4 py-2 text-sm font-bold text-[#bac9cc] disabled:opacity-40"
                disabled={page <= 1}
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t("physicalPrint.tracking.previous")}
              </button>
              <span className="text-sm font-semibold text-[#bac9cc]">
                {t("physicalPrint.tracking.page", {
                  page,
                  totalPages,
                })}
              </span>
              <button
                className="min-h-11 rounded-md border border-white/10 px-4 py-2 text-sm font-bold text-[#bac9cc] disabled:opacity-40"
                disabled={page >= totalPages}
                type="button"
                onClick={() => setPage((current) => current + 1)}
              >
                {t("physicalPrint.tracking.next")}
              </button>
            </nav>
          ) : null}
        </div>
      </main>
    </DashboardShell>
  );
}
