import { KeyboardEvent, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole, X } from "lucide-react";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PaywallModal({ isOpen, onClose }: PaywallModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const firstButton = dialogRef.current?.querySelector<HTMLElement>(
      "a, button",
    );

    firstButton?.focus();

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      previousActiveElement?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") {
      return;
    }

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    if (!focusable?.length) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-sm"
      role="presentation"
    >
      <div
        aria-labelledby="paywall-title"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-[#00e5ff]/20 bg-[#1c1b1b] p-5 text-[#e5e2e1] shadow-[0_0_42px_rgba(0,229,255,0.14)]"
        ref={dialogRef}
        role="dialog"
        onKeyDown={trapFocus}
      >
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#00e5ff]/25 bg-[#00e5ff]/10 text-[#00e5ff]">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <button
            aria-label="Close paywall"
            className="flex h-10 w-10 items-center justify-center rounded-md text-[#bac9cc] transition hover:bg-white/[0.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#00e5ff]">
          PAYWALL_REQUIRED
        </p>
        <h2
          className="mt-3 font-display text-2xl font-semibold text-white"
          id="paywall-title"
        >
          Export is a paid feature.
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#bac9cc]">
          Download and export are available on paid plans. Starter unlocks model
          downloads and basic export.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff]"
            to="/credits"
            onClick={onClose}
          >
            View plans
          </Link>
          <button
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/60 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff]"
            type="button"
            onClick={onClose}
          >
            Continue previewing
          </button>
        </div>
      </div>
    </div>
  );
}
