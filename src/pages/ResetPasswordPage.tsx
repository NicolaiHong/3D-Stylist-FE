import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, CheckCircle, KeyRound, Mail } from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { PasswordInput } from "../components/common/PasswordInput";
import { authApi } from "../features/auth/auth.api";
import { getApiErrorMessage } from "../services/apiClient";
import { useI18n } from "../i18n/useI18n";

interface ResetPasswordLocationState {
  email?: string;
  notice?: string;
}

interface ResetPasswordFormErrors {
  email?: string;
  otp?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9\W_]).{8,128}$/;

export function ResetPasswordPage() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ResetPasswordLocationState | null;
  const initialEmail = useMemo(() => {
    const queryEmail = new URLSearchParams(location.search).get("email");
    return state?.email ?? queryEmail ?? "";
  }, [location.search, state?.email]);
  const [values, setValues] = useState({
    email: initialEmail,
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<ResetPasswordFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const nextErrors: ResetPasswordFormErrors = {};

    if (!values.email.trim()) {
      nextErrors.email = t("auth.validation.emailRequired");
    } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      nextErrors.email = t("auth.validation.emailInvalid");
    }

    if (!/^\d{6}$/.test(values.otp.trim())) {
      nextErrors.otp = t("auth.validation.otpInvalid");
    }

    if (!strongPasswordPattern.test(values.newPassword)) {
      nextErrors.newPassword = t("auth.validation.passwordStrong");
    }

    if (!values.confirmPassword) {
      nextErrors.confirmPassword = t("auth.validation.confirmPasswordRequired");
    } else if (values.confirmPassword !== values.newPassword) {
      nextErrors.confirmPassword = t("auth.validation.passwordMismatch");
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      await authApi.resetPassword({
        email: values.email.trim(),
        otp: values.otp.trim(),
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      navigate("/login?reset=success", { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.reset.title")}
      subtitle={t("auth.reset.subtitle")}
    >
      {state?.notice ? (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-[#2cebcf]/25 bg-[#2cebcf]/10 px-4 py-3 text-sm text-[#b9fff4]">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.notice}</span>
        </div>
      ) : null}

      <p className="mb-5 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
        {t("auth.reset.instruction")}
      </p>

      <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
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
        <Input
          label={t("auth.reset.otp")}
          name="otp"
          value={values.otp}
          error={errors.otp}
          placeholder={t("auth.placeholder.otp")}
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={6}
          icon={<KeyRound className="h-4 w-4" />}
          onChange={(event) =>
            setValues((current) => ({ ...current, otp: event.target.value }))
          }
        />
        <PasswordInput
          label={t("auth.reset.newPassword")}
          name="newPassword"
          value={values.newPassword}
          error={errors.newPassword}
          placeholder={t("auth.placeholder.createPassword")}
          autoComplete="new-password"
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              newPassword: event.target.value,
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
          {t("auth.reset.submit")}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-400">
        <Link
          className="font-semibold text-[#7df9df] transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7df9df]"
          to="/forgot-password"
        >
          {t("auth.reset.requestNewCode")}
        </Link>
      </p>
    </AuthLayout>
  );
}
