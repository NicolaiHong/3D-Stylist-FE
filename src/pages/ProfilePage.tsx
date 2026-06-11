import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Calendar,
  Camera,
  CheckCircle2,
  CreditCard,
  ImagePlus,
  Loader2,
  Mail,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { useAuthStore } from "../features/auth/auth.store";
import { AUTH_ROLES } from "../features/auth/auth.types";
import { billingApi } from "../features/billing/billing.api";
import type { BillingSummary } from "../features/billing/billing.types";
import { profileApi } from "../features/profile/profile.api";
import { getApiErrorMessage } from "../services/apiClient";
import { getKnownDisplayLabel } from "../i18n/displayMaps";
import { formatI18nDate } from "../i18n/formatters";
import { useI18n } from "../i18n/useI18n";
import type { Language } from "../i18n/types";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SELFIE_SIZE_BYTES = 5 * 1024 * 1024;

type Translate = ReturnType<typeof useI18n>["t"];

function formatFileSize(value: number, language: Language) {
  const locale = language === "vi" ? "vi-VN" : "en-US";
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value / 1024 / 1024)} MB`;
}

function getInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "ST";
  }

  return parts.map((part) => part[0]?.toUpperCase()).join("");
}

function validateSelfieFile(file: File, t: Translate): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return t("profile.validation.unsupportedType");
  }

  if (file.size > MAX_SELFIE_SIZE_BYTES) {
    return t("profile.validation.fileTooLarge");
  }

  return null;
}

function MessageBanner({
  message,
  tone,
}: {
  message: string;
  tone: "error" | "success";
}) {
  const isError = tone === "error";
  const Icon = isError ? AlertTriangle : CheckCircle2;

  return (
    <div
      className={`flex gap-3 rounded-lg border p-4 text-sm ${
        isError
          ? "border-[#ffb4ab]/30 bg-[#93000a]/24 text-[#ffdad6]"
          : "border-[#00e5ff]/25 bg-[#00e5ff]/10 text-[#c3f5ff]"
      }`}
      role={isError ? "alert" : "status"}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function ProfilePage() {
  const { language, t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const displayName = user?.displayName || user?.fullName || "";
  const fallbackName = displayName || user?.email || t("profile.fallbackName");
  const [nameValue, setNameValue] = useState(displayName);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [billingSummary, setBillingSummary] =
    useState<BillingSummary | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isBillingLoading, setIsBillingLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const loadBillingSummary = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsBillingLoading(true);
    }
    setBillingError(null);

    try {
      const summary = await billingApi.getBillingMe();
      setBillingSummary(summary);
    } catch (error) {
      setBillingError(getApiErrorMessage(error));
    } finally {
      if (showLoading) {
        setIsBillingLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    setNameValue(displayName);
  }, [displayName]);

  useEffect(() => {
    void loadBillingSummary();
  }, [loadBillingSummary]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const activePreviewUrl = previewUrl ?? user?.avatarUrl ?? null;
  const hasSelectedFile = Boolean(selectedFile);
  const hasSavedAvatar = Boolean(user?.avatarUrl);
  const hasProfileChanges = nameValue.trim() !== displayName;
  const isAdmin = user?.role === AUTH_ROLES.ADMIN;
  const planName = billingSummary?.plan.name ?? t("credits.summary.free");
  const planStatus =
    billingSummary?.subscription?.status ?? billingSummary?.plan.status ?? null;
  const creditsBalance = billingSummary?.credits.balance ?? 0;
  const billingStatusLabel = isBillingLoading
    ? t("common.loading")
    : billingError
      ? t("common.unavailable")
      : planStatus
        ? getKnownDisplayLabel(planStatus, language)
        : t("credits.summary.free");

  function selectFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const validationError = validateSelfieFile(file, t);
    setSuccessMessage(null);

    if (validationError) {
      setSelectedFile(null);
      setUploadError(validationError);
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = nameValue.trim();
    setProfileError(null);
    setSuccessMessage(null);

    if (!trimmedName) {
      setProfileError(t("profile.validation.displayNameRequired"));
      return;
    }

    setIsSavingProfile(true);

    try {
      await profileApi.updateDisplayName(trimmedName);
      await refreshUser();
      setSuccessMessage(t("profile.success.profileUpdated"));
    } catch (error) {
      setProfileError(getApiErrorMessage(error));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleUploadSubmit() {
    if (!selectedFile) {
      setUploadError(t("profile.validation.chooseImage"));
      return;
    }

    setUploadError(null);
    setSuccessMessage(null);
    setIsUploading(true);

    try {
      await profileApi.uploadSelfie(selectedFile);
      await refreshUser();
      setSelectedFile(null);
      setSuccessMessage(t("profile.success.selfieUploaded"));
    } catch (error) {
      setUploadError(
        getApiErrorMessage(error) || t("profile.error.uploadFailed"),
      );
    } finally {
      setIsUploading(false);
    }
  }

  if (!user) {
    return (
      <DashboardShell>
        <main className="min-h-screen px-4 py-6 text-[#e5e2e1] sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto flex min-h-[420px] w-full max-w-[1160px] items-center justify-center rounded-lg border border-[#3b494c] bg-[#1c1b1b]">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#00e5ff]" />
              <p className="mt-4 text-sm font-bold text-white">
                {t("profile.loading")}
              </p>
            </div>
          </div>
        </main>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell planLabel={billingSummary?.plan.name}>
      <main className="min-h-screen px-4 py-6 text-[#e5e2e1] sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-[1180px] space-y-6">
          <section className="overflow-hidden rounded-lg border border-[#3b494c] bg-[#1c1b1b]">
            <div className="grid gap-5 p-5 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-6 lg:p-6">
              <div className="mx-auto w-full max-w-[180px] lg:mx-0">
                <div className="relative aspect-square rounded-lg border border-white/10 bg-[#0e0e0e] p-1">
                  {activePreviewUrl ? (
                    <img
                      alt={t("profile.avatarAlt", { name: fallbackName })}
                      className="h-full w-full rounded-md object-cover"
                      src={activePreviewUrl}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-md border border-dashed border-[#3b494c] bg-[#131313] text-center">
                      <span className="font-display text-3xl font-semibold text-[#9cf0ff]">
                        {getInitials(fallbackName)}
                      </span>
                      <span className="mt-2 max-w-[110px] text-xs font-semibold leading-5 text-[#bac9cc]">
                        {t("profile.noSelfieUploaded")}
                      </span>
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-md border border-[#3b494c] bg-[#1c1b1b] text-[#9cf0ff]">
                    {activePreviewUrl ? (
                      <BadgeCheck className="h-4 w-4" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </span>
                </div>
                <p className="mt-3 text-center text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                  {hasSelectedFile
                    ? t("profile.previewSelected")
                    : hasSavedAvatar
                      ? t("profile.selfieActive")
                      : t("profile.awaitingUpload")}
                </p>
              </div>

              <div className="flex min-w-0 flex-col justify-center text-center lg:text-left">
                <div className="flex flex-col items-center gap-3 lg:flex-row lg:items-start">
                  <h1 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                    {fallbackName}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#bac9cc]">
                    {isAdmin ? (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {isAdmin
                      ? t("display.role.admin")
                      : isBillingLoading
                        ? t("profile.planLoading")
                        : billingError
                          ? t("profile.billingUnavailable")
                          : planName}
                  </span>
                </div>

                <p className="mt-3 break-all text-sm font-semibold text-[#bac9cc]">
                  {user.email || t("profile.noEmailReturned")}
                </p>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[#bac9cc] lg:mx-0">
                  {t("profile.hero.body")}
                </p>

                <dl className="mt-6 grid gap-3 text-left sm:grid-cols-3">
                  <div className="border-l border-[#3b494c] px-4">
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                      {t("profile.currentPlan")}
                    </dt>
                    <dd className="mt-2 text-sm font-bold text-white">
                      {isBillingLoading
                        ? t("common.loading")
                        : billingError
                          ? t("common.unavailable")
                          : planName}
                    </dd>
                  </div>
                  <div className="border-l border-[#3b494c] px-4">
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                      {t("profile.credits")}
                    </dt>
                    <dd className="mt-2 text-sm font-bold text-white">
                      {isBillingLoading
                        ? t("common.loading")
                        : billingError
                          ? t("common.unavailable")
                          : creditsBalance}
                    </dd>
                  </div>
                  <div className="border-l border-[#3b494c] px-4">
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                      {t("profile.memberSince")}
                    </dt>
                    <dd className="mt-2 text-sm font-bold text-white">
                      {formatI18nDate(
                        user.createdAt,
                        language,
                        t("common.unknown"),
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          {successMessage ? (
            <MessageBanner message={successMessage} tone="success" />
          ) : null}

          {billingError ? (
            <section
              className="rounded-lg border border-[#f3bf26]/30 bg-[#f3bf26]/10 p-4 text-sm text-[#ffeac0]"
              role="status"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {t("profile.billingUnavailableBanner")}
                  </span>
                </div>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#f3bf26]/35 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#ffeac0] transition hover:bg-[#f3bf26]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f3bf26]"
                  type="button"
                  onClick={() => void loadBillingSummary()}
                >
                  <RefreshCw className="h-4 w-4" />
                  {t("profile.retryBilling")}
                </button>
              </div>
            </section>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.82fr)]">
            <form
              className="rounded-lg border border-[#3b494c] bg-[#201f1f] p-5"
              onSubmit={(event) => void handleProfileSubmit(event)}
            >
              <div className="flex flex-col gap-3 border-b border-[#3b494c]/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00e5ff]">
                    {t("profile.identity.eyebrow")}
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                    {t("profile.identity.title")}
                  </h2>
                </div>
                {isAdmin ? (
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                    {t("profile.identity.adminAccount")}
                  </span>
                ) : null}
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label
                    className="text-xs font-bold uppercase tracking-[0.14em] text-[#bac9cc]"
                    htmlFor="displayName"
                  >
                    {t("profile.identity.displayName")}
                  </label>
                  <input
                    className="h-12 w-full rounded-md border border-[#3b494c] bg-[#0e0e0e] px-3 text-base text-white outline-none transition placeholder:text-[#849396] focus:border-[#00e5ff] focus:ring-4 focus:ring-[#00e5ff]/15 disabled:cursor-not-allowed disabled:opacity-60"
                    id="displayName"
                    maxLength={255}
                    placeholder={t("profile.identity.displayNamePlaceholder")}
                    value={nameValue}
                    onChange={(event) => setNameValue(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-xs font-bold uppercase tracking-[0.14em] text-[#bac9cc]"
                    htmlFor="email"
                  >
                    {t("profile.identity.email")}
                  </label>
                  <input
                    className="h-12 w-full cursor-not-allowed rounded-md border border-[#3b494c] bg-[#0e0e0e] px-3 text-base text-[#bac9cc] outline-none"
                    id="email"
                    readOnly
                    value={user.email ?? t("profile.identity.notProvided")}
                  />
                </div>
              </div>

              {profileError ? (
                <div className="mt-5">
                  <MessageBanner message={profileError} tone="error" />
                </div>
              ) : null}

              <section className="mt-6 border-t border-[#3b494c]/60 pt-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-[#bac9cc]">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {t("profile.identity.visibilityTitle")}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[#bac9cc]">
                      {t("profile.identity.visibilityBody")}
                    </p>
                  </div>
                </div>
              </section>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-5 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSavingProfile || !hasProfileChanges}
                  type="submit"
                >
                  {isSavingProfile ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {t("common.saveChanges")}
                </button>
                <p className="text-sm text-[#849396]">
                  {hasProfileChanges
                    ? t("profile.identity.unsaved")
                    : t("profile.identity.current")}
                </p>
              </div>
            </form>

            <section className="rounded-lg border border-[#3b494c] bg-[#201f1f] p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#00e5ff]/10 text-[#9cf0ff]">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00e5ff]">
                    {t("profile.selfie.eyebrow")}
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                    {t("profile.selfie.title")}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                    {t("profile.selfie.body")}
                  </p>
                </div>
              </div>

              <label
                className={`mt-6 flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-5 py-6 text-center transition ${
                  isDragging
                    ? "border-[#00e5ff] bg-[#00e5ff]/12"
                    : "border-[#3b494c] bg-[#0e0e0e] hover:border-[#00e5ff]/65 hover:bg-[#00e5ff]/8"
                }`}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  type="file"
                  onChange={handleFileChange}
                />
                <span className="flex h-14 w-14 items-center justify-center rounded-md border border-[#00e5ff]/30 bg-[#00e5ff]/10 text-[#9cf0ff]">
                  <ImagePlus className="h-6 w-6" />
                </span>
                <span className="mt-4 text-base font-bold text-white">
                  {t("profile.selfie.upload")}
                </span>
                <span className="mt-2 max-w-xs text-sm leading-6 text-[#bac9cc]">
                  {t("profile.selfie.dropHelp")}
                </span>
              </label>

              {selectedFile ? (
                <div className="mt-5 rounded-lg border border-[#00e5ff]/25 bg-[#00e5ff]/10 p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#00e5ff] text-[#001f24]">
                      <ImagePlus className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">
                        {selectedFile.name}
                      </p>
                      <p className="mt-1 text-sm text-[#c3f5ff]">
                        {formatFileSize(selectedFile.size, language)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                      type="button"
                      onClick={() => setSelectedFile(null)}
                    >
                      <X className="h-4 w-4" />
                      {t("profile.selfie.clearPreview")}
                    </button>
                    <button
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isUploading}
                      type="button"
                      onClick={() => void handleUploadSubmit()}
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UploadCloud className="h-4 w-4" />
                      )}
                      {t("profile.selfie.uploadButton")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-4">
                  <div className="flex items-start gap-3">
                    <Camera className="mt-0.5 h-4 w-4 shrink-0 text-[#9cf0ff]" />
                    <p className="text-sm leading-6 text-[#bac9cc]">
                      {hasSavedAvatar
                        ? t("profile.selfie.replaceHelp")
                        : t("profile.selfie.personalizeHelp")}
                    </p>
                  </div>
                </div>
              )}

              {uploadError ? (
                <div className="mt-5">
                  <MessageBanner message={uploadError} tone="error" />
                </div>
              ) : null}
            </section>
          </div>

          <section className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00e5ff]">
                  {t("profile.record.eyebrow")}
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                  {t("profile.record.title")}
                </h2>
              </div>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                type="button"
                onClick={() => {
                  void refreshUser();
                  void loadBillingSummary(false);
                }}
              >
                <RefreshCw className="h-4 w-4" />
                {t("common.refresh")}
              </button>
            </div>

            <dl className="mt-6 grid overflow-hidden rounded-lg border border-[#3b494c] sm:grid-cols-2 lg:grid-cols-3">
              <div className="border-b border-[#3b494c]/60 p-4 sm:border-r lg:border-r">
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                  <Mail className="h-3.5 w-3.5" />
                  {t("profile.record.email")}
                </dt>
                <dd className="mt-3 break-all text-sm font-bold text-white">
                  {user.email || t("profile.identity.notProvided")}
                </dd>
              </div>
              <div className="border-b border-[#3b494c]/60 p-4 lg:border-r">
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                  <CreditCard className="h-3.5 w-3.5" />
                  {t("profile.currentPlan")}
                </dt>
                <dd className="mt-3 text-sm font-bold text-white">
                  {isBillingLoading
                    ? t("common.loading")
                    : billingError
                      ? t("common.unavailable")
                      : planName}
                </dd>
              </div>
              <div className="border-b border-[#3b494c]/60 p-4 sm:border-r lg:border-r-0">
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("profile.credits")}
                </dt>
                <dd className="mt-3 text-sm font-bold text-white">
                  {isBillingLoading
                    ? t("common.loading")
                    : billingError
                      ? t("common.unavailable")
                      : creditsBalance}
                </dd>
              </div>
              <div className="border-b border-[#3b494c]/60 p-4 lg:border-b-0 lg:border-r">
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {t("profile.record.planStatus")}
                </dt>
                <dd className="mt-3 text-sm font-bold text-white">
                  {billingStatusLabel}
                </dd>
              </div>
              <div className="border-b border-[#3b494c]/60 p-4 sm:border-b-0 sm:border-r">
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("profile.record.joined")}
                </dt>
                <dd className="mt-3 text-sm font-bold text-white">
                  {formatI18nDate(
                    user.createdAt,
                    language,
                    t("common.unknown"),
                  )}
                </dd>
              </div>
              <div className="p-4">
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                  <Camera className="h-3.5 w-3.5" />
                  {t("profile.record.selfie")}
                </dt>
                <dd className="mt-3 text-sm font-bold text-white">
                  {hasSavedAvatar
                    ? t("display.boolean.verified")
                    : t("display.boolean.notVerified")}
                </dd>
              </div>
            </dl>

            {isAdmin ? (
              <section className="mt-4 border-t border-[#3b494c]/60 pt-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                  {t("profile.record.adminFields")}
                </p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                      {t("profile.record.role")}
                    </dt>
                    <dd className="mt-2 text-sm font-bold text-white">
                      {getKnownDisplayLabel(user.role, language)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                      {t("profile.record.accountStatus")}
                    </dt>
                    <dd className="mt-2 text-sm font-bold text-white">
                      {getKnownDisplayLabel(user.status, language)}
                    </dd>
                  </div>
                </dl>
              </section>
            ) : null}
          </section>
        </div>
      </main>
    </DashboardShell>
  );
}
