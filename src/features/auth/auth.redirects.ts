import type { Location } from "react-router-dom";
import type { AuthUser } from "./auth.types";

const OAUTH_INTENT_STORAGE_KEY = "3d-stylist.oauth-intended-route";

function isInternalPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

function isAuthFlowPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/auth/")
  );
}

function getPathname(value: string): string {
  return value.split(/[?#]/)[0] || "/";
}

export function normalizeRedirectPath(value: string | null | undefined) {
  if (!value || !isInternalPath(value)) {
    return null;
  }

  const pathname = getPathname(value);

  if (isAuthFlowPath(pathname) || pathname === "/onboarding") {
    return null;
  }

  return value;
}

export function getAuthIntentPath(state: unknown): string | null {
  const from = (state as { from?: Partial<Location> } | null)?.from;

  if (!from?.pathname) {
    return null;
  }

  return normalizeRedirectPath(
    `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`,
  );
}

export function resolvePostAuthRedirect(
  user: Pick<AuthUser, "onboardingCompleted"> | null | undefined,
  intendedPath?: string | null,
) {
  if (!user?.onboardingCompleted) {
    return "/onboarding";
  }

  return normalizeRedirectPath(intendedPath) ?? "/dashboard";
}

export function rememberOAuthIntent(intendedPath: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const safePath = normalizeRedirectPath(intendedPath);

  if (safePath) {
    window.sessionStorage.setItem(OAUTH_INTENT_STORAGE_KEY, safePath);
    return;
  }

  window.sessionStorage.removeItem(OAUTH_INTENT_STORAGE_KEY);
}

export function consumeOAuthIntent() {
  if (typeof window === "undefined") {
    return null;
  }

  const intendedPath = normalizeRedirectPath(
    window.sessionStorage.getItem(OAUTH_INTENT_STORAGE_KEY),
  );
  window.sessionStorage.removeItem(OAUTH_INTENT_STORAGE_KEY);

  return intendedPath;
}
