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

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SELFIE_SIZE_BYTES = 5 * 1024 * 1024;

function formatDate(value?: string) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatFileSize(value: number) {
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function formatLabel(value: string | null | undefined, fallback = "Unknown") {
  if (!value) {
    return fallback;
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function validateSelfieFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Unsupported file type. Please use JPG, PNG, or WebP.";
  }

  if (file.size > MAX_SELFIE_SIZE_BYTES) {
    return "File is too large. Please upload an image under 5MB.";
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
  const user = useAuthStore((state) => state.user);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const displayName = user?.displayName || user?.fullName || "";
  const fallbackName = displayName || user?.email || "Stylist";
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
  const planName = billingSummary?.plan.name ?? "Free";
  const planStatus =
    billingSummary?.subscription?.status ?? billingSummary?.plan.status ?? null;
  const creditsBalance = billingSummary?.credits.balance ?? 0;
  const billingStatusLabel = isBillingLoading
    ? "Loading"
    : billingError
      ? "Unavailable"
      : formatLabel(planStatus, "Free");

  function selectFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const validationError = validateSelfieFile(file);
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
      setProfileError("Display name is required.");
      return;
    }

    setIsSavingProfile(true);

    try {
      await profileApi.updateDisplayName(trimmedName);
      await refreshUser();
      setSuccessMessage("Profile updated.");
    } catch (error) {
      setProfileError(getApiErrorMessage(error));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleUploadSubmit() {
    if (!selectedFile) {
      setUploadError("Choose an image before uploading.");
      return;
    }

    setUploadError(null);
    setSuccessMessage(null);
    setIsUploading(true);

    try {
      await profileApi.uploadSelfie(selectedFile);
      await refreshUser();
      setSelectedFile(null);
      setSuccessMessage("Selfie uploaded.");
    } catch (error) {
      setUploadError(
        getApiErrorMessage(error) || "Upload failed. Please try again.",
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
                Loading profile
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
          <section className="overflow-hidden rounded-lg border border-[#3b494c] bg-[#1c1b1b] shadow-[0_0_38px_rgba(0,229,255,0.08)]">
            <div className="grid gap-5 p-5 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-6 lg:p-6">
              <div className="mx-auto w-full max-w-[180px] lg:mx-0">
                <div className="relative aspect-square rounded-lg border border-[#00e5ff]/55 bg-[#0e0e0e] p-1 shadow-[0_0_28px_rgba(0,229,255,0.18)]">
                  {activePreviewUrl ? (
                    <img
                      alt={`${fallbackName} avatar preview`}
                      className="h-full w-full rounded-md object-cover"
                      src={activePreviewUrl}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-md border border-dashed border-[#3b494c] bg-[#131313] text-center">
                      <span className="font-display text-3xl font-semibold text-[#9cf0ff]">
                        {getInitials(fallbackName)}
                      </span>
                      <span className="mt-2 max-w-[110px] text-xs font-semibold leading-5 text-[#bac9cc]">
                        No selfie uploaded
                      </span>
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-md border border-[#1c1b1b] bg-[#00e5ff] text-[#001f24]">
                    {activePreviewUrl ? (
                      <BadgeCheck className="h-4 w-4" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </span>
                </div>
                <p className="mt-3 text-center text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                  {hasSelectedFile
                    ? "Preview selected"
                    : hasSavedAvatar
                      ? "Selfie active"
                      : "Awaiting upload"}
                </p>
              </div>

              <div className="flex min-w-0 flex-col justify-center text-center lg:text-left">
                <div className="flex flex-col items-center gap-3 lg:flex-row lg:items-start">
                  <h1 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                    {fallbackName}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-[#00e5ff]/30 bg-[#00e5ff]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#9cf0ff]">
                    {isAdmin ? (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {isAdmin
                      ? "Admin"
                      : isBillingLoading
                        ? "Plan loading"
                        : billingError
                          ? "Billing unavailable"
                          : planName}
                  </span>
                </div>

                <p className="mt-3 break-all text-sm font-semibold text-[#bac9cc]">
                  {user.email || "No email returned"}
                </p>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[#bac9cc] lg:mx-0">
                  Manage the identity details used across your 3D Stylist
                  workspace. Upload a clear front-facing selfie now so future
                  outfit personalization has a stronger profile reference.
                </p>

                <dl className="mt-6 grid gap-3 text-left sm:grid-cols-3">
                  <div className="border-l border-[#3b494c] px-4">
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                      Current plan
                    </dt>
                    <dd className="mt-2 text-sm font-bold text-white">
                      {isBillingLoading
                        ? "Loading"
                        : billingError
                          ? "Unavailable"
                          : planName}
                    </dd>
                  </div>
                  <div className="border-l border-[#3b494c] px-4">
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                      Credits
                    </dt>
                    <dd className="mt-2 text-sm font-bold text-white">
                      {isBillingLoading
                        ? "Loading"
                        : billingError
                          ? "Unavailable"
                          : creditsBalance}
                    </dd>
                  </div>
                  <div className="border-l border-[#3b494c] px-4">
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                      Member since
                    </dt>
                    <dd className="mt-2 text-sm font-bold text-white">
                      {formatDate(user.createdAt)}
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
                    Billing summary is unavailable right now. Profile editing
                    and selfie upload still work.
                  </span>
                </div>
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#f3bf26]/35 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#ffeac0] transition hover:bg-[#f3bf26]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f3bf26]"
                  type="button"
                  onClick={() => void loadBillingSummary()}
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry billing
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
                    Identity management
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                    Account settings
                  </h2>
                </div>
                {isAdmin ? (
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                    Admin account
                  </span>
                ) : null}
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label
                    className="text-xs font-bold uppercase tracking-[0.14em] text-[#bac9cc]"
                    htmlFor="displayName"
                  >
                    Display name
                  </label>
                  <input
                    className="h-12 w-full rounded-md border border-[#3b494c] bg-[#0e0e0e] px-3 text-base text-white outline-none transition placeholder:text-[#849396] focus:border-[#00e5ff] focus:ring-4 focus:ring-[#00e5ff]/15 disabled:cursor-not-allowed disabled:opacity-60"
                    id="displayName"
                    maxLength={255}
                    placeholder="Your display name"
                    value={nameValue}
                    onChange={(event) => setNameValue(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-xs font-bold uppercase tracking-[0.14em] text-[#bac9cc]"
                    htmlFor="email"
                  >
                    Email address
                  </label>
                  <input
                    className="h-12 w-full cursor-not-allowed rounded-md border border-[#3b494c] bg-[#0e0e0e] px-3 text-base text-[#bac9cc] outline-none"
                    id="email"
                    readOnly
                    value={user.email ?? "Not provided"}
                  />
                </div>
              </div>

              {profileError ? (
                <div className="mt-5">
                  <MessageBanner message={profileError} tone="error" />
                </div>
              ) : null}

              <section className="mt-6 rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#00e5ff]/10 text-[#9cf0ff]">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Account visibility
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[#bac9cc]">
                      Display name is editable. Email, membership date, and
                      billing plan details come from protected backend
                      responses.
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
                  Save changes
                </button>
                <p className="text-sm text-[#849396]">
                  {hasProfileChanges
                    ? "Unsaved display name change"
                    : "Profile details are current"}
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
                    Selfie upload
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                    Personalization image
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                    Use a clear front-facing image. The preview updates before
                    upload so you can verify the crop and lighting first.
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
                  Upload your selfie
                </span>
                <span className="mt-2 max-w-xs text-sm leading-6 text-[#bac9cc]">
                  Drag an image here or choose a file. JPG, PNG, or WebP under
                  5MB.
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
                        {formatFileSize(selectedFile.size)}
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
                      Clear preview
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
                      Upload selfie
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-4">
                  <div className="flex items-start gap-3">
                    <Camera className="mt-0.5 h-4 w-4 shrink-0 text-[#9cf0ff]" />
                    <p className="text-sm leading-6 text-[#bac9cc]">
                      {hasSavedAvatar
                        ? "Choose a new image when you want to replace the current selfie."
                        : "Upload your selfie to personalize future outfit generation."}
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
                  Account record
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                  Profile details
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
                Refresh
              </button>
            </div>

            <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-[#3b494c] bg-[#0e0e0e] p-4">
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </dt>
                <dd className="mt-3 break-all text-sm font-bold text-white">
                  {user.email || "Not provided"}
                </dd>
              </div>
              <div className="rounded-lg border border-[#3b494c] bg-[#0e0e0e] p-4">
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                  <CreditCard className="h-3.5 w-3.5" />
                  Current plan
                </dt>
                <dd className="mt-3 text-sm font-bold text-white">
                  {isBillingLoading
                    ? "Loading"
                    : billingError
                      ? "Unavailable"
                      : planName}
                </dd>
              </div>
              <div className="rounded-lg border border-[#3b494c] bg-[#0e0e0e] p-4">
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Credits
                </dt>
                <dd className="mt-3 text-sm font-bold text-white">
                  {isBillingLoading
                    ? "Loading"
                    : billingError
                      ? "Unavailable"
                      : creditsBalance}
                </dd>
              </div>
              <div className="rounded-lg border border-[#3b494c] bg-[#0e0e0e] p-4">
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Plan status
                </dt>
                <dd className="mt-3 text-sm font-bold text-white">
                  {billingStatusLabel}
                </dd>
              </div>
              <div className="rounded-lg border border-[#3b494c] bg-[#0e0e0e] p-4">
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                  <Calendar className="h-3.5 w-3.5" />
                  Joined
                </dt>
                <dd className="mt-3 text-sm font-bold text-white">
                  {formatDate(user.createdAt)}
                </dd>
              </div>
              <div className="rounded-lg border border-[#3b494c] bg-[#0e0e0e] p-4">
                <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                  <Camera className="h-3.5 w-3.5" />
                  Selfie
                </dt>
                <dd className="mt-3 text-sm font-bold text-white">
                  {hasSavedAvatar ? "Uploaded" : "Not uploaded"}
                </dd>
              </div>
            </dl>

            {isAdmin ? (
              <section className="mt-4 rounded-lg border border-[#3b494c] bg-[#0e0e0e] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                  Admin-only account fields
                </p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                      Role
                    </dt>
                    <dd className="mt-2 text-sm font-bold text-white">
                      {formatLabel(user.role, "Admin")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                      Account status
                    </dt>
                    <dd className="mt-2 text-sm font-bold text-white">
                      {formatLabel(user.status, "Active")}
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
