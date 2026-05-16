import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../features/auth/auth.store";
import type { AuthRole } from "../features/auth/auth.types";

interface ProtectedRouteProps {
  allowedRoles?: AuthRole[];
  unauthorizedRedirectTo?: string;
}

export function ProtectedRoute({
  allowedRoles,
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

  return <Outlet />;
}
