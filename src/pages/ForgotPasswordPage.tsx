import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Mail } from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { authApi } from "../features/auth/auth.api";
import { getApiErrorMessage } from "../services/apiClient";
import { useI18n } from "../i18n/useI18n";

interface ForgotPasswordFormErrors {
  email?: string;
}

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<ForgotPasswordFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const nextErrors: ForgotPasswordFormErrors = {};

    if (!email.trim()) {
      nextErrors.email = t("auth.validation.emailRequired");
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.email = t("auth.validation.emailInvalid");
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

    const normalizedEmail = email.trim();
    setIsLoading(true);

    try {
      await authApi.forgotPassword({ email: normalizedEmail });

      navigate("/reset-password", {
        state: {
          email: normalizedEmail,
          notice: t("auth.forgot.success"),
        },
      });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.forgot.title")}
      subtitle={t("auth.forgot.subtitle")}
    >
      <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
        <Input
          label={t("auth.email")}
          name="email"
          type="email"
          value={email}
          error={errors.email}
          placeholder={t("auth.placeholder.email")}
          autoComplete="email"
          icon={<Mail className="h-4 w-4" />}
          onChange={(event) => setEmail(event.target.value)}
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
          {t("auth.forgot.submit")}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-400">
        <Link
          className="font-semibold text-[#7df9df] transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7df9df]"
          to="/login"
        >
          {t("auth.forgot.backToLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
}
