import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  Clock3,
  CreditCard,
  ExternalLink,
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
  BILLING_PROVIDERS,
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

type CheckoutMode = "select" | "manual" | "payos";
type CopiedField = "account" | "transfer";
type Translate = ReturnType<typeof useI18n>["t"];

const MANUAL_REPORTED_STATUSES = [
  "pending_admin_verification",
  "user_reported_transferred",
];
const ACTIVE_PAYOS_TRANSACTION_STATUSES = ["initiated", "redirected"];

function getCheckoutMode(method: string | undefined): CheckoutMode {
  if (method === "manual" || method === "payos") {
    return method;
  }

  return "select";
}

function getMethodPath(orderId: string, mode: Exclude<CheckoutMode, "select">) {
  return `/credits/checkout/${orderId}/${mode}`;
}

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

function hasActivePayosTransaction(order: BillingOrder) {
  return order.transactions.some(
    (transaction) =>
      transaction.provider === BILLING_PROVIDERS.PAYOS &&
      ACTIVE_PAYOS_TRANSACTION_STATUSES.includes(transaction.status),
  );
}

function isPayosLocked(order: BillingOrder) {
  return order.provider === BILLING_PROVIDERS.PAYOS || hasActivePayosTransaction(order);
}

function isManualLocked(order: BillingOrder) {
  return (
    Boolean(order.userReportedTransferredAt) ||
    MANUAL_REPORTED_STATUSES.includes(order.paymentVerification ?? "")
  );
}

function getLockedCheckoutMode(
  order: BillingOrder,
): Exclude<CheckoutMode, "select"> | null {
  if (isPayosLocked(order)) {
    return "payos";
  }

  if (isManualLocked(order)) {
    return "manual";
  }

  return null;
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

  if (MANUAL_REPORTED_STATUSES.includes(order.paymentVerification ?? "")) {
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

  if (MANUAL_REPORTED_STATUSES.includes(order.paymentVerification ?? "")) {
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

  if (MANUAL_REPORTED_STATUSES.includes(order.paymentVerification ?? "")) {
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
    <section className="grid gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-[#262626] bg-[#121212] p-4 sm:col-span-2">
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

function MethodSelection({
  order,
  payosEnabled,
}: {
  order: BillingOrder;
  payosEnabled: boolean;
}) {
  const { t } = useI18n();

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#f3bf26]/30 bg-[#f3bf26]/10 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#f3bf26]" />
          <p className="text-sm font-semibold leading-6 text-[#ffeac0]">
            {t("checkout.method.warning")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {payosEnabled ? (
          <article className="rounded-lg border border-[#00e5ff]/25 bg-[#121212] p-5">
            <div className="flex h-full flex-col justify-between gap-5">
              <div className="flex gap-3">
                <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-[#00e5ff]" />
                <div>
                  <h2 className="font-display text-2xl font-semibold text-white">
                    {t("checkout.method.payos.title")}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                    {t("checkout.method.payos.body")}
                  </p>
                </div>
              </div>
              <Link
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-3 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff]"
                to={getMethodPath(order.id, "payos")}
              >
                {t("checkout.method.payos.button")}
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </Link>
            </div>
          </article>
        ) : null}

        <article className="rounded-lg border border-[#262626] bg-[#121212] p-5">
          <div className="flex h-full flex-col justify-between gap-5">
            <div className="flex gap-3">
              <ScanLine className="mt-0.5 h-5 w-5 shrink-0 text-[#00e5ff]" />
              <div>
                <h2 className="font-display text-2xl font-semibold text-white">
                  {t("checkout.method.manual.title")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                  {t("checkout.method.manual.body")}
                </p>
              </div>
            </div>
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-3 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
              to={getMethodPath(order.id, "manual")}
            >
              {t("checkout.method.manual.button")}
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}

function ManualStatusPanel({
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
          to={`/credits/checkout/${order.id}`}
        >
          {t("checkout.backToMethods")}
        </Link>
      </div>
    </section>
  );
}

function PayosStatusPanel({
  order,
  canOpenPayos,
  isCreatingPayosLink,
  payosUnavailable,
  onPayosCheckout,
  onRefresh,
}: {
  order: BillingOrder;
  canOpenPayos: boolean;
  isCreatingPayosLink: boolean;
  payosUnavailable: boolean;
  onPayosCheckout: () => void;
  onRefresh: () => void;
}) {
  const { language, t } = useI18n();
  const isPaid = order.status === "paid";
  const isTerminal =
    order.status === "expired" ||
    order.status === "failed" ||
    order.status === "cancelled";
  const isDisabled =
    isPaid || isTerminal || !canOpenPayos || isCreatingPayosLink || payosUnavailable;

  return (
    <section className="rounded-lg border border-[#00e5ff]/25 bg-[#121212] p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-[#00e5ff]" />
          <div>
            <h2 className="font-display text-2xl font-semibold text-white">
              {t("checkout.payos.title")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
              {t("checkout.payos.body")}
            </p>
            <p className="mt-3 text-xs font-semibold leading-5 text-[#c3f5ff]">
              {t("checkout.payos.webhookNotice")}
            </p>
            {payosUnavailable ? (
              <p className="mt-3 text-xs font-semibold leading-5 text-[#ffeac0]">
                {t("checkout.payos.disabledHelp")}
              </p>
            ) : null}
          </div>
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-3 lg:w-auto lg:min-w-[260px] lg:grid-cols-1">
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-3 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDisabled}
            type="button"
            onClick={onPayosCheckout}
          >
            {isCreatingPayosLink ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            {isPaid
              ? getDisplayLabel("orderStatus", "paid", language)
              : payosUnavailable
                ? t("checkout.payos.unavailable")
                : t("checkout.payos.button")}
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
            to={`/credits/checkout/${order.id}`}
          >
            {t("checkout.backToMethods")}
          </Link>
        </div>
      </div>
    </section>
  );
}

function OrderStatusCard({ order }: { order: BillingOrder }) {
  const { language, t } = useI18n();
  const statusLabel = getDisplayLabel("orderStatus", order.status, language);

  return (
    <section className="rounded-lg border border-[#262626] bg-[#121212] p-5">
      <div className="flex gap-3">
        <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-[#00e5ff]" />
        <div>
          <h2 className="text-sm font-bold text-white">
            {t("checkout.statusCard.title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
            {statusLabel}
          </p>
        </div>
      </div>
    </section>
  );
}

function ManualPaymentPage({
  order,
  payment,
  copiedField,
  qrFailed,
  isReportingTransfer,
  canReportTransfer,
  onCopy,
  onQrFailed,
  onConfirmTransfer,
  onRefresh,
}: {
  order: BillingOrder;
  payment: VietQrPaymentInstruction | null;
  copiedField: CopiedField | null;
  qrFailed: boolean;
  isReportingTransfer: boolean;
  canReportTransfer: boolean;
  onCopy: (value: string | null | undefined, field: CopiedField) => void;
  onQrFailed: () => void;
  onConfirmTransfer: () => void;
  onRefresh: () => void;
}) {
  const { language, t } = useI18n();

  return (
    <>
      <section className="rounded-lg border border-[#f3bf26]/30 bg-[#f3bf26]/10 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#f3bf26]" />
          <p className="text-sm font-semibold leading-6 text-[#ffeac0]">
            {t("checkout.manual.reportNotice")}
          </p>
        </div>
      </section>

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
                    onError={onQrFailed}
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
            onCopy={onCopy}
          />
        </div>
      </section>

      <PaymentProgress order={order} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <PaymentInstructionCards />

        <div className="space-y-4">
          <ManualStatusPanel
            canReportTransfer={canReportTransfer}
            isReportingTransfer={isReportingTransfer}
            order={order}
            onConfirmTransfer={onConfirmTransfer}
            onRefresh={onRefresh}
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
  );
}

export function CheckoutPage() {
  const { t } = useI18n();
  const { orderId, method } = useParams();
  const navigate = useNavigate();
  const mode = getCheckoutMode(method);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [order, setOrder] = useState<BillingOrder | null>(null);
  const [payment, setPayment] = useState<VietQrPaymentInstruction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReportingTransfer, setIsReportingTransfer] = useState(false);
  const [isCreatingPayosLink, setIsCreatingPayosLink] = useState(false);
  const [payosUnavailable, setPayosUnavailable] = useState(false);
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

  useEffect(() => {
    if (!order || isLoading) {
      return;
    }

    const lockedMode = getLockedCheckoutMode(order);

    if (lockedMode && lockedMode !== mode) {
      navigate(getMethodPath(order.id, lockedMode), { replace: true });
    }
  }, [isLoading, mode, navigate, order]);

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

  async function handlePayosCheckout() {
    if (!order) {
      return;
    }

    setIsCreatingPayosLink(true);
    setActionError(null);
    setPayosUnavailable(false);

    try {
      const result = await billingApi.createPayosPaymentLink(order.id);
      setOrder(result.order);
      setPayment(result.order.payment);
      window.location.assign(result.payment.checkoutUrl);
    } catch (payosError) {
      setPayosUnavailable(true);
      setActionError(
        `${getApiErrorMessage(payosError)} ${t("checkout.payos.fallback")}`,
      );
    } finally {
      setIsCreatingPayosLink(false);
    }
  }

  const canReportTransfer =
    mode === "manual" &&
    order?.status === "pending" &&
    !MANUAL_REPORTED_STATUSES.includes(order.paymentVerification ?? "") &&
    !isPayosLocked(order);
  const payosEnabled = Boolean(summary?.paymentOptions?.payosEnabled);
  const canOpenPayos =
    mode === "payos" && Boolean(order) && payosEnabled && order?.status === "pending";
  const headerKey =
    mode === "payos"
      ? "checkout.header.payos"
      : mode === "manual"
        ? "checkout.header.manual"
        : "checkout.header.select";

  return (
    <DashboardShell planLabel={summary?.plan.name}>
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-[1240px] space-y-6">
          <div className="flex flex-col gap-4 rounded-lg border border-[#262626] bg-[#121212] p-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
              to={mode === "select" || !order ? "/credits" : `/credits/checkout/${order.id}`}
            >
              <ArrowLeft className="h-4 w-4" />
              {mode === "select" || !order
                ? t("checkout.backToCredits")
                : t("checkout.backToMethods")}
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#00e5ff]/25 bg-[#00e5ff]/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#c3f5ff]">
                <LockKeyhole className="h-4 w-4" />
                {t(`${headerKey}.badge`)}
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
              {t(`${headerKey}.eyebrow`)}
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
              {t(`${headerKey}.title`)}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bac9cc] sm:text-base">
              {t(`${headerKey}.body`)}
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
              <div className="h-[420px] animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
              <div className="h-[420px] animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
            </div>
          ) : !order ? (
            <section className="rounded-lg border border-dashed border-[#3b494c] bg-[#121212] p-6 text-center">
              <ShoppingCartFallback />
            </section>
          ) : (
            <>
              <CheckoutOrderSummary order={order} payment={payment} />

              {mode === "select" ? (
                <MethodSelection order={order} payosEnabled={payosEnabled} />
              ) : mode === "manual" ? (
                <ManualPaymentPage
                  canReportTransfer={Boolean(canReportTransfer)}
                  copiedField={copiedField}
                  isReportingTransfer={isReportingTransfer}
                  order={order}
                  payment={payment}
                  qrFailed={qrFailed}
                  onConfirmTransfer={() => void handleConfirmTransfer()}
                  onCopy={(value, field) => void copyPaymentText(value, field)}
                  onQrFailed={() => setQrFailed(true)}
                  onRefresh={() => void loadCheckout()}
                />
              ) : (
                <>
                  {!payosEnabled ? (
                    <section className="rounded-lg border border-[#f3bf26]/30 bg-[#f3bf26]/10 p-4">
                      <div className="flex gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#f3bf26]" />
                        <p className="text-sm font-semibold leading-6 text-[#ffeac0]">
                          {t("checkout.payos.disabledHelp")}
                        </p>
                      </div>
                    </section>
                  ) : null}

                  <PayosStatusPanel
                    canOpenPayos={canOpenPayos}
                    isCreatingPayosLink={isCreatingPayosLink}
                    order={order}
                    payosUnavailable={payosUnavailable || !payosEnabled}
                    onPayosCheckout={() => void handlePayosCheckout()}
                    onRefresh={() => void loadCheckout()}
                  />

                  <OrderStatusCard order={order} />
                </>
              )}
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
