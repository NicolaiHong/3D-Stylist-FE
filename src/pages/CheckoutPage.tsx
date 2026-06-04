import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  Clock3,
  HelpCircle,
  Loader2,
  LockKeyhole,
  PackageCheck,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  XCircle,
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
import { getDisplayLabel } from "../i18n/displayMaps";
import { formatI18nCurrency, formatI18nDateTime } from "../i18n/formatters";
import { useI18n } from "../i18n/useI18n";
import type { Language } from "../i18n/types";

type CopiedField = "account" | "transfer";
type Translate = ReturnType<typeof useI18n>["t"];

function getOrderProductName(order: BillingOrder | null, t: Translate) {
  return order?.items[0]?.productName ?? t("checkout.productFallback");
}

function getTransferContent(
  payment: VietQrPaymentInstruction | null,
  order: BillingOrder | null,
) {
  return (
    payment?.transferContent ??
    order?.bankTransferContent ??
    order?.orderCode ??
    null
  );
}

function getVerificationLabel(
  order: BillingOrder | null,
  language: Language,
  t: Translate,
) {
  if (!order) {
    return t("checkout.preparing");
  }

  if (order.status === "paid") {
    return getDisplayLabel("orderStatus", "paid", language);
  }

  if (
    order.paymentVerification === "pending_admin_verification" ||
    order.paymentVerification === "user_reported_transferred"
  ) {
    return getDisplayLabel(
      "verificationStatus",
      "pending_admin_verification",
      language,
    );
  }

  if (order.status === "expired") {
    return getDisplayLabel("orderStatus", "expired", language);
  }

  if (order.status === "failed" || order.status === "cancelled") {
    return getDisplayLabel("orderStatus", order.status, language);
  }

  return getDisplayLabel("verificationStatus", "awaiting_transfer", language);
}

function getStatusDescription(order: BillingOrder | null, t: Translate) {
  if (!order) {
    return t("checkout.status.preparing");
  }

  if (order.status === "paid") {
    return t("checkout.status.paid");
  }

  if (order.status === "expired") {
    return t("checkout.status.expired");
  }

  if (order.status === "failed" || order.status === "cancelled") {
    return t("checkout.status.terminal");
  }

  if (
    order.paymentVerification === "pending_admin_verification" ||
    order.paymentVerification === "user_reported_transferred"
  ) {
    return t("checkout.status.reported");
  }

  return t("checkout.status.awaiting");
}

function getProgressIndex(order: BillingOrder | null) {
  if (!order) {
    return -1;
  }

  if (order.status === "paid") {
    return 3;
  }

  if (
    order.paymentVerification === "pending_admin_verification" ||
    order.paymentVerification === "user_reported_transferred"
  ) {
    return 2;
  }

  if (order.status === "pending") {
    return 0;
  }

  return -1;
}

function PaymentProgress({ order }: { order: BillingOrder | null }) {
  const { t } = useI18n();
  const steps = [
    { label: t("checkout.progress.waiting"), icon: Clock3 },
    { label: t("checkout.progress.reported"), icon: PackageCheck },
    { label: t("checkout.progress.admin"), icon: ShieldCheck },
    { label: t("checkout.progress.paid"), icon: CheckCircle2 },
  ];
  const activeIndex = getProgressIndex(order);

  return (
    <section
      aria-label={t("checkout.progress.label")}
      className="rounded-lg border border-[#262626] bg-[#121212] p-4 sm:p-5"
    >
      <div className="grid gap-3 sm:grid-cols-4">
        {steps.map(({ label, icon: Icon }, index) => {
          const isActive = index <= activeIndex;

          return (
            <div
              className={`flex min-h-[92px] items-center gap-3 rounded-md border p-3 ${
                isActive
                  ? "border-[#00e5ff]/35 bg-[#00e5ff]/10 text-[#c3f5ff]"
                  : "border-[#262626] bg-[#0e0e0e] text-[#849396]"
              }`}
              key={label}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${
                  isActive
                    ? "border-[#00e5ff]/45 bg-[#00e5ff]/12"
                    : "border-[#3b494c] bg-[#1c1b1b]"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold uppercase leading-5 tracking-[0.12em]">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CheckoutOrderSummary({
  order,
  payment,
}: {
  order: BillingOrder;
  payment: VietQrPaymentInstruction | null;
}) {
  const { language, t } = useI18n();

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-[#262626] bg-[#121212] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#849396]">
          {t("checkout.summary.product")}
        </p>
        <p className="mt-2 text-lg font-semibold text-white">
          {getOrderProductName(order, t)}
        </p>
      </div>
      <div className="rounded-lg border border-[#262626] bg-[#121212] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#849396]">
          {t("checkout.summary.amount")}
        </p>
        <p className="mt-2 font-display text-2xl font-semibold text-[#00e5ff]">
          {formatI18nCurrency(
            payment?.amount ?? order.totalAmount,
            language,
            order.currency,
          )}
        </p>
      </div>
      <div className="rounded-lg border border-[#262626] bg-[#121212] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#849396]">
          {t("checkout.summary.expires")}
        </p>
        <p className="mt-2 text-lg font-semibold text-white">
          {formatI18nDateTime(
            order.expiresAt,
            language,
            t("common.notReturned"),
          )}
        </p>
      </div>
    </section>
  );
}

function DetailRow({
  label,
  value,
  isEmphasized = false,
  isMono = false,
  copyLabel,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  isEmphasized?: boolean;
  isMono?: boolean;
  copyLabel?: string;
  copied?: boolean;
  onCopy?: () => void;
}) {
  const { t } = useI18n();

  return (
    <div
      className={`grid gap-2 rounded-md border p-3 ${
        isEmphasized
          ? "border-[#00e5ff]/25 bg-[#00e5ff]/10"
          : "border-[#262626] bg-[#0e0e0e]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
          {label}
        </dt>
        {onCopy ? (
          <button
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-xs font-bold text-[#c3f5ff] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff]"
            type="button"
            onClick={onCopy}
          >
            {copied ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Clipboard className="h-3.5 w-3.5" />
            )}
            {copied ? t("common.copied") : copyLabel ?? t("common.copy")}
          </button>
        ) : null}
      </div>
      <dd
        className={`break-words text-sm font-semibold text-white ${
          isMono ? "font-mono" : ""
        } ${isEmphasized ? "text-lg text-[#c3f5ff]" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function BankTransferDetails({
  payment,
  order,
  copiedField,
  onCopy,
}: {
  payment: VietQrPaymentInstruction | null;
  order: BillingOrder;
  copiedField: CopiedField | null;
  onCopy: (value: string | null | undefined, field: CopiedField) => void;
}) {
  const { language, t } = useI18n();
  const transferContent =
    getTransferContent(payment, order) ?? t("common.notReturned");
  const accountNumber = payment?.bank.accountNumber ?? t("common.notReturned");

  return (
    <section className="flex h-full flex-col justify-between gap-5 p-5 sm:p-6 lg:p-6">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#00e5ff]" />
          <div>
            <h2 className="font-display text-2xl font-semibold text-white">
              {t("checkout.detail.bankTitle")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
              {t("checkout.detail.bankBody")}
            </p>
          </div>
        </div>

        <dl className="grid gap-3">
          <DetailRow
            label={t("checkout.detail.bankName")}
            value={payment?.bank.bankName || t("checkout.detail.configuredBank")}
          />
          <DetailRow
            copied={copiedField === "account"}
            copyLabel={t("checkout.detail.copyAccount")}
            isMono
            label={t("checkout.detail.accountNumber")}
            value={accountNumber}
            onCopy={() => onCopy(payment?.bank.accountNumber, "account")}
          />
          <DetailRow
            label={t("checkout.detail.accountHolder")}
            value={payment?.bank.accountName || t("common.notReturned")}
          />
          <DetailRow
            label={t("checkout.detail.amount")}
            value={formatI18nCurrency(
              payment?.amount ?? order.totalAmount,
              language,
              order.currency,
            )}
          />
          <DetailRow
            copied={copiedField === "transfer"}
            copyLabel={t("checkout.detail.copyContent")}
            isEmphasized
            isMono
            label={t("checkout.detail.transferContent")}
            value={transferContent}
            onCopy={() => onCopy(getTransferContent(payment, order), "transfer")}
          />
        </dl>
      </div>
    </section>
  );
}

function PaymentInstructionCards() {
  const { t } = useI18n();
  const steps = [
    {
      title: t("checkout.instructions.openApp.title"),
      body: t("checkout.instructions.openApp.body"),
      icon: Smartphone,
    },
    {
      title: t("checkout.instructions.scan.title"),
      body: t("checkout.instructions.scan.body"),
      icon: ScanLine,
    },
    {
      title: t("checkout.instructions.amount.title"),
      body: t("checkout.instructions.amount.body"),
      icon: LockKeyhole,
    },
    {
      title: t("checkout.instructions.report.title"),
      body: t("checkout.instructions.report.body"),
      icon: PackageCheck,
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {steps.map(({ title, body, icon: Icon }, index) => (
        <article
          className="rounded-lg border border-[#262626] bg-[#121212] p-4"
          key={title}
        >
          <div className="flex items-start justify-between gap-4">
            <span className="font-display text-4xl font-bold text-white/[0.08]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[#00e5ff]/25 bg-[#00e5ff]/10 text-[#00e5ff]">
              <Icon className="h-4 w-4" />
            </span>
          </div>
          <h3 className="mt-5 text-base font-bold text-white">{title}</h3>
          <p className="mt-3 text-sm leading-6 text-[#bac9cc]">{body}</p>
        </article>
      ))}
    </section>
  );
}

function CheckoutStatusPanel({
  order,
  isReportingTransfer,
  canReportTransfer,
  onConfirmTransfer,
  onRefresh,
}: {
  order: BillingOrder;
  isReportingTransfer: boolean;
  canReportTransfer: boolean;
  onConfirmTransfer: () => void;
  onRefresh: () => void;
}) {
  const { language, t } = useI18n();
  const label = getVerificationLabel(order, language, t);
  const isPaid = order.status === "paid";
  const isTerminal =
    order.status === "expired" ||
    order.status === "failed" ||
    order.status === "cancelled";
  const Icon = isPaid ? CheckCircle2 : isTerminal ? XCircle : Clock3;

  return (
    <section
      className={`rounded-lg border p-5 ${
        isTerminal
          ? "border-[#ffb4ab]/30 bg-[#93000a]/20"
          : isPaid
            ? "border-[#00e5ff]/30 bg-[#00e5ff]/10"
            : "border-[#f3bf26]/30 bg-[#f3bf26]/10"
      }`}
    >
      <div className="flex gap-3">
        <Icon
          className={`mt-0.5 h-5 w-5 shrink-0 ${
            isTerminal
              ? "text-[#ffb4ab]"
              : isPaid
                ? "text-[#9cf0ff]"
                : "text-[#ffeac0]"
          }`}
        />
        <div>
          <p className="text-sm font-bold text-white">{label}</p>
          <p className="mt-2 text-sm leading-6 text-[#e5e2e1]/80">
            {getStatusDescription(order, t)}
          </p>
        </div>
      </div>

      {!isPaid && !isTerminal ? (
        <p className="mt-4 text-xs font-semibold leading-5 text-[#ffeac0]">
          {t("checkout.report.warning")}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-3 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canReportTransfer || isReportingTransfer}
          type="button"
          onClick={onConfirmTransfer}
        >
          {isReportingTransfer ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          {canReportTransfer ? t("checkout.iTransferred") : label}
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-3 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
          type="button"
          onClick={onRefresh}
        >
          <RefreshCw className="h-4 w-4" />
          {t("checkout.refreshStatus")}
        </button>
        <Link
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/10 px-4 py-3 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/40 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
          to="/credits"
        >
          {t("checkout.backToCredits")}
        </Link>
      </div>
    </section>
  );
}

export function CheckoutPage() {
  const { language, t } = useI18n();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [order, setOrder] = useState<BillingOrder | null>(null);
  const [payment, setPayment] = useState<VietQrPaymentInstruction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReportingTransfer, setIsReportingTransfer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<CopiedField | null>(null);
  const [qrFailed, setQrFailed] = useState(false);

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

  useEffect(() => {
    setQrFailed(false);
  }, [payment?.qr.imageUrl]);

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

  async function copyPaymentText(
    value: string | null | undefined,
    field: CopiedField,
  ) {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => {
        setCopiedField((currentField) =>
          currentField === field ? null : currentField,
        );
      }, 1800);
    } catch {
      setActionError(t("checkout.copyFailed"));
    }
  }

  const canReportTransfer =
    order?.status === "pending" &&
    order.paymentVerification !== "pending_admin_verification" &&
    order.paymentVerification !== "user_reported_transferred";

  return (
    <DashboardShell planLabel={summary?.plan.name}>
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-[1240px] space-y-6">
          <div className="flex flex-col gap-4 rounded-lg border border-[#262626] bg-[#121212] p-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
              to="/credits"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("checkout.backToCredits")}
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#00e5ff]/25 bg-[#00e5ff]/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#c3f5ff]">
                <LockKeyhole className="h-4 w-4" />
                {t("checkout.badge")}
              </span>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                type="button"
                onClick={() => void loadCheckout()}
              >
                <RefreshCw className="h-4 w-4" />
                {t("checkout.refreshStatus")}
              </button>
            </div>
          </div>

          <header className="rounded-lg border border-[#262626] bg-[#121212] p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
              {t("checkout.header.eyebrow")}
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
              {t("checkout.header.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bac9cc] sm:text-base">
              {t("checkout.header.body")}
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
                    {t("checkout.error.title")}
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
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="h-[560px] animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
              <div className="h-[560px] animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
            </div>
          ) : !order ? (
            <section className="rounded-lg border border-dashed border-[#3b494c] bg-[#121212] p-6 text-center">
              <ShoppingCartFallback />
            </section>
          ) : (
            <>
              <CheckoutOrderSummary order={order} payment={payment} />

              <section className="overflow-hidden rounded-lg border border-[#262626] bg-[#121212]">
                <div className="grid lg:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.05fr)]">
                  <div className="border-b border-[#262626] bg-[#0a0a0a] p-5 sm:p-8 lg:border-b-0 lg:border-r">
                    <div className="flex h-full min-h-[430px] flex-col items-center justify-center gap-5">
                      <div className="text-center">
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#00e5ff]">
                          {t("checkout.qr.eyebrow")}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                          {t("checkout.qr.body")}
                        </p>
                      </div>

                      <div className="flex w-full max-w-[340px] items-center justify-center rounded-lg border border-[#00e5ff]/20 bg-white p-4 shadow-[0_0_42px_rgba(0,229,255,0.08)]">
                        {payment?.qr.imageUrl && !qrFailed ? (
                          <img
                            alt={t("checkout.qr.alt", {
                              product: getOrderProductName(order, t),
                            })}
                            className="aspect-square w-full object-contain"
                            src={payment.qr.imageUrl}
                            onError={() => setQrFailed(true)}
                          />
                        ) : (
                          <div className="flex aspect-square w-full flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-slate-800">
                            <AlertTriangle className="h-9 w-9 text-amber-600" />
                            <p className="mt-4 text-sm font-bold">
                              {t("checkout.qr.unavailable")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-slate-600">
                              {t("checkout.qr.manual")}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="rounded-full border border-[#3b494c] bg-[#1c1b1b] px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.12em] text-[#c3f5ff]">
                        {t("checkout.expiresAt", {
                          date: formatI18nDateTime(
                            order.expiresAt,
                            language,
                            t("common.notReturned"),
                          ),
                        })}
                      </div>
                    </div>
                  </div>

                  <BankTransferDetails
                    copiedField={copiedField}
                    order={order}
                    payment={payment}
                    onCopy={(value, field) =>
                      void copyPaymentText(value, field)
                    }
                  />
                </div>
              </section>

              <PaymentProgress order={order} />

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
                <PaymentInstructionCards />

                <div className="space-y-4">
                  <CheckoutStatusPanel
                    canReportTransfer={Boolean(canReportTransfer)}
                    isReportingTransfer={isReportingTransfer}
                    order={order}
                    onConfirmTransfer={() => void handleConfirmTransfer()}
                    onRefresh={() => void loadCheckout()}
                  />
                  <section className="rounded-lg border border-[#262626] bg-[#121212] p-5">
                    <div className="flex gap-3">
                      <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#00e5ff]" />
                      <div>
                        <h2 className="text-sm font-bold text-white">
                          {t("checkout.manualVerification.title")}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                          {t("checkout.manualVerification.body")}
                        </p>
                      </div>
                    </div>
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
  const { t } = useI18n();

  return (
    <>
      <p className="font-display text-2xl font-semibold text-white">
        {t("checkout.empty.title")}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#bac9cc]">
        {t("checkout.empty.body")}
      </p>
      <Link
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff]"
        to="/credits"
      >
        {t("checkout.empty.chooseProduct")}
      </Link>
    </>
  );
}
