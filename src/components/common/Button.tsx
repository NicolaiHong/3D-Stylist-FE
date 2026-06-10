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
    "border border-accent-cyan/20 bg-accent-cyan text-[#001f24] hover:bg-[#9cf0ff] focus-visible:outline-focus-ring",
  secondary:
    "border border-border-soft bg-surface-muted text-text-primary hover:bg-surface-raised focus-visible:outline-focus-ring",
  ghost:
    "text-text-secondary hover:bg-white/[0.045] hover:text-text-primary focus-visible:outline-focus-ring",
  danger:
    "bg-clay text-white hover:bg-clay/90 focus-visible:outline-clay shadow-sm",
  authPrimary:
    "border border-accent-cyan/20 bg-accent-cyan text-[#001f24] hover:bg-[#9cf0ff] focus-visible:outline-focus-ring",
  authSecondary:
    "border border-border-soft bg-surface-muted text-text-primary hover:bg-surface-raised focus-visible:outline-focus-ring",
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
