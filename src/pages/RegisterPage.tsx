import { FormEvent, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Mail, User } from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { OAuthButtons } from "../components/auth/OAuthButtons";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { PasswordInput } from "../components/common/PasswordInput";
import { useAuthStore } from "../features/auth/auth.store";
import {
  getAuthIntentPath,
  resolvePostAuthRedirect,
} from "../features/auth/auth.redirects";
import { useI18n } from "../i18n/useI18n";

interface RegisterFormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9\W_]).{8,128}$/;

export function RegisterPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const register = useAuthStore((state) => state.register);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const [values, setValues] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const redirectTo = useMemo(
    () => getAuthIntentPath(location.state),
    [location.state],
  );

  if (isAuthenticated) {
    return <Navigate to={resolvePostAuthRedirect(user, redirectTo)} replace />;
  }

  const validate = () => {
    const nextErrors: RegisterFormErrors = {};

    if (!values.fullName.trim()) {
      nextErrors.fullName = t("auth.validation.fullNameRequired");
    }

    if (!values.email.trim()) {
      nextErrors.email = t("auth.validation.emailRequired");
    } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      nextErrors.email = t("auth.validation.emailInvalid");
    }

    if (!strongPasswordPattern.test(values.password)) {
      nextErrors.password = t("auth.validation.passwordStrong");
    }

    if (values.confirmPassword !== values.password) {
      nextErrors.confirmPassword = t("auth.validation.passwordMismatch");
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();

    if (!validate()) {
      return;
    }

    const registeredUser = await register({
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      password: values.password,
    });
    navigate(resolvePostAuthRedirect(registeredUser, redirectTo), {
      replace: true,
    });
  };

  return (
    <AuthLayout
      title={t("auth.register.title")}
      subtitle={t("auth.register.subtitle")}
    >
      <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
        <Input
          label={t("auth.fullName")}
          name="fullName"
          value={values.fullName}
          error={errors.fullName}
          placeholder="Alex Morgan"
          autoComplete="name"
          icon={<User className="h-4 w-4" />}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              fullName: event.target.value,
            }))
          }
        />
        <Input
          label={t("auth.email")}
          name="email"
          type="email"
          value={values.email}
          error={errors.email}
          placeholder={t("auth.placeholder.email")}
          autoComplete="email"
          icon={<Mail className="h-4 w-4" />}
          onChange={(event) =>
            setValues((current) => ({ ...current, email: event.target.value }))
          }
        />
        <PasswordInput
          label={t("auth.password")}
          name="password"
          value={values.password}
          error={errors.password}
          placeholder={t("auth.placeholder.createPassword")}
          autoComplete="new-password"
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              password: event.target.value,
            }))
          }
        />
        <PasswordInput
          label={t("auth.confirmPassword")}
          name="confirmPassword"
          value={values.confirmPassword}
          error={errors.confirmPassword}
          placeholder={t("auth.placeholder.repeatPassword")}
          autoComplete="new-password"
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              confirmPassword: event.target.value,
            }))
          }
        />

        {error ? (
          <div
            className="flex items-start gap-3 rounded-md border border-[#ff8a65]/25 bg-[#ff8a65]/10 px-4 py-3 text-sm text-[#ffb199]"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <Button
          type="submit"
          variant="authPrimary"
          className="w-full"
          icon={<ArrowRight className="h-4 w-4" />}
          isLoading={isLoading}
        >
          {t("auth.register.submit")}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-sm text-slate-400">
        <span className="h-px flex-1 bg-white/[0.16]" />
        <span>{t("auth.separator")}</span>
        <span className="h-px flex-1 bg-white/[0.16]" />
      </div>

      <OAuthButtons />

      <p className="mt-7 text-center text-sm text-slate-400">
        {t("auth.register.existingUser")}{" "}
        <Link
          className="font-semibold text-[#7df9df] transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7df9df]"
          to="/login"
        >
          {t("auth.login.submit")}
        </Link>
      </p>
    </AuthLayout>
  );
}
