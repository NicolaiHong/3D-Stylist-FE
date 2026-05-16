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

const facebookEmailSuggestions = [
  {
    icon: RefreshCw,
    text: "Reconnect Facebook and approve the email permission again.",
  },
  {
    icon: UserRound,
    text: "Try another Facebook account that can share a verified email.",
  },
  {
    icon: CheckCircle2,
    text: "Continue with Google or use email/password login.",
  },
];

export function OAuthErrorPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const message =
    searchParams.get("message") || "The provider could not complete sign in.";
  const isFacebookMissingEmail =
    code === "OAUTH_EMAIL_REQUIRED" ||
    message.toLowerCase().includes("did not return an email");

  const title = isFacebookMissingEmail
    ? "Facebook sign-in could not be completed"
    : "Sign-in could not be completed";
  const description = isFacebookMissingEmail
    ? "Facebook did not provide an email address for this account."
    : "The provider could not complete sign in. Please try another sign-in method.";

  const continueWithGoogle = () => {
    window.location.href = authApi.getOAuthUrl("google");
  };

  return (
    <AuthLayout
      title={title}
      subtitle={description}
    >
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
              Your account is safe.
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              We need an email address to connect a secure 3D Stylist account.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.035] p-4">
        <p className="text-sm font-semibold text-slate-100">
          What you can do next
        </p>
        <ul className="mt-3 space-y-3">
          {facebookEmailSuggestions.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 text-sm leading-6 text-slate-300">
              <Icon className="mt-1 h-4 w-4 shrink-0 text-[#f0b44c]" />
              <span>{text}</span>
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
          Continue with Google
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
          Back to Login
        </Button>
      </div>

      <p className="mt-5 text-center text-sm text-slate-400">
        Prefer a password account?{" "}
        <Link
          className="font-semibold text-[#7df9df] transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7df9df]"
          to="/login"
        >
          Use email/password login
        </Link>
      </p>
    </AuthLayout>
  );
}
