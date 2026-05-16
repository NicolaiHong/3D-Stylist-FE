import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Mail, User } from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { OAuthButtons } from "../components/auth/OAuthButtons";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { PasswordInput } from "../components/common/PasswordInput";
import { useAuthStore } from "../features/auth/auth.store";

interface RegisterFormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9\W_]).{8,128}$/;

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
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

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const validate = () => {
    const nextErrors: RegisterFormErrors = {};

    if (!values.fullName.trim()) {
      nextErrors.fullName = "Full name is required";
    }

    if (!values.email.trim()) {
      nextErrors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      nextErrors.email = "Enter a valid email";
    }

    if (!strongPasswordPattern.test(values.password)) {
      nextErrors.password =
        "Use 8+ characters with uppercase, lowercase, and a number or symbol";
    }

    if (values.confirmPassword !== values.password) {
      nextErrors.confirmPassword = "Passwords do not match";
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

    await register({
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      password: values.password,
    });
    navigate("/dashboard", { replace: true });
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start generating personalized outfit concepts."
    >
      <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
        <Input
          label="Full name"
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
          placeholder="Create a password"
          autoComplete="new-password"
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              password: event.target.value,
            }))
          }
        />
        <PasswordInput
          label="Confirm password"
          name="confirmPassword"
          value={values.confirmPassword}
          error={errors.confirmPassword}
          placeholder="Repeat password"
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
          Create account
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-sm text-slate-500">
        <span className="h-px flex-1 bg-white/10" />
        <span>or</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <OAuthButtons />

      <p className="mt-7 text-center text-sm text-slate-400">
        Already have an account?{" "}
        <Link
          className="font-semibold text-[#7df9df] transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7df9df]"
          to="/login"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
