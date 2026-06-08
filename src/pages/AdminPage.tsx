import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  Database,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { adminApi } from "../features/admin/admin.api";
import {
  ADMIN_RANGES,
  type AdminHealth,
  type AdminMarkPaidResult,
  type AdminOrder,
  type AdminOrderStatus,
  type AdminPagination,
  type AdminPaymentStatus,
  type AdminPaymentTransaction,
  type AdminProduct,
  type AdminProductsResult,
  type AdminRange,
  type AdminStats,
  type AdminUser,
} from "../features/admin/admin.types";
import { useAuthStore } from "../features/auth/auth.store";
import { getApiErrorMessage } from "../services/apiClient";
import { getDisplayLabel, getKnownDisplayLabel } from "../i18n/displayMaps";
import {
  formatI18nCurrency,
  formatI18nDate,
  formatI18nDateTime,
  formatI18nNumber,
} from "../i18n/formatters";
import { useI18n } from "../i18n/useI18n";
import type { Language } from "../i18n/types";

type OrderStatusFilter = AdminOrderStatus | "all";
type PaymentStatusFilter = AdminPaymentStatus | "all";

const orderStatusOptions: OrderStatusFilter[] = [
  "all",
  "pending",
  "paid",
  "failed",
  "cancelled",
  "expired",
];

const transactionStatusOptions: PaymentStatusFilter[] = [
  "all",
  "initiated",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
];

const rangeOptions: Array<{ label: string; value: AdminRange }> = [
  { label: "admin.range.7d", value: ADMIN_RANGES.SEVEN_DAYS },
  { label: "admin.range.30d", value: ADMIN_RANGES.THIRTY_DAYS },
  { label: "admin.range.all", value: ADMIN_RANGES.ALL },
];

const emptyUsersPage: AdminPagination<AdminUser> = {
  page: 1,
  limit: 6,
  total: 0,
  totalPages: 0,
  items: [],
};

const emptyOrdersPage: AdminPagination<AdminOrder> = {
  page: 1,
  limit: 8,
  total: 0,
  totalPages: 0,
  items: [],
};

const emptyTransactionsPage: AdminPagination<AdminPaymentTransaction> = {
  page: 1,
  limit: 8,
  total: 0,
  totalPages: 0,
  items: [],
};

const emptyProductsResult: AdminProductsResult = {
  products: [],
  summary: {
    total: 0,
    active: 0,
    inactive: 0,
    missingMvpProducts: [],
  },
};

type Translate = ReturnType<typeof useI18n>["t"];

function formatNumber(value: number | null | undefined, language: Language) {
  return formatI18nNumber(value, language);
}

function formatCurrency(
  value: number | null | undefined,
  language: Language,
  currency = "VND",
) {
  return formatI18nCurrency(value, language, currency);
}

function formatDateTime(
  value: string | null | undefined,
  language: Language,
  t: Translate,
) {
  return formatI18nDateTime(value, language, t("common.notReturned"));
}

function formatDate(
  value: string | null | undefined,
  language: Language,
  t: Translate,
) {
  return formatI18nDate(value, language, t("common.notReturned"));
}

function shortId(value: string | null | undefined, t: Translate) {
  return value ? value.slice(0, 8) : t("common.unknown");
}

function getUserLabel(user: {
  displayName: string | null;
  email: string | null;
}, t: Translate) {
  return user.displayName || user.email || t("admin.table.unnamedUser");
}

function getInitials(
  user: { displayName: string | null; email: string | null },
  t: Translate,
) {
  const label = getUserLabel(user, t);
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getOrderProduct(order: AdminOrder) {
  return order.items[0] ?? null;
}

function getOrderTransferContent(order: AdminOrder, t: Translate) {
  return (
    order.transferContent ??
    order.bankTransferContent ??
    order.orderCode ??
    t("common.notReturned")
  );
}

function getOrderPaymentMethod(order: AdminOrder) {
  return order.provider ?? order.paymentMethod ?? "vietqr_bank_transfer";
}

function getStatusTone(status: string) {
  if (
    status === "paid" ||
    status === "succeeded" ||
    status === "active" ||
    status === "ok"
  ) {
    return "border-[#00e5ff]/30 bg-[#00e5ff]/10 text-[#9cf0ff]";
  }

  if (status === "pending") {
    return "border-[#f3bf26]/35 bg-[#f3bf26]/10 text-[#ffeac0]";
  }

  if (status === "redirected" || status === "initiated") {
    return "border-[#00e5ff]/18 bg-[#00e5ff]/5 text-[#c3f5ff]";
  }

  if (status === "expired") {
    return "border-[#f3bf26]/35 bg-[#f3bf26]/10 text-[#ffeac0]";
  }

  if (status === "failed" || status === "blocked") {
    return "border-[#ffb4ab]/30 bg-[#93000a]/25 text-[#ffdad6]";
  }

  return "border-white/10 bg-white/[0.05] text-[#bac9cc]";
}

function getManualMarkPaidEnabled(health: AdminHealth | null) {
  return Boolean(health?.billing?.manualMarkPaidEnabled);
}

function getProductIssue(product: AdminProduct) {
  if (!product.isActive) {
    return "inactive";
  }

  if (product.priceVnd <= 0) {
    return "invalid_price";
  }

  if (product.credits === null || product.credits <= 0) {
    return "missing_credits";
  }

  if (product.kind === "subscription_plan" && !product.planCode) {
    return "missing_plan";
  }

  return null;
}

function AdminPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-[#3b494c] bg-[#1c1b1b] ${className}`}
    >
      {children}
    </section>
  );
}

function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[#3b494c]/70 p-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-[#bac9cc]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { language } = useI18n();

  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold uppercase ${getStatusTone(
        status,
      )}`}
    >
      {getKnownDisplayLabel(status, language)}
    </span>
  );
}

function MiniRatioBar({
  value,
  total,
  tone = "cyan",
}: {
  value: number;
  total: number;
  tone?: "amber" | "cyan" | "red";
}) {
  const width = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const fill =
    tone === "amber" ? "bg-[#f3bf26]" : tone === "red" ? "bg-[#ffb4ab]" : "bg-[#00e5ff]";

  return (
    <div className="h-1.5 overflow-hidden rounded-sm bg-[#353534]">
      <div className={`h-full rounded-sm ${fill}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  detail,
  ratioValue,
  ratioTotal,
  tone = "cyan",
  isLoading,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  ratioValue?: number;
  ratioTotal?: number;
  tone?: "amber" | "cyan" | "red";
  isLoading: boolean;
}) {
  const toneClass =
    tone === "amber"
      ? "text-[#ffeac0] bg-[#f3bf26]/10"
      : tone === "red"
        ? "text-[#ffdad6] bg-[#93000a]/25"
        : "text-[#00e5ff] bg-[#00e5ff]/10";

  return (
    <article className="min-h-[148px] rounded-lg border border-[#3b494c] bg-[#201f1f] p-4">
      {isLoading ? (
        <div className="space-y-5">
          <div className="h-4 w-28 animate-pulse rounded-sm bg-white/10" />
          <div className="h-8 w-20 animate-pulse rounded-sm bg-white/10" />
          <div className="h-3 w-full animate-pulse rounded-sm bg-white/10" />
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-bold uppercase text-[#bac9cc]">{label}</p>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${toneClass}`}
            >
              {icon}
            </span>
          </div>
          <p className="mt-4 font-display text-3xl font-semibold leading-none text-white">
            {value}
          </p>
          <p className="mt-3 text-xs font-semibold text-[#bac9cc]">{detail}</p>
          {ratioValue !== undefined && ratioTotal !== undefined ? (
            <div className="mt-4">
              <MiniRatioBar total={ratioTotal} value={ratioValue} tone={tone} />
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}

function AdminEmptyState({ message }: { message: string }) {
  const { t } = useI18n();

  return (
    <div className="p-8 text-center">
      <p className="text-sm font-bold text-white">{message}</p>
      <p className="mt-2 text-sm text-[#849396]">
        {t("admin.empty.refreshHint")}
      </p>
    </div>
  );
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 4 }).map((_, rowIndex) => (
        <div className="grid gap-3" key={rowIndex} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <div
              className="h-8 animate-pulse rounded-sm bg-white/[0.07]"
              key={columnIndex}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function SectionSelect<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: TValue;
  options: TValue[];
  onChange: (value: TValue) => void;
}) {
  const { language, t } = useI18n();

  return (
    <label className="flex min-w-[148px] flex-col gap-1.5 text-xs font-bold uppercase text-[#849396]">
      {label}
      <select
        className="min-h-11 rounded-md border border-[#3b494c] bg-[#0e0e0e] px-3 py-2 text-sm font-semibold normal-case text-[#e5e2e1] outline-none transition focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff]"
        value={value}
        onChange={(event) => onChange(event.target.value as TValue)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === "all" ? t("admin.filter.all") : getKnownDisplayLabel(option, language)}
          </option>
        ))}
      </select>
    </label>
  );
}

function UsersTable({
  users,
  isLoading,
}: {
  users: AdminUser[];
  isLoading: boolean;
}) {
  const { language, t } = useI18n();

  if (isLoading) {
    return <TableSkeleton columns={5} />;
  }

  if (users.length === 0) {
    return <AdminEmptyState message={t("admin.empty.users")} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[820px] w-full text-left">
        <thead className="border-b border-[#3b494c]/70 bg-[#201f1f] text-xs uppercase text-[#849396]">
          <tr>
            <th className="px-5 py-3 font-bold">{t("admin.table.user")}</th>
            <th className="px-5 py-3 font-bold">{t("admin.table.role")}</th>
            <th className="px-5 py-3 font-bold">
              {t("admin.table.onboarding")}
            </th>
            <th className="px-5 py-3 font-bold">{t("admin.table.plan")}</th>
            <th className="px-5 py-3 font-bold">{t("admin.table.joined")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#3b494c]/60">
          {users.map((adminUser) => (
            <tr className="transition hover:bg-white/[0.035]" key={adminUser.id}>
              <td className="px-5 py-4">
                <div className="flex min-w-[240px] items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#3b494c] bg-[#00e5ff]/10 text-xs font-bold text-[#9cf0ff]">
                    {adminUser.avatarUrl ? (
                      <img
                        alt=""
                        className="h-full w-full object-cover"
                        src={adminUser.avatarUrl}
                      />
                    ) : (
                      getInitials(adminUser, t)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {adminUser.displayName || t("admin.table.unnamedUser")}
                    </p>
                    <p className="truncate text-xs text-[#bac9cc]">
                      {adminUser.email || t("admin.table.noEmail")}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4">
                <StatusBadge status={adminUser.role} />
              </td>
              <td className="px-5 py-4 text-sm font-semibold text-[#e5e2e1]">
                {adminUser.onboardingCompleted
                  ? getKnownDisplayLabel("complete", language)
                  : getKnownDisplayLabel("incomplete", language)}
              </td>
              <td className="px-5 py-4">
                <p className="text-sm font-bold text-white">
                  {adminUser.billing.planCode}
                </p>
                <p className="mt-1 text-xs text-[#bac9cc]">
                  {t("admin.table.credits", {
                    count: formatNumber(
                      adminUser.billing.creditBalance,
                      language,
                    ),
                  })}
                </p>
              </td>
              <td className="px-5 py-4 text-sm text-[#bac9cc]">
                {formatDate(adminUser.createdAt, language, t)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({
  orders,
  health,
  isLoading,
  markingOrderId,
  onRequestMarkPaid,
}: {
  orders: AdminOrder[];
  health: AdminHealth | null;
  isLoading: boolean;
  markingOrderId: string | null;
  onRequestMarkPaid: (order: AdminOrder) => void;
}) {
  const { language, t } = useI18n();
  const manualMarkPaidEnabled = getManualMarkPaidEnabled(health);

  if (isLoading) {
    return <TableSkeleton columns={7} />;
  }

  if (orders.length === 0) {
    return <AdminEmptyState message={t("admin.empty.orders")} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1060px] w-full text-left">
        <thead className="border-b border-[#3b494c]/70 bg-[#201f1f] text-xs uppercase text-[#849396]">
          <tr>
            <th className="px-5 py-3 font-bold">{t("admin.table.order")}</th>
            <th className="px-5 py-3 font-bold">{t("admin.table.user")}</th>
            <th className="px-5 py-3 font-bold">
              {t("admin.table.product")}
            </th>
            <th className="px-5 py-3 font-bold">{t("admin.table.amount")}</th>
            <th className="px-5 py-3 font-bold">
              {t("admin.table.transfer")}
            </th>
            <th className="px-5 py-3 font-bold">{t("admin.table.method")}</th>
            <th className="px-5 py-3 font-bold">{t("admin.table.status")}</th>
            <th className="px-5 py-3 font-bold">{t("admin.table.action")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#3b494c]/60">
          {orders.map((order) => {
            const product = getOrderProduct(order);
            const paymentMethod = getOrderPaymentMethod(order);
            const canMarkPaid =
              manualMarkPaidEnabled &&
              order.status === "pending" &&
              order.actions.canManualMarkPaid;

            return (
              <tr className="transition hover:bg-white/[0.035]" key={order.id}>
                <td className="px-5 py-4">
                  <p className="font-mono text-xs font-bold text-[#e5e2e1]">
                    {shortId(order.id, t)}
                  </p>
                  <p className="mt-1 text-xs text-[#849396]">
                    {formatDateTime(order.createdAt, language, t)}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <p className="max-w-[180px] truncate text-sm font-bold text-white">
                    {getUserLabel(order.user, t)}
                  </p>
                  <p className="mt-1 max-w-[180px] truncate text-xs text-[#bac9cc]">
                    {order.user.email || t("admin.table.noEmail")}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <p className="text-sm font-bold text-white">
                    {product?.productName ?? t("admin.table.unknownProduct")}
                  </p>
                  <p className="mt-1 text-xs text-[#bac9cc]">
                    {product?.productCode ?? t("admin.table.noCode")}
                  </p>
                </td>
                <td className="px-5 py-4 text-sm font-semibold text-[#e5e2e1]">
                  {formatCurrency(
                    order.totalAmount,
                    language,
                    order.currency,
                  )}
                </td>
                <td className="px-5 py-4">
                  <p className="max-w-[180px] truncate font-mono text-xs font-bold text-[#ffeac0]">
                    {getOrderTransferContent(order, t)}
                  </p>
                  <p className="mt-1 text-xs text-[#849396]">
                    {getDisplayLabel(
                      "verificationStatus",
                      order.paymentVerification ?? "awaiting_transfer",
                      language,
                    )}
                  </p>
                </td>
                <td className="px-5 py-4 text-xs font-bold text-[#bac9cc]">
                  {getDisplayLabel(
                    "paymentProvider",
                    paymentMethod,
                    language,
                  )}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-5 py-4">
                  {canMarkPaid ? (
                    <button
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#f3bf26] px-3 py-2 text-xs font-bold text-[#251a00] transition hover:bg-[#ffdf96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffdf96] disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={markingOrderId === order.id}
                      type="button"
                      onClick={() => onRequestMarkPaid(order)}
                    >
                      {markingOrderId === order.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {t("admin.table.verifyTransfer")}
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-[#849396]">
                      {paymentMethod === "payos"
                        ? t("admin.table.payosNoVerification")
                        : t("admin.table.noAction")}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TransactionsTable({
  transactions,
  isLoading,
}: {
  transactions: AdminPaymentTransaction[];
  isLoading: boolean;
}) {
  const { language, t } = useI18n();

  if (isLoading) {
    return <TableSkeleton columns={7} />;
  }

  if (transactions.length === 0) {
    return <AdminEmptyState message={t("admin.empty.transactions")} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full text-left">
        <thead className="border-b border-[#3b494c]/70 bg-[#201f1f] text-xs uppercase text-[#849396]">
          <tr>
            <th className="px-5 py-3 font-bold">
              {t("admin.table.transaction")}
            </th>
            <th className="px-5 py-3 font-bold">{t("admin.table.order")}</th>
            <th className="px-5 py-3 font-bold">{t("admin.table.user")}</th>
            <th className="px-5 py-3 font-bold">
              {t("admin.table.provider")}
            </th>
            <th className="px-5 py-3 font-bold">{t("admin.table.status")}</th>
            <th className="px-5 py-3 font-bold">
              {t("admin.table.signature")}
            </th>
            <th className="px-5 py-3 font-bold">{t("admin.table.amount")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#3b494c]/60">
          {transactions.map((transaction) => (
            <tr className="transition hover:bg-white/[0.035]" key={transaction.id}>
              <td className="px-5 py-4">
                <p className="font-mono text-xs font-bold text-white">
                  {transaction.txnRef || shortId(transaction.id, t)}
                </p>
                <p className="mt-1 text-xs text-[#849396]">
                  {formatDateTime(
                    transaction.processedAt ?? transaction.createdAt,
                    language,
                    t,
                  )}
                </p>
              </td>
              <td className="px-5 py-4 font-mono text-xs font-bold text-[#bac9cc]">
                {shortId(transaction.orderId, t)}
              </td>
              <td className="px-5 py-4">
                <p className="max-w-[170px] truncate text-sm font-bold text-white">
                  {getUserLabel(transaction.user, t)}
                </p>
                <p className="mt-1 max-w-[170px] truncate text-xs text-[#bac9cc]">
                  {transaction.user.email || t("admin.table.noEmail")}
                </p>
              </td>
              <td className="px-5 py-4 text-xs font-bold text-[#bac9cc]">
                {getDisplayLabel(
                  "paymentProvider",
                  transaction.provider,
                  language,
                )}
              </td>
              <td className="px-5 py-4">
                <StatusBadge status={transaction.status} />
              </td>
              <td className="px-5 py-4 text-sm font-semibold text-[#e5e2e1]">
                {transaction.signatureVerified
                  ? getDisplayLabel("booleanStatus", "verified", language)
                  : getDisplayLabel("booleanStatus", "not_verified", language)}
              </td>
              <td className="px-5 py-4 text-sm font-semibold text-[#e5e2e1]">
                {formatCurrency(
                  transaction.amount,
                  language,
                  transaction.currency,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HealthPanel({
  health,
  isLoading,
}: {
  health: AdminHealth | null;
  isLoading: boolean;
}) {
  const { language, t } = useI18n();
  const rows = [
    {
      label: t("admin.health.api"),
      value: health?.api?.status ?? health?.status ?? "unknown",
    },
    {
      label: t("admin.health.database"),
      value: health?.database?.status ?? "not_returned",
      detail: health?.database?.latencyMs
        ? `${health.database.latencyMs}ms`
        : undefined,
    },
    {
      label: t("admin.health.vietqr"),
      value: health?.billing?.vietQrConfigured ? "configured" : "pending",
    },
    {
      label: t("admin.health.payos"),
      value: health?.billing?.payosEnabled
        ? health.billing.payosConfigured
          ? "enabled"
          : "pending"
        : "disabled",
    },
    {
      label: t("admin.health.manualMarkPaid"),
      value: health?.billing?.manualMarkPaidEnabled ? "enabled" : "disabled",
    },
  ];

  return (
    <AdminPanel className="lg:col-span-5">
      <PanelHeader
        title={t("admin.health.title")}
        description={t("admin.health.description")}
      />
      {isLoading ? (
        <div className="space-y-3 p-5">
          {rows.map((row) => (
            <div className="h-12 animate-pulse rounded-sm bg-white/[0.07]" key={row.label} />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-[#3b494c]/60">
          {rows.map((row) => (
            <div
              className="flex items-center justify-between gap-4 px-5 py-4"
              key={row.label}
            >
              <span className="text-sm font-semibold text-[#bac9cc]">
                {row.label}
              </span>
              <div className="flex items-center gap-2">
                {row.detail ? (
                  <span className="text-xs font-semibold text-[#849396]">
                    {row.detail}
                  </span>
                ) : null}
                <StatusBadge status={row.value} />
              </div>
            </div>
          ))}
          <div className="px-5 py-4 text-xs font-semibold text-[#849396]">
            {t("admin.health.lastChecked", {
              date: formatDateTime(health?.timestamp, language, t),
            })}
          </div>
        </div>
      )}
    </AdminPanel>
  );
}

function SubscriptionCreditPanel({
  stats,
  isLoading,
}: {
  stats: AdminStats | null;
  isLoading: boolean;
}) {
  const { language, t } = useI18n();
  const planTotal = stats?.subscriptions.active ?? 0;

  return (
    <AdminPanel className="lg:col-span-7">
      <PanelHeader
        title={t("admin.subscriptions.title")}
        description={t("admin.subscriptions.description")}
      />
      {isLoading ? (
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div className="h-48 animate-pulse rounded-sm bg-white/[0.07]" />
          <div className="h-48 animate-pulse rounded-sm bg-white/[0.07]" />
        </div>
      ) : (
        <div className="grid gap-6 p-5 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase text-[#849396]">
              {t("admin.subscriptions.active")}
            </p>
            <p className="mt-3 font-display text-4xl font-semibold text-white">
              {formatNumber(planTotal, language)}
            </p>
            <div className="mt-6 space-y-4">
              {(stats?.subscriptions.byPlan ?? []).length === 0 ? (
                <p className="text-sm text-[#bac9cc]">
                  {t("admin.subscriptions.empty")}
                </p>
              ) : (
                stats?.subscriptions.byPlan.map((plan) => (
                  <div key={plan.planCode}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold text-[#e5e2e1]">
                        {plan.planCode}
                      </span>
                      <span className="text-[#00e5ff]">
                        {formatNumber(plan.count, language)}
                      </span>
                    </div>
                    <MiniRatioBar total={planTotal} value={plan.count} />
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="border-t border-[#3b494c]/70 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            <p className="text-xs font-bold uppercase text-[#849396]">
              {t("admin.credits.ledger")}
            </p>
            <p className="mt-3 font-display text-4xl font-semibold text-white">
              {formatNumber(stats?.credits.totalBalance, language)}
            </p>
            <div className="mt-6 grid gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#bac9cc]">
                  {t("admin.credits.purchased")}
                </span>
                <span className="font-bold text-white">
                  {formatNumber(stats?.credits.purchasedInRange, language)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#bac9cc]">
                  {t("admin.credits.consumed")}
                </span>
                <span className="font-bold text-white">
                  {formatNumber(stats?.credits.consumedInRange, language)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminPanel>
  );
}

function CatalogPanel({
  productsResult,
  isLoading,
}: {
  productsResult: AdminProductsResult;
  isLoading: boolean;
}) {
  const { language, t } = useI18n();

  return (
    <AdminPanel>
      <PanelHeader
        title={t("admin.catalog.title")}
        description={t("admin.catalog.description")}
        action={
          <span className="text-sm font-bold text-[#bac9cc]">
            {t("admin.catalog.activeCount", {
              active: productsResult.summary.active,
              total: productsResult.summary.total,
            })}
          </span>
        }
      />
      {isLoading ? (
        <TableSkeleton columns={5} />
      ) : productsResult.products.length === 0 ? (
        <AdminEmptyState message={t("admin.empty.products")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left">
            <thead className="border-b border-[#3b494c]/70 bg-[#201f1f] text-xs uppercase text-[#849396]">
              <tr>
                <th className="px-5 py-3 font-bold">
                  {t("admin.table.product")}
                </th>
                <th className="px-5 py-3 font-bold">
                  {t("admin.catalog.kind")}
                </th>
                <th className="px-5 py-3 font-bold">
                  {t("admin.catalog.price")}
                </th>
                <th className="px-5 py-3 font-bold">
                  {t("admin.catalog.credits")}
                </th>
                <th className="px-5 py-3 font-bold">
                  {t("admin.table.status")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3b494c]/60">
              {productsResult.products.map((product) => {
                const issue = getProductIssue(product);

                return (
                  <tr className="transition hover:bg-white/[0.035]" key={product.id}>
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-white">{product.name}</p>
                      <p className="mt-1 font-mono text-xs text-[#bac9cc]">
                        {product.code}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-[#e5e2e1]">
                        {getDisplayLabel("productKind", product.kind, language)}
                      </p>
                      <p className="mt-1 text-xs text-[#849396]">
                        {product.interval ?? "one-time"}
                        {product.planCode ? ` · ${product.planCode}` : ""}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-[#e5e2e1]">
                      {formatCurrency(
                        product.priceVnd,
                        language,
                        product.currency,
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#bac9cc]">
                      {product.credits ?? 0}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={issue ?? "active"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!isLoading && productsResult.summary.missingMvpProducts.length > 0 ? (
        <div className="border-t border-[#f3bf26]/25 bg-[#f3bf26]/10 px-5 py-4 text-sm text-[#ffeac0]">
          {t("admin.catalog.missing", {
            products: productsResult.summary.missingMvpProducts.join(", "),
          })}
        </div>
      ) : null}
    </AdminPanel>
  );
}

function ManualMarkPaidDialog({
  order,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  order: AdminOrder | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { language, t } = useI18n();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const isSubmittingRef = useRef(isSubmitting);
  const onCloseRef = useRef(onClose);
  const orderId = order?.id;

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!orderId) {
      return undefined;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const focusTimeoutId = window.setTimeout(
      () => cancelButtonRef.current?.focus(),
      0,
    );

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmittingRef.current) {
        onCloseRef.current();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimeoutId);
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [orderId]);

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    if (!focusableElements?.length) {
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  if (!order) {
    return null;
  }

  const product = getOrderProduct(order);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-8 backdrop-blur-sm"
      role="presentation"
    >
      <div
        aria-describedby="manual-mark-paid-description"
        aria-labelledby="manual-mark-paid-title"
        aria-modal="true"
        className="max-h-[calc(100vh-4rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-[#f3bf26]/35 bg-[#1c1b1b] shadow-[0_0_56px_rgba(243,191,38,0.14)]"
        onKeyDown={trapFocus}
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#3b494c]/70 p-5">
          <div>
            <p className="text-xs font-bold uppercase text-[#f3bf26]">
              {t("admin.dialog.eyebrow")}
            </p>
            <h2
              className="mt-2 font-display text-2xl font-semibold text-white"
              id="manual-mark-paid-title"
            >
              {t("admin.dialog.title")}
            </h2>
          </div>
          <button
            aria-label={t("admin.dialog.closeAria")}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-[#bac9cc] transition hover:border-[#00e5ff]/35 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <p
            className="text-sm leading-6 text-[#bac9cc]"
            id="manual-mark-paid-description"
          >
            {t("admin.dialog.description")}
          </p>
          <dl className="grid gap-3 text-sm">
            <div className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start sm:gap-4">
              <dt className="text-[#849396]">{t("admin.dialog.orderId")}</dt>
              <dd className="break-all font-mono font-bold text-white sm:text-right">
                {shortId(order.id, t)}
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start sm:gap-4">
              <dt className="text-[#849396]">{t("admin.dialog.customer")}</dt>
              <dd className="break-words font-bold text-white sm:text-right">
                {getUserLabel(order.user, t)}
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start sm:gap-4">
              <dt className="text-[#849396]">{t("admin.table.product")}</dt>
              <dd className="break-words font-bold text-white sm:text-right">
                {product?.productName ?? t("admin.table.unknownProduct")}
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start sm:gap-4">
              <dt className="text-[#849396]">{t("admin.table.amount")}</dt>
              <dd className="font-bold text-white sm:text-right">
                {formatCurrency(order.totalAmount, language, order.currency)}
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start sm:gap-4">
              <dt className="text-[#849396]">
                {t("admin.dialog.transferContent")}
              </dt>
              <dd className="break-all font-mono font-bold text-[#ffeac0] sm:text-right">
                {getOrderTransferContent(order, t)}
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start sm:gap-4">
              <dt className="text-[#849396]">
                {t("admin.dialog.paymentMethod")}
              </dt>
              <dd className="font-mono text-xs font-bold text-white sm:text-right">
                {getDisplayLabel(
                  "paymentProvider",
                  getOrderPaymentMethod(order),
                  language,
                )}
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start sm:gap-4">
              <dt className="text-[#849396]">
                {t("admin.dialog.verificationState")}
              </dt>
              <dd className="font-bold text-white sm:text-right">
                {getDisplayLabel(
                  "verificationStatus",
                  order.paymentVerification ?? "awaiting_transfer",
                  language,
                )}
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start sm:gap-4">
              <dt className="text-[#849396]">
                {t("admin.dialog.orderStatus")}
              </dt>
              <dd className="font-bold text-white sm:text-right">
                {getDisplayLabel("orderStatus", order.status, language)}
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start sm:gap-4">
              <dt className="text-[#849396]">{t("admin.dialog.expires")}</dt>
              <dd className="font-bold text-white sm:text-right">
                {formatDateTime(order.expiresAt, language, t)}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-[#3b494c]/70 p-5 sm:flex-row sm:justify-end">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/10 px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/35 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
            ref={cancelButtonRef}
          >
            {t("common.cancel")}
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#f3bf26] px-4 py-2.5 text-sm font-bold text-[#251a00] transition hover:bg-[#ffdf96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffdf96] disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
            type="button"
            onClick={onConfirm}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("admin.dialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminPage() {
  const { language, t } = useI18n();
  const currentUser = useAuthStore((state) => state.user);
  const [range, setRange] = useState<AdminRange>(ADMIN_RANGES.THIRTY_DAYS);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState<OrderStatusFilter>("all");
  const [transactionStatus, setTransactionStatus] =
    useState<PaymentStatusFilter>("all");
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [usersPage, setUsersPage] =
    useState<AdminPagination<AdminUser>>(emptyUsersPage);
  const [ordersPage, setOrdersPage] =
    useState<AdminPagination<AdminOrder>>(emptyOrdersPage);
  const [transactionsPage, setTransactionsPage] =
    useState<AdminPagination<AdminPaymentTransaction>>(emptyTransactionsPage);
  const [productsResult, setProductsResult] =
    useState<AdminProductsResult>(emptyProductsResult);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [confirmOrder, setConfirmOrder] = useState<AdminOrder | null>(null);
  const [markingOrderId, setMarkingOrderId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const displayName =
    currentUser?.displayName ||
    currentUser?.fullName ||
    currentUser?.email ||
    t("display.role.admin");

  const loadAdminData = useCallback(
    async (showLoading = true) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setError(null);

      try {
        const [
          healthResult,
          statsResult,
          usersResult,
          ordersResult,
          transactionsResult,
          productsResponse,
        ] = await Promise.all([
          adminApi.getAdminHealth(),
          adminApi.getAdminStats(range),
          adminApi.getAdminUsers({
            page: 1,
            limit: 6,
            search: activeSearch || undefined,
          }),
          adminApi.getAdminOrders({
            page: 1,
            limit: 8,
            search: activeSearch || undefined,
            status: orderStatus === "all" ? undefined : orderStatus,
          }),
          adminApi.getAdminPaymentTransactions({
            page: 1,
            limit: 8,
            status:
              transactionStatus === "all" ? undefined : transactionStatus,
          }),
          adminApi.getAdminProducts(true),
        ]);

        if (requestIdRef.current !== requestId) {
          return;
        }

        setHealth(healthResult);
        setStats(statsResult);
        setUsersPage(usersResult);
        setOrdersPage(ordersResult);
        setTransactionsPage(transactionsResult);
        setProductsResult(productsResponse);
      } catch (loadError) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setError(getApiErrorMessage(loadError));
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [activeSearch, orderStatus, range, transactionStatus],
  );

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  const kpis = useMemo(
    () => [
      {
        label: t("admin.kpi.totalUsers"),
        value: formatNumber(stats?.users.total, language),
        detail: t("admin.kpi.newInRange", {
          count: formatNumber(stats?.users.newInRange, language),
        }),
        icon: <UsersRound className="h-4 w-4" />,
        ratioValue: stats?.users.active,
        ratioTotal: stats?.users.total,
      },
      {
        label: t("admin.kpi.activeUsers"),
        value: formatNumber(stats?.users.active, language),
        detail: t("admin.kpi.blockedAccounts", {
          count: formatNumber(stats?.users.blocked, language),
        }),
        icon: <UserRound className="h-4 w-4" />,
        ratioValue: stats?.users.active,
        ratioTotal: stats?.users.total,
      },
      {
        label: t("admin.kpi.pendingOrders"),
        value: formatNumber(stats?.orders.pending, language),
        detail: t("admin.kpi.totalOrders", {
          count: formatNumber(stats?.orders.total, language),
        }),
        icon: <Clock3 className="h-4 w-4" />,
        ratioValue: stats?.orders.pending,
        ratioTotal: stats?.orders.total,
        tone: "amber" as const,
      },
      {
        label: t("admin.kpi.paidOrders"),
        value: formatNumber(stats?.orders.paid, language),
        detail: t("admin.kpi.failedPayments", {
          count: formatNumber(stats?.orders.failed, language),
        }),
        icon: <CheckCircle2 className="h-4 w-4" />,
        ratioValue: stats?.orders.paid,
        ratioTotal: stats?.orders.total,
      },
      {
        label: t("admin.kpi.manualVolume"),
        value: formatCurrency(stats?.orders.sandboxVolumeVnd, language),
        detail: t("admin.kpi.manualVolumeDetail"),
        icon: <WalletCards className="h-4 w-4" />,
      },
      {
        label: t("admin.kpi.activeSubs"),
        value: formatNumber(stats?.subscriptions.active, language),
        detail: t("admin.kpi.adminUsers", {
          count: formatNumber(stats?.users.admins, language),
        }),
        icon: <CreditCard className="h-4 w-4" />,
      },
      {
        label: t("admin.kpi.creditBalance"),
        value: formatNumber(stats?.credits.totalBalance, language),
        detail: t("admin.kpi.purchasedInRange", {
          count: formatNumber(stats?.credits.purchasedInRange, language),
        }),
        icon: <Database className="h-4 w-4" />,
      },
      {
        label: t("admin.kpi.catalogStatus"),
        value: `${formatNumber(stats?.products.active, language)}/${formatNumber(
          stats?.products.total,
          language,
        )}`,
        detail:
          (stats?.products.missingMvpProducts.length ?? 0) > 0
            ? t("admin.kpi.missingProducts", {
                count: stats?.products.missingMvpProducts.length ?? 0,
              })
            : t("admin.kpi.catalogCoverage"),
        icon: <PackageCheck className="h-4 w-4" />,
        ratioValue: stats?.products.active,
        ratioTotal: stats?.products.total,
        tone:
          (stats?.products.missingMvpProducts.length ?? 0) > 0
            ? ("amber" as const)
            : ("cyan" as const),
      },
    ],
    [language, stats, t],
  );

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveSearch(searchInput.trim());
  }

  async function handleMarkPaid(order: AdminOrder) {
    setActionError(null);
    setActionSuccess(null);
    setMarkingOrderId(order.id);

    try {
      const result: AdminMarkPaidResult = await adminApi.markOrderPaid(order.id);
      setConfirmOrder(null);
      setActionSuccess(
        t("admin.success.markPaid", {
          orderId: shortId(result.order.id, t),
          status: result.order.status,
        }),
      );
      await loadAdminData(false);
    } catch (markPaidError) {
      setActionError(getApiErrorMessage(markPaidError));
    } finally {
      setMarkingOrderId(null);
    }
  }

  return (
    <DashboardShell planLabel={t("shell.adminPlan")} variant="admin">
      <main className="min-h-screen overflow-x-hidden px-4 py-6 text-[#e5e2e1] sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-[1440px] space-y-6">
          <header className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,560px)] xl:items-end">
            <div>
              <p className="text-xs font-bold uppercase text-[#00e5ff]">
                {t("admin.header.eyebrow")}
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                {t("admin.header.title")}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#bac9cc] sm:text-base">
                {t("admin.header.body", { name: displayName })}
              </p>
            </div>

            <div className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                {rangeOptions.map((option) => (
                  <button
                    className={`min-h-11 flex-1 basis-[calc(50%-0.25rem)] rounded-md border px-4 py-2 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] sm:flex-none sm:basis-auto ${
                      range === option.value
                        ? "border-[#00e5ff]/40 bg-[#00e5ff] text-[#001f24]"
                        : "border-[#3b494c] bg-[#1c1b1b] text-[#bac9cc] hover:border-[#00e5ff]/35 hover:text-white"
                    }`}
                    key={option.value}
                    type="button"
                    onClick={() => setRange(option.value)}
                  >
                    {t(option.label)}
                  </button>
                ))}
                <button
                  className="inline-flex min-h-11 flex-1 basis-[calc(50%-0.25rem)] items-center justify-center gap-2 rounded-md border border-[#3b494c] bg-[#1c1b1b] px-4 py-2 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/35 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:basis-auto"
                  disabled={isLoading || isRefreshing}
                  type="button"
                  onClick={() => void loadAdminData(false)}
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {t("common.refresh")}
                </button>
              </div>

              <form
                className="flex flex-col gap-3 sm:flex-row"
                onSubmit={handleSearchSubmit}
              >
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">{t("admin.search.label")}</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#849396]" />
                  <input
                    className="min-h-11 w-full rounded-md border border-[#3b494c] bg-[#1c1b1b] py-2 pl-10 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-[#849396] focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff]"
                    placeholder={t("admin.search.placeholder")}
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                </label>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
                  type="submit"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {t("admin.search.apply")}
                </button>
              </form>
            </div>
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
                      {t("admin.error.title")}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-[#ffdad6]/80">
                      {error}
                    </p>
                  </div>
                </div>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#ffb4ab]/35 px-4 py-2.5 text-sm font-bold text-[#ffdad6] transition hover:bg-[#ffb4ab]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffb4ab]"
                  type="button"
                  onClick={() => void loadAdminData()}
                >
                  <RefreshCw className="h-4 w-4" />
                  {t("common.retry")}
                </button>
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

          {actionSuccess ? (
            <section className="rounded-lg border border-[#00e5ff]/25 bg-[#00e5ff]/10 p-4 text-sm text-[#c3f5ff]">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            </section>
          ) : null}

          <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <KpiCard
                detail={kpi.detail}
                icon={kpi.icon}
                isLoading={isLoading}
                key={kpi.label}
                label={kpi.label}
                ratioTotal={kpi.ratioTotal}
                ratioValue={kpi.ratioValue}
                tone={kpi.tone}
                value={kpi.value}
              />
            ))}
          </section>

          <section className="grid gap-5 lg:grid-cols-12">
            <HealthPanel health={health} isLoading={isLoading} />
            <SubscriptionCreditPanel stats={stats} isLoading={isLoading} />
          </section>

          <AdminPanel>
            <PanelHeader
              title={t("admin.orders.title")}
              description={t("admin.orders.description", {
                count: ordersPage.total,
              })}
              action={
                <div className="flex flex-wrap gap-3">
                  <SectionSelect
                    label={t("admin.orders.statusFilter")}
                    options={orderStatusOptions}
                    value={orderStatus}
                    onChange={setOrderStatus}
                  />
                </div>
              }
            />
            <OrdersTable
              health={health}
              isLoading={isLoading}
              markingOrderId={markingOrderId}
              orders={ordersPage.items}
              onRequestMarkPaid={(order) => {
                setActionError(null);
                setActionSuccess(null);
                setConfirmOrder(order);
              }}
            />
          </AdminPanel>

          <section className="grid gap-5 xl:grid-cols-12">
            <AdminPanel className="xl:col-span-7">
              <PanelHeader
                title={t("admin.transactions.title")}
                description={t("admin.transactions.description", {
                  count: transactionsPage.total,
                })}
                action={
                  <div className="flex flex-wrap gap-3">
                    <SectionSelect
                      label={t("admin.transactions.statusFilter")}
                      options={transactionStatusOptions}
                      value={transactionStatus}
                      onChange={setTransactionStatus}
                    />
                  </div>
                }
              />
              <TransactionsTable
                isLoading={isLoading}
                transactions={transactionsPage.items}
              />
            </AdminPanel>

            <AdminPanel className="xl:col-span-5">
              <PanelHeader
                title={t("admin.users.title")}
                description={t("admin.users.description", {
                  count: usersPage.total,
                })}
              />
              <UsersTable isLoading={isLoading} users={usersPage.items} />
            </AdminPanel>
          </section>

          <CatalogPanel
            isLoading={isLoading}
            productsResult={productsResult}
          />

          <section className="flex flex-col gap-3 border-t border-[#3b494c]/70 py-6 text-xs font-semibold text-[#849396] sm:flex-row sm:items-center sm:justify-between">
            <span>{t("admin.footer.console")}</span>
            <span>
              {t("admin.footer.manualMarkPaid", {
                state: getManualMarkPaidEnabled(health)
                  ? t("common.enabled")
                  : t("common.disabled"),
              })}
              {" · "}
              {t("admin.footer.pagination", {
                page: ordersPage.page,
                totalPages: ordersPage.totalPages,
              })}
            </span>
          </section>
        </div>
      </main>

      <ManualMarkPaidDialog
        isSubmitting={Boolean(markingOrderId)}
        order={confirmOrder}
        onClose={() => {
          if (!markingOrderId) {
            setConfirmOrder(null);
          }
        }}
        onConfirm={() => {
          if (confirmOrder) {
            void handleMarkPaid(confirmOrder);
          }
        }}
      />
    </DashboardShell>
  );
}
