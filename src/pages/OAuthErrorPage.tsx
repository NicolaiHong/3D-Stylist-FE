import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { Button } from "../components/common/Button";
import { authApi } from "../features/auth/auth.api";
import { useI18n } from "../i18n/useI18n";

const facebookEmailSuggestions = [
  {
    icon: RefreshCw,
    key: "auth.oauthError.facebookEmailSuggestion1",
  },
  {
    icon: UserRound,
    key: "auth.oauthError.facebookEmailSuggestion2",
  },
  {
    icon: CheckCircle2,
    key: "auth.oauthError.facebookEmailSuggestion3",
  },
];

const sessionRestoreSuggestions = [
  {
    icon: RefreshCw,
    key: "auth.oauthError.sessionSuggestion1",
  },
  {
    icon: UserRound,
    key: "auth.oauthError.sessionSuggestion2",
  },
  {
    icon: CheckCircle2,
    key: "auth.oauthError.sessionSuggestion3",
  },
];

const genericProviderSuggestions = [
  {
    icon: RefreshCw,
    key: "auth.oauthError.genericSuggestion1",
  },
  {
    icon: UserRound,
    key: "auth.oauthError.genericSuggestion2",
  },
  {
    icon: CheckCircle2,
    key: "auth.oauthError.genericSuggestion3",
  },
];

export function OAuthErrorPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const message =
    searchParams.get("message") || t("auth.oauthError.fallbackMessage");
  const isEmailRequired =
    code === "OAUTH_EMAIL_REQUIRED" ||
    message.toLowerCase().includes("did not return an email");
  const isSessionRestoreFailure = code === "OAUTH_SESSION_RESTORE_FAILED";

  const title = isEmailRequired
    ? t("auth.oauthError.emailTitle")
    : isSessionRestoreFailure
      ? t("auth.oauthError.sessionTitle")
      : t("auth.oauthError.genericTitle");
  const description = isEmailRequired
    ? t("auth.oauthError.emailDescription")
    : isSessionRestoreFailure
      ? t("auth.oauthError.sessionDescription")
      : t("auth.oauthError.genericDescription");
  const alertTitle = isEmailRequired
    ? t("auth.oauthError.emailAlertTitle")
    : isSessionRestoreFailure
      ? t("auth.oauthError.sessionAlertTitle")
      : t("auth.oauthError.genericAlertTitle");
  const alertDescription = isEmailRequired
    ? t("auth.oauthError.emailAlertDescription")
    : isSessionRestoreFailure
      ? t("auth.oauthError.sessionAlertDescription")
      : t("auth.oauthError.genericAlertDescription");
  const suggestions = isEmailRequired
    ? facebookEmailSuggestions
    : isSessionRestoreFailure
      ? sessionRestoreSuggestions
      : genericProviderSuggestions;

  const continueWithGoogle = () => {
    window.location.href = authApi.getOAuthUrl("google");
  };

  return (
    <AuthLayout title={title} subtitle={description}>
      <div
        className="rounded-lg border border-[#f0b44c]/20 bg-[#f0b44c]/[0.07] p-4 text-[#ffe3a6] shadow-[0_18px_60px_rgba(0,0,0,0.18)]"
        role="alert"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#f0b44c]/25 bg-[#f0b44c]/10 text-[#f0b44c]">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#ffe8b8]">
              {alertTitle}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              {alertDescription}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.035] p-4">
        <p className="text-sm font-semibold text-slate-100">
          {t("auth.oauthError.nextSteps")}
        </p>
        <ul className="mt-3 space-y-3">
          {suggestions.map(({ icon: Icon, key }) => (
            <li key={key} className="flex gap-3 text-sm leading-6 text-slate-300">
              <Icon className="mt-1 h-4 w-4 shrink-0 text-[#f0b44c]" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button
          className="w-full"
          variant="authPrimary"
          icon={
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[13px] font-black text-[#1f2937]">
              G
            </span>
          }
          type="button"
          onClick={continueWithGoogle}
        >
          {t("auth.oauthError.continueWithGoogle")}
        </Button>
        <Button
          className="w-full"
          variant="authSecondary"
          icon={<ArrowLeft className="h-4 w-4" />}
          type="button"
          onClick={() => {
            window.location.href = "/login";
          }}
        >
          {t("auth.oauthError.backToLogin")}
        </Button>
      </div>

      <p className="mt-5 text-center text-sm text-slate-400">
        {t("auth.oauthError.passwordPrompt")}{" "}
        <Link
          className="font-semibold text-[#7df9df] transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7df9df]"
          to="/login"
        >
          {t("auth.oauthError.usePasswordLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
}
