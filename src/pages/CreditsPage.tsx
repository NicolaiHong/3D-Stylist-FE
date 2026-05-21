import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Database,
  Loader2,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { billingApi } from "../features/billing/billing.api";
import {
  BILLING_PROVIDERS,
  type BillingCatalog,
  type BillingOrder,
  type BillingProduct,
  type BillingProvider,
  type BillingSummary,
} from "../features/billing/billing.types";
import { getApiErrorMessage } from "../services/apiClient";

interface ProcessingState {
  orderId?: string;
  productCode?: string;
  provider: BillingProvider;
}

interface RedirectState {
  provider: BillingProvider;
  productName: string;
}

function formatCurrency(value: number, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "No expiry returned";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getOrderProductName(order: BillingOrder) {
  return order.items[0]?.productName ?? "Billing product";
}

function getOrderProductCode(order: BillingOrder) {
  return order.items[0]?.productCode ?? "";
}

function getPlanBenefit(product: BillingProduct) {
  if (product.planCode === "pro") {
    return "Priority render and high quality texture";
  }

  if (product.planCode === "creator") {
    return "Faster queue and better texture";
  }

  return "Standard queue and basic export";
}

function statusTone(status: BillingOrder["status"]) {
  if (status === "paid") {
    return "border-[#00e5ff]/25 bg-[#00e5ff]/10 text-[#9cf0ff]";
  }

  if (status === "pending") {
    return "border-[#f3bf26]/30 bg-[#f3bf26]/10 text-[#ffeac0]";
  }

  return "border-[#ffb4ab]/25 bg-[#93000a]/20 text-[#ffdad6]";
}

function MethodButton({
  provider,
  disabled = false,
  isLoading,
  onClick,
}: {
  provider: BillingProvider;
  disabled?: boolean;
  isLoading: boolean;
  onClick: () => void;
}) {
  const label = provider === BILLING_PROVIDERS.MOMO ? "MoMo" : "VNPay";

  return (
    <button
      className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-3 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled || isLoading}
      type="button"
      onClick={onClick}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      Pay with {label} sandbox
    </button>
  );
}

function EmptyCatalogState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[#3b494c] bg-[#1c1b1b] p-6 text-center lg:col-span-3">
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="mt-1 text-sm text-[#bac9cc]">{body}</p>
    </div>
  );
}

export function CreditsPage() {
  const paymentInitiationRef = useRef(false);
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [selectedProduct, setSelectedProduct] =
    useState<BillingProduct | null>(null);
  const [createdOrder, setCreatedOrder] = useState<BillingOrder | null>(null);
  const [processing, setProcessing] = useState<ProcessingState | null>(null);
  const [redirecting, setRedirecting] = useState<RedirectState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadBillingData(showLoading = true) {
    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const [catalogResult, summaryResult, ordersResult] = await Promise.all([
        billingApi.getBillingCatalog(),
        billingApi.getBillingMe(),
        billingApi.getBillingOrders(),
      ]);

      setCatalog(catalogResult);
      setSummary(summaryResult);
      setOrders(ordersResult);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadBillingData();
  }, []);

  const pendingOrders = useMemo(() => {
    const byId = new Map<string, BillingOrder>();

    summary?.pendingOrders.forEach((order) => byId.set(order.id, order));
    orders
      .filter((order) => order.status === "pending")
      .forEach((order) => byId.set(order.id, order));

    if (createdOrder?.status === "pending") {
      byId.set(createdOrder.id, createdOrder);
    }

    return Array.from(byId.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }, [createdOrder, orders, summary?.pendingOrders]);
  const plans = catalog?.plans ?? [];
  const creditPacks = catalog?.creditPacks ?? [];

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

  async function redirectToPayment(
    order: BillingOrder,
    provider: BillingProvider,
    lockAlreadyAcquired = false,
  ): Promise<boolean> {
    if (!lockAlreadyAcquired && !beginPaymentInitiation()) {
      return false;
    }

    let redirectStarted = false;
    setActionError(null);
    setProcessing({ orderId: order.id, provider });

    try {
      const result = await billingApi.payBillingOrder(order.id, provider);
      const redirectUrl = result.payment.redirectUrl || result.transaction.paymentUrl;

      if (!redirectUrl) {
        setActionError("Sandbox payment did not return a redirect URL.");
        await loadBillingData(false);
        return false;
      }

      setRedirecting({ provider, productName: getOrderProductName(result.order) });
      redirectStarted = true;
      window.setTimeout(() => {
        window.location.assign(redirectUrl);
      }, 150);
      return true;
    } catch (payError) {
      setActionError(getApiErrorMessage(payError));
      await loadBillingData(false);
      return false;
    } finally {
      setProcessing(null);

      if (!lockAlreadyAcquired && !redirectStarted) {
        releasePaymentInitiation();
      }
    }
  }

  async function createAndPay(
    product: BillingProduct,
    provider: BillingProvider,
  ) {
    if (!beginPaymentInitiation()) {
      return;
    }

    let redirectStarted = false;
    setActionError(null);
    setProcessing({ productCode: product.code, provider });

    try {
      const order = await billingApi.createBillingOrder(product.code);
      setCreatedOrder(order);
      setOrders((current) => [order, ...current]);
      redirectStarted = await redirectToPayment(order, provider, true);
    } catch (createError) {
      setActionError(getApiErrorMessage(createError));
      await loadBillingData(false);
    } finally {
      setProcessing(null);

      if (!redirectStarted) {
        releasePaymentInitiation();
      }
    }
  }

  function isProcessingProduct(product: BillingProduct, provider: BillingProvider) {
    return (
      processing?.productCode === product.code && processing.provider === provider
    );
  }

  function isProcessingOrder(order: BillingOrder, provider: BillingProvider) {
    return processing?.orderId === order.id && processing.provider === provider;
  }

  function findCatalogProduct(productCode: string) {
    return catalog?.products.find((product) => product.code === productCode);
  }

  if (redirecting) {
    const providerName =
      redirecting.provider === BILLING_PROVIDERS.MOMO ? "MoMo" : "VNPay";

    return (
      <DashboardShell planLabel={summary?.plan.name}>
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
          <section className="w-full max-w-md rounded-lg border border-[#00e5ff]/25 bg-[#1c1b1b] p-6 text-center shadow-[0_0_48px_rgba(0,229,255,0.12)]">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#00e5ff]" />
            <h1 className="mt-5 font-display text-2xl font-semibold text-white">
              Opening {providerName} sandbox...
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#bac9cc]">
              Do not close this tab while we prepare payment for{" "}
              {redirecting.productName}.
            </p>
          </section>
        </main>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell planLabel={summary?.plan.name}>
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <div className="mx-auto w-full max-w-[1200px] space-y-8">
          <header className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
                Credits
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Plans and sandbox payments.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bac9cc] sm:text-base">
                Choose a business plan or credit pack, create a pending order,
                then open MoMo sandbox or VNPay sandbox.
              </p>
            </div>

            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#bac9cc]">
                  Current plan
                </p>
                <p className="mt-2 truncate font-display text-2xl font-semibold text-white">
                  {summary?.plan.name ?? "Free"}
                </p>
              </div>
              <div className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#bac9cc]">
                  Credits
                </p>
                <p className="mt-2 font-display text-2xl font-semibold text-white">
                  {summary?.credits.balance ?? 0}
                </p>
              </div>
            </section>
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
                      Billing data failed to load
                    </h2>
                    <p className="mt-1 text-sm text-[#ffdad6]/80">{error}</p>
                  </div>
                </div>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#ffb4ab]/35 px-4 py-2.5 text-sm font-bold text-[#ffdad6] transition hover:bg-[#ffb4ab]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffb4ab]"
                  type="button"
                  onClick={() => void loadBillingData()}
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

          {isLoading ? (
            <div className="grid gap-6 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  className="h-72 animate-pulse rounded-lg border border-white/10 bg-white/[0.05]"
                  key={index}
                />
              ))}
            </div>
          ) : (
            <>
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-[#00e5ff]" />
                  <h2 className="font-display text-2xl font-semibold text-white">
                    Subscription plans
                  </h2>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {plans.length === 0 ? (
                    <EmptyCatalogState
                      title="No subscription plans returned"
                      body="Refresh billing data after the catalog endpoint is ready."
                    />
                  ) : (
                    plans.map((plan) => {
                      const isCurrent =
                        summary?.plan.status === "active" &&
                        summary.plan.code === plan.planCode;

                      return (
                        <article
                          className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-5"
                          key={plan.code}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-display text-2xl font-semibold text-white">
                                {plan.name}
                              </h3>
                              <p className="mt-1 text-sm text-[#bac9cc]">
                                Sandbox monthly plan
                              </p>
                            </div>
                            {isCurrent ? (
                              <span className="rounded-md border border-[#00e5ff]/25 bg-[#00e5ff]/10 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#9cf0ff]">
                                Current
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-6 font-display text-3xl font-semibold text-white">
                            {formatCurrency(plan.priceVnd, plan.currency)}
                            <span className="ml-2 text-sm font-semibold text-[#bac9cc]">
                              / month
                            </span>
                          </p>
                          <ul className="mt-5 space-y-3 text-sm text-[#bac9cc]">
                            <li className="flex gap-2">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00e5ff]" />
                              {plan.credits ?? 0} included HD generations
                            </li>
                            <li className="flex gap-2">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00e5ff]" />
                              Download model and basic export
                            </li>
                            <li className="flex gap-2">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00e5ff]" />
                              {getPlanBenefit(plan)}
                            </li>
                          </ul>
                          <button
                            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isCurrent}
                            type="button"
                            onClick={() => {
                              setSelectedProduct(plan);
                              setCreatedOrder(null);
                              setActionError(null);
                            }}
                          >
                            {isCurrent ? "Current plan" : `Choose ${plan.name}`}
                          </button>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-[#00e5ff]" />
                  <h2 className="font-display text-2xl font-semibold text-white">
                    Credit packs
                  </h2>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {creditPacks.length === 0 ? (
                    <EmptyCatalogState
                      title="No credit packs returned"
                      body="Refresh billing data after the catalog endpoint is ready."
                    />
                  ) : (
                    creditPacks.map((pack) => (
                      <article
                        className="rounded-lg border border-[#3b494c] bg-[#201f1f] p-5"
                        key={pack.code}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-display text-2xl font-semibold text-white">
                              {pack.name}
                            </h3>
                            <p className="mt-1 text-sm text-[#bac9cc]">
                              1 credit = 1 HD generation
                            </p>
                          </div>
                          <WalletCards className="h-5 w-5 text-[#f3bf26]" />
                        </div>
                        <p className="mt-6 font-display text-3xl font-semibold text-white">
                          {formatCurrency(pack.priceVnd, pack.currency)}
                        </p>
                        <p className="mt-4 text-sm leading-6 text-[#bac9cc]">
                          Adds {pack.credits ?? 0} credits after verified
                          sandbox payment. Credit packs do not unlock export by
                          themselves.
                        </p>
                        <button
                          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff]"
                          type="button"
                          onClick={() => {
                            setSelectedProduct(pack);
                            setCreatedOrder(null);
                            setActionError(null);
                          }}
                        >
                          Buy {pack.credits ?? pack.name} credits
                        </button>
                      </article>
                    ))
                  )}
                </div>
              </section>

              {selectedProduct ? (
                <section className="rounded-lg border border-[#00e5ff]/25 bg-[#00e5ff]/10 p-5">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00e5ff]">
                        Sandbox payment
                      </p>
                      <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                        {selectedProduct.name}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                        We create a pending order first, then open the selected
                        sandbox gateway. The frontend never marks orders paid.
                      </p>
                      {createdOrder ? (
                        <p className="mt-3 text-sm font-semibold text-[#ffeac0]">
                          Order {createdOrder.id.slice(0, 8)} created. Choose a
                          sandbox payment method to continue.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex min-w-full flex-col gap-3 sm:min-w-[420px] sm:flex-row">
                      <MethodButton
                        disabled={Boolean(processing)}
                        isLoading={isProcessingProduct(
                          selectedProduct,
                          BILLING_PROVIDERS.MOMO,
                        )}
                        provider={BILLING_PROVIDERS.MOMO}
                        onClick={() =>
                          void createAndPay(
                            selectedProduct,
                            BILLING_PROVIDERS.MOMO,
                          )
                        }
                      />
                      <MethodButton
                        disabled={Boolean(processing)}
                        isLoading={isProcessingProduct(
                          selectedProduct,
                          BILLING_PROVIDERS.VNPAY,
                        )}
                        provider={BILLING_PROVIDERS.VNPAY}
                        onClick={() =>
                          void createAndPay(
                            selectedProduct,
                            BILLING_PROVIDERS.VNPAY,
                          )
                        }
                      />
                    </div>
                  </div>
                </section>
              ) : null}

              <section className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-white">
                      Pending orders
                    </h2>
                    <p className="mt-1 text-sm text-[#bac9cc]">
                      Retry or resume sandbox payment while an order is pending.
                    </p>
                  </div>
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                    type="button"
                    onClick={() => void loadBillingData(false)}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                </div>

                {pendingOrders.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#3b494c] bg-[#1c1b1b] p-6 text-center">
                    <CreditCard className="mx-auto h-7 w-7 text-[#3b494c]" />
                    <p className="mt-3 text-sm font-bold text-white">
                      No pending payments
                    </p>
                    <p className="mt-1 text-sm text-[#bac9cc]">
                      Choose a plan or credit pack to create one.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {pendingOrders.map((order) => (
                      <article
                        className="rounded-lg border border-[#f3bf26]/30 bg-[#201f1f] p-5"
                        key={order.id}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <span className="inline-flex rounded-md border border-[#f3bf26]/30 bg-[#f3bf26]/10 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#ffeac0]">
                              Payment pending
                            </span>
                            <h3 className="mt-3 font-display text-xl font-semibold text-white">
                              {getOrderProductName(order)}
                            </h3>
                            <p className="mt-2 text-sm text-[#bac9cc]">
                              {formatCurrency(order.totalAmount, order.currency)}
                              {" · "}Expires {formatDateTime(order.expiresAt)}
                            </p>
                            {order.transactions[0] ? (
                              <p className="mt-2 text-sm text-[#bac9cc]">
                                Latest attempt: {order.transactions[0].provider}{" "}
                                {order.transactions[0].status}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-col gap-3 sm:flex-row">
                            <MethodButton
                              disabled={Boolean(processing)}
                              isLoading={isProcessingOrder(
                                order,
                                BILLING_PROVIDERS.MOMO,
                              )}
                              provider={BILLING_PROVIDERS.MOMO}
                              onClick={() =>
                                void redirectToPayment(
                                  order,
                                  BILLING_PROVIDERS.MOMO,
                                )
                              }
                            />
                            <MethodButton
                              disabled={Boolean(processing)}
                              isLoading={isProcessingOrder(
                                order,
                                BILLING_PROVIDERS.VNPAY,
                              )}
                              provider={BILLING_PROVIDERS.VNPAY}
                              onClick={() =>
                                void redirectToPayment(
                                  order,
                                  BILLING_PROVIDERS.VNPAY,
                                )
                              }
                            />
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <h2 className="font-display text-2xl font-semibold text-white">
                  Order history
                </h2>
                {orders.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#3b494c] bg-[#1c1b1b] p-6 text-center">
                    <p className="text-sm font-bold text-white">
                      No billing orders yet
                    </p>
                    <p className="mt-1 text-sm text-[#bac9cc]">
                      Completed, failed, and cancelled sandbox orders will appear
                      here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-[#3b494c] bg-[#1c1b1b]">
                    {orders.slice(0, 8).map((order) => {
                      const canRetry = order.status !== "paid";
                      const retryProduct = findCatalogProduct(
                        getOrderProductCode(order),
                      );

                      return (
                        <div
                          className="grid gap-4 border-b border-[#3b494c]/70 p-4 last:border-b-0 md:grid-cols-[1fr_auto]"
                          key={order.id}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-bold text-white">
                                {getOrderProductName(order)}
                              </p>
                              <span
                                className={`rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-[0.12em] ${statusTone(
                                  order.status,
                                )}`}
                              >
                                {order.status}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-[#bac9cc]">
                              {formatCurrency(order.totalAmount, order.currency)}
                              {" · "}Created {formatDateTime(order.createdAt)}
                            </p>
                          </div>
                          {canRetry && retryProduct ? (
                            <button
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                              type="button"
                              onClick={() => {
                                setSelectedProduct(retryProduct);
                                setCreatedOrder(null);
                                setActionError(null);
                              }}
                            >
                              Retry payment
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          ) : order.status === "paid" ? (
                            <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-[#9cf0ff]">
                              <CheckCircle2 className="h-4 w-4" />
                              Confirmed
                            </span>
                          ) : (
                            <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-[#ffdad6]">
                              <XCircle className="h-4 w-4" />
                              Not payable
                            </span>
                          )}
                        </div>
                      );
                    })}
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
