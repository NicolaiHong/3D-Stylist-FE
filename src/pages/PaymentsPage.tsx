import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  ReceiptText,
  RefreshCw,
} from "lucide-react";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { billingApi } from "../features/billing/billing.api";
import type {
  BillingOrder,
  BillingSummary,
} from "../features/billing/billing.types";
import { getDisplayLabel } from "../i18n/displayMaps";
import { formatI18nCurrency, formatI18nDateTime } from "../i18n/formatters";
import { useI18n } from "../i18n/useI18n";
import { getApiErrorMessage } from "../services/apiClient";
import type { Language } from "../i18n/types";

type Translate = ReturnType<typeof useI18n>["t"];

function getOrderProductName(order: BillingOrder, t: Translate) {
  return order.items[0]?.productName ?? t("payments.productFallback");
}

function getOrderPaymentMethod(order: BillingOrder) {
  const payosTransaction = order.transactions.find(
    (transaction) => transaction.provider === "payos",
  );

  return (
    order.provider ??
    order.paymentMethod ??
    payosTransaction?.provider ??
    "vietqr_bank_transfer"
  );
}

function getPaymentMethodLabel(
  order: BillingOrder,
  language: Language,
  t: Translate,
) {
  const method = getOrderPaymentMethod(order);

  if (method === "payos") {
    return t("payments.method.payos");
  }

  if (method === "vietqr" || method === "vietqr_bank_transfer") {
    return t("payments.method.manual");
  }

  return getDisplayLabel("paymentProvider", method, language);
}

function statusTone(status: string) {
  if (status === "paid" || status === "admin_verified") {
    return "border-[#00e5ff]/25 bg-[#00e5ff]/10 text-[#9cf0ff]";
  }

  if (
    status === "pending" ||
    status === "awaiting_transfer" ||
    status === "pending_admin_verification" ||
    status === "user_reported_transferred"
  ) {
    return "border-[#f3bf26]/30 bg-[#f3bf26]/10 text-[#ffeac0]";
  }

  return "border-[#ffb4ab]/25 bg-[#93000a]/20 text-[#ffdad6]";
}

function isPayablePendingOrder(order: BillingOrder) {
  if (order.status !== "pending") {
    return false;
  }

  if (!order.expiresAt) {
    return true;
  }

  const expiresAt = Date.parse(order.expiresAt);

  return Number.isNaN(expiresAt) || expiresAt > Date.now();
}

function getVerificationStatus(order: BillingOrder) {
  return order.paymentVerification ?? "awaiting_transfer";
}

function PaymentsEmptyState({
  body,
  title,
}: {
  body: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[#3b494c] bg-[#1c1b1b] p-6 text-center">
      <ReceiptText className="mx-auto h-8 w-8 text-[#3b494c]" />
      <p className="mt-3 text-sm font-bold text-white">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#bac9cc]">
        {body}
      </p>
    </div>
  );
}

function PendingPaymentCard({
  order,
}: {
  order: BillingOrder;
}) {
  const { language, t } = useI18n();
  const verificationStatus = getVerificationStatus(order);
  const isPayable = isPayablePendingOrder(order);

  return (
    <article className="rounded-lg border border-[#f3bf26]/30 bg-[#201f1f] p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] ${statusTone(
                verificationStatus,
              )}`}
            >
              {getDisplayLabel("verificationStatus", verificationStatus, language)}
            </span>
            <span className="rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-[#bac9cc]">
              {getPaymentMethodLabel(order, language, t)}
            </span>
          </div>

          <div>
            <h3 className="font-display text-xl font-semibold text-white">
              {getOrderProductName(order, t)}
            </h3>
            <p className="mt-2 break-all font-mono text-xs font-bold text-[#ffeac0]">
              {order.bankTransferContent ??
                order.orderCode ??
                t("common.notReturned")}
            </p>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-md border border-[#3b494c]/70 bg-[#0e0e0e] p-3">
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#849396]">
                {t("payments.field.amount")}
              </dt>
              <dd className="mt-2 font-bold text-white">
                {formatI18nCurrency(
                  order.totalAmount,
                  language,
                  order.currency,
                )}
              </dd>
            </div>
            <div className="rounded-md border border-[#3b494c]/70 bg-[#0e0e0e] p-3">
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#849396]">
                {t("payments.field.expires")}
              </dt>
              <dd className="mt-2 font-bold text-white">
                {formatI18nDateTime(
                  order.expiresAt,
                  language,
                  t("common.notReturned"),
                )}
              </dd>
            </div>
            <div className="rounded-md border border-[#3b494c]/70 bg-[#0e0e0e] p-3">
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#849396]">
                {t("payments.field.status")}
              </dt>
              <dd className="mt-2 font-bold text-white">
                {getDisplayLabel("orderStatus", order.status, language)}
              </dd>
            </div>
          </dl>
        </div>

        {isPayable ? (
          <Link
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff]"
            to={`/credits/checkout/${order.id}`}
          >
            {t("payments.action.resume")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function OrderHistoryRow({ order }: { order: BillingOrder }) {
  const { language, t } = useI18n();
  const isPayable = isPayablePendingOrder(order);

  return (
    <div className="grid gap-4 border-b border-[#3b494c]/70 p-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-bold text-white">
            {getOrderProductName(order, t)}
          </p>
          <span
            className={`rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-[0.12em] ${statusTone(
              order.status,
            )}`}
          >
            {getDisplayLabel("orderStatus", order.status, language)}
          </span>
        </div>
        <p className="mt-2 text-sm text-[#bac9cc]">
          {t("payments.history.created", {
            date: formatI18nDateTime(
              order.createdAt,
              language,
              t("common.notReturned"),
            ),
          })}
        </p>
      </div>

      <p className="text-sm font-bold text-white">
        {formatI18nCurrency(order.totalAmount, language, order.currency)}
      </p>
      <p className="text-sm font-semibold text-[#bac9cc]">
        {getPaymentMethodLabel(order, language, t)}
      </p>

      {isPayable ? (
        <Link
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-3 py-2 text-xs font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
          to={`/credits/checkout/${order.id}`}
        >
          {t("payments.action.resume")}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : order.status === "paid" ? (
        <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-bold text-[#9cf0ff]">
          <CheckCircle2 className="h-4 w-4" />
          {t("payments.history.paid")}
        </span>
      ) : (
        <span className="inline-flex min-h-10 items-center justify-center rounded-md px-3 py-2 text-xs font-bold text-[#bac9cc]">
          {t("payments.history.noAction")}
        </span>
      )}
    </div>
  );
}

export function PaymentsPage() {
  const { t } = useI18n();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setError(null);

    try {
      const [summaryResult, ordersResult] = await Promise.all([
        billingApi.getBillingMe(),
        billingApi.getBillingOrders(),
      ]);

      setSummary(summaryResult);
      setOrders(ordersResult);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const pendingOrders = useMemo(() => {
    const byId = new Map<string, BillingOrder>();

    summary?.pendingOrders.forEach((order) => byId.set(order.id, order));
    orders
      .filter((order) => order.status === "pending")
      .forEach((order) => byId.set(order.id, order));

    return Array.from(byId.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }, [orders, summary?.pendingOrders]);

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orders],
  );

  return (
    <DashboardShell planLabel={summary?.plan.name}>
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-[1180px] space-y-6">
          <header className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
                {t("payments.header.eyebrow")}
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                {t("payments.header.title")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bac9cc] sm:text-base">
                {t("payments.header.body")}
              </p>
            </div>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading || isRefreshing}
              type="button"
              onClick={() => void loadPayments(false)}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t("common.refresh")}
            </button>
          </header>

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
                      {t("payments.error.title")}
                    </h2>
                    <p className="mt-1 text-sm text-[#ffdad6]/80">{error}</p>
                  </div>
                </div>
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#ffb4ab]/35 px-3 py-2 text-xs font-bold text-[#ffdad6] transition hover:bg-[#ffb4ab]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffb4ab]"
                  type="button"
                  onClick={() => void loadPayments()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t("common.retry")}
                </button>
              </div>
            </section>
          ) : null}

          {isLoading ? (
            <div className="grid gap-5">
              <div className="h-56 animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
              <div className="h-80 animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
            </div>
          ) : (
            <>
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <Clock3 className="h-5 w-5 text-[#f3bf26]" />
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-white">
                      {t("payments.pending.title")}
                    </h2>
                    <p className="mt-1 text-sm text-[#bac9cc]">
                      {t("payments.pending.body")}
                    </p>
                  </div>
                </div>

                {pendingOrders.length === 0 ? (
                  <PaymentsEmptyState
                    body={t("payments.pending.emptyBody")}
                    title={t("payments.pending.emptyTitle")}
                  />
                ) : (
                  <div className="grid gap-4">
                    {pendingOrders.map((order) => (
                      <PendingPaymentCard key={order.id} order={order} />
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-[#00e5ff]" />
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-white">
                      {t("payments.history.title")}
                    </h2>
                    <p className="mt-1 text-sm text-[#bac9cc]">
                      {t("payments.history.body")}
                    </p>
                  </div>
                </div>

                {sortedOrders.length === 0 ? (
                  <PaymentsEmptyState
                    body={t("payments.history.emptyBody")}
                    title={t("payments.history.emptyTitle")}
                  />
                ) : (
                  <div className="overflow-hidden rounded-lg border border-[#3b494c] bg-[#1c1b1b]">
                    {sortedOrders.map((order) => (
                      <OrderHistoryRow key={order.id} order={order} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </DashboardShell>
  );
}
