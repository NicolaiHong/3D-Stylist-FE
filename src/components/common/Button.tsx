import { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "authPrimary"
  | "authSecondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: ReactNode;
  isLoading?: boolean;
  variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-white hover:bg-moss focus-visible:outline-ink shadow-sm",
  secondary:
    "border border-ink/15 bg-white text-ink hover:border-jade hover:text-jade focus-visible:outline-jade",
  ghost:
    "text-ink hover:bg-ink/5 focus-visible:outline-jade",
  danger:
    "bg-clay text-white hover:bg-clay/90 focus-visible:outline-clay shadow-sm",
  authPrimary:
    "border border-[#34f5c5]/30 bg-[#2cebcf] text-[#06100e] shadow-[0_18px_45px_rgba(44,235,207,0.22)] hover:bg-[#7df9df] focus-visible:outline-[#7df9df]",
  authSecondary:
    "border border-white/10 bg-white/[0.04] text-slate-100 hover:border-[#34f5c5]/50 hover:bg-[#34f5c5]/10 focus-visible:outline-[#7df9df]",
};

export function Button({
  children,
  icon,
  isLoading = false,
  variant = "primary",
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      <span>{children}</span>
    </button>
  );
}
