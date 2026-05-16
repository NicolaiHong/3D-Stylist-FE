import { Loader2 } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="atelier-grid relative flex min-h-screen items-center justify-center overflow-hidden px-4 text-slate-100">
      <div
        className="relative z-10 flex w-full max-w-sm flex-col items-center rounded-lg border border-white/10 bg-[#0b111a] p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.4)]"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#2cebcf]" />
        <p className="mt-4 text-sm font-semibold text-slate-100">
          Preparing your styling studio
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Checking your secure session.
        </p>
      </div>
    </div>
  );
}
