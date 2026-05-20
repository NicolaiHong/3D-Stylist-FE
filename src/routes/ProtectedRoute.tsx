import { Navigate, Outlet, useLocation } from "react-router-dom";
import { userNeedsOnboarding } from "../features/auth/auth.redirects";
import { useAuthStore } from "../features/auth/auth.store";
import type { AuthRole } from "../features/auth/auth.types";

interface ProtectedRouteProps {
  allowedRoles?: AuthRole[];
  requireCompletedOnboarding?: boolean;
  unauthorizedRedirectTo?: string;
}

export function ProtectedRoute({
  allowedRoles,
  requireCompletedOnboarding = true,
  unauthorizedRedirectTo = "/dashboard",
}: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles?.length && (!user || !allowedRoles.includes(user.role))) {
    return <Navigate to={unauthorizedRedirectTo} replace />;
  }

  if (requireCompletedOnboarding && userNeedsOnboarding(user)) {
    return <Navigate to="/onboarding" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
