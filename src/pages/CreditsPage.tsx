import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  type BillingProduct,
  type BillingSummary,
} from "../features/billing/billing.types";
import { getApiErrorMessage } from "../services/apiClient";
import { formatI18nCurrency } from "../i18n/formatters";
import { useI18n } from "../i18n/useI18n";

export const BILLING_CART_STORAGE_KEY = "3d-stylist.checkout.productCode";

type ProductSelectionIntent = "add_to_cart" | "buy_now";
type Translate = ReturnType<typeof useI18n>["t"];

interface PendingSubscriptionChange {
  product: BillingProduct;
}

function getPlanBenefit(product: BillingProduct, t: Translate) {
  if (product.planCode === "pro") {
    return t("credits.plan.benefit.pro");
  }

  if (product.planCode === "creator") {
    return t("credits.plan.benefit.creator");
  }

  return t("credits.plan.benefit.default");
}

function EmptyCatalogState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#3b494c] bg-[#1c1b1b] p-5 text-center lg:col-span-3">
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
  const { t } = useI18n();
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
        className="w-full max-w-lg rounded-lg border border-[#f3bf26]/30 bg-[#1c1b1b] p-5 text-[#e5e2e1] shadow-2xl shadow-black/35"
        ref={dialogRef}
        role="dialog"
        onKeyDown={trapFocus}
      >
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#f3bf26]/30 bg-[#f3bf26]/10 text-[#ffeac0]">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <button
            aria-label={t("credits.cancel.closeAria")}
            className="flex h-11 w-11 items-center justify-center rounded-md text-[#bac9cc] transition hover:bg-white/[0.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#f3bf26]">
          {t("credits.cancel.eyebrow")}
        </p>
        <h2
          className="mt-3 font-display text-2xl font-semibold text-white"
          id="subscription-cancel-title"
        >
          {t("credits.cancel.title")}
        </h2>
        <p
          className="mt-3 text-sm leading-6 text-[#bac9cc]"
          id="subscription-cancel-description"
        >
          {t("credits.cancel.description", {
            currentPlan: currentPlanName,
            selectedPlan: selectedPlanName,
          })}
        </p>

        <div className="mt-5 rounded-md border border-[#f3bf26]/30 bg-[#f3bf26]/10 p-4 text-sm leading-6 text-[#ffeac0]">
          {t("credits.cancel.warning")}
        </div>

        <label
          className="mt-5 block text-sm font-bold text-white"
          htmlFor="subscription-cancel-confirmation"
        >
          {t("credits.cancel.confirmLabel")}
        </label>
        <input
          aria-describedby={error ? "subscription-cancel-error" : undefined}
          aria-invalid={Boolean(error)}
          className="mt-2 h-12 w-full rounded-md border border-white/10 bg-[#0e0e0e] px-3 text-base text-white outline-none transition placeholder:text-[#849396] focus:border-[#00e5ff] focus:ring-4 focus:ring-[#00e5ff]/15 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          id="subscription-cancel-confirmation"
          placeholder={t("credits.cancel.placeholder")}
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
            {t("credits.cancel.keepCurrent")}
          </button>
          <button
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#ffb4ab] px-4 py-2.5 text-sm font-bold text-[#3a0909] transition hover:bg-[#ffdad6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffdad6] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canConfirm || isSubmitting}
            type="button"
            onClick={onConfirm}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("credits.cancel.confirm")}
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
  const { t } = useI18n();
  const isSelected = selectedProductCode === product.code;

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        type="button"
        onClick={() => onAddToCart(product)}
      >
        <ShoppingCart className="h-4 w-4" />
        {isSelected ? t("credits.actions.inCart") : t("credits.actions.addToCart")}
      </button>
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        type="button"
        onClick={() => onBuyNow(product)}
      >
        {t("credits.actions.buyNow")}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function CreditsPage() {
  const { language, t } = useI18n();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [cartProductCode, setCartProductCode] = useState<string | null>(() =>
    window.localStorage.getItem(BILLING_CART_STORAGE_KEY),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCartUpdating, setIsCartUpdating] = useState(false);
  const [checkoutStartingProductCode, setCheckoutStartingProductCode] =
    useState<string | null>(null);
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
      const [catalogResult, summaryResult] = await Promise.all([
        billingApi.getBillingCatalog(),
        billingApi.getBillingMe(),
      ]);

      setCatalog(catalogResult);
      setSummary(summaryResult);
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
    setActionMessage(
      message ?? t("credits.cart.ready", { product: product.name }),
    );
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

  async function startCheckoutForProduct(product: BillingProduct) {
    setCheckoutStartingProductCode(product.code);
    setError(null);
    setActionMessage(null);

    try {
      const checkout = await billingApi.createBillingCheckout(
        product.code,
        "buy_now",
      );

      window.localStorage.removeItem(BILLING_CART_STORAGE_KEY);
      setCartProductCode(null);
      navigate(`/credits/checkout/${checkout.order.id}`);
    } catch (checkoutError) {
      setError(getApiErrorMessage(checkoutError));
    } finally {
      setCheckoutStartingProductCode(null);
    }
  }

  function handleProductSelection(
    product: BillingProduct,
    intent: ProductSelectionIntent,
  ) {
    if (requiresSubscriptionCancellation(product)) {
      openCancellationDialog(product);
      return;
    }

    if (intent === "buy_now") {
      void startCheckoutForProduct(product);
      return;
    }

    setCartProduct(product);
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
      setActionMessage(
        t("credits.cart.currentPlan", { product: selectedProduct.name }),
      );
      return;
    }

    if (requiresSubscriptionCancellation(selectedProduct)) {
      openCancellationDialog(selectedProduct);
      return;
    }

    void startCheckoutForProduct(selectedProduct);
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
        t("credits.cart.currentPlanCancelled"),
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
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-[1200px] space-y-6">
          <header className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
                {t("credits.header.eyebrow")}
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                {t("credits.header.title")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bac9cc] sm:text-base">
                {t("credits.header.body")}
              </p>
            </div>

            <section className="grid grid-cols-2 divide-x divide-[#3b494c]/60 overflow-hidden rounded-lg border border-[#3b494c] bg-[#1c1b1b]">
              <div className="min-w-0 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#bac9cc]">
                  {t("credits.summary.currentPlan")}
                </p>
                <p className="mt-2 truncate font-display text-2xl font-semibold text-white">
                  {summary?.plan.name ?? t("credits.summary.free")}
                </p>
              </div>
              <div className="min-w-0 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#bac9cc]">
                  {t("credits.summary.credits")}
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
                      {t("credits.error.title")}
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
                  {t("common.retry")}
                </button>
              </div>
            </section>
          ) : null}

          {actionMessage ? (
            <section className="border-l-2 border-[#2cebcf]/45 py-2 pl-4 text-sm text-[#c9fff6]">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{actionMessage}</span>
              </div>
            </section>
          ) : null}

          {selectedProduct ? (
            <section className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-4">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#bac9cc]">
                    {t("credits.cart.eyebrow")}
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                    {selectedProduct.name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                    {formatI18nCurrency(
                      selectedProduct.priceVnd,
                      language,
                      selectedProduct.currency,
                    )}
                    {" · "}
                    {selectedProduct.kind === "subscription_plan"
                      ? t("credits.cart.monthlyPlan")
                      : t("credits.cart.hdCredits", {
                          count: selectedProduct.credits ?? 0,
                        })}
                  </p>
                  <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-[#849396]">
                    {t("credits.cart.checkoutNote")}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                    type="button"
                    onClick={clearCart}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("credits.cart.remove")}
                  </button>
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isCartUpdating || Boolean(checkoutStartingProductCode)}
                    type="button"
                    onClick={handleCheckoutSelectedProduct}
                  >
                    {isCartUpdating || checkoutStartingProductCode === selectedProduct.code ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {t("credits.cart.checkout")}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          <section className="border-y border-[#3b494c]/60 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-[#bac9cc]">
                  <CreditCard className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-white">
                    {t("credits.paymentsLink.title")}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[#bac9cc]">
                    {t("credits.paymentsLink.body")}
                  </p>
                </div>
              </div>
              <Link
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                to="/payments"
              >
                {t("credits.paymentsLink.action")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

          {isLoading ? (
            <div className="grid gap-5 lg:grid-cols-3">
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
                  <ShieldCheck className="h-5 w-5 text-[#bac9cc]" />
                  <h2 className="font-display text-2xl font-semibold text-white">
                    {t("credits.plans.title")}
                  </h2>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {plans.length === 0 ? (
                      <EmptyCatalogState
                      title={t("credits.plans.emptyTitle")}
                      body={t("credits.plans.emptyBody")}
                    />
                  ) : (
                    plans.map((plan) => {
                      const isCurrent =
                        summary?.plan.status === "active" &&
                        summary.plan.code === plan.planCode;

                      return (
                        <article
                          className="credits-product-card p-5"
                          key={plan.code}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-display text-2xl font-semibold text-white">
                                {plan.name}
                              </h3>
                              <p className="mt-1 text-sm text-[#bac9cc]">
                                {t("credits.plans.manualMonthly")}
                              </p>
                            </div>
                            {isCurrent ? (
                              <span className="rounded-md border border-[#00e5ff]/25 bg-[#00e5ff]/10 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#9cf0ff]">
                                {t("credits.plans.current")}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-5 font-display text-3xl font-semibold text-white">
                            {formatI18nCurrency(
                              plan.priceVnd,
                              language,
                              plan.currency,
                            )}
                            <span className="ml-2 text-sm font-semibold text-[#bac9cc]">
                              {t("credits.plans.cadence")}
                            </span>
                          </p>
                          <ul className="mt-4 space-y-2.5 text-sm text-[#bac9cc]">
                            <li className="flex gap-2">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#849396]" />
                              {t("credits.plan.includedGenerations", {
                                count: plan.credits ?? 0,
                              })}
                            </li>
                            <li className="flex gap-2">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#849396]" />
                              {t("credits.plan.export")}
                            </li>
                            <li className="flex gap-2">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#849396]" />
                              {getPlanBenefit(plan, t)}
                            </li>
                          </ul>
                          <ProductActions
                            disabled={
                              isCurrent || Boolean(checkoutStartingProductCode)
                            }
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
                  <Database className="h-5 w-5 text-[#bac9cc]" />
                  <h2 className="font-display text-2xl font-semibold text-white">
                    {t("credits.packs.title")}
                  </h2>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {creditPacks.length === 0 ? (
                      <EmptyCatalogState
                      title={t("credits.packs.emptyTitle")}
                      body={t("credits.packs.emptyBody")}
                    />
                  ) : (
                    creditPacks.map((pack) => (
                      <article
                        className="credits-product-card p-5"
                        key={pack.code}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-display text-2xl font-semibold text-white">
                              {pack.name}
                            </h3>
                            <p className="mt-1 text-sm text-[#bac9cc]">
                              {t("credits.packs.rule")}
                            </p>
                          </div>
                          <WalletCards className="h-5 w-5 text-[#849396]" />
                        </div>
                        <p className="mt-5 font-display text-3xl font-semibold text-white">
                          {formatI18nCurrency(
                            pack.priceVnd,
                            language,
                            pack.currency,
                          )}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-[#bac9cc]">
                          {t("credits.packs.body", {
                            count: pack.credits ?? 0,
                          })}
                        </p>
                        <ProductActions
                          disabled={Boolean(checkoutStartingProductCode)}
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

            </>
          )}
        </div>
      </main>
      <SubscriptionCancelDialog
        confirmationText={cancellationText}
        currentPlanName={summary?.plan.name ?? t("credits.cancel.currentPlanFallback")}
        error={cancellationError}
        isOpen={Boolean(pendingSubscriptionChange)}
        isSubmitting={isCancellingSubscription}
        selectedPlanName={
          pendingSubscriptionChange?.product.name ??
          t("credits.cancel.newPlanFallback")
        }
        onClose={closeCancellationDialog}
        onConfirm={() => void handleConfirmCancellation()}
        onConfirmationChange={setCancellationText}
      />
    </DashboardShell>
  );
}
