import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Truck,
  X,
} from "lucide-react";
import { useI18n } from "../../../i18n/useI18n";
import {
  formatI18nCurrency,
  formatI18nDateTime,
} from "../../../i18n/formatters";
import { getApiErrorMessage } from "../../../services/apiClient";
import { adminApi } from "../admin.api";
import type {
  AdminEditablePhysicalPrintFulfillmentStatus,
  AdminPagination,
  AdminPhysicalPrintFulfillmentStatus,
  AdminPhysicalPrintOrderDetail,
  AdminPhysicalPrintOrderListItem,
  AdminPhysicalPrintPaymentStatus,
  AdminPhysicalPrintStatusPayload,
} from "../admin.types";

type PaymentFilter = AdminPhysicalPrintPaymentStatus | "all";
type FulfillmentFilter = AdminPhysicalPrintFulfillmentStatus | "all";

const paymentOptions: PaymentFilter[] = [
  "all",
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
];

const fulfillmentOptions: FulfillmentFilter[] = [
  "all",
  "NOT_STARTED",
  "WAITING_FULFILLMENT",
  "ASSIGNED_TO_PRINT_PARTNER",
  "PRINTING",
  "PRINTED",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
];

const allowedTransitions: Record<
  AdminPhysicalPrintFulfillmentStatus,
  AdminEditablePhysicalPrintFulfillmentStatus[]
> = {
  NOT_STARTED: [],
  WAITING_FULFILLMENT: [
    "WAITING_FULFILLMENT",
    "PRINTING",
    "CANCELLED",
  ],
  ASSIGNED_TO_PRINT_PARTNER: [
    "ASSIGNED_TO_PRINT_PARTNER",
    "PRINTING",
    "CANCELLED",
  ],
  PRINTING: ["PRINTING", "PRINTED", "CANCELLED"],
  PRINTED: ["PRINTED", "SHIPPED", "CANCELLED"],
  SHIPPED: ["SHIPPED", "COMPLETED"],
  COMPLETED: ["COMPLETED"],
  CANCELLED: ["CANCELLED"],
};

const emptyOrders: AdminPagination<AdminPhysicalPrintOrderListItem> = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  items: [],
};

function shortId(value: string) {
  return value.slice(0, 8);
}

function statusTone(status: string) {
  if (status === "PAID" || status === "COMPLETED" || status === "PRINTED") {
    return "border-[#00e5ff]/30 bg-[#00e5ff]/10 text-[#9cf0ff]";
  }

  if (
    status === "PENDING" ||
    status === "WAITING_FULFILLMENT" ||
    status === "ASSIGNED_TO_PRINT_PARTNER" ||
    status === "PRINTING" ||
    status === "SHIPPED"
  ) {
    return "border-[#f3bf26]/35 bg-[#f3bf26]/10 text-[#ffeac0]";
  }

  if (status === "FAILED" || status === "CANCELLED") {
    return "border-[#ffb4ab]/30 bg-[#93000a]/25 text-[#ffdad6]";
  }

  return "border-white/10 bg-white/[0.05] text-[#bac9cc]";
}

function StatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold uppercase ${statusTone(
        status,
      )}`}
    >
      {label}
    </span>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 border-b border-[#3b494c]/50 py-3 last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-bold uppercase text-[#849396]">{label}</dt>
      <dd className="break-words text-sm font-semibold text-[#e5e2e1] sm:text-right">
        {value}
      </dd>
    </div>
  );
}

export function PhysicalPrintOrdersPanel() {
  const { language, t } = useI18n();
  const [orders, setOrders] = useState(emptyOrders);
  const [paymentStatus, setPaymentStatus] = useState<PaymentFilter>("all");
  const [fulfillmentStatus, setFulfillmentStatus] =
    useState<FulfillmentFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] =
    useState<AdminPhysicalPrintOrderDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [targetStatus, setTargetStatus] =
    useState<AdminEditablePhysicalPrintFulfillmentStatus | null>(null);
  const [trackingCode, setTrackingCode] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const requestIdRef = useRef(0);

  const paymentLabels: Record<PaymentFilter, string> = {
    all: t("admin.physicalPrint.all"),
    PENDING: t("admin.physicalPrint.payment.pending"),
    PAID: t("admin.physicalPrint.payment.paid"),
    FAILED: t("admin.physicalPrint.payment.failed"),
    CANCELLED: t("admin.physicalPrint.payment.cancelled"),
    EXPIRED: t("admin.physicalPrint.payment.expired"),
    REFUNDED: t("admin.physicalPrint.payment.refunded"),
  };

  const fulfillmentLabels: Record<FulfillmentFilter, string> = {
    all: t("admin.physicalPrint.all"),
    NOT_STARTED: t("admin.physicalPrint.fulfillment.notStarted"),
    WAITING_FULFILLMENT: t(
      "admin.physicalPrint.fulfillment.waitingFulfillment",
    ),
    ASSIGNED_TO_PRINT_PARTNER: t(
      "admin.physicalPrint.fulfillment.assignedToPartner",
    ),
    PRINTING: t("admin.physicalPrint.fulfillment.printing"),
    PRINTED: t("admin.physicalPrint.fulfillment.printed"),
    SHIPPED: t("admin.physicalPrint.fulfillment.shipped"),
    COMPLETED: t("admin.physicalPrint.fulfillment.completed"),
    CANCELLED: t("admin.physicalPrint.fulfillment.cancelled"),
  };

  const loadOrders = useCallback(
    async (showLoading = true) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setLoadError(null);

      try {
        const result = await adminApi.getPhysicalPrintOrders({
          page: 1,
          limit: 20,
          search: activeSearch || undefined,
          paymentStatus: paymentStatus === "all" ? undefined : paymentStatus,
          fulfillmentStatus:
            fulfillmentStatus === "all" ? undefined : fulfillmentStatus,
        });

        if (requestIdRef.current === requestId) {
          setOrders(result);
        }
      } catch (error) {
        if (requestIdRef.current === requestId) {
          setLoadError(getApiErrorMessage(error));
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [activeSearch, fulfillmentStatus, paymentStatus],
  );

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const transitionOptions = useMemo(
    () =>
      selectedOrder
        ? allowedTransitions[selectedOrder.fulfillmentStatus]
        : [],
    [selectedOrder],
  );

  async function openDetail(orderId: string) {
    setIsDetailLoading(true);
    setDetailError(null);
    setActionError(null);
    setActionSuccess(null);

    try {
      const detail = await adminApi.getPhysicalPrintOrder(orderId);

      setSelectedOrder(detail);
      setTargetStatus(
        detail.fulfillmentStatus === "NOT_STARTED"
          ? null
          : detail.fulfillmentStatus,
      );
      setTrackingCode(detail.trackingCode ?? "");
      setInternalNote(detail.internalNote ?? "");
    } catch (error) {
      setDetailError(getApiErrorMessage(error));
    } finally {
      setIsDetailLoading(false);
    }
  }

  function closeDetail() {
    if (isUpdating) {
      return;
    }

    setSelectedOrder(null);
    setDetailError(null);
    setActionError(null);
    setActionSuccess(null);
  }

  async function updateStatus() {
    if (!selectedOrder || !targetStatus) {
      return;
    }

    setIsUpdating(true);
    setActionError(null);
    setActionSuccess(null);

    const payload: AdminPhysicalPrintStatusPayload = {
      fulfillmentStatus: targetStatus,
      internalNote: internalNote.trim(),
      ...(targetStatus === "SHIPPED"
        ? { trackingCode: trackingCode.trim() }
        : {}),
    };

    try {
      const updated = await adminApi.updatePhysicalPrintOrderStatus(
        selectedOrder.id,
        payload,
      );
      setSelectedOrder(updated);
      setTrackingCode(updated.trackingCode ?? "");
      setInternalNote(updated.internalNote ?? "");
      setTargetStatus(
        updated.fulfillmentStatus === "NOT_STARTED"
          ? null
          : updated.fulfillmentStatus,
      );
      setActionSuccess(t("admin.physicalPrint.success.status"));
      await loadOrders(false);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <section className="rounded-lg border border-[#3b494c] bg-[#1c1b1b]">
      <div className="flex flex-col gap-4 border-b border-[#3b494c]/70 p-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-[#00e5ff]">
            {t("admin.physicalPrint.eyebrow")}
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold text-white">
            {t("admin.physicalPrint.title")}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#bac9cc]">
            {t("admin.physicalPrint.description", { count: orders.total })}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[150px_190px_auto]">
          <label className="grid gap-1.5 text-xs font-bold uppercase text-[#849396]">
            {t("admin.physicalPrint.paymentStatus")}
            <select
              className="min-h-11 rounded-md border border-[#3b494c] bg-[#0e0e0e] px-3 py-2 text-sm font-semibold normal-case text-white outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff]"
              value={paymentStatus}
              onChange={(event) =>
                setPaymentStatus(event.target.value as PaymentFilter)
              }
            >
              {paymentOptions.map((option) => (
                <option key={option} value={option}>
                  {paymentLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-bold uppercase text-[#849396]">
            {t("admin.physicalPrint.fulfillmentStatus")}
            <select
              className="min-h-11 rounded-md border border-[#3b494c] bg-[#0e0e0e] px-3 py-2 text-sm font-semibold normal-case text-white outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff]"
              value={fulfillmentStatus}
              onChange={(event) =>
                setFulfillmentStatus(event.target.value as FulfillmentFilter)
              }
            >
              {fulfillmentOptions.map((option) => (
                <option key={option} value={option}>
                  {fulfillmentLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-md border border-[#3b494c] bg-[#201f1f] px-4 py-2 text-sm font-bold text-white transition hover:border-[#00e5ff]/40 hover:bg-[#00e5ff]/10 disabled:opacity-60"
            disabled={isLoading || isRefreshing}
            type="button"
            onClick={() => void loadOrders(false)}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t("common.refresh")}
          </button>
        </div>
      </div>

      <form
        className="flex flex-col gap-3 border-b border-[#3b494c]/60 p-5 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setActiveSearch(searchInput.trim());
        }}
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">
            {t("admin.physicalPrint.searchLabel")}
          </span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#849396]" />
          <input
            className="min-h-11 w-full rounded-md border border-[#3b494c] bg-[#0e0e0e] py-2 pl-10 pr-3 text-sm font-semibold text-white outline-none placeholder:text-[#849396] focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff]"
            placeholder={t("admin.physicalPrint.searchPlaceholder")}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#00e5ff] px-4 py-2 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff]"
          type="submit"
        >
          {t("admin.physicalPrint.applyFilters")}
        </button>
      </form>

      {loadError ? (
        <div className="m-5 flex gap-3 rounded-md border border-[#ffb4ab]/30 bg-[#93000a]/25 p-4 text-sm text-[#ffdad6]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("admin.physicalPrint.errors.load")}: {loadError}</span>
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              className="h-14 animate-pulse rounded-sm bg-white/[0.07]"
              key={index}
            />
          ))}
        </div>
      ) : orders.items.length === 0 ? (
        <div className="p-8 text-center text-sm text-[#bac9cc]">
          {t("admin.physicalPrint.empty")}
        </div>
      ) : (
        <div className="internal-scroll-region overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left">
            <thead className="border-b border-[#3b494c]/70 bg-[#201f1f] text-xs uppercase text-[#849396]">
              <tr>
                <th className="px-5 py-3">{t("admin.physicalPrint.order")}</th>
                <th className="px-5 py-3">{t("admin.physicalPrint.customer")}</th>
                <th className="px-5 py-3">{t("admin.physicalPrint.package")}</th>
                <th className="px-5 py-3">{t("admin.table.amount")}</th>
                <th className="px-5 py-3">{t("admin.physicalPrint.paymentStatus")}</th>
                <th className="px-5 py-3">{t("admin.physicalPrint.fulfillmentStatus")}</th>
                <th className="px-5 py-3">{t("admin.physicalPrint.shipping")}</th>
                <th className="px-5 py-3">{t("admin.table.action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3b494c]/60">
              {orders.items.map((order) => (
                <tr className="transition hover:bg-white/[0.035]" key={order.id}>
                  <td className="px-5 py-4">
                    <p className="font-mono text-xs font-bold text-white">
                      {shortId(order.id)}
                    </p>
                    <p className="mt-1 text-xs text-[#849396]">
                      {formatI18nDateTime(
                        order.createdAt,
                        language,
                        t("common.notReturned"),
                      )}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="max-w-[180px] truncate text-sm font-bold text-white">
                      {order.user.displayName ||
                        order.user.email ||
                        order.shipping.name}
                    </p>
                    <p className="mt-1 text-xs text-[#bac9cc]">
                      {order.shipping.phone}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-bold text-white">
                      {order.packageName}
                    </p>
                    <p className="mt-1 font-mono text-xs text-[#849396]">
                      {order.packageCode}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-white">
                    {formatI18nCurrency(
                      order.finalPriceVnd,
                      language,
                      order.currency,
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge
                      label={paymentLabels[order.paymentStatus]}
                      status={order.paymentStatus}
                    />
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge
                      label={fulfillmentLabels[order.fulfillmentStatus]}
                      status={order.fulfillmentStatus}
                    />
                  </td>
                  <td className="px-5 py-4">
                    <p className="max-w-[220px] truncate text-sm text-[#e5e2e1]">
                      {order.shipping.addressSummary}
                    </p>
                    <p className="mt-1 font-mono text-xs text-[#849396]">
                      {order.trackingCode ||
                        t("admin.physicalPrint.noTracking")}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/30 bg-[#00e5ff]/10 px-3 py-2 text-xs font-bold text-[#c3f5ff] transition hover:bg-[#00e5ff]/15"
                      type="button"
                      onClick={() => void openDetail(order.id)}
                    >
                      <Package className="h-4 w-4" />
                      {t("admin.physicalPrint.viewDetail")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedOrder || isDetailLoading || detailError ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-sm"
          role="presentation"
        >
          <div
            aria-modal="true"
            className="max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-y-auto rounded-lg border border-[#3b494c] bg-[#1c1b1b] shadow-2xl shadow-black/40"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#3b494c]/70 p-5">
              <div>
                <p className="text-xs font-bold uppercase text-[#00e5ff]">
                  {t("admin.physicalPrint.detail")}
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-white">
                  {selectedOrder
                    ? `${selectedOrder.package.name} · ${shortId(selectedOrder.id)}`
                    : t("admin.physicalPrint.loadingDetail")}
                </h3>
              </div>
              <button
                aria-label={t("admin.physicalPrint.close")}
                autoFocus
                className="flex h-11 w-11 items-center justify-center rounded-md border border-white/10 text-[#bac9cc] hover:border-[#00e5ff]/35 hover:text-white disabled:opacity-60"
                disabled={isUpdating}
                type="button"
                onClick={closeDetail}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isDetailLoading ? (
              <div className="flex min-h-64 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#00e5ff]" />
              </div>
            ) : detailError ? (
              <div className="m-5 rounded-md border border-[#ffb4ab]/30 bg-[#93000a]/25 p-4 text-sm text-[#ffdad6]">
                {t("admin.physicalPrint.errors.detail")}: {detailError}
              </div>
            ) : selectedOrder ? (
              <div className="grid gap-5 p-5 lg:grid-cols-2">
                <div className="space-y-5">
                  <section className="rounded-md border border-[#3b494c]/70 bg-[#201f1f] p-4">
                    <h4 className="font-display text-lg font-semibold text-white">
                      {t("admin.physicalPrint.orderSummary")}
                    </h4>
                    <dl className="mt-3">
                      <DetailRow
                        label={t("admin.physicalPrint.customer")}
                        value={
                          selectedOrder.user.displayName ||
                          selectedOrder.user.email ||
                          selectedOrder.user.id
                        }
                      />
                      <DetailRow
                        label={t("admin.physicalPrint.figure")}
                        value={shortId(selectedOrder.figureId)}
                      />
                      <DetailRow
                        label={t("admin.physicalPrint.package")}
                        value={`${selectedOrder.package.name} · ${selectedOrder.package.estimatedSizeLabel}`}
                      />
                      <DetailRow
                        label={t("admin.physicalPrint.price")}
                        value={formatI18nCurrency(
                          selectedOrder.price.finalPriceVnd,
                          language,
                          selectedOrder.price.currency,
                        )}
                      />
                      <DetailRow
                        label={t("admin.physicalPrint.modelAsset")}
                        value={
                          selectedOrder.modelAsset.ready
                            ? `${selectedOrder.modelAsset.format} · ${t("admin.physicalPrint.ready")}`
                            : t("admin.physicalPrint.notReady")
                        }
                      />
                    </dl>
                  </section>

                  <section className="rounded-md border border-[#3b494c]/70 bg-[#201f1f] p-4">
                    <h4 className="font-display text-lg font-semibold text-white">
                      {t("admin.physicalPrint.shipping")}
                    </h4>
                    <dl className="mt-3">
                      <DetailRow
                        label={t("physicalPrint.shipping.name")}
                        value={selectedOrder.shippingName}
                      />
                      <DetailRow
                        label={t("physicalPrint.shipping.phone")}
                        value={selectedOrder.shippingPhone}
                      />
                      <DetailRow
                        label={t("physicalPrint.shipping.address")}
                        value={selectedOrder.shippingAddress}
                      />
                      <DetailRow
                        label={t("admin.physicalPrint.customerNote")}
                        value={
                          selectedOrder.customerNote ||
                          t("common.notReturned")
                        }
                      />
                    </dl>
                  </section>

                  <section className="rounded-md border border-[#3b494c]/70 bg-[#201f1f] p-4">
                    <h4 className="font-display text-lg font-semibold text-white">
                      {t("admin.physicalPrint.timestamps")}
                    </h4>
                    <dl className="mt-3">
                      {[
                        ["createdAt", selectedOrder.createdAt],
                        ["paidAt", selectedOrder.paidAt],
                        ["assignedAt", selectedOrder.assignedAt],
                        ["printedAt", selectedOrder.printedAt],
                        ["shippedAt", selectedOrder.shippedAt],
                        ["completedAt", selectedOrder.completedAt],
                        ["cancelledAt", selectedOrder.cancelledAt],
                      ].map(([key, value]) => (
                        <DetailRow
                          key={key}
                          label={t(`admin.physicalPrint.${key}`)}
                          value={formatI18nDateTime(
                            value,
                            language,
                            t("common.notReturned"),
                          )}
                        />
                      ))}
                    </dl>
                  </section>
                </div>

                <div className="space-y-5">
                  <section className="rounded-md border border-[#3b494c]/70 bg-[#201f1f] p-4">
                    <h4 className="font-display text-lg font-semibold text-white">
                      {t("admin.physicalPrint.statusControl")}
                    </h4>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusBadge
                        label={paymentLabels[selectedOrder.paymentStatus]}
                        status={selectedOrder.paymentStatus}
                      />
                      <StatusBadge
                        label={
                          fulfillmentLabels[selectedOrder.fulfillmentStatus]
                        }
                        status={selectedOrder.fulfillmentStatus}
                      />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[#849396]">
                      {t("admin.physicalPrint.paymentReadOnly")}
                    </p>

                    <label className="mt-5 grid gap-1.5 text-xs font-bold uppercase text-[#849396]">
                      {t("admin.physicalPrint.fulfillmentStatus")}
                      <select
                        className="min-h-11 rounded-md border border-[#3b494c] bg-[#0e0e0e] px-3 py-2 text-sm font-semibold normal-case text-white outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] disabled:opacity-60"
                        disabled={
                          selectedOrder.paymentStatus !== "PAID" ||
                          transitionOptions.length === 0
                        }
                        value={targetStatus ?? ""}
                        onChange={(event) =>
                          setTargetStatus(
                            event.target
                              .value as AdminEditablePhysicalPrintFulfillmentStatus,
                          )
                        }
                      >
                        {transitionOptions.map((status) => (
                          <option key={status} value={status}>
                            {fulfillmentLabels[status]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="mt-4 grid gap-1.5 text-xs font-bold uppercase text-[#849396]">
                      {t("admin.physicalPrint.trackingCode")}
                      <input
                        className="min-h-11 rounded-md border border-[#3b494c] bg-[#0e0e0e] px-3 py-2 text-sm font-semibold normal-case text-white outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] disabled:opacity-60"
                        disabled={targetStatus !== "SHIPPED"}
                        value={trackingCode}
                        onChange={(event) => setTrackingCode(event.target.value)}
                      />
                    </label>

                    <label className="mt-4 grid gap-1.5 text-xs font-bold uppercase text-[#849396]">
                      {t("admin.physicalPrint.internalNote")}
                      <textarea
                        className="min-h-28 resize-y rounded-md border border-[#3b494c] bg-[#0e0e0e] px-3 py-2 text-sm font-semibold normal-case text-white outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff]"
                        maxLength={2000}
                        value={internalNote}
                        onChange={(event) => setInternalNote(event.target.value)}
                      />
                    </label>

                    <button
                      className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={
                        isUpdating ||
                        !targetStatus ||
                        selectedOrder.paymentStatus !== "PAID" ||
                        (targetStatus === "SHIPPED" &&
                          trackingCode.trim().length === 0)
                      }
                      type="button"
                      onClick={() => void updateStatus()}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Truck className="h-4 w-4" />
                      )}
                      {t("admin.physicalPrint.updateStatus")}
                    </button>
                  </section>

                  {actionError ? (
                    <div className="flex gap-3 rounded-md border border-[#ffb4ab]/30 bg-[#93000a]/25 p-4 text-sm text-[#ffdad6]">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {t("admin.physicalPrint.errors.update")}: {actionError}
                      </span>
                    </div>
                  ) : null}

                  {actionSuccess ? (
                    <div className="flex gap-3 rounded-md border border-[#00e5ff]/25 bg-[#00e5ff]/10 p-4 text-sm text-[#c3f5ff]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{actionSuccess}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
