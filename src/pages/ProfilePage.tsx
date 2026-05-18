import { ChangeEvent, DragEvent, FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Camera,
  CheckCircle2,
  ImagePlus,
  Mail,
  Save,
  Shield,
  UploadCloud,
  User,
  X,
} from "lucide-react";
import { MainLayout } from "../layouts/MainLayout";
import { Button } from "../components/common/Button";
import { useAuthStore } from "../features/auth/auth.store";
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

function validateSelfieFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Unsupported file type. Please use JPG, PNG, or WebP.";
  }

  if (file.size > MAX_SELFIE_SIZE_BYTES) {
    return "File is too large. Please upload an image under 5MB.";
  }

  return null;
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
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setNameValue(displayName);
  }, [displayName]);

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

  return (
    <MainLayout>
      <main className="min-h-[calc(100vh-73px)] bg-[#05070b] px-4 py-8 text-[#d7e5e2] sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.34)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-[#2cebcf]">
                  Profile
                </p>
                <h1 className="mt-2 text-3xl font-bold leading-tight text-white">
                  {fallbackName}
                </h1>
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 rounded-md border border-[#2cebcf]/20 bg-[#2cebcf]/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#7df9df]">
                <Shield className="h-4 w-4" />
                {user?.role ?? "user"}
              </span>
            </div>

            <div className="mt-6 overflow-hidden rounded-lg border border-white/10 bg-black/24">
              <div className="relative aspect-[4/5] bg-[#080d14]">
                {activePreviewUrl ? (
                  <img
                    alt="Profile selfie preview"
                    className="h-full w-full object-cover"
                    src={activePreviewUrl}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-md border border-[#2cebcf]/20 bg-[#2cebcf]/10 text-[#7df9df]">
                      <Camera className="h-8 w-8" />
                    </span>
                    <p className="max-w-[220px] text-sm font-semibold text-[#d7e5e2]/72">
                      Upload your selfie to personalize future outfit generation.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5">
              <label
                className={`flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-5 py-6 text-center transition ${
                  isDragging
                    ? "border-[#2cebcf] bg-[#2cebcf]/12"
                    : "border-white/16 bg-black/18 hover:border-[#2cebcf]/60 hover:bg-[#2cebcf]/8"
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
                <ImagePlus className="h-6 w-6 text-[#7df9df]" />
                <span className="mt-3 text-base font-bold text-white">
                  Upload your selfie
                </span>
                <span className="mt-1 text-sm text-[#d7e5e2]/58">
                  JPG, PNG, or WebP. Max 5MB.
                </span>
              </label>

              {selectedFile ? (
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-[#d7e5e2]/58">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="border-white/10 text-[#d7e5e2]"
                      icon={<X className="h-4 w-4" />}
                      type="button"
                      variant="authSecondary"
                      onClick={() => setSelectedFile(null)}
                    >
                      Clear
                    </Button>
                    <Button
                      icon={<UploadCloud className="h-4 w-4" />}
                      isLoading={isUploading}
                      type="button"
                      variant="authPrimary"
                      onClick={() => void handleUploadSubmit()}
                    >
                      Upload
                    </Button>
                  </div>
                </div>
              ) : null}

              {uploadError ? (
                <div
                  className="mt-4 flex gap-3 rounded-lg border border-[#ff8a65]/25 bg-[#ff8a65]/10 p-4 text-sm text-[#ffb199]"
                  role="alert"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-6">
            {successMessage ? (
              <div
                className="flex gap-3 rounded-lg border border-[#2cebcf]/25 bg-[#2cebcf]/10 p-4 text-sm font-semibold text-[#7df9df]"
                role="status"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            ) : null}

            <form
              className="rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-6"
              onSubmit={(event) => void handleProfileSubmit(event)}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#f0b44c]/12 text-[#f0b44c]">
                  <User className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-white">Account</h2>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <div className="space-y-2.5">
                  <label
                    className="text-sm font-semibold text-slate-100"
                    htmlFor="displayName"
                  >
                    Display name
                  </label>
                  <input
                    className="h-12 w-full rounded-md border border-white/10 bg-[#080d14] px-3 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-[#2cebcf] focus:ring-4 focus:ring-[#2cebcf]/15 disabled:cursor-not-allowed disabled:opacity-60"
                    id="displayName"
                    maxLength={255}
                    value={nameValue}
                    onChange={(event) => setNameValue(event.target.value)}
                  />
                </div>

                {profileError ? (
                  <div
                    className="flex gap-3 rounded-lg border border-[#ff8a65]/25 bg-[#ff8a65]/10 p-4 text-sm text-[#ffb199]"
                    role="alert"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{profileError}</span>
                  </div>
                ) : null}

                <Button
                  icon={<Save className="h-4 w-4" />}
                  isLoading={isSavingProfile}
                  type="submit"
                  variant="authPrimary"
                >
                  Save profile
                </Button>
              </div>
            </form>

            <section className="rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#2cebcf]/10 text-[#7df9df]">
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-white">Details</h2>
                </div>
              </div>

              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <dt className="text-xs font-bold uppercase tracking-wide text-[#d7e5e2]/48">
                    Email
                  </dt>
                  <dd className="mt-2 truncate text-sm font-semibold text-white">
                    {user?.email || "Not provided"}
                  </dd>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <dt className="text-xs font-bold uppercase tracking-wide text-[#d7e5e2]/48">
                    Status
                  </dt>
                  <dd className="mt-2 truncate text-sm font-semibold text-white">
                    {user?.status || "active"}
                  </dd>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <dt className="text-xs font-bold uppercase tracking-wide text-[#d7e5e2]/48">
                    Role
                  </dt>
                  <dd className="mt-2 truncate text-sm font-semibold text-white">
                    {user?.role || "user"}
                  </dd>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#d7e5e2]/48">
                    <Calendar className="h-3.5 w-3.5" />
                    Joined
                  </dt>
                  <dd className="mt-2 truncate text-sm font-semibold text-white">
                    {formatDate(user?.createdAt)}
                  </dd>
                </div>
              </dl>
            </section>
          </section>
        </div>
      </main>
    </MainLayout>
  );
}
