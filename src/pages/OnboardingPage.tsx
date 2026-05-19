import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Camera,
  Check,
  CheckCircle2,
  ImagePlus,
  LogOut,
  Palette,
  Save,
  Sparkles,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { LoadingScreen } from "../components/common/LoadingScreen";
import { onboardingApi } from "../features/onboarding/onboarding.api";
import type { OnboardingPayload } from "../features/onboarding/onboarding.api";
import { profileApi } from "../features/profile/profile.api";
import { useAuthStore } from "../features/auth/auth.store";
import { resolvePostAuthRedirect } from "../features/auth/auth.redirects";
import type { AuthUser } from "../features/auth/auth.types";
import { getApiErrorMessage } from "../services/apiClient";

const STYLE_OPTIONS = [
  "minimal",
  "streetwear",
  "formal",
  "luxury",
  "sporty",
  "vintage",
  "techwear",
  "casual",
  "avant-garde",
] as const;

const COLOR_OPTIONS = [
  { value: "black", label: "Black", hex: "#050505" },
  { value: "white", label: "White", hex: "#f8fafc" },
  { value: "gray", label: "Gray", hex: "#7c8794" },
  { value: "navy", label: "Navy", hex: "#172554" },
  { value: "beige", label: "Beige", hex: "#d6c5a5" },
  { value: "red", label: "Red", hex: "#c2412d" },
  { value: "emerald", label: "Emerald", hex: "#047857" },
  { value: "cobalt", label: "Cobalt", hex: "#2554d8" },
  { value: "violet", label: "Violet", hex: "#7c3aed" },
  { value: "rose", label: "Rose", hex: "#e11d48" },
] as const;

const VIBE_OPTIONS = [
  {
    value: "daily casual",
    label: "Daily casual",
    description: "Easy pieces with a clean finish.",
  },
  {
    value: "office-ready",
    label: "Office-ready",
    description: "Sharp enough for focused workdays.",
  },
  {
    value: "event statement",
    label: "Event statement",
    description: "A stronger silhouette for nights out.",
  },
  {
    value: "weekend",
    label: "Weekend",
    description: "Relaxed, styled, never careless.",
  },
  {
    value: "experimental",
    label: "Experimental",
    description: "Unexpected shape, color, and contrast.",
  },
] as const;

const STEPS = [
  {
    label: "Identity",
    title: "Name your studio profile.",
    copy: "A small polish pass before the styling room opens.",
    icon: UserRound,
  },
  {
    label: "Lifestyle",
    title: "Tune the studio around your day.",
    copy: "Keep it practical, but not plain.",
    icon: Briefcase,
  },
  {
    label: "Style",
    title: "Set your style direction.",
    copy: "Choose the signals that feel most like your wardrobe.",
    icon: Sparkles,
  },
  {
    label: "Palette",
    title: "Choose colors you actually wear.",
    copy: "The future looks should start from familiar tones.",
    icon: Palette,
  },
  {
    label: "Selfie",
    title: "Add a face reference when you are ready.",
    copy: "Optional, but helpful for future outfit previews.",
    icon: Camera,
  },
] as const;

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SELFIE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_SELECTED_VALUES = 5;

interface OnboardingForm {
  displayName: string;
  occupation: string;
  stylePreferences: string[];
  preferredColors: string[];
  outfitVibe: string;
}

interface OnboardingErrors {
  displayName?: string;
  occupation?: string;
  stylePreferences?: string;
  preferredColors?: string;
  outfitVibe?: string;
  selfie?: string;
  form?: string;
}

const emptyForm: OnboardingForm = {
  displayName: "",
  occupation: "",
  stylePreferences: [],
  preferredColors: [],
  outfitVibe: "",
};

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formFromUser(user: AuthUser): OnboardingForm {
  return {
    displayName: user.displayName ?? user.fullName ?? "",
    occupation: user.occupation ?? "",
    stylePreferences: user.stylePreferences ?? [],
    preferredColors: user.preferredColors ?? [],
    outfitVibe: user.outfitVibe ?? "",
  };
}

function getFirstIncompleteStep(form: OnboardingForm) {
  if (!form.displayName.trim()) {
    return 0;
  }

  if (!form.occupation.trim() || !form.outfitVibe) {
    return 1;
  }

  if (form.stylePreferences.length < 2) {
    return 2;
  }

  if (form.preferredColors.length < 1) {
    return 3;
  }

  return 4;
}

function createOnboardingPayload(
  form: OnboardingForm,
  complete: boolean,
): OnboardingPayload {
  const displayName = form.displayName.trim();
  const occupation = form.occupation.trim();
  const payload: OnboardingPayload = { complete };

  if (displayName || complete) {
    payload.displayName = displayName;
  }

  if (occupation || complete) {
    payload.occupation = occupation;
  }

  if (form.stylePreferences.length || complete) {
    payload.stylePreferences = form.stylePreferences;
  }

  if (form.preferredColors.length || complete) {
    payload.preferredColors = form.preferredColors;
  }

  if (form.outfitVibe || complete) {
    payload.outfitVibe = form.outfitVibe;
  }

  return payload;
}

function validateSelfieFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Use a JPG, PNG, or WebP image.";
  }

  if (file.size > MAX_SELFIE_SIZE_BYTES) {
    return "Choose an image under 5MB.";
  }

  return null;
}

function validateStep(stepIndex: number, form: OnboardingForm): OnboardingErrors {
  const nextErrors: OnboardingErrors = {};
  const displayName = form.displayName.trim();
  const occupation = form.occupation.trim();

  if (stepIndex === 0) {
    if (!displayName) {
      nextErrors.displayName = "Display name is required.";
    } else if (displayName.length > 80) {
      nextErrors.displayName = "Keep display name under 80 characters.";
    }
  }

  if (stepIndex === 1) {
    if (!occupation) {
      nextErrors.occupation = "Occupation or lifestyle is required.";
    } else if (occupation.length > 100) {
      nextErrors.occupation = "Keep occupation under 100 characters.";
    }

    if (!form.outfitVibe) {
      nextErrors.outfitVibe = "Choose one outfit vibe.";
    }
  }

  if (stepIndex === 2) {
    if (form.stylePreferences.length < 2) {
      nextErrors.stylePreferences = "Choose at least 2 style directions.";
    } else if (form.stylePreferences.length > MAX_SELECTED_VALUES) {
      nextErrors.stylePreferences = "Choose up to 5 style directions.";
    }
  }

  if (stepIndex === 3) {
    if (form.preferredColors.length < 1) {
      nextErrors.preferredColors = "Choose at least 1 color.";
    } else if (form.preferredColors.length > MAX_SELECTED_VALUES) {
      nextErrors.preferredColors = "Choose up to 5 colors.";
    }
  }

  return nextErrors;
}

function getFirstValidationIssue(form: OnboardingForm) {
  for (let index = 0; index < 4; index += 1) {
    const errors = validateStep(index, form);

    if (Object.keys(errors).length > 0) {
      return { index, errors };
    }
  }

  return null;
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const logout = useAuthStore((state) => state.logout);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const [form, setForm] = useState<OnboardingForm>(emptyForm);
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!user || hasInitialized.current) {
      return;
    }

    const userForm = formFromUser(user);
    setForm(userForm);
    setCurrentStep(getFirstIncompleteStep(userForm));
    hasInitialized.current = true;
  }, [user]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const activeStep = STEPS[currentStep];
  const ActiveStepIcon = activeStep.icon;
  const activePreviewUrl = previewUrl ?? user?.avatarUrl ?? null;
  const progressText = `Step ${currentStep + 1} of ${STEPS.length}`;
  const isBusy = isSaving || isCompleting || isUploading;

  const selectedSummary = useMemo(
    () => [
      ...form.stylePreferences.slice(0, 3).map(titleCase),
      ...form.preferredColors.slice(0, 2).map(titleCase),
    ],
    [form.preferredColors, form.stylePreferences],
  );

  if (!user) {
    return <LoadingScreen />;
  }

  if (user.onboardingCompleted) {
    return <Navigate to="/dashboard" replace />;
  }

  function updateField<K extends keyof OnboardingForm>(
    field: K,
    value: OnboardingForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
    setStatusMessage(null);
  }

  function toggleListValue(
    field: "stylePreferences" | "preferredColors",
    value: string,
  ) {
    setStatusMessage(null);
    setForm((current) => {
      const currentValues = current[field];
      const isSelected = currentValues.includes(value);

      if (isSelected) {
        setErrors((existing) => ({
          ...existing,
          [field]: undefined,
          form: undefined,
        }));
        return {
          ...current,
          [field]: currentValues.filter((item) => item !== value),
        };
      }

      if (currentValues.length >= MAX_SELECTED_VALUES) {
        setErrors((existing) => ({
          ...existing,
          [field]:
            field === "stylePreferences"
              ? "Choose up to 5 style directions."
              : "Choose up to 5 colors.",
        }));
        return current;
      }

      setErrors((existing) => ({
        ...existing,
        [field]: undefined,
        form: undefined,
      }));
      return {
        ...current,
        [field]: [...currentValues, value],
      };
    });
  }

  async function saveOnboardingDraft() {
    const updatedUser = await onboardingApi.patchOnboarding(
      createOnboardingPayload(form, false),
    );
    setUser(updatedUser);
    return updatedUser;
  }

  async function handleSaveDraft() {
    setIsSaving(true);
    setStatusMessage(null);
    setErrors((current) => ({ ...current, form: undefined }));

    try {
      await saveOnboardingDraft();
      setStatusMessage("Draft saved.");
    } catch (error) {
      setErrors((current) => ({
        ...current,
        form: getApiErrorMessage(error),
      }));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleNext() {
    const nextErrors = validateStep(currentStep, form);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    setErrors({});

    try {
      await saveOnboardingDraft();
      setCurrentStep((step) => Math.min(step + 1, STEPS.length - 1));
      setStatusMessage("Saved.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setErrors({ form: getApiErrorMessage(error) });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFinish() {
    const validationIssue = getFirstValidationIssue(form);

    if (validationIssue) {
      setCurrentStep(validationIssue.index);
      setErrors(validationIssue.errors);
      return;
    }

    setIsCompleting(true);
    setStatusMessage(null);
    setErrors({});

    try {
      const updatedUser = await onboardingApi.patchOnboarding(
        createOnboardingPayload(form, true),
      );
      setUser(updatedUser);
      navigate(resolvePostAuthRedirect(updatedUser, "/dashboard"), {
        replace: true,
      });
    } catch (error) {
      setErrors({ form: getApiErrorMessage(error) });
    } finally {
      setIsCompleting(false);
    }
  }

  function handleBack() {
    setCurrentStep((step) => Math.max(step - 1, 0));
    setErrors({});
    setStatusMessage(null);
  }

  function selectFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const validationError = validateSelfieFile(file);
    setStatusMessage(null);

    if (validationError) {
      setSelectedFile(null);
      setErrors((current) => ({ ...current, selfie: validationError }));
      return;
    }

    setSelectedFile(file);
    setErrors((current) => ({ ...current, selfie: undefined, form: undefined }));
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

  async function handleUploadSelfie() {
    if (!selectedFile) {
      setErrors((current) => ({
        ...current,
        selfie: "Choose an image before uploading.",
      }));
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);
    setErrors((current) => ({ ...current, selfie: undefined, form: undefined }));

    try {
      await profileApi.uploadSelfie(selectedFile);
      await refreshUser();
      setSelectedFile(null);
      setStatusMessage("Selfie uploaded.");
    } catch (error) {
      setErrors((current) => ({
        ...current,
        selfie: getApiErrorMessage(error),
      }));
    } finally {
      setIsUploading(false);
    }
  }

  function renderIdentityStep() {
    return (
      <div className="space-y-5">
        <Input
          label="Display name"
          name="displayName"
          maxLength={80}
          placeholder="Alex Morgan"
          value={form.displayName}
          error={errors.displayName}
          icon={<UserRound className="h-4 w-4" />}
          onChange={(event) => updateField("displayName", event.target.value)}
        />
      </div>
    );
  }

  function renderLifestyleStep() {
    return (
      <div className="space-y-6">
        <Input
          label="Occupation or lifestyle"
          name="occupation"
          maxLength={100}
          placeholder="Product designer, student, founder..."
          value={form.occupation}
          error={errors.occupation}
          icon={<Briefcase className="h-4 w-4" />}
          onChange={(event) => updateField("occupation", event.target.value)}
        />

        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-100">Outfit vibe</p>
            <p className="mt-1 text-sm text-[#d7e5e2]/58">
              Pick the default mood for future styling.
            </p>
          </div>
          <div
            className="grid gap-3 sm:grid-cols-2"
            role="group"
            aria-label="Outfit vibe"
          >
            {VIBE_OPTIONS.map((option) => {
              const isSelected = form.outfitVibe === option.value;

              return (
                <button
                  aria-pressed={isSelected}
                  className={`min-h-[108px] rounded-lg border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7df9df] ${
                    isSelected
                      ? "border-[#2cebcf] bg-[#2cebcf]/12 shadow-[0_18px_50px_rgba(44,235,207,0.13)]"
                      : "border-white/10 bg-black/20 hover:border-[#2cebcf]/50 hover:bg-[#2cebcf]/8"
                  }`}
                  key={option.value}
                  type="button"
                  onClick={() => updateField("outfitVibe", option.value)}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-base font-bold text-white">
                      {option.label}
                    </span>
                    {isSelected ? (
                      <Check className="h-5 w-5 shrink-0 text-[#7df9df]" />
                    ) : null}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-[#d7e5e2]/62">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
          {errors.outfitVibe ? (
            <p className="text-sm text-[#ffb199]" role="alert">
              {errors.outfitVibe}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  function renderStyleStep() {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-100">
            Style preferences
          </p>
          <p className="mt-1 text-sm text-[#d7e5e2]/58">
            Choose 2 to 5 directions.
          </p>
        </div>
        <div
          className="flex flex-wrap gap-3"
          role="group"
          aria-label="Style preferences"
        >
          {STYLE_OPTIONS.map((option) => {
            const isSelected = form.stylePreferences.includes(option);

            return (
              <button
                aria-pressed={isSelected}
                className={`min-h-11 rounded-md border px-4 py-2.5 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7df9df] ${
                  isSelected
                    ? "border-[#2cebcf] bg-[#2cebcf] text-[#06100e] shadow-[0_14px_36px_rgba(44,235,207,0.2)]"
                    : "border-white/10 bg-white/[0.045] text-[#d7e5e2] hover:border-[#2cebcf]/60 hover:bg-[#2cebcf]/10"
                }`}
                key={option}
                type="button"
                onClick={() => toggleListValue("stylePreferences", option)}
              >
                <span className="inline-flex items-center gap-2">
                  {isSelected ? <Check className="h-4 w-4" /> : null}
                  {titleCase(option)}
                </span>
              </button>
            );
          })}
        </div>
        {errors.stylePreferences ? (
          <p className="text-sm text-[#ffb199]" role="alert">
            {errors.stylePreferences}
          </p>
        ) : null}
      </div>
    );
  }

  function renderColorStep() {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-100">
            Preferred colors
          </p>
          <p className="mt-1 text-sm text-[#d7e5e2]/58">
            Choose 1 to 5 colors.
          </p>
        </div>
        <div
          className="grid gap-3 sm:grid-cols-2"
          role="group"
          aria-label="Preferred colors"
        >
          {COLOR_OPTIONS.map((option) => {
            const isSelected = form.preferredColors.includes(option.value);

            return (
              <button
                aria-pressed={isSelected}
                className={`flex min-h-[68px] items-center gap-3 rounded-lg border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7df9df] ${
                  isSelected
                    ? "border-[#2cebcf] bg-[#2cebcf]/12"
                    : "border-white/10 bg-black/20 hover:border-[#2cebcf]/50 hover:bg-[#2cebcf]/8"
                }`}
                key={option.value}
                type="button"
                onClick={() => toggleListValue("preferredColors", option.value)}
              >
                <span
                  className="h-9 w-9 shrink-0 rounded-md border border-white/20 shadow-inner"
                  style={{ backgroundColor: option.hex }}
                />
                <span className="min-w-0 flex-1 text-sm font-bold text-white">
                  {option.label}
                </span>
                {isSelected ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#7df9df]" />
                ) : null}
              </button>
            );
          })}
        </div>
        {errors.preferredColors ? (
          <p className="text-sm text-[#ffb199]" role="alert">
            {errors.preferredColors}
          </p>
        ) : null}
      </div>
    );
  }

  function renderSelfieStep() {
    return (
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="overflow-hidden rounded-lg border border-white/10 bg-black/24">
          <div className="relative aspect-[4/5] bg-[#080d14]">
            {activePreviewUrl ? (
              <img
                alt="Selfie preview"
                className="h-full w-full object-cover"
                src={activePreviewUrl}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-md border border-[#2cebcf]/20 bg-[#2cebcf]/10 text-[#7df9df]">
                  <Camera className="h-8 w-8" />
                </span>
                <p className="text-sm font-semibold leading-6 text-[#d7e5e2]/72">
                  Optional, but helpful for future outfit previews.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <label
            className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-5 py-6 text-center transition ${
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
              Upload a selfie
            </span>
            <span className="mt-1 text-sm text-[#d7e5e2]/58">
              JPG, PNG, or WebP. Max 5MB.
            </span>
          </label>

          {selectedFile ? (
            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
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
                  disabled={isBusy}
                  icon={<X className="h-4 w-4" />}
                  type="button"
                  variant="authSecondary"
                  onClick={() => setSelectedFile(null)}
                >
                  Clear
                </Button>
                <Button
                  disabled={isCompleting || isSaving}
                  icon={<UploadCloud className="h-4 w-4" />}
                  isLoading={isUploading}
                  type="button"
                  variant="authPrimary"
                  onClick={() => void handleUploadSelfie()}
                >
                  Upload
                </Button>
              </div>
            </div>
          ) : null}

          {errors.selfie ? (
            <div
              className="flex gap-3 rounded-lg border border-[#ff8a65]/25 bg-[#ff8a65]/10 p-4 text-sm text-[#ffb199]"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errors.selfie}</span>
            </div>
          ) : null}

          <Button
            className="w-full border-white/10 text-[#d7e5e2]"
            disabled={isSaving || isUploading}
            isLoading={isCompleting}
            type="button"
            variant="authSecondary"
            onClick={() => void handleFinish()}
          >
            Skip for now
          </Button>
        </div>
      </div>
    );
  }

  function renderCurrentStep() {
    if (currentStep === 0) {
      return renderIdentityStep();
    }

    if (currentStep === 1) {
      return renderLifestyleStep();
    }

    if (currentStep === 2) {
      return renderStyleStep();
    }

    if (currentStep === 3) {
      return renderColorStep();
    }

    return renderSelfieStep();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05070b] text-[#d7e5e2]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(44,235,207,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(135deg,#05070b_0%,#071118_54%,#140f14_100%)] bg-[length:46px_46px,46px_46px,auto]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,transparent_0_18%,rgba(44,235,207,0.12)_18.1%_18.25%,transparent_18.35%_100%),linear-gradient(72deg,transparent_0_74%,rgba(240,180,76,0.09)_74.1%_74.28%,transparent_74.4%_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#2cebcf]/30 bg-[#2cebcf]/12 text-[#7df9df]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold leading-tight text-white">
                3D Stylist
              </p>
              <p className="truncate text-sm text-[#d7e5e2]/58">
                Studio setup
              </p>
            </div>
          </div>

          <Button
            className="border-white/10 text-[#d7e5e2]"
            icon={<LogOut className="h-4 w-4" />}
            isLoading={isAuthLoading}
            type="button"
            variant="authSecondary"
            onClick={() => void logout()}
          >
            Sign out
          </Button>
        </header>

        <section className="grid flex-1 items-center gap-6 py-6 lg:grid-cols-[0.78fr_1.22fr] lg:py-10">
          <aside className="rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#2cebcf]/10 text-[#7df9df]">
                <ActiveStepIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#7df9df]">
                  {progressText}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {activeStep.label}
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-5 gap-2" aria-hidden="true">
              {STEPS.map((step, index) => (
                <span
                  className={`h-1.5 rounded-full ${
                    index <= currentStep ? "bg-[#2cebcf]" : "bg-white/12"
                  }`}
                  key={step.label}
                />
              ))}
            </div>
            <p className="sr-only" aria-live="polite">
              {progressText}: {activeStep.label}
            </p>

            <div className="mt-8">
              <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">
                {activeStep.title}
              </h1>
              <p className="mt-4 text-base leading-7 text-[#d7e5e2]/68">
                {activeStep.copy}
              </p>
            </div>

            <div className="mt-8 rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#d7e5e2]/48">
                Current profile
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#2cebcf]/20 bg-[#2cebcf]/10 text-lg font-bold text-[#7df9df]">
                  {user.avatarUrl ? (
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      src={user.avatarUrl}
                    />
                  ) : (
                    (form.displayName || user.email || "S").charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">
                    {form.displayName.trim() || user.email || "Stylist"}
                  </p>
                  <p className="truncate text-sm text-[#d7e5e2]/58">
                    {form.occupation.trim() || "Lifestyle pending"}
                  </p>
                </div>
              </div>

              {selectedSummary.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedSummary.map((item) => (
                    <span
                      className="rounded-md border border-white/10 bg-white/[0.045] px-2.5 py-1 text-xs font-bold text-[#d7e5e2]"
                      key={item}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {statusMessage ? (
              <div
                className="mt-4 flex gap-3 rounded-lg border border-[#2cebcf]/25 bg-[#2cebcf]/10 p-4 text-sm font-semibold text-[#7df9df]"
                role="status"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            ) : null}
          </aside>

          <section className="rounded-lg border border-white/10 bg-[#080d14]/88 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.42)] backdrop-blur sm:p-6 lg:p-7">
            {errors.form ? (
              <div
                className="mb-5 flex gap-3 rounded-lg border border-[#ff8a65]/25 bg-[#ff8a65]/10 p-4 text-sm text-[#ffb199]"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errors.form}</span>
              </div>
            ) : null}

            {renderCurrentStep()}

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row">
                {currentStep > 0 ? (
                  <Button
                    className="border-white/10 text-[#d7e5e2]"
                    disabled={isBusy}
                    icon={<ArrowLeft className="h-4 w-4" />}
                    type="button"
                    variant="authSecondary"
                    onClick={handleBack}
                  >
                    Back
                  </Button>
                ) : null}
                <Button
                  className="border-white/10 text-[#d7e5e2]"
                  disabled={isCompleting || isUploading}
                  icon={<Save className="h-4 w-4" />}
                  isLoading={isSaving}
                  type="button"
                  variant="authSecondary"
                  onClick={() => void handleSaveDraft()}
                >
                  Save draft
                </Button>
              </div>

              <Button
                disabled={isSaving || isUploading}
                icon={<ArrowRight className="h-4 w-4" />}
                isLoading={isCompleting}
                type="button"
                variant="authPrimary"
                onClick={() =>
                  currentStep === STEPS.length - 1
                    ? void handleFinish()
                    : void handleNext()
                }
              >
                {currentStep === STEPS.length - 1 ? "Finish setup" : "Continue"}
              </Button>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
