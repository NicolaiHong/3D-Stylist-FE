import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { billingApi } from "../features/billing/billing.api";
import {
  type BillingOrder,
  type BillingSummary,
  type VietQrPaymentInstruction,
} from "../features/billing/billing.types";
import { getApiErrorMessage } from "../services/apiClient";
import { BILLING_CART_STORAGE_KEY } from "./CreditsPage";

function formatCurrency(value: number, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not returned";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getOrderProductName(order: BillingOrder | null) {
  return order?.items[0]?.productName ?? "Checkout item";
}

function getVerificationLabel(order: BillingOrder | null) {
  if (!order) {
    return "Preparing checkout";
  }

  if (order.status === "paid") {
    return "Paid";
  }

  if (
    order.paymentVerification === "pending_admin_verification" ||
    order.paymentVerification === "user_reported_transferred"
  ) {
    return "Waiting for admin verification";
  }

  if (order.status === "expired") {
    return "Expired";
  }

  if (order.status === "failed" || order.status === "cancelled") {
    return "Payment not completed";
  }

  return "Waiting for transfer";
}

function PaymentProgress({ order }: { order: BillingOrder | null }) {
  const steps = [
    "Waiting for transfer",
    "Transfer reported",
    "Admin verification",
    "Paid",
  ];
  const activeLabel = getVerificationLabel(order);
  const activeIndex =
    order?.status === "paid"
      ? 3
      : activeLabel === "Waiting for admin verification"
        ? 2
        : activeLabel === "Waiting for transfer"
          ? 0
          : -1;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {steps.map((step, index) => (
        <div
          className={`rounded-lg border p-3 ${
            index <= activeIndex
              ? "border-[#00e5ff]/35 bg-[#00e5ff]/10 text-[#c3f5ff]"
              : "border-[#3b494c] bg-[#1c1b1b] text-[#849396]"
          }`}
          key={step}
        >
          <p className="text-xs font-bold uppercase tracking-[0.12em]">
            {step}
          </p>
        </div>
      ))}
    </div>
  );
}

function TransferDetails({
  payment,
  order,
  onCopy,
  copied,
}: {
  payment: VietQrPaymentInstruction | null;
  order: BillingOrder;
  copied: boolean;
  onCopy: () => void;
}) {
  const transferContent =
    payment?.transferContent ??
    order.bankTransferContent ??
    order.orderCode ??
    "Not returned";

  return (
    <section className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#00e5ff]" />
        <div>
          <h2 className="font-display text-2xl font-semibold text-white">
            Bank transfer details
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
            Transfer the exact amount and keep the transfer content unchanged.
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 text-sm">
        <div className="flex justify-between gap-4 border-b border-[#3b494c]/60 pb-3">
          <dt className="text-[#849396]">Amount</dt>
          <dd className="font-bold text-white">
            {formatCurrency(payment?.amount ?? order.totalAmount, order.currency)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-[#3b494c]/60 pb-3">
          <dt className="text-[#849396]">Bank</dt>
          <dd className="text-right font-bold text-white">
            {payment?.bank.bankName || "Configured bank"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-[#3b494c]/60 pb-3">
          <dt className="text-[#849396]">Account number</dt>
          <dd className="font-mono font-bold text-white">
            {payment?.bank.accountNumber || "Not returned"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-[#3b494c]/60 pb-3">
          <dt className="text-[#849396]">Account name</dt>
          <dd className="text-right font-bold text-white">
            {payment?.bank.accountName || "Not returned"}
          </dd>
        </div>
        <div className="grid gap-3 rounded-md border border-[#00e5ff]/25 bg-[#00e5ff]/10 p-4">
          <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#00e5ff]">
            Transfer content
          </dt>
          <dd className="break-all font-mono text-lg font-bold text-white">
            {transferContent}
          </dd>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff]"
            type="button"
            onClick={onCopy}
          >
            <Clipboard className="h-4 w-4" />
            {copied ? "Copied" : "Copy transfer content"}
          </button>
        </div>
      </dl>
    </section>
  );
}

export function CheckoutPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [order, setOrder] = useState<BillingOrder | null>(null);
  const [payment, setPayment] = useState<VietQrPaymentInstruction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReportingTransfer, setIsReportingTransfer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const productCode = useMemo(
    () => window.localStorage.getItem(BILLING_CART_STORAGE_KEY),
    [],
  );

  const loadCheckout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setActionError(null);

    try {
      const summaryPromise = billingApi.getBillingMe();
      const orderPromise = orderId
        ? billingApi.getBillingOrder(orderId)
        : productCode
          ? billingApi.createBillingCheckout(productCode, "buy_now")
          : Promise.resolve(null);
      const [summaryResult, orderResult] = await Promise.all([
        summaryPromise,
        orderPromise,
      ]);

      setSummary(summaryResult);

      if (!orderResult) {
        setOrder(null);
        setPayment(null);
        return;
      }

      if ("order" in orderResult) {
        setOrder(orderResult.order);
        setPayment(orderResult.payment ?? orderResult.order.payment);
        window.localStorage.removeItem(BILLING_CART_STORAGE_KEY);
        navigate(`/credits/checkout/${orderResult.order.id}`, { replace: true });
      } else {
        setOrder(orderResult);
        setPayment(orderResult.payment);
      }
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [navigate, orderId, productCode]);

  useEffect(() => {
    void loadCheckout();
  }, [loadCheckout]);

  async function handleConfirmTransfer() {
    if (!order) {
      return;
    }

    setIsReportingTransfer(true);
    setActionError(null);

    try {
      const updatedOrder = await billingApi.confirmBillingTransfer(order.id);
      setOrder(updatedOrder);
      setPayment(updatedOrder.payment);
    } catch (confirmError) {
      setActionError(getApiErrorMessage(confirmError));
    } finally {
      setIsReportingTransfer(false);
    }
  }

  async function copyTransferContent() {
    const transferContent =
      payment?.transferContent ?? order?.bankTransferContent ?? order?.orderCode;

    if (!transferContent) {
      return;
    }

    await navigator.clipboard.writeText(transferContent);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const canReportTransfer =
    order?.status === "pending" &&
    order.paymentVerification !== "pending_admin_verification" &&
    order.paymentVerification !== "user_reported_transferred";

  return (
    <DashboardShell planLabel={summary?.plan.name}>
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <div className="mx-auto w-full max-w-[1180px] space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
              to="/credits"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to credits
            </Link>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
              type="button"
              onClick={() => void loadCheckout()}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh status
            </button>
          </div>

          <header className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
              VietQR checkout
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Complete your payment
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bac9cc] sm:text-base">
              Scan the dynamic VietQR code or transfer manually. Credits or
              subscription access activate only after admin verification.
            </p>
          </header>

          {error ? (
            <section
              className="rounded-lg border border-[#ffb4ab]/30 bg-[#93000a]/25 p-5 text-[#ffdad6]"
              role="alert"
            >
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Checkout failed to load
                  </h2>
                  <p className="mt-1 text-sm text-[#ffdad6]/80">{error}</p>
                </div>
              </div>
            </section>
          ) : null}

          {actionError ? (
            <section
              className="rounded-lg border border-[#ffb4ab]/30 bg-[#93000a]/25 p-4 text-sm text-[#ffdad6]"
              role="alert"
            >
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            </section>
          ) : null}

          {isLoading ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <div className="h-[520px] animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
              <div className="h-[520px] animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
            </div>
          ) : !order ? (
            <section className="rounded-lg border border-dashed border-[#3b494c] bg-[#1c1b1b] p-8 text-center">
              <ShoppingCartFallback />
            </section>
          ) : (
            <>
              <PaymentProgress order={order} />

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <section className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-5">
                  <div className="flex flex-col gap-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#849396]">
                        Order
                      </p>
                      <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                        {getOrderProductName(order)}
                      </h2>
                      <p className="mt-2 text-sm text-[#bac9cc]">
                        {formatCurrency(order.totalAmount, order.currency)}
                        {" · "}Expires {formatDateTime(order.expiresAt)}
                      </p>
                    </div>

                    <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-[#00e5ff]/20 bg-[#0e0e0e] p-4">
                      {payment?.qr.imageUrl ? (
                        <img
                          alt={`VietQR code for ${getOrderProductName(order)}`}
                          className="h-full max-h-[300px] w-full max-w-[300px] rounded-md bg-white object-contain p-3"
                          src={payment.qr.imageUrl}
                        />
                      ) : (
                        <div className="text-center">
                          <AlertTriangle className="mx-auto h-8 w-8 text-[#f3bf26]" />
                          <p className="mt-3 text-sm font-bold text-white">
                            QR image unavailable
                          </p>
                          <p className="mt-1 text-sm text-[#bac9cc]">
                            Use the bank transfer details instead.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {(payment?.instructions ?? []).map((instruction) => (
                        <div
                          className="rounded-md border border-[#3b494c] bg-[#0e0e0e] p-4 text-sm leading-6 text-[#bac9cc]"
                          key={instruction}
                        >
                          {instruction}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <div className="space-y-6">
                  <TransferDetails
                    copied={copied}
                    order={order}
                    payment={payment}
                    onCopy={() => void copyTransferContent()}
                  />

                  <section className="rounded-lg border border-[#f3bf26]/30 bg-[#f3bf26]/10 p-5">
                    <div className="flex gap-3">
                      {order.status === "paid" ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#9cf0ff]" />
                      ) : (
                        <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-[#ffeac0]" />
                      )}
                      <div>
                        <p className="text-sm font-bold text-white">
                          {getVerificationLabel(order)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#ffeac0]/85">
                          {order.status === "paid"
                            ? "Your billing access has been confirmed by the backend."
                            : "After sending the transfer, report it here. Admin verification is required before grants are applied."}
                        </p>
                      </div>
                    </div>

                    <button
                      className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-3 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!canReportTransfer || isReportingTransfer}
                      type="button"
                      onClick={() => void handleConfirmTransfer()}
                    >
                      {isReportingTransfer ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      {canReportTransfer
                        ? "I have transferred"
                        : getVerificationLabel(order)}
                    </button>
                  </section>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </DashboardShell>
  );
}

function ShoppingCartFallback() {
  return (
    <>
      <p className="font-display text-2xl font-semibold text-white">
        No checkout item selected
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#bac9cc]">
        Add a plan or credit pack to cart first, then checkout will create a
        VietQR order.
      </p>
      <Link
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff]"
        to="/credits"
      >
        Choose product
      </Link>
    </>
  );
}
