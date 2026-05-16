import { useState } from "react";
import type { ChangeEvent } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "./Input";

interface PasswordInputProps {
  label: string;
  name: string;
  value: string;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function PasswordInput({
  label,
  name,
  value,
  error,
  placeholder,
  autoComplete,
  onChange,
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        label={label}
        name={name}
        type={isVisible ? "text" : "password"}
        value={value}
        error={error}
        placeholder={placeholder}
        autoComplete={autoComplete}
        icon={<Lock className="h-4 w-4" />}
        className="pr-12"
        onChange={onChange}
      />
      <button
        type="button"
        className="absolute right-3 top-10 flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7df9df]"
        onClick={() => setIsVisible((value) => !value)}
        aria-label={isVisible ? "Hide password" : "Show password"}
        title={isVisible ? "Hide password" : "Show password"}
      >
        {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
