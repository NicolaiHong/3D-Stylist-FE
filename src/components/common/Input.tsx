import { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: ReactNode;
}

export function Input({
  label,
  error,
  icon,
  className = "",
  id,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;
  const stateClass = error
    ? "border-[#ff8a65] focus:border-[#ff8a65] focus:ring-[#ff8a65]/15"
    : "border-border-soft focus:border-accent-cyan focus:ring-accent-cyan/10";

  return (
    <div className="space-y-2.5">
      <label className="text-sm font-semibold text-text-primary" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent-cyan/70">
            {icon}
          </span>
        ) : null}
        <input
          id={inputId}
          className={`h-12 w-full rounded-md border bg-surface-muted px-3 text-base text-text-primary outline-none transition placeholder:text-text-muted focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${stateClass} ${icon ? "pl-10" : ""} ${className}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-sm text-[#ffb199]" id={`${inputId}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
