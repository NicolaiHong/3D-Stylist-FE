import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { OAuthSuccessPage } from "../pages/OAuthSuccessPage";
import { OAuthErrorPage } from "../pages/OAuthErrorPage";
import { DashboardPage } from "../pages/DashboardPage";
import { StudioPage } from "../pages/StudioPage";
import { CreditsPage } from "../pages/CreditsPage";
import { CheckoutPage } from "../pages/CheckoutPage";
import { PaymentsPage } from "../pages/PaymentsPage";
import { PaymentResultPage } from "../pages/PaymentResultPage";
import { PhysicalPrintCheckoutStatusPage } from "../pages/PhysicalPrintCheckoutStatusPage";
import { PhysicalPrintOrderDetailPage } from "../pages/PhysicalPrintOrderDetailPage";
import { PhysicalPrintOrdersPage } from "../pages/PhysicalPrintOrdersPage";
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
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/success" element={<OAuthSuccessPage />} />
      <Route path="/auth/error" element={<OAuthErrorPage />} />
      <Route element={<ProtectedRoute requireCompletedOnboarding={false} />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/credits/checkout" element={<CheckoutPage />} />
        <Route
          path="/credits/checkout/:orderId/:method"
          element={<CheckoutPage />}
        />
        <Route path="/credits/checkout/:orderId" element={<CheckoutPage />} />
        <Route path="/credits/payment/:status" element={<PaymentResultPage />} />
        <Route
          path="/physical-print/orders"
          element={<PhysicalPrintOrdersPage />}
        />
        <Route
          path="/physical-print/orders/:orderId"
          element={<PhysicalPrintOrderDetailPage />}
        />
        <Route
          path="/physical-print/checkout/return"
          element={<PhysicalPrintCheckoutStatusPage mode="return" />}
        />
        <Route
          path="/physical-print/checkout/cancel"
          element={<PhysicalPrintCheckoutStatusPage mode="cancel" />}
        />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={[AUTH_ROLES.ADMIN]} />}>
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
