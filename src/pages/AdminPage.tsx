import {
  FormEvent,
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
  { label: "7 days", value: ADMIN_RANGES.SEVEN_DAYS },
  { label: "30 days", value: ADMIN_RANGES.THIRTY_DAYS },
  { label: "All time", value: ADMIN_RANGES.ALL },
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

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en").format(value ?? 0);
}

function formatCurrency(value: number | null | undefined, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value ?? 0);
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

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not returned";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function shortId(value: string | null | undefined) {
  return value ? value.slice(0, 8) : "unknown";
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getUserLabel(user: {
  displayName: string | null;
  email: string | null;
}) {
  return user.displayName || user.email || "Unnamed user";
}

function getInitials(user: { displayName: string | null; email: string | null }) {
  const label = getUserLabel(user);
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

function getOrderTransferContent(order: AdminOrder) {
  return (
    order.transferContent ??
    order.bankTransferContent ??
    order.orderCode ??
    "Not returned"
  );
}

function getOrderPaymentMethod(order: AdminOrder) {
  return order.paymentMethod ?? order.provider ?? "vietqr_bank_transfer";
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

  if (status === "pending" || status === "redirected" || status === "initiated") {
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
    return "Inactive";
  }

  if (product.priceVnd <= 0) {
    return "Invalid price";
  }

  if (product.credits === null || product.credits <= 0) {
    return "Missing credits";
  }

  if (product.kind === "subscription_plan" && !product.planCode) {
    return "Missing plan";
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
  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold uppercase ${getStatusTone(
        status,
      )}`}
    >
      {titleCase(status)}
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
    <article className="min-h-[156px] rounded-lg border border-[#3b494c] bg-[#201f1f] p-5">
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
          <p className="mt-5 font-display text-3xl font-semibold leading-none text-white">
            {value}
          </p>
          <p className="mt-4 text-xs font-semibold text-[#bac9cc]">{detail}</p>
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
  return (
    <div className="p-8 text-center">
      <p className="text-sm font-bold text-white">{message}</p>
      <p className="mt-2 text-sm text-[#849396]">
        Refresh after new payment activity is available.
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
            {option === "all" ? "All" : titleCase(option)}
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
  if (isLoading) {
    return <TableSkeleton columns={5} />;
  }

  if (users.length === 0) {
    return <AdminEmptyState message="No users found" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[820px] w-full text-left">
        <thead className="border-b border-[#3b494c]/70 bg-[#201f1f] text-xs uppercase text-[#849396]">
          <tr>
            <th className="px-5 py-3 font-bold">User</th>
            <th className="px-5 py-3 font-bold">Role</th>
            <th className="px-5 py-3 font-bold">Onboarding</th>
            <th className="px-5 py-3 font-bold">Plan</th>
            <th className="px-5 py-3 font-bold">Joined</th>
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
                      getInitials(adminUser)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {adminUser.displayName || "Unnamed user"}
                    </p>
                    <p className="truncate text-xs text-[#bac9cc]">
                      {adminUser.email || "No email"}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4">
                <StatusBadge status={adminUser.role} />
              </td>
              <td className="px-5 py-4 text-sm font-semibold text-[#e5e2e1]">
                {adminUser.onboardingCompleted ? "Complete" : "Incomplete"}
              </td>
              <td className="px-5 py-4">
                <p className="text-sm font-bold text-white">
                  {titleCase(adminUser.billing.planCode)}
                </p>
                <p className="mt-1 text-xs text-[#bac9cc]">
                  {formatNumber(adminUser.billing.creditBalance)} credits
                </p>
              </td>
              <td className="px-5 py-4 text-sm text-[#bac9cc]">
                {formatDate(adminUser.createdAt)}
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
  const manualMarkPaidEnabled = getManualMarkPaidEnabled(health);

  if (isLoading) {
    return <TableSkeleton columns={7} />;
  }

  if (orders.length === 0) {
    return <AdminEmptyState message="No orders match this filter" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1060px] w-full text-left">
        <thead className="border-b border-[#3b494c]/70 bg-[#201f1f] text-xs uppercase text-[#849396]">
          <tr>
            <th className="px-5 py-3 font-bold">Order</th>
            <th className="px-5 py-3 font-bold">User</th>
            <th className="px-5 py-3 font-bold">Product</th>
            <th className="px-5 py-3 font-bold">Amount</th>
            <th className="px-5 py-3 font-bold">Transfer</th>
            <th className="px-5 py-3 font-bold">Method</th>
            <th className="px-5 py-3 font-bold">Status</th>
            <th className="px-5 py-3 font-bold">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#3b494c]/60">
          {orders.map((order) => {
            const product = getOrderProduct(order);
            const canMarkPaid =
              manualMarkPaidEnabled &&
              order.status === "pending" &&
              order.actions.canManualMarkPaid;

            return (
              <tr className="transition hover:bg-white/[0.035]" key={order.id}>
                <td className="px-5 py-4">
                  <p className="font-mono text-xs font-bold text-[#e5e2e1]">
                    {shortId(order.id)}
                  </p>
                  <p className="mt-1 text-xs text-[#849396]">
                    {formatDateTime(order.createdAt)}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <p className="max-w-[180px] truncate text-sm font-bold text-white">
                    {getUserLabel(order.user)}
                  </p>
                  <p className="mt-1 max-w-[180px] truncate text-xs text-[#bac9cc]">
                    {order.user.email || "No email"}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <p className="text-sm font-bold text-white">
                    {product?.productName ?? "Unknown product"}
                  </p>
                  <p className="mt-1 text-xs text-[#bac9cc]">
                    {product?.productCode ?? "No code"}
                  </p>
                </td>
                <td className="px-5 py-4 text-sm font-semibold text-[#e5e2e1]">
                  {formatCurrency(order.totalAmount, order.currency)}
                </td>
                <td className="px-5 py-4">
                  <p className="max-w-[180px] truncate font-mono text-xs font-bold text-[#ffeac0]">
                    {getOrderTransferContent(order)}
                  </p>
                  <p className="mt-1 text-xs text-[#849396]">
                    {order.paymentVerification ?? "awaiting_transfer"}
                  </p>
                </td>
                <td className="px-5 py-4 text-sm font-bold uppercase text-[#bac9cc]">
                  {getOrderPaymentMethod(order)}
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
                      Mark paid
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-[#849396]">
                      No action
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
  if (isLoading) {
    return <TableSkeleton columns={7} />;
  }

  if (transactions.length === 0) {
    return <AdminEmptyState message="No payment transactions yet" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full text-left">
        <thead className="border-b border-[#3b494c]/70 bg-[#201f1f] text-xs uppercase text-[#849396]">
          <tr>
            <th className="px-5 py-3 font-bold">Transaction</th>
            <th className="px-5 py-3 font-bold">Order</th>
            <th className="px-5 py-3 font-bold">User</th>
            <th className="px-5 py-3 font-bold">Provider</th>
            <th className="px-5 py-3 font-bold">Status</th>
            <th className="px-5 py-3 font-bold">Signature</th>
            <th className="px-5 py-3 font-bold">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#3b494c]/60">
          {transactions.map((transaction) => (
            <tr className="transition hover:bg-white/[0.035]" key={transaction.id}>
              <td className="px-5 py-4">
                <p className="font-mono text-xs font-bold text-white">
                  {transaction.txnRef || shortId(transaction.id)}
                </p>
                <p className="mt-1 text-xs text-[#849396]">
                  {formatDateTime(transaction.processedAt ?? transaction.createdAt)}
                </p>
              </td>
              <td className="px-5 py-4 font-mono text-xs font-bold text-[#bac9cc]">
                {shortId(transaction.orderId)}
              </td>
              <td className="px-5 py-4">
                <p className="max-w-[170px] truncate text-sm font-bold text-white">
                  {getUserLabel(transaction.user)}
                </p>
                <p className="mt-1 max-w-[170px] truncate text-xs text-[#bac9cc]">
                  {transaction.user.email || "No email"}
                </p>
              </td>
              <td className="px-5 py-4 text-sm font-bold uppercase text-[#bac9cc]">
                {transaction.provider}
              </td>
              <td className="px-5 py-4">
                <StatusBadge status={transaction.status} />
              </td>
              <td className="px-5 py-4 text-sm font-semibold text-[#e5e2e1]">
                {transaction.signatureVerified ? "Verified" : "Not verified"}
              </td>
              <td className="px-5 py-4 text-sm font-semibold text-[#e5e2e1]">
                {formatCurrency(transaction.amount, transaction.currency)}
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
  const rows = [
    {
      label: "API",
      value: health?.api?.status ?? health?.status ?? "unknown",
    },
    {
      label: "Database",
      value: health?.database?.status ?? "not returned",
      detail: health?.database?.latencyMs
        ? `${health.database.latencyMs}ms`
        : undefined,
    },
    {
      label: "VietQR",
      value: health?.billing?.vietQrConfigured ? "configured" : "pending",
    },
    {
      label: "Manual mark-paid",
      value: health?.billing?.manualMarkPaidEnabled ? "enabled" : "disabled",
    },
  ];

  return (
    <AdminPanel className="lg:col-span-5">
      <PanelHeader
        title="System Health"
        description="Configuration presence only. Secret values stay server-side."
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
            Last checked: {formatDateTime(health?.timestamp)}
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
  const planTotal = stats?.subscriptions.active ?? 0;

  return (
    <AdminPanel className="lg:col-span-7">
      <PanelHeader
        title="Subscriptions And Credits"
        description="Sandbox grants and credit ledger totals from backend billing state."
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
              Active subscriptions
            </p>
            <p className="mt-3 font-display text-4xl font-semibold text-white">
              {formatNumber(planTotal)}
            </p>
            <div className="mt-6 space-y-4">
              {(stats?.subscriptions.byPlan ?? []).length === 0 ? (
                <p className="text-sm text-[#bac9cc]">
                  No active subscription rows returned.
                </p>
              ) : (
                stats?.subscriptions.byPlan.map((plan) => (
                  <div key={plan.planCode}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold text-[#e5e2e1]">
                        {titleCase(plan.planCode)}
                      </span>
                      <span className="text-[#00e5ff]">
                        {formatNumber(plan.count)}
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
              Credit ledger
            </p>
            <p className="mt-3 font-display text-4xl font-semibold text-white">
              {formatNumber(stats?.credits.totalBalance)}
            </p>
            <div className="mt-6 grid gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#bac9cc]">Purchased in range</span>
                <span className="font-bold text-white">
                  {formatNumber(stats?.credits.purchasedInRange)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#bac9cc]">Consumed in range</span>
                <span className="font-bold text-white">
                  {formatNumber(stats?.credits.consumedInRange)}
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
  return (
    <AdminPanel>
      <PanelHeader
        title="Product Catalog"
        description="Read-only status for the six MVP billing products."
        action={
          <span className="text-sm font-bold text-[#bac9cc]">
            {productsResult.summary.active}/{productsResult.summary.total} active
          </span>
        }
      />
      {isLoading ? (
        <TableSkeleton columns={5} />
      ) : productsResult.products.length === 0 ? (
        <AdminEmptyState message="No products returned" />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left">
            <thead className="border-b border-[#3b494c]/70 bg-[#201f1f] text-xs uppercase text-[#849396]">
              <tr>
                <th className="px-5 py-3 font-bold">Product</th>
                <th className="px-5 py-3 font-bold">Kind</th>
                <th className="px-5 py-3 font-bold">Price</th>
                <th className="px-5 py-3 font-bold">Credits</th>
                <th className="px-5 py-3 font-bold">Status</th>
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
                        {titleCase(product.kind)}
                      </p>
                      <p className="mt-1 text-xs text-[#849396]">
                        {product.interval ?? "one-time"}
                        {product.planCode ? ` · ${product.planCode}` : ""}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-[#e5e2e1]">
                      {formatCurrency(product.priceVnd, product.currency)}
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
          Missing MVP products: {productsResult.summary.missingMvpProducts.join(", ")}
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
  useEffect(() => {
    if (!order) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose, order]);

  if (!order) {
    return null;
  }

  const product = getOrderProduct(order);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-8 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-lg border border-[#f3bf26]/35 bg-[#1c1b1b] shadow-[0_0_56px_rgba(243,191,38,0.14)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#3b494c]/70 p-5">
          <div>
            <p className="text-xs font-bold uppercase text-[#f3bf26]">
              Development action
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-white">
              Mark this VietQR order paid?
            </h2>
          </div>
          <button
            aria-label="Close mark paid dialog"
            className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-[#bac9cc] transition hover:border-[#00e5ff]/35 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <p className="text-sm leading-6 text-[#bac9cc]">
            Confirm the bank transfer amount and transfer content match before
            continuing. This uses the same backend grant path as a verified
            payment.
          </p>
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[#849396]">Order</dt>
              <dd className="font-mono font-bold text-white">{shortId(order.id)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#849396]">User</dt>
              <dd className="max-w-[260px] truncate font-bold text-white">
                {getUserLabel(order.user)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#849396]">Product</dt>
              <dd className="max-w-[260px] truncate font-bold text-white">
                {product?.productName ?? "Unknown product"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#849396]">Amount</dt>
              <dd className="font-bold text-white">
                {formatCurrency(order.totalAmount, order.currency)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#849396]">Transfer content</dt>
              <dd className="max-w-[260px] truncate font-mono font-bold text-white">
                {getOrderTransferContent(order)}
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
          >
            Cancel
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#f3bf26] px-4 py-2.5 text-sm font-bold text-[#251a00] transition hover:bg-[#ffdf96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffdf96] disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
            type="button"
            onClick={onConfirm}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirm mark-paid
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminPage() {
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
    currentUser?.displayName || currentUser?.fullName || currentUser?.email || "Admin";

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
        label: "Total Users",
        value: formatNumber(stats?.users.total),
        detail: `${formatNumber(stats?.users.newInRange)} new in range`,
        icon: <UsersRound className="h-4 w-4" />,
        ratioValue: stats?.users.active,
        ratioTotal: stats?.users.total,
      },
      {
        label: "Active Users",
        value: formatNumber(stats?.users.active),
        detail: `${formatNumber(stats?.users.blocked)} blocked accounts`,
        icon: <UserRound className="h-4 w-4" />,
        ratioValue: stats?.users.active,
        ratioTotal: stats?.users.total,
      },
      {
        label: "Pending Orders",
        value: formatNumber(stats?.orders.pending),
        detail: `${formatNumber(stats?.orders.total)} total orders`,
        icon: <Clock3 className="h-4 w-4" />,
        ratioValue: stats?.orders.pending,
        ratioTotal: stats?.orders.total,
        tone: "amber" as const,
      },
      {
        label: "Paid Orders",
        value: formatNumber(stats?.orders.paid),
        detail: `${formatNumber(stats?.orders.failed)} failed payments`,
        icon: <CheckCircle2 className="h-4 w-4" />,
        ratioValue: stats?.orders.paid,
        ratioTotal: stats?.orders.total,
      },
      {
        label: "Manual Volume",
        value: formatCurrency(stats?.orders.sandboxVolumeVnd),
        detail: "Admin-confirmed order total",
        icon: <WalletCards className="h-4 w-4" />,
      },
      {
        label: "Active Subs",
        value: formatNumber(stats?.subscriptions.active),
        detail: `${formatNumber(stats?.users.admins)} admin users`,
        icon: <CreditCard className="h-4 w-4" />,
      },
      {
        label: "Credit Balance",
        value: formatNumber(stats?.credits.totalBalance),
        detail: `${formatNumber(stats?.credits.purchasedInRange)} purchased in range`,
        icon: <Database className="h-4 w-4" />,
      },
      {
        label: "Catalog Status",
        value: `${formatNumber(stats?.products.active)}/${formatNumber(
          stats?.products.total,
        )}`,
        detail:
          (stats?.products.missingMvpProducts.length ?? 0) > 0
            ? `${stats?.products.missingMvpProducts.length} missing MVP products`
            : "MVP catalog coverage",
        icon: <PackageCheck className="h-4 w-4" />,
        ratioValue: stats?.products.active,
        ratioTotal: stats?.products.total,
        tone:
          (stats?.products.missingMvpProducts.length ?? 0) > 0
            ? ("amber" as const)
            : ("cyan" as const),
      },
    ],
    [stats],
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
        `Order ${shortId(result.order.id)} returned ${result.order.status}.`,
      );
      await loadAdminData(false);
    } catch (markPaidError) {
      setActionError(getApiErrorMessage(markPaidError));
    } finally {
      setMarkingOrderId(null);
    }
  }

  return (
    <DashboardShell planLabel="Admin OS">
      <main className="min-h-screen overflow-x-hidden bg-[#0a0a0a] px-4 py-8 text-[#e5e2e1] sm:px-6 lg:px-10 lg:py-12">
        <div className="mx-auto w-full max-w-[1440px] space-y-8">
          <header className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,560px)] xl:items-end">
            <div>
              <p className="text-xs font-bold uppercase text-[#00e5ff]">
                Admin Overview
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Admin Operations
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#bac9cc] sm:text-base">
                Signed in as {displayName}. Monitor users, VietQR payment
                verification, catalog readiness, and system health from one
                admin-only view.
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
                    {option.label}
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
                  Refresh
                </button>
              </div>

              <form
                className="flex flex-col gap-3 sm:flex-row"
                onSubmit={handleSearchSubmit}
              >
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Search users and orders</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#849396]" />
                  <input
                    className="min-h-11 w-full rounded-md border border-[#3b494c] bg-[#1c1b1b] py-2 pl-10 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-[#849396] focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff]"
                    placeholder="Search users and orders"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                </label>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
                  type="submit"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Apply
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
                      Admin dashboard failed to load
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
                  Retry
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

          <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
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

          <section className="grid gap-6 lg:grid-cols-12">
            <HealthPanel health={health} isLoading={isLoading} />
            <SubscriptionCreditPanel stats={stats} isLoading={isLoading} />
          </section>

          <AdminPanel>
            <PanelHeader
              title="Recent Orders"
              description={`${ordersPage.total} matching orders. Manual mark-paid appears only for eligible pending VietQR transfers.`}
              action={
                <div className="flex flex-wrap gap-3">
                  <SectionSelect
                    label="Order status"
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

          <section className="grid gap-6 xl:grid-cols-12">
            <AdminPanel className="xl:col-span-7">
              <PanelHeader
                title="Payment Transactions"
                description={`${transactionsPage.total} matching payment records. Gateway transactions remain secondary when present.`}
                action={
                  <div className="flex flex-wrap gap-3">
                    <SectionSelect
                      label="Payment status"
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
                title="Recent Users"
                description={`${usersPage.total} matching accounts. Safe fields only.`}
              />
              <UsersTable isLoading={isLoading} users={usersPage.items} />
            </AdminPanel>
          </section>

          <CatalogPanel
            isLoading={isLoading}
            productsResult={productsResult}
          />

          <section className="flex flex-col gap-3 border-t border-[#3b494c]/70 py-6 text-xs font-semibold text-[#849396] sm:flex-row sm:items-center sm:justify-between">
            <span>3D Stylist admin console · Week 03B VietQR operations</span>
            <span>
              Manual mark-paid:{" "}
              {getManualMarkPaidEnabled(health) ? "enabled" : "disabled"}
              {" · "}Pagination: page {ordersPage.page} of {ordersPage.totalPages}
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
