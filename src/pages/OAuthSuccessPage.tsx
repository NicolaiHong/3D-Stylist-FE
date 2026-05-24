import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { useAuthStore } from "../features/auth/auth.store";
import {
  consumeOAuthIntent,
  resolvePostAuthRedirect,
} from "../features/auth/auth.redirects";

const MIN_SUCCESS_DURATION_MS = 2000;

const statusLabels = [
  "Verifying session",
  "Loading profile",
  "Opening workspace",
];

export function OAuthSuccessPage() {
  const navigate = useNavigate();
  const completeOAuth = useAuthStore((state) => state.completeOAuth);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(4);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    const startedAt = performance.now();
    let frameId = window.requestAnimationFrame(function tick(now) {
      const elapsed = now - startedAt;
      const nextProgress = Math.min(
        100,
        Math.round((elapsed / MIN_SUCCESS_DURATION_MS) * 100),
      );

      setProgress(nextProgress);

      if (nextProgress < 100) {
        frameId = window.requestAnimationFrame(tick);
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }

    hasStarted.current = true;

    const intendedPath = consumeOAuthIntent();

    completeOAuth()
      .then((user) =>
        setRedirectTo(resolvePostAuthRedirect(user, intendedPath)),
      )
      .catch(() => {
        setFailed(true);
        window.setTimeout(() => {
          navigate("/auth/error?message=OAuth%20session%20is%20invalid", {
            replace: true,
          });
        }, 700);
      });
  }, [completeOAuth, navigate]);

  useEffect(() => {
    if (!failed && redirectTo && progress >= 100) {
      navigate(redirectTo, { replace: true });
    }
  }, [failed, navigate, progress, redirectTo]);

  const authSucceeded = Boolean(redirectTo);
  const visibleProgress = authSucceeded ? progress : Math.min(progress, 86);
  const activeStatusIndex = authSucceeded
    ? visibleProgress >= 100
      ? 2
      : visibleProgress >= 55
        ? 1
        : 0
    : visibleProgress >= 55
      ? 1
      : 0;

  return (
    <AuthLayout
      title={
        failed
          ? "Sign-in failed"
          : authSucceeded
            ? "Authentication successful"
            : "Verifying authentication"
      }
      subtitle="Preparing your 3D Stylist workspace..."
    >
      <section
        className="rounded-lg border border-[#00e5ff]/20 bg-[#00e5ff]/10 p-5 text-[#c3f5ff] shadow-[0_0_42px_rgba(0,229,255,0.08)]"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#00e5ff]/30 bg-[#00e5ff]/12 text-[#00e5ff]">
            {authSucceeded ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <LockKeyhole className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-white">
                {authSucceeded ? "Session ready" : "Secure connection"}
              </p>
              {failed ? null : authSucceeded && visibleProgress >= 100 ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#00e5ff]" />
              ) : (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#00e5ff]" />
              )}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {authSucceeded
                ? "Profile loaded. Opening your workspace now."
                : "We are confirming your session before redirecting."}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em] text-[#9cf0ff]">
            <span>Workspace preparation</span>
            <span>{visibleProgress}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#0e0e0e] ring-1 ring-white/10">
            <div
              className="h-full rounded-full bg-[#00e5ff] transition-[width] duration-200 ease-out"
              style={{ width: `${visibleProgress}%` }}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {statusLabels.map((label, index) => {
            const isActive = index <= activeStatusIndex;
            const isComplete =
              index < activeStatusIndex ||
              (authSucceeded && visibleProgress >= 100 && index === activeStatusIndex);

            return (
              <div
                className={`flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                  isActive
                    ? "border-[#00e5ff]/25 bg-[#00e5ff]/10 text-white"
                    : "border-white/10 bg-[#0e0e0e] text-slate-500"
                }`}
                key={label}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-md border ${
                    isActive
                      ? "border-[#00e5ff]/30 text-[#00e5ff]"
                      : "border-white/10 text-slate-500"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                </span>
                <span className="font-semibold">{label}</span>
              </div>
            );
          })}
        </div>
      </section>
    </AuthLayout>
  );
}
