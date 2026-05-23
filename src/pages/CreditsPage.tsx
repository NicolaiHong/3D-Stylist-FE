import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Database,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { billingApi } from "../features/billing/billing.api";
import {
  type BillingCatalog,
  type BillingOrder,
  type BillingProduct,
  type BillingSummary,
} from "../features/billing/billing.types";
import { getApiErrorMessage } from "../services/apiClient";

export const BILLING_CART_STORAGE_KEY = "3d-stylist.checkout.productCode";

type ProductSelectionIntent = "add_to_cart" | "buy_now";

interface PendingSubscriptionChange {
  product: BillingProduct;
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

function EmptyCatalogState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#3b494c] bg-[#1c1b1b] p-6 text-center lg:col-span-3">
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="mt-1 text-sm text-[#bac9cc]">{body}</p>
    </div>
  );
}

function SubscriptionCancelDialog({
  currentPlanName,
  selectedPlanName,
  confirmationText,
  error,
  isSubmitting,
  isOpen,
  onClose,
  onConfirm,
  onConfirmationChange,
}: {
  currentPlanName: string;
  selectedPlanName: string;
  confirmationText: string;
  error: string | null;
  isSubmitting: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onConfirmationChange: (value: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canConfirm = confirmationText === "cancel";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;

    window.setTimeout(() => inputRef.current?.focus(), 0);

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      previousActiveElement?.focus();
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") {
      return;
    }

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    if (!focusable?.length) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-sm"
      role="presentation"
    >
      <div
        aria-describedby="subscription-cancel-description"
        aria-labelledby="subscription-cancel-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-lg border border-[#f3bf26]/30 bg-[#1c1b1b] p-5 text-[#e5e2e1] shadow-[0_0_42px_rgba(243,191,38,0.12)]"
        ref={dialogRef}
        role="dialog"
        onKeyDown={trapFocus}
      >
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#f3bf26]/30 bg-[#f3bf26]/10 text-[#ffeac0]">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <button
            aria-label="Close cancellation dialog"
            className="flex h-10 w-10 items-center justify-center rounded-md text-[#bac9cc] transition hover:bg-white/[0.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#f3bf26]">
          Plan change blocked
        </p>
        <h2
          className="mt-3 font-display text-2xl font-semibold text-white"
          id="subscription-cancel-title"
        >
          Cancel current subscription?
        </h2>
        <p
          className="mt-3 text-sm leading-6 text-[#bac9cc]"
          id="subscription-cancel-description"
        >
          You are currently on {currentPlanName}. Cancellation is required
          before changing to {selectedPlanName}.
        </p>

        <div className="mt-5 rounded-md border border-[#f3bf26]/30 bg-[#f3bf26]/10 p-4 text-sm leading-6 text-[#ffeac0]">
          Your current plan will stop unlocking paid export and download access.
          No new VietQR order will be created until you choose the new plan
          again.
        </div>

        <label
          className="mt-5 block text-sm font-bold text-white"
          htmlFor="subscription-cancel-confirmation"
        >
          Type 'cancel' to confirm
        </label>
        <input
          aria-describedby={error ? "subscription-cancel-error" : undefined}
          aria-invalid={Boolean(error)}
          className="mt-2 h-12 w-full rounded-md border border-white/10 bg-[#0e0e0e] px-3 text-base text-white outline-none transition placeholder:text-[#849396] focus:border-[#00e5ff] focus:ring-4 focus:ring-[#00e5ff]/15 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          id="subscription-cancel-confirmation"
          placeholder="type cancel to confirm"
          ref={inputRef}
          type="text"
          value={confirmationText}
          onChange={(event) => onConfirmationChange(event.target.value)}
        />

        {error ? (
          <p
            className="mt-3 text-sm text-[#ffdad6]"
            id="subscription-cancel-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            Keep current plan
          </button>
          <button
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#ffb4ab] px-4 py-2.5 text-sm font-bold text-[#3a0909] transition hover:bg-[#ffdad6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffdad6] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canConfirm || isSubmitting}
            type="button"
            onClick={onConfirm}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Cancel current plan
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductActions({
  product,
  disabled,
  selectedProductCode,
  onAddToCart,
  onBuyNow,
}: {
  product: BillingProduct;
  disabled?: boolean;
  selectedProductCode: string | null;
  onAddToCart: (product: BillingProduct) => void;
  onBuyNow: (product: BillingProduct) => void;
}) {
  const isSelected = selectedProductCode === product.code;

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        type="button"
        onClick={() => onAddToCart(product)}
      >
        <ShoppingCart className="h-4 w-4" />
        {isSelected ? "In cart" : "Add to cart"}
      </button>
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        type="button"
        onClick={() => onBuyNow(product)}
      >
        Buy now
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function CreditsPage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [cartProductCode, setCartProductCode] = useState<string | null>(() =>
    window.localStorage.getItem(BILLING_CART_STORAGE_KEY),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCartUpdating, setIsCartUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingSubscriptionChange, setPendingSubscriptionChange] =
    useState<PendingSubscriptionChange | null>(null);
  const [cancellationText, setCancellationText] = useState("");
  const [cancellationError, setCancellationError] = useState<string | null>(
    null,
  );
  const [isCancellingSubscription, setIsCancellingSubscription] =
    useState(false);

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

    return Array.from(byId.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }, [orders, summary?.pendingOrders]);

  const selectedProduct = useMemo(
    () =>
      catalog?.products.find((product) => product.code === cartProductCode) ??
      null,
    [cartProductCode, catalog?.products],
  );
  const plans = catalog?.plans ?? [];
  const creditPacks = catalog?.creditPacks ?? [];

  function isCurrentSubscriptionProduct(product: BillingProduct) {
    const activeSubscription = summary?.subscription;

    if (
      product.kind !== "subscription_plan" ||
      !activeSubscription ||
      activeSubscription.status !== "active"
    ) {
      return false;
    }

    return (
      activeSubscription.productCode === product.code ||
      (Boolean(product.planCode) &&
        activeSubscription.planCode === product.planCode)
    );
  }

  function requiresSubscriptionCancellation(product: BillingProduct) {
    const activeSubscription = summary?.subscription;

    return (
      product.kind === "subscription_plan" &&
      Boolean(activeSubscription) &&
      activeSubscription?.status === "active" &&
      !isCurrentSubscriptionProduct(product)
    );
  }

  function setCartProduct(product: BillingProduct, message?: string) {
    setIsCartUpdating(true);
    setActionMessage(null);
    window.localStorage.setItem(BILLING_CART_STORAGE_KEY, product.code);
    setCartProductCode(product.code);
    setActionMessage(message ?? `${product.name} is ready for checkout.`);
    window.setTimeout(() => setIsCartUpdating(false), 150);
  }

  function openCancellationDialog(product: BillingProduct) {
    setPendingSubscriptionChange({ product });
    setCancellationText("");
    setCancellationError(null);
    setActionMessage(null);
  }

  function closeCancellationDialog() {
    if (isCancellingSubscription) {
      return;
    }

    setPendingSubscriptionChange(null);
    setCancellationText("");
    setCancellationError(null);
  }

  function handleProductSelection(
    product: BillingProduct,
    intent: ProductSelectionIntent,
  ) {
    if (requiresSubscriptionCancellation(product)) {
      openCancellationDialog(product);
      return;
    }

    setCartProduct(product);

    if (intent === "buy_now") {
      navigate("/credits/checkout");
    }
  }

  function handleAddToCart(product: BillingProduct) {
    handleProductSelection(product, "add_to_cart");
  }

  function handleBuyNow(product: BillingProduct) {
    handleProductSelection(product, "buy_now");
  }

  function handleCheckoutSelectedProduct() {
    if (!selectedProduct) {
      return;
    }

    if (isCurrentSubscriptionProduct(selectedProduct)) {
      setActionMessage(`${selectedProduct.name} is already your current plan.`);
      return;
    }

    if (requiresSubscriptionCancellation(selectedProduct)) {
      openCancellationDialog(selectedProduct);
      return;
    }

    navigate("/credits/checkout");
  }

  async function handleConfirmCancellation() {
    if (!pendingSubscriptionChange || cancellationText !== "cancel") {
      return;
    }

    setIsCancellingSubscription(true);
    setCancellationError(null);

    try {
      await billingApi.cancelCurrentSubscription(cancellationText);
      await loadBillingData(false);
      setCartProduct(
        pendingSubscriptionChange.product,
        "Current plan cancelled. You can now continue with your new plan.",
      );
      setPendingSubscriptionChange(null);
      setCancellationText("");
    } catch (cancelError) {
      setCancellationError(getApiErrorMessage(cancelError));
    } finally {
      setIsCancellingSubscription(false);
    }
  }

  function clearCart() {
    window.localStorage.removeItem(BILLING_CART_STORAGE_KEY);
    setCartProductCode(null);
    setActionMessage(null);
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
                Plans and credit packs.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bac9cc] sm:text-base">
                Add one item to cart or buy now, then complete checkout with
                VietQR bank transfer. Access activates after admin verification.
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

          {actionMessage ? (
            <section className="rounded-lg border border-[#00e5ff]/25 bg-[#00e5ff]/10 p-4 text-sm text-[#c3f5ff]">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{actionMessage}</span>
              </div>
            </section>
          ) : null}

          {selectedProduct ? (
            <section className="rounded-lg border border-[#00e5ff]/25 bg-[#00e5ff]/10 p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00e5ff]">
                    One-item cart
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                    {selectedProduct.name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                    {formatCurrency(
                      selectedProduct.priceVnd,
                      selectedProduct.currency,
                    )}
                    {" · "}
                    {selectedProduct.kind === "subscription_plan"
                      ? "Monthly plan"
                      : `${selectedProduct.credits ?? 0} HD credits`}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                    type="button"
                    onClick={clearCart}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isCartUpdating}
                    type="button"
                    onClick={handleCheckoutSelectedProduct}
                  >
                    {isCartUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Checkout
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
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
                                Manual monthly plan
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
                          <ProductActions
                            disabled={isCurrent}
                            product={plan}
                            selectedProductCode={cartProductCode}
                            onAddToCart={handleAddToCart}
                            onBuyNow={handleBuyNow}
                          />
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
                          Adds {pack.credits ?? 0} credits after admin verifies
                          the VietQR transfer. Credit packs do not unlock export
                          by themselves.
                        </p>
                        <ProductActions
                          product={pack}
                          selectedProductCode={cartProductCode}
                          onAddToCart={handleAddToCart}
                          onBuyNow={handleBuyNow}
                        />
                      </article>
                    ))
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-white">
                      Pending verification
                    </h2>
                    <p className="mt-1 text-sm text-[#bac9cc]">
                      Resume a VietQR order or wait for admin mark-paid after
                      transfer.
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
                              Waiting for verification
                            </span>
                            <h3 className="mt-3 font-display text-xl font-semibold text-white">
                              {getOrderProductName(order)}
                            </h3>
                            <p className="mt-2 text-sm text-[#bac9cc]">
                              {formatCurrency(
                                order.totalAmount,
                                order.currency,
                              )}
                              {" · "}Expires {formatDateTime(order.expiresAt)}
                            </p>
                            {order.bankTransferContent ? (
                              <p className="mt-2 font-mono text-xs font-bold text-[#ffeac0]">
                                {order.bankTransferContent}
                              </p>
                            ) : null}
                          </div>
                          <button
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff]"
                            type="button"
                            onClick={() =>
                              navigate(`/credits/checkout/${order.id}`)
                            }
                          >
                            View checkout
                            <ArrowRight className="h-4 w-4" />
                          </button>
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
                      VietQR orders will appear here after checkout starts.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-[#3b494c] bg-[#1c1b1b]">
                    {orders.slice(0, 8).map((order) => (
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
                        {order.status === "pending" ? (
                          <button
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                            type="button"
                            onClick={() =>
                              navigate(`/credits/checkout/${order.id}`)
                            }
                          >
                            Resume checkout
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        ) : order.status === "paid" ? (
                          <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-[#9cf0ff]">
                            <CheckCircle2 className="h-4 w-4" />
                            Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-sm font-bold text-[#ffdad6]">
                            Payment not completed
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
      <SubscriptionCancelDialog
        confirmationText={cancellationText}
        currentPlanName={summary?.plan.name ?? "current plan"}
        error={cancellationError}
        isOpen={Boolean(pendingSubscriptionChange)}
        isSubmitting={isCancellingSubscription}
        selectedPlanName={pendingSubscriptionChange?.product.name ?? "new plan"}
        onClose={closeCancellationDialog}
        onConfirm={() => void handleConfirmCancellation()}
        onConfirmationChange={setCancellationText}
      />
    </DashboardShell>
  );
}
