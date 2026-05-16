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
    : "border-white/10 focus:border-[#2cebcf] focus:ring-[#2cebcf]/15";

  return (
    <div className="space-y-2.5">
      <label className="text-sm font-semibold text-slate-100" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7df9df]/70">
            {icon}
          </span>
        ) : null}
        <input
          id={inputId}
          className={`h-12 w-full rounded-md border bg-[#080d14] px-3 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${stateClass} ${icon ? "pl-10" : ""} ${className}`}
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
