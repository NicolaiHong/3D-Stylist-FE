import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { billingApi } from "../features/billing/billing.api";
import {
  BILLING_PROVIDERS,
  type BillingOrder,
  type BillingProvider,
  type BillingSummary,
} from "../features/billing/billing.types";
import { getApiErrorMessage } from "../services/apiClient";

type PaymentResultRouteState = "success" | "failed" | "cancelled";

interface PaymentResultPageProps {
  routeState: PaymentResultRouteState;
}

function formatCurrency(value: number, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function getOrderProductName(order: BillingOrder | null) {
  return order?.items[0]?.productName ?? "Sandbox order";
}

function getRouteLabel(routeState: PaymentResultRouteState) {
  if (routeState === "success") {
    return "Payment return";
  }

  if (routeState === "cancelled") {
    return "Payment cancelled";
  }

  return "Payment failed";
}

function getStatusCopy(order: BillingOrder | null, routeState: PaymentResultRouteState) {
  if (!order) {
    return {
      icon: AlertTriangle,
      title: "Order status unavailable",
      body: "We could not confirm this sandbox payment yet.",
      tone: "border-[#ffb4ab]/25 bg-[#93000a]/20 text-[#ffdad6]",
    };
  }

  if (order.status === "paid") {
    return {
      icon: CheckCircle2,
      title: "Payment confirmed by backend",
      body:
        order.items[0]?.productKind === "subscription_plan"
          ? `${getOrderProductName(order)} is active for this account.`
          : `${order.items[0]?.credits ?? 0} credits were granted.`,
      tone: "border-[#00e5ff]/25 bg-[#00e5ff]/10 text-[#9cf0ff]",
    };
  }

  if (order.status === "pending") {
    return {
      icon: Clock3,
      title: "Checking payment status",
      body:
        "The order is still pending. Refresh after the sandbox gateway finishes, or retry payment.",
      tone: "border-[#f3bf26]/30 bg-[#f3bf26]/10 text-[#ffeac0]",
    };
  }

  if (order.status === "cancelled") {
    return {
      icon: XCircle,
      title: "Sandbox payment cancelled",
      body: "No credits or subscription access were granted.",
      tone: "border-[#ffb4ab]/25 bg-[#93000a]/20 text-[#ffdad6]",
    };
  }

  return {
    icon: XCircle,
    title:
      routeState === "cancelled"
        ? "Sandbox payment did not complete"
        : "Sandbox payment failed",
    body: "No credits or subscription access were granted.",
    tone: "border-[#ffb4ab]/25 bg-[#93000a]/20 text-[#ffdad6]",
  };
}

export function PaymentResultPage({ routeState }: PaymentResultPageProps) {
  const paymentInitiationRef = useRef(false);
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [order, setOrder] = useState<BillingOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingProvider, setProcessingProvider] =
    useState<BillingProvider | null>(null);
  const [redirectingProvider, setRedirectingProvider] =
    useState<BillingProvider | null>(null);

  const loadResult = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const summaryPromise = billingApi.getBillingMe();
      const orderPromise = orderId
        ? billingApi.getBillingOrder(orderId)
        : Promise.resolve(null);
      const [summaryResult, orderResult] = await Promise.all([
        summaryPromise,
        orderPromise,
      ]);

      setSummary(summaryResult);
      setOrder(orderResult);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadResult();
  }, [loadResult]);

  function beginPaymentInitiation() {
    if (paymentInitiationRef.current) {
      return false;
    }

    paymentInitiationRef.current = true;
    return true;
  }

  function releasePaymentInitiation() {
    paymentInitiationRef.current = false;
  }

  async function retryPayment(provider: BillingProvider) {
    if (!order) {
      return;
    }

    const productCode = order.items[0]?.productCode;

    if (!productCode) {
      setActionError("This order is missing product information.");
      return;
    }

    if (!beginPaymentInitiation()) {
      return;
    }

    let redirectStarted = false;
    setActionError(null);
    setProcessingProvider(provider);

    try {
      const payableOrder =
        order.status === "pending"
          ? order
          : await billingApi.createBillingOrder(productCode);
      const result = await billingApi.payBillingOrder(payableOrder.id, provider);
      const redirectUrl = result.payment.redirectUrl || result.transaction.paymentUrl;

      if (!redirectUrl) {
        setActionError("Sandbox payment did not return a redirect URL.");
        setOrder(payableOrder);
        return;
      }

      setOrder(result.order);
      redirectStarted = true;
      setRedirectingProvider(provider);
      window.setTimeout(() => {
        window.location.assign(redirectUrl);
      }, 150);
    } catch (retryError) {
      setActionError(getApiErrorMessage(retryError));
    } finally {
      setProcessingProvider(null);

      if (!redirectStarted) {
        releasePaymentInitiation();
      }
    }
  }

  const copy = getStatusCopy(order, routeState);
  const StatusIcon = copy.icon;
  const providerName =
    redirectingProvider === BILLING_PROVIDERS.MOMO ? "MoMo" : "VNPay";

  if (redirectingProvider) {
    return (
      <DashboardShell planLabel={summary?.plan.name}>
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
          <section className="w-full max-w-md rounded-lg border border-[#00e5ff]/25 bg-[#1c1b1b] p-6 text-center shadow-[0_0_48px_rgba(0,229,255,0.12)]">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#00e5ff]" />
            <h1 className="mt-5 font-display text-2xl font-semibold text-white">
              Opening {providerName} sandbox...
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#bac9cc]">
              We are retrying payment for {getOrderProductName(order)}.
            </p>
          </section>
        </main>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell planLabel={summary?.plan.name}>
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <div className="mx-auto grid w-full max-w-[900px] gap-6">
          <section className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
              {getRouteLabel(routeState)}
            </p>

            {isLoading ? (
              <div className="mt-8 flex items-center gap-3 text-[#bac9cc]">
                <Loader2 className="h-5 w-5 animate-spin text-[#00e5ff]" />
                Checking backend order state...
              </div>
            ) : (
              <>
                <div className="mt-8 flex items-start gap-4">
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md border ${copy.tone}`}
                  >
                    <StatusIcon className="h-6 w-6" />
                  </span>
                  <div>
                    <h1 className="font-display text-3xl font-semibold leading-tight text-white">
                      {copy.title}
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-[#bac9cc]">
                      {copy.body}
                    </p>
                  </div>
                </div>

                {error ? (
                  <div
                    className="mt-6 rounded-lg border border-[#ffb4ab]/30 bg-[#93000a]/25 p-4 text-sm text-[#ffdad6]"
                    role="alert"
                  >
                    <div className="flex gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  </div>
                ) : null}

                {actionError ? (
                  <div
                    className="mt-6 rounded-lg border border-[#ffb4ab]/30 bg-[#93000a]/25 p-4 text-sm text-[#ffdad6]"
                    role="alert"
                  >
                    <div className="flex gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{actionError}</span>
                    </div>
                  </div>
                ) : null}

                {order ? (
                  <dl className="mt-8 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-[#3b494c] bg-[#0e0e0e] p-4">
                      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#849396]">
                        Product
                      </dt>
                      <dd className="mt-2 text-sm font-bold text-white">
                        {getOrderProductName(order)}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-[#3b494c] bg-[#0e0e0e] p-4">
                      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#849396]">
                        Backend status
                      </dt>
                      <dd className="mt-2 text-sm font-bold text-white">
                        {order.status}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-[#3b494c] bg-[#0e0e0e] p-4">
                      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#849396]">
                        Amount
                      </dt>
                      <dd className="mt-2 text-sm font-bold text-white">
                        {formatCurrency(order.totalAmount, order.currency)}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-[#3b494c] bg-[#0e0e0e] p-4">
                      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#849396]">
                        Order
                      </dt>
                      <dd className="mt-2 truncate text-sm font-bold text-white">
                        {order.id}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <div className="mt-8 rounded-lg border border-[#3b494c] bg-[#0e0e0e] p-5 text-sm text-[#bac9cc]">
                    No order id was provided by the payment return route.
                  </div>
                )}

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                    type="button"
                    onClick={() => void loadResult()}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh status
                  </button>
                  <Link
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff]"
                    to="/dashboard"
                  >
                    Return to dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                    to="/credits"
                  >
                    Back to credits
                  </Link>
                </div>

                {order && order.status !== "paid" ? (
                  <div className="mt-6 rounded-lg border border-[#f3bf26]/30 bg-[#f3bf26]/10 p-4">
                    <p className="text-sm font-bold text-white">
                      Retry sandbox payment
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#ffeac0]/80">
                      A retry creates a fresh order when the original order is no
                      longer payable.
                    </p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <button
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={Boolean(processingProvider)}
                        type="button"
                        onClick={() => void retryPayment(BILLING_PROVIDERS.MOMO)}
                      >
                        {processingProvider === BILLING_PROVIDERS.MOMO ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Retry with MoMo sandbox
                      </button>
                      <button
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={Boolean(processingProvider)}
                        type="button"
                        onClick={() => void retryPayment(BILLING_PROVIDERS.VNPAY)}
                      >
                        {processingProvider === BILLING_PROVIDERS.VNPAY ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Retry with VNPay sandbox
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </main>
    </DashboardShell>
  );
}
