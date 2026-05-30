import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { OAuthSuccessPage } from "../pages/OAuthSuccessPage";
import { OAuthErrorPage } from "../pages/OAuthErrorPage";
import { DashboardPage } from "../pages/DashboardPage";
import { CreditsPage } from "../pages/CreditsPage";
import { CheckoutPage } from "../pages/CheckoutPage";
import { PaymentResultPage } from "../pages/PaymentResultPage";
import { AdminPage } from "../pages/AdminPage";
import { ProfilePage } from "../pages/ProfilePage";
import { OnboardingPage } from "../pages/OnboardingPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { LandingPage } from "../pages/LandingPage";
import { AUTH_ROLES } from "../features/auth/auth.types";

export function AppRoutes() {
  return (
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
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="/credits/checkout" element={<CheckoutPage />} />
        <Route path="/credits/checkout/:orderId" element={<CheckoutPage />} />
        <Route path="/credits/payment/:status" element={<PaymentResultPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={[AUTH_ROLES.ADMIN]} />}>
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
