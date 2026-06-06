import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  RotateCcw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { billingApi } from "../features/billing/billing.api";
import type { BillingOrderStatus } from "../features/billing/billing.types";
import { getApiErrorMessage } from "../services/apiClient";
import { useI18n } from "../i18n/useI18n";

type PaymentResultStatus =
  | "success"
  | "noOrder"
  | "pending"
  | "failed"
  | "cancelled"
  | "unknown";
type OrderLookupStatus = "idle" | "loading" | "loaded" | "error";

interface PaymentResultCopy {
  keyPrefix: string;
  icon: LucideIcon;
  panelClassName: string;
  iconClassName: string;
}

const resultCopy: Record<PaymentResultStatus, PaymentResultCopy> = {
  success: {
    keyPrefix: "paymentResult.success",
    icon: CheckCircle2,
    panelClassName: "border-[#00e5ff]/30 bg-[#00e5ff]/10 text-[#c3f5ff]",
    iconClassName: "border-[#00e5ff]/35 bg-[#00e5ff]/12 text-[#00e5ff]",
  },
  noOrder: {
    keyPrefix: "paymentResult.noOrder",
    icon: Clock3,
    panelClassName: "border-[#3b494c] bg-[#1c1b1b] text-[#c3f5ff]",
    iconClassName: "border-[#3b494c] bg-[#0e0e0e] text-[#00e5ff]",
  },
  pending: {
    keyPrefix: "paymentResult.pending",
    icon: Clock3,
    panelClassName: "border-[#f3bf26]/30 bg-[#f3bf26]/10 text-[#ffeac0]",
    iconClassName: "border-[#f3bf26]/35 bg-[#f3bf26]/12 text-[#f3bf26]",
  },
  failed: {
    keyPrefix: "paymentResult.failed",
    icon: XCircle,
    panelClassName: "border-[#ffb4ab]/30 bg-[#93000a]/25 text-[#ffdad6]",
    iconClassName: "border-[#ffb4ab]/35 bg-[#93000a]/25 text-[#ffb4ab]",
  },
  cancelled: {
    keyPrefix: "paymentResult.cancelled",
    icon: Clock3,
    panelClassName: "border-[#f3bf26]/30 bg-[#f3bf26]/10 text-[#ffeac0]",
    iconClassName: "border-[#f3bf26]/35 bg-[#f3bf26]/12 text-[#f3bf26]",
  },
  unknown: {
    keyPrefix: "paymentResult.unknown",
    icon: AlertTriangle,
    panelClassName: "border-[#3b494c] bg-[#1c1b1b] text-[#bac9cc]",
    iconClassName: "border-[#3b494c] bg-[#0e0e0e] text-[#bac9cc]",
  },
};

function normalizeStatus(value: string | undefined): PaymentResultStatus {
  if (
    value === "success" ||
    value === "pending" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value;
  }

  if (value === "canceled") {
    return "cancelled";
  }

  return "unknown";
}

function resolveDisplayStatus(
  urlStatus: PaymentResultStatus,
  backendStatus: BillingOrderStatus | null,
  provider: string | null,
  hasOrderId: boolean,
  orderLookupStatus: OrderLookupStatus,
): PaymentResultStatus {
  if (hasOrderId && orderLookupStatus === "error") {
    return "unknown";
  }

  if (backendStatus === "paid") {
    return "success";
  }

  if (!hasOrderId) {
    if (urlStatus === "failed" || urlStatus === "cancelled") {
      return urlStatus;
    }

    if (urlStatus === "unknown") {
      return "unknown";
    }

    return "noOrder";
  }

  if (urlStatus === "cancelled") {
    return "cancelled";
  }

  if (backendStatus === "pending") {
    return "pending";
  }

  if (backendStatus === "failed" || backendStatus === "expired") {
    return "failed";
  }

  if (backendStatus === "cancelled") {
    return "cancelled";
  }

  if (provider === "payos" && urlStatus === "success") {
    return "pending";
  }

  if (urlStatus === "success") {
    return "pending";
  }

  return urlStatus;
}

export function PaymentResultPage() {
  const { t } = useI18n();
  const { status: rawStatus } = useParams();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const provider = searchParams.get("provider");
  const [backendStatus, setBackendStatus] =
    useState<BillingOrderStatus | null>(null);
  const [orderLookupStatus, setOrderLookupStatus] =
    useState<OrderLookupStatus>("idle");
  const [statusError, setStatusError] = useState<string | null>(null);
  const urlStatus = normalizeStatus(rawStatus);
  const hasOrderId = Boolean(orderId);
  const status = useMemo(
    () =>
      resolveDisplayStatus(
        urlStatus,
        backendStatus,
        provider,
        hasOrderId,
        orderLookupStatus,
      ),
    [backendStatus, hasOrderId, orderLookupStatus, provider, urlStatus],
  );
  const copy = resultCopy[status];
  const statusLabel = t(`paymentResult.status.${status}`);
  const Icon = copy.icon;
  const sourceLabel =
    provider === "payos"
      ? t("paymentResult.source.payos")
      : t("paymentResult.source.gateway");
  const canViewOrderCheckout =
    hasOrderId &&
    (status === "pending" ||
      status === "failed" ||
      status === "cancelled" ||
      status === "unknown");

  useEffect(() => {
    if (!orderId) {
      setBackendStatus(null);
      setStatusError(null);
      setOrderLookupStatus("idle");
      return;
    }

    const resolvedOrderId = orderId;
    let isActive = true;
    setBackendStatus(null);
    setStatusError(null);
    setOrderLookupStatus("loading");

    async function loadOrderStatus() {
      try {
        const order = await billingApi.getBillingOrder(resolvedOrderId);

        if (isActive) {
          setBackendStatus(order.status);
          setStatusError(null);
          setOrderLookupStatus("loaded");
        }
      } catch (error) {
        if (isActive) {
          setBackendStatus(null);
          setStatusError(getApiErrorMessage(error));
          setOrderLookupStatus("error");
        }
      }
    }

    void loadOrderStatus();

    return () => {
      isActive = false;
    };
  }, [orderId]);

  return (
    <DashboardShell>
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-[980px] space-y-5">
          <header className="rounded-lg border border-[#262626] bg-[#121212] p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
              {sourceLabel}
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
              {t(`${copy.keyPrefix}.title`)}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bac9cc] sm:text-base">
              {t(`${copy.keyPrefix}.description`)}
            </p>
          </header>

          <section className={`rounded-lg border p-5 ${copy.panelClassName}`}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <span
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-md border ${copy.iconClassName}`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold uppercase tracking-[0.14em]">
                  {t("paymentResult.statusLabel")}: {statusLabel}
                </p>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-md border border-white/10 bg-[#0e0e0e]/70 p-3">
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                      {t("paymentResult.orderId")}
                    </dt>
                    <dd className="mt-2 break-words font-mono text-[#e5e2e1]">
                      {orderId ?? t("common.notReturned")}
                    </dd>
                  </div>
                  <div className="rounded-md border border-white/10 bg-[#0e0e0e]/70 p-3">
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                      {t("paymentResult.source")}
                    </dt>
                    <dd className="mt-2 font-semibold text-[#e5e2e1]">
                      {sourceLabel}
                    </dd>
                  </div>
                </dl>
                {statusError ? (
                  <p className="mt-4 text-sm leading-6 text-[#ffdad6]">
                    {statusError}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-4">
            <div className="flex gap-3">
              <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-[#00e5ff]" />
              <div>
                <h2 className="text-sm font-bold text-white">
                  {t("paymentResult.backendOwned.title")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                  {t("paymentResult.backendOwned.body")}
                </p>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-5 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff]"
              to="/credits"
            >
              {t("paymentResult.backToCredits")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            {!hasOrderId ? (
              <Link
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-5 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                to="/credits/checkout"
              >
                <RotateCcw className="h-4 w-4" />
                {t("paymentResult.backToCheckout")}
              </Link>
            ) : canViewOrderCheckout && orderId ? (
              <Link
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-5 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                to={`/credits/checkout/${orderId}`}
              >
                <RotateCcw className="h-4 w-4" />
                {t("paymentResult.viewOrderCheckout")}
              </Link>
            ) : null}
            {status === "success" ? (
              <Link
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-5 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                to="/dashboard"
              >
                {t("paymentResult.openDashboard")}
              </Link>
            ) : null}
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}
