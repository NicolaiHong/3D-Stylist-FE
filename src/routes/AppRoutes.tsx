import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { LoadingScreen } from "../components/common/LoadingScreen";
import { ProtectedRoute } from "./ProtectedRoute";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { OAuthSuccessPage } from "../pages/OAuthSuccessPage";
import { OAuthErrorPage } from "../pages/OAuthErrorPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { LandingPage } from "../pages/LandingPage";
import { AUTH_ROLES } from "../features/auth/auth.types";

const DashboardPage = lazy(() =>
  import("../pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const StudioPage = lazy(() =>
  import("../pages/StudioPage").then((module) => ({
    default: module.StudioPage,
  })),
);
const CreditsPage = lazy(() =>
  import("../pages/CreditsPage").then((module) => ({
    default: module.CreditsPage,
  })),
);
const CheckoutPage = lazy(() =>
  import("../pages/CheckoutPage").then((module) => ({
    default: module.CheckoutPage,
  })),
);
const PaymentResultPage = lazy(() =>
  import("../pages/PaymentResultPage").then((module) => ({
    default: module.PaymentResultPage,
  })),
);
const ProfilePage = lazy(() =>
  import("../pages/ProfilePage").then((module) => ({
    default: module.ProfilePage,
  })),
);
const OnboardingPage = lazy(() =>
  import("../pages/OnboardingPage").then((module) => ({
    default: module.OnboardingPage,
  })),
);
const AdminPage = lazy(() =>
  import("../pages/AdminPage").then((module) => ({
    default: module.AdminPage,
  })),
);

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/success" element={<OAuthSuccessPage />} />
        <Route path="/auth/error" element={<OAuthErrorPage />} />
        <Route element={<ProtectedRoute requireCompletedOnboarding={false} />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/studio" element={<StudioPage />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="/credits/checkout" element={<CheckoutPage />} />
          <Route path="/credits/checkout/:orderId" element={<CheckoutPage />} />
          <Route
            path="/credits/payment/:status"
            element={<PaymentResultPage />}
          />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={[AUTH_ROLES.ADMIN]} />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
