import { FormEvent, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Mail } from "lucide-react";
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

interface LoginFormErrors {
  email?: string;
  password?: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<LoginFormErrors>({});

  const redirectTo = useMemo(
    () => getAuthIntentPath(location.state),
    [location.state],
  );

  if (isAuthenticated) {
    return <Navigate to={resolvePostAuthRedirect(user, redirectTo)} replace />;
  }

  const validate = () => {
    const nextErrors: LoginFormErrors = {};

    if (!values.email.trim()) {
      nextErrors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      nextErrors.email = "Enter a valid email";
    }

    if (!values.password) {
      nextErrors.password = "Password is required";
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

    const authenticatedUser = await login(values);
    navigate(resolvePostAuthRedirect(authenticatedUser, redirectTo), {
      replace: true,
    });
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue creating AI outfit concepts."
    >
      <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
        <Input
          label="Email"
          name="email"
          type="email"
          value={values.email}
          error={errors.email}
          placeholder="you@example.com"
          autoComplete="email"
          icon={<Mail className="h-4 w-4" />}
          onChange={(event) =>
            setValues((current) => ({ ...current, email: event.target.value }))
          }
        />
        <PasswordInput
          label="Password"
          name="password"
          value={values.password}
          error={errors.password}
          placeholder="Your password"
          autoComplete="current-password"
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              password: event.target.value,
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
          Sign in
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-sm text-slate-500">
        <span className="h-px flex-1 bg-white/10" />
        <span>or</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <OAuthButtons />

      <p className="mt-7 text-center text-sm text-slate-400">
        New to 3D Stylist?{" "}
        <Link
          className="font-semibold text-[#7df9df] transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7df9df]"
          to="/register"
        >
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
