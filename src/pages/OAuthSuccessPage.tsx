import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { useAuthStore } from "../features/auth/auth.store";
import {
  consumeOAuthIntent,
  resolvePostAuthRedirect,
} from "../features/auth/auth.redirects";

export function OAuthSuccessPage() {
  const navigate = useNavigate();
  const completeOAuth = useAuthStore((state) => state.completeOAuth);
  const [failed, setFailed] = useState(false);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }

    hasStarted.current = true;

    const intendedPath = consumeOAuthIntent();

    completeOAuth()
      .then((user) =>
        navigate(resolvePostAuthRedirect(user, intendedPath), { replace: true }),
      )
      .catch(() => setFailed(true));
  }, [completeOAuth, navigate]);

  if (failed) {
    return (
      <Navigate to="/auth/error?message=OAuth%20session%20is%20invalid" replace />
    );
  }

  return (
    <AuthLayout
      title="Finishing sign in"
      subtitle="Your secure session is being prepared before we send you to the studio."
    >
      <div
        className="rounded-md border border-[#2cebcf]/20 bg-[#2cebcf]/10 p-4 text-[#b7fff0]"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="font-semibold">OAuth connected</span>
          <Loader2 className="ml-auto h-5 w-5 animate-spin" />
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Syncing your profile and opening the dashboard.
        </p>
      </div>
    </AuthLayout>
  );
}
