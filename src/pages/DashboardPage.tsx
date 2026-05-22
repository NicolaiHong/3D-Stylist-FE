import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Database,
  Download,
  LockKeyhole,
  Plus,
  RefreshCw,
  Sparkles,
  UserRound,
} from "lucide-react";
import { PaywallModal } from "../components/billing/PaywallModal";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { billingApi } from "../features/billing/billing.api";
import type { BillingOrder, BillingSummary } from "../features/billing/billing.types";
import { useAuthStore } from "../features/auth/auth.store";
import { getApiErrorMessage } from "../services/apiClient";

function formatDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getProductName(order: BillingOrder | null | undefined) {
  return order?.items[0]?.productName ?? "billing order";
}

function getPlanTone(summary: BillingSummary | null) {
  if (!summary) {
    return "Checking";
  }

  return summary.plan.status === "active" ? "Active plan" : "Free plan";
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="h-72 animate-pulse rounded-lg border border-white/10 bg-white/[0.05] lg:col-span-8" />
      <div className="h-72 animate-pulse rounded-lg border border-white/10 bg-white/[0.05] lg:col-span-4" />
      <div className="h-52 animate-pulse rounded-lg border border-white/10 bg-white/[0.05] lg:col-span-4" />
      <div className="h-52 animate-pulse rounded-lg border border-white/10 bg-white/[0.05] lg:col-span-4" />
      <div className="h-52 animate-pulse rounded-lg border border-white/10 bg-white/[0.05] lg:col-span-4" />
    </div>
  );
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const displayName = user?.displayName || user?.fullName || "Creator";
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);

  async function loadBillingSummary() {
    setIsLoading(true);
    setError(null);

    try {
      const billingSummary = await billingApi.getBillingMe();
      setSummary(billingSummary);
    } catch (loadError) {
      setSummary(null);
      setError(getApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadBillingSummary();
  }, []);

  const pendingOrder = summary?.pendingOrders[0] ?? null;
  const renewalDate = formatDate(summary?.plan.currentPeriodEnd);
  const latestPayment = summary?.latestPayment;

  return (
    <DashboardShell planLabel={summary?.plan.name}>
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <div className="mx-auto w-full max-w-[1200px] space-y-8">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
                Dashboard
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Good day, {displayName}.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bac9cc] sm:text-base">
                Your studio is ready for VietQR checkout and future 3D
                generation workflows.
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-4 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
              to="/credits"
            >
              Credits and plans
              <ArrowRight className="h-4 w-4" />
            </Link>
          </header>

          {pendingOrder ? (
            <section className="rounded-lg border border-[#f3bf26]/30 bg-[#f3bf26]/10 p-4 text-[#ffeac0]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Payment pending for {getProductName(pendingOrder)}.
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-[#ffeac0]/78">
                      Continue with VietQR checkout from the credits page. No
                      credits or plan access are granted until admin
                      verification marks the order paid.
                    </p>
                  </div>
                </div>
                <Link
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-[#f3bf26] px-4 py-2.5 text-sm font-bold text-[#251a00] transition hover:bg-[#ffdf96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffdf96]"
                  to="/credits"
                >
                  Continue payment
                </Link>
              </div>
            </section>
          ) : null}

          {error ? (
            <section
              className="rounded-lg border border-[#ffb4ab]/30 bg-[#93000a]/25 p-5 text-[#ffdad6]"
              role="alert"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Billing summary unavailable
                    </h2>
                    <p className="mt-1 text-sm text-[#ffdad6]/80">{error}</p>
                  </div>
                </div>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#ffb4ab]/35 px-4 py-2.5 text-sm font-bold text-[#ffdad6] transition hover:bg-[#ffb4ab]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffb4ab]"
                  type="button"
                  onClick={() => void loadBillingSummary()}
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              </div>
            </section>
          ) : null}

          {isLoading ? (
            <DashboardSkeleton />
          ) : (
            <section className="grid gap-6 lg:grid-cols-12">
              <article className="relative overflow-hidden rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-6 lg:col-span-8 lg:p-8">
                <div className="absolute inset-x-0 top-0 h-px bg-[#00e5ff]/55" />
                <div className="flex h-full min-h-[260px] flex-col justify-between gap-8">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-md border border-[#00e5ff]/25 bg-[#00e5ff]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#9cf0ff]">
                      <span className="h-2 w-2 rounded-full bg-[#00e5ff]" />
                      Engine placeholder
                    </span>
                    <h2 className="mt-5 max-w-xl font-display text-3xl font-semibold leading-tight text-white">
                      Draft a new garment when the studio engine lands.
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-[#bac9cc]">
                      Week 03A keeps generation disabled while billing and
                      payment states become testable.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-5 py-3 text-sm font-bold text-[#001f24] opacity-70"
                      disabled
                      type="button"
                    >
                      <Plus className="h-4 w-4" />
                      Generate placeholder
                    </button>
                    <button
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-5 py-3 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                      type="button"
                      onClick={() => setIsPaywallOpen(true)}
                    >
                      <Download className="h-4 w-4" />
                      Check export gate
                    </button>
                  </div>
                </div>
              </article>

              <article className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-6 lg:col-span-4 lg:p-8">
                <div className="flex items-start justify-between gap-4">
                  <Database className="h-6 w-6 text-[#bac9cc]" />
                  <Link
                    className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.16em] text-[#00e5ff] transition hover:text-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                    to="/credits"
                  >
                    Top up
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-[#bac9cc]">
                  Credit balance
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-6xl font-semibold leading-none text-white">
                    {summary?.credits.balance ?? 0}
                  </span>
                  <span className="text-base font-semibold text-[#bac9cc]">
                    credits
                  </span>
                </div>
                <p className="mt-5 border-t border-[#3b494c]/70 pt-5 text-sm leading-6 text-[#bac9cc]">
                  1 credit = 1 HD generation.
                </p>
              </article>

              <article className="rounded-lg border border-[#3b494c] bg-[#201f1f] p-6 lg:col-span-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#00e5ff]/10 text-[#00e5ff]">
                    <CreditCard className="h-5 w-5" />
                  </span>
                  <span className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#bac9cc]">
                    {getPlanTone(summary)}
                  </span>
                </div>
                <h2 className="mt-5 font-display text-3xl font-semibold text-white">
                  {summary?.plan.name ?? "Free"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                  {summary?.plan.status === "active"
                    ? "Download and export access is unlocked for this account."
                    : "Preview generation available. Download/export locked."}
                </p>
                {renewalDate ? (
                  <p className="mt-4 text-sm font-semibold text-[#e5e2e1]">
                    Active through {renewalDate}
                  </p>
                ) : null}
                <Link
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[#00e5ff] px-4 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf0ff]"
                  to="/credits"
                >
                  {summary?.plan.status === "active" ? "Manage plan" : "Upgrade"}
                </Link>
              </article>

              <article className="rounded-lg border border-[#3b494c] bg-[#201f1f] p-6 lg:col-span-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#f3bf26]/12 text-[#f3bf26]">
                  {summary?.capabilities.canExportModel ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <LockKeyhole className="h-5 w-5" />
                  )}
                </div>
                <h2 className="mt-5 font-display text-2xl font-semibold text-white">
                  Export access
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                  {summary?.capabilities.canExportModel
                    ? "Paid plan capability confirmed by backend billing state."
                    : "PAYWALL_REQUIRED opens when export/download is blocked."}
                </p>
                <button
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                  type="button"
                  onClick={() => {
                    if (!summary?.capabilities.canExportModel) {
                      setIsPaywallOpen(true);
                    }
                  }}
                >
                  <Download className="h-4 w-4" />
                  Download/export access
                </button>
              </article>

              <article className="rounded-lg border border-[#3b494c] bg-[#201f1f] p-6 lg:col-span-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white/[0.08] text-[#bac9cc]">
                  <UserRound className="h-5 w-5" />
                </div>
                <h2 className="mt-5 font-display text-2xl font-semibold text-white">
                  Account
                </h2>
                <p className="mt-2 truncate text-sm font-semibold text-[#e5e2e1]">
                  {user?.email || "No email"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                  Profile and onboarding remain separate from paid plan state.
                </p>
                <Link
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                  to="/profile"
                >
                  View profile
                </Link>
              </article>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold text-white">
                  Recent generations
                </h2>
                <p className="mt-1 text-sm text-[#bac9cc]">
                  No generated garments yet.
                </p>
              </div>
              {latestPayment ? (
                <p className="text-sm font-semibold text-[#bac9cc]">
                  Latest payment: {latestPayment.status}
                </p>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  className="rounded-lg border border-[#3b494c]/70 bg-[#201f1f] p-4"
                  key={index}
                >
                  <div className="flex aspect-square flex-col items-center justify-center rounded-md border border-dashed border-[#3b494c] bg-[#0e0e0e] text-center">
                    <Sparkles className="h-8 w-8 text-[#3b494c]" />
                    <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[#849396]">
                      Empty slot
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
      />
    </DashboardShell>
  );
}
