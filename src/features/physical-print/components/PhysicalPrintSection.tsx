import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  Box,
  Check,
  Clock3,
  Loader2,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import type { FigureStatus } from "../../figures/figures.types";
import { formatI18nCurrency } from "../../../i18n/formatters";
import { useI18n } from "../../../i18n/useI18n";
import { getApiErrorMessage } from "../../../services/apiClient";
import { physicalPrintApi } from "../physical-print.api";
import type {
  CreatePhysicalPrintOrderPayload,
  PhysicalPrintOrder,
  PhysicalPrintPackage,
  PhysicalPrintPackageCode,
} from "../physical-print.types";

type PhysicalPrintSectionProps = {
  selectedFigureId: string;
  selectedFigureStatus: FigureStatus;
  modelAssetReady: boolean;
  selectedFigurePrompt?: string | null;
};

type ShippingField =
  | "shippingName"
  | "shippingPhone"
  | "shippingAddress";

type ShippingErrors = Partial<Record<ShippingField, string>>;

type ActionState =
  | "idle"
  | "creating-order"
  | "creating-checkout"
  | "redirecting";

const EMPTY_SHIPPING_FORM = {
  shippingName: "",
  shippingPhone: "",
  shippingAddress: "",
  customerNote: "",
};

function getPromptSnippet(prompt: string | null | undefined) {
  const value = prompt?.trim();

  if (!value) {
    return null;
  }

  return value.length > 110 ? `${value.slice(0, 110)}...` : value;
}

export function PhysicalPrintSection({
  selectedFigureId,
  selectedFigureStatus,
  modelAssetReady,
  selectedFigurePrompt,
}: PhysicalPrintSectionProps) {
  const { language, t } = useI18n();
  const isEligible =
    selectedFigureStatus === "success" && modelAssetReady === true;
  const activeFigureIdRef = useRef(selectedFigureId);
  const packageRequestIdRef = useRef(0);
  const actionRequestIdRef = useRef(0);
  const [packages, setPackages] = useState<PhysicalPrintPackage[]>([]);
  const [isPackagesLoading, setIsPackagesLoading] = useState(false);
  const [packageError, setPackageError] = useState<string | null>(null);
  const [selectedPackageCode, setSelectedPackageCode] =
    useState<PhysicalPrintPackageCode | null>(null);
  const [shippingForm, setShippingForm] = useState(EMPTY_SHIPPING_FORM);
  const [shippingErrors, setShippingErrors] = useState<ShippingErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] =
    useState<PhysicalPrintOrder | null>(null);
  const [actionState, setActionState] = useState<ActionState>("idle");

  activeFigureIdRef.current = selectedFigureId;

  const selectedPackage = useMemo(
    () =>
      packages.find((item) => item.code === selectedPackageCode) ?? null,
    [packages, selectedPackageCode],
  );
  const promptSnippet = getPromptSnippet(selectedFigurePrompt);
  const isActionPending = actionState !== "idle";

  const loadPackages = useCallback(async () => {
    if (!isEligible) {
      return;
    }

    const requestFigureId = selectedFigureId;
    const requestId = ++packageRequestIdRef.current;

    setIsPackagesLoading(true);
    setPackageError(null);

    try {
      const result = await physicalPrintApi.getPhysicalPrintPackages();

      if (
        activeFigureIdRef.current !== requestFigureId ||
        packageRequestIdRef.current !== requestId
      ) {
        return;
      }

      setPackages(result);
    } catch {
      if (
        activeFigureIdRef.current === requestFigureId &&
        packageRequestIdRef.current === requestId
      ) {
        setPackageError(t("physicalPrint.packages.error"));
      }
    } finally {
      if (
        activeFigureIdRef.current === requestFigureId &&
        packageRequestIdRef.current === requestId
      ) {
        setIsPackagesLoading(false);
      }
    }
  }, [isEligible, selectedFigureId, t]);

  useEffect(() => {
    packageRequestIdRef.current += 1;
    actionRequestIdRef.current += 1;
    setSelectedPackageCode(null);
    setShippingForm(EMPTY_SHIPPING_FORM);
    setShippingErrors({});
    setFormError(null);
    setPackageError(null);
    setOrderError(null);
    setCheckoutError(null);
    setCreatedOrder(null);
    setActionState("idle");
    setIsPackagesLoading(false);
  }, [selectedFigureId]);

  useEffect(() => {
    if (isEligible && packages.length === 0) {
      void loadPackages();
    }
  }, [isEligible, loadPackages, packages.length]);

  function setShippingValue(
    field: keyof typeof EMPTY_SHIPPING_FORM,
    value: string,
  ) {
    setShippingForm((current) => ({ ...current, [field]: value }));

    if (field !== "customerNote" && shippingErrors[field]) {
      setShippingErrors((current) => ({ ...current, [field]: undefined }));
    }

    setFormError(null);
    setOrderError(null);
  }

  function validateShippingForm(): ShippingErrors {
    const nextErrors: ShippingErrors = {};
    const shippingName = shippingForm.shippingName.trim();
    const shippingPhone = shippingForm.shippingPhone.trim();
    const shippingAddress = shippingForm.shippingAddress.trim();

    if (!shippingName) {
      nextErrors.shippingName = t("physicalPrint.validation.name");
    }

    if (!shippingPhone) {
      nextErrors.shippingPhone = t("physicalPrint.validation.phone");
    } else {
      const digitCount = shippingPhone.replace(/\D/g, "").length;
      const hasValidCharacters = /^[+\d][\d\s().-]*$/.test(shippingPhone);

      if (!hasValidCharacters || digitCount < 8 || digitCount > 15) {
        nextErrors.shippingPhone = t(
          "physicalPrint.validation.phoneInvalid",
        );
      }
    }

    if (!shippingAddress) {
      nextErrors.shippingAddress = t("physicalPrint.validation.address");
    }

    return nextErrors;
  }

  async function redirectToCheckout(
    order: PhysicalPrintOrder,
    requestFigureId: string,
    requestId: number,
  ) {
    setActionState("creating-checkout");
    setCheckoutError(null);

    try {
      const result =
        await physicalPrintApi.createPhysicalPrintPayosCheckout(order.id);

      if (
        activeFigureIdRef.current !== requestFigureId ||
        actionRequestIdRef.current !== requestId
      ) {
        return;
      }

      const checkoutUrl = result.payment.checkoutUrl?.trim();

      if (!checkoutUrl) {
        setCheckoutError(t("physicalPrint.errors.missingCheckoutUrl"));
        setActionState("idle");
        return;
      }

      setCreatedOrder(result.order);
      setActionState("redirecting");
      window.location.assign(checkoutUrl);
    } catch (checkoutFailure) {
      if (
        activeFigureIdRef.current === requestFigureId &&
        actionRequestIdRef.current === requestId
      ) {
        setCheckoutError(
          `${t("physicalPrint.errors.checkoutCreation")} ${getApiErrorMessage(checkoutFailure)}`,
        );
        setActionState("idle");
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPackageCode || createdOrder || isActionPending) {
      return;
    }

    const nextErrors = validateShippingForm();

    if (Object.keys(nextErrors).length > 0) {
      setShippingErrors(nextErrors);
      setFormError(t("physicalPrint.validation.banner"));
      return;
    }

    const requestFigureId = selectedFigureId;
    const requestId = ++actionRequestIdRef.current;
    const payload: CreatePhysicalPrintOrderPayload = {
      figureId: selectedFigureId,
      packageCode: selectedPackageCode,
      shippingName: shippingForm.shippingName.trim(),
      shippingPhone: shippingForm.shippingPhone.trim(),
      shippingAddress: shippingForm.shippingAddress.trim(),
      ...(shippingForm.customerNote.trim()
        ? { customerNote: shippingForm.customerNote.trim() }
        : {}),
    };

    setShippingErrors({});
    setFormError(null);
    setOrderError(null);
    setCheckoutError(null);
    setActionState("creating-order");

    try {
      const order = await physicalPrintApi.createPhysicalPrintOrder(payload);

      if (
        activeFigureIdRef.current !== requestFigureId ||
        actionRequestIdRef.current !== requestId
      ) {
        return;
      }

      setCreatedOrder(order);
      await redirectToCheckout(order, requestFigureId, requestId);
    } catch {
      if (
        activeFigureIdRef.current === requestFigureId &&
        actionRequestIdRef.current === requestId
      ) {
        setOrderError(t("physicalPrint.errors.orderCreation"));
        setActionState("idle");
      }
    }
  }

  function handleRetryCheckout() {
    if (!createdOrder || isActionPending) {
      return;
    }

    const requestId = ++actionRequestIdRef.current;
    void redirectToCheckout(createdOrder, selectedFigureId, requestId);
  }

  if (!isEligible) {
    return (
      <section
        aria-labelledby="physical-print-unavailable-title"
        className="rounded-lg border border-[#3b494c]/55 bg-[#101417]/94 p-4 shadow-[0_18px_42px_rgba(0,0,0,0.16)] sm:p-5"
      >
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.035] text-[#849396]">
            <Box className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2
              className="font-display text-lg font-semibold text-[#e5e2e1]"
              id="physical-print-unavailable-title"
            >
              {t("physicalPrint.unavailable.title")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#9aa8aa]">
              {t("physicalPrint.unavailable.body")}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="physical-print-title"
      className="min-w-0 overflow-hidden rounded-lg border border-[#3b494c]/60 bg-[#101417]/96 shadow-[0_22px_60px_rgba(0,0,0,0.2)]"
    >
      <header className="border-b border-[#3b494c]/45 bg-[#121719]/80 px-4 py-5 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#00e5ff]">
              {t("physicalPrint.eyebrow")}
            </p>
            <h2
              className="mt-2 font-display text-2xl font-semibold text-white"
              id="physical-print-title"
              tabIndex={-1}
            >
              {t("physicalPrint.title")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#bac9cc]">
              {t("physicalPrint.subtitle")}
            </p>
            {promptSnippet ? (
              <p className="mt-3 max-w-3xl truncate text-xs text-[#849396]">
                <span className="font-bold uppercase tracking-[0.1em] text-[#9cf0ff]">
                  {t("physicalPrint.selectedDesign")}:
                </span>{" "}
                {promptSnippet}
              </p>
            ) : null}
          </div>
          <span className="inline-flex min-h-8 shrink-0 items-center gap-2 self-start rounded-md border border-[#2cebcf]/25 bg-[#2cebcf]/10 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[#c9fff6]">
            <Check className="h-3.5 w-3.5" />
            {t("physicalPrint.modelReady")}
          </span>
        </div>
      </header>

      <div className="space-y-5 p-4 sm:p-5">
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-display text-xl font-semibold text-white">
                {t("physicalPrint.packages.title")}
              </h3>
              <p className="mt-1 text-sm text-[#9aa8aa]">
                {t("physicalPrint.packages.body")}
              </p>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#849396]">
              {t("physicalPrint.packages.select")}
            </p>
          </div>

          {packageError ? (
            <div
              className="mt-4 flex flex-col gap-3 rounded-md border border-[#ffb4ab]/30 bg-[#93000a]/20 p-3 text-[#ffdad6] sm:flex-row sm:items-center sm:justify-between"
              role="alert"
            >
              <span className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {packageError}
              </span>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#ffb4ab]/35 px-3 py-2 text-xs font-bold transition hover:bg-[#ffb4ab]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffb4ab]"
                type="button"
                onClick={() => void loadPackages()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("physicalPrint.packages.retry")}
              </button>
            </div>
          ) : null}

          {isPackagesLoading ? (
            <div
              aria-live="polite"
              className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
              role="status"
            >
              {[0, 1, 2].map((item) => (
                <div
                  className="min-h-56 animate-pulse rounded-lg border border-white/10 bg-white/[0.035]"
                  key={item}
                />
              ))}
              <span className="sr-only">
                {t("physicalPrint.packages.loading")}
              </span>
            </div>
          ) : packages.length > 0 ? (
            <div
              aria-label={t("physicalPrint.packages.select")}
              className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
              role="radiogroup"
            >
              {packages.map((item) => {
                const isSelected = item.code === selectedPackageCode;

                return (
                  <button
                    aria-checked={isSelected}
                    className={`group min-h-56 min-w-0 rounded-lg border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] ${
                      isSelected
                        ? "border-[#00e5ff]/70 bg-[#00e5ff]/10 shadow-[0_0_0_1px_rgba(0,229,255,0.14)]"
                        : "border-[#3b494c]/55 bg-[#0b1012]/78 hover:border-[#00e5ff]/35 hover:bg-[#11181a]"
                    }`}
                    disabled={Boolean(createdOrder)}
                    key={item.code}
                    role="radio"
                    type="button"
                    onClick={() => {
                      setSelectedPackageCode(item.code);
                      setFormError(null);
                      setOrderError(null);
                      setCheckoutError(null);
                    }}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-display text-lg font-semibold text-white">
                          {item.name}
                        </span>
                        <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[#9cf0ff]">
                          {item.estimatedSizeLabel}
                        </span>
                      </span>
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                          isSelected
                            ? "border-[#00e5ff] bg-[#00e5ff] text-[#001f24]"
                            : "border-[#3b494c] text-transparent group-hover:border-[#00e5ff]/50"
                        }`}
                      >
                        <Check className="h-4 w-4" />
                      </span>
                    </span>

                    <span className="mt-5 grid gap-2 text-sm text-[#bac9cc]">
                      <span className="flex items-center gap-2">
                        <PackageCheck className="h-4 w-4 shrink-0 text-[#00e5ff]" />
                        {item.qualityLabel}
                      </span>
                      <span className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 shrink-0 text-[#f3bf26]" />
                        {item.productionTimeLabel}
                      </span>
                    </span>

                    <span className="mt-5 block border-t border-white/10 pt-4">
                      <span className="flex justify-between gap-3 text-xs text-[#849396]">
                        <span>{t("physicalPrint.basePrice")}</span>
                        <span>
                          {formatI18nCurrency(
                            item.basePriceVnd,
                            language,
                            item.currency,
                          )}
                        </span>
                      </span>
                      <span className="mt-1 flex justify-between gap-3 text-xs text-[#849396]">
                        <span>{t("physicalPrint.handlingFee")}</span>
                        <span>
                          {formatI18nCurrency(
                            item.handlingFeeVnd,
                            language,
                            item.currency,
                          )}
                        </span>
                      </span>
                      <span className="mt-3 flex items-end justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-[0.1em] text-[#9aa8aa]">
                          {t("physicalPrint.finalPrice")}
                        </span>
                        <span className="text-xl font-bold text-[#9cf0ff]">
                          {formatI18nCurrency(
                            item.finalPriceVnd,
                            language,
                            item.currency,
                          )}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {selectedPackage ? (
          <form className="space-y-5" noValidate onSubmit={handleSubmit}>
            <div className="grid min-w-0 gap-5 border-t border-[#3b494c]/45 pt-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#00e5ff]/20 bg-[#00e5ff]/10 text-[#9cf0ff]">
                    <Truck className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-semibold text-white">
                      {t("physicalPrint.shipping.title")}
                    </h3>
                    <p className="mt-0.5 text-sm text-[#9aa8aa]">
                      {t("physicalPrint.shipping.body")}
                    </p>
                  </div>
                </div>

                {formError ? (
                  <div
                    className="mt-4 flex items-start gap-2 rounded-md border border-[#ffb4ab]/30 bg-[#93000a]/20 p-3 text-sm text-[#ffdad6]"
                    role="alert"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {formError}
                  </div>
                ) : null}

                <fieldset
                  className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2"
                  disabled={Boolean(createdOrder) || isActionPending}
                >
                  <div className="min-w-0">
                    <label
                      className="text-sm font-semibold text-[#e5e2e1]"
                      htmlFor="physical-print-shipping-name"
                    >
                      {t("physicalPrint.shipping.name")}
                    </label>
                    <input
                      aria-describedby={
                        shippingErrors.shippingName
                          ? "physical-print-shipping-name-error"
                          : undefined
                      }
                      aria-invalid={Boolean(shippingErrors.shippingName)}
                      autoComplete="name"
                      className={`mt-2 h-12 w-full rounded-md border bg-[#0b1012] px-3 text-base text-white outline-none transition placeholder:text-[#657376] focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
                        shippingErrors.shippingName
                          ? "border-[#ffb4ab] focus:border-[#ffb4ab] focus:ring-[#ffb4ab]/10"
                          : "border-[#3b494c] focus:border-[#00e5ff] focus:ring-[#00e5ff]/10"
                      }`}
                      id="physical-print-shipping-name"
                      maxLength={120}
                      placeholder={t(
                        "physicalPrint.shipping.namePlaceholder",
                      )}
                      type="text"
                      value={shippingForm.shippingName}
                      onChange={(event) =>
                        setShippingValue("shippingName", event.target.value)
                      }
                    />
                    {shippingErrors.shippingName ? (
                      <p
                        className="mt-2 text-sm text-[#ffb4ab]"
                        id="physical-print-shipping-name-error"
                      >
                        {shippingErrors.shippingName}
                      </p>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <label
                      className="text-sm font-semibold text-[#e5e2e1]"
                      htmlFor="physical-print-shipping-phone"
                    >
                      {t("physicalPrint.shipping.phone")}
                    </label>
                    <input
                      aria-describedby={
                        shippingErrors.shippingPhone
                          ? "physical-print-shipping-phone-error"
                          : undefined
                      }
                      aria-invalid={Boolean(shippingErrors.shippingPhone)}
                      autoComplete="tel"
                      className={`mt-2 h-12 w-full rounded-md border bg-[#0b1012] px-3 text-base text-white outline-none transition placeholder:text-[#657376] focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
                        shippingErrors.shippingPhone
                          ? "border-[#ffb4ab] focus:border-[#ffb4ab] focus:ring-[#ffb4ab]/10"
                          : "border-[#3b494c] focus:border-[#00e5ff] focus:ring-[#00e5ff]/10"
                      }`}
                      id="physical-print-shipping-phone"
                      inputMode="tel"
                      maxLength={30}
                      placeholder={t(
                        "physicalPrint.shipping.phonePlaceholder",
                      )}
                      type="tel"
                      value={shippingForm.shippingPhone}
                      onChange={(event) =>
                        setShippingValue("shippingPhone", event.target.value)
                      }
                    />
                    {shippingErrors.shippingPhone ? (
                      <p
                        className="mt-2 text-sm text-[#ffb4ab]"
                        id="physical-print-shipping-phone-error"
                      >
                        {shippingErrors.shippingPhone}
                      </p>
                    ) : null}
                  </div>

                  <div className="min-w-0 sm:col-span-2">
                    <label
                      className="text-sm font-semibold text-[#e5e2e1]"
                      htmlFor="physical-print-shipping-address"
                    >
                      {t("physicalPrint.shipping.address")}
                    </label>
                    <textarea
                      aria-describedby={
                        shippingErrors.shippingAddress
                          ? "physical-print-shipping-address-error"
                          : undefined
                      }
                      aria-invalid={Boolean(shippingErrors.shippingAddress)}
                      autoComplete="street-address"
                      className={`mt-2 min-h-28 w-full resize-y rounded-md border bg-[#0b1012] px-3 py-3 text-base text-white outline-none transition placeholder:text-[#657376] focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
                        shippingErrors.shippingAddress
                          ? "border-[#ffb4ab] focus:border-[#ffb4ab] focus:ring-[#ffb4ab]/10"
                          : "border-[#3b494c] focus:border-[#00e5ff] focus:ring-[#00e5ff]/10"
                      }`}
                      id="physical-print-shipping-address"
                      maxLength={500}
                      placeholder={t(
                        "physicalPrint.shipping.addressPlaceholder",
                      )}
                      value={shippingForm.shippingAddress}
                      onChange={(event) =>
                        setShippingValue("shippingAddress", event.target.value)
                      }
                    />
                    {shippingErrors.shippingAddress ? (
                      <p
                        className="mt-2 text-sm text-[#ffb4ab]"
                        id="physical-print-shipping-address-error"
                      >
                        {shippingErrors.shippingAddress}
                      </p>
                    ) : null}
                  </div>

                  <div className="min-w-0 sm:col-span-2">
                    <label
                      className="text-sm font-semibold text-[#e5e2e1]"
                      htmlFor="physical-print-customer-note"
                    >
                      {t("physicalPrint.shipping.note")}{" "}
                      <span className="font-normal text-[#849396]">
                        ({t("physicalPrint.shipping.optional")})
                      </span>
                    </label>
                    <textarea
                      className="mt-2 min-h-24 w-full resize-y rounded-md border border-[#3b494c] bg-[#0b1012] px-3 py-3 text-base text-white outline-none transition placeholder:text-[#657376] focus:border-[#00e5ff] focus:ring-4 focus:ring-[#00e5ff]/10 disabled:cursor-not-allowed disabled:opacity-60"
                      id="physical-print-customer-note"
                      maxLength={500}
                      placeholder={t(
                        "physicalPrint.shipping.notePlaceholder",
                      )}
                      value={shippingForm.customerNote}
                      onChange={(event) =>
                        setShippingValue("customerNote", event.target.value)
                      }
                    />
                  </div>
                </fieldset>
              </div>

              <aside className="min-w-0 rounded-lg border border-[#3b494c]/55 bg-[#0b1012]/82 p-4">
                <h3 className="font-display text-lg font-semibold text-white">
                  {t("physicalPrint.summary.title")}
                </h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                    <dt className="text-[#849396]">
                      {t("physicalPrint.summary.package")}
                    </dt>
                    <dd className="text-right font-semibold text-white">
                      {selectedPackage.name}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#849396]">
                      {t("physicalPrint.estimatedSize")}
                    </dt>
                    <dd className="text-right text-[#bac9cc]">
                      {selectedPackage.estimatedSizeLabel}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#849396]">
                      {t("physicalPrint.productionTime")}
                    </dt>
                    <dd className="text-right text-[#bac9cc]">
                      {selectedPackage.productionTimeLabel}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-white/10 pt-3">
                    <dt className="text-[#849396]">
                      {t("physicalPrint.basePrice")}
                    </dt>
                    <dd className="text-right text-[#bac9cc]">
                      {formatI18nCurrency(
                        selectedPackage.basePriceVnd,
                        language,
                        selectedPackage.currency,
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#849396]">
                      {t("physicalPrint.handlingFee")}
                    </dt>
                    <dd className="text-right text-[#bac9cc]">
                      {formatI18nCurrency(
                        selectedPackage.handlingFeeVnd,
                        language,
                        selectedPackage.currency,
                      )}
                    </dd>
                  </div>
                  <div className="flex items-end justify-between gap-4 border-t border-[#00e5ff]/20 pt-4">
                    <dt className="font-bold uppercase tracking-[0.1em] text-[#9cf0ff]">
                      {t("physicalPrint.total")}
                    </dt>
                    <dd className="text-right text-2xl font-bold text-white">
                      {formatI18nCurrency(
                        selectedPackage.finalPriceVnd,
                        language,
                        selectedPackage.currency,
                      )}
                    </dd>
                  </div>
                </dl>

                {orderError ? (
                  <div
                    className="mt-4 flex items-start gap-2 rounded-md border border-[#ffb4ab]/30 bg-[#93000a]/20 p-3 text-sm text-[#ffdad6]"
                    role="alert"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {orderError}
                  </div>
                ) : null}

                {checkoutError ? (
                  <div
                    className="mt-4 flex items-start gap-2 rounded-md border border-[#ffb4ab]/30 bg-[#93000a]/20 p-3 text-sm text-[#ffdad6]"
                    role="alert"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {checkoutError}
                  </div>
                ) : null}

                {createdOrder && checkoutError ? (
                  <p className="mt-3 break-all text-xs text-[#849396]">
                    {t("physicalPrint.pendingOrder")}: {createdOrder.id}
                  </p>
                ) : null}

                {createdOrder && checkoutError ? (
                  <button
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-3 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff] disabled:cursor-wait disabled:opacity-65"
                    disabled={isActionPending}
                    type="button"
                    onClick={handleRetryCheckout}
                  >
                    {isActionPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {isActionPending
                      ? t("physicalPrint.redirecting")
                      : t("physicalPrint.retryCheckout")}
                  </button>
                ) : (
                  <button
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-3 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-65"
                    disabled={isActionPending || Boolean(createdOrder)}
                    type="submit"
                  >
                    {isActionPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PackageCheck className="h-4 w-4" />
                    )}
                    {actionState === "creating-order"
                      ? t("physicalPrint.creatingOrder")
                      : actionState === "creating-checkout" ||
                          actionState === "redirecting"
                        ? t("physicalPrint.redirecting")
                        : t("physicalPrint.orderPrint")}
                  </button>
                )}

                <div className="mt-4 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-[#849396]">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#9cf0ff]" />
                  <p>{t("physicalPrint.paymentNote")}</p>
                </div>
              </aside>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}
