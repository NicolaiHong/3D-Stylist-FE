import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  RotateCcw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { DashboardShell } from "../components/dashboard/DashboardShell";

type PaymentResultStatus = "success" | "failed" | "cancelled" | "unknown";

interface PaymentResultCopy {
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  panelClassName: string;
  iconClassName: string;
}

const resultCopy: Record<PaymentResultStatus, PaymentResultCopy> = {
  success: {
    title: "Payment result confirmed",
    eyebrow: "Gateway return",
    description:
      "The backend accepted the gateway return and recorded the payment result. Open credits to refresh your current billing state.",
    icon: CheckCircle2,
    panelClassName: "border-[#00e5ff]/30 bg-[#00e5ff]/10 text-[#c3f5ff]",
    iconClassName: "border-[#00e5ff]/35 bg-[#00e5ff]/12 text-[#00e5ff]",
  },
  failed: {
    title: "Payment was not completed",
    eyebrow: "Payment failed",
    description:
      "The gateway returned a failed payment result. You can return to credits or resume this checkout if the order is still valid.",
    icon: XCircle,
    panelClassName: "border-[#ffb4ab]/30 bg-[#93000a]/25 text-[#ffdad6]",
    iconClassName: "border-[#ffb4ab]/35 bg-[#93000a]/25 text-[#ffb4ab]",
  },
  cancelled: {
    title: "Payment was cancelled",
    eyebrow: "Payment cancelled",
    description:
      "The gateway reported a cancelled payment. You can return to credits or resume this checkout if the order is still valid.",
    icon: Clock3,
    panelClassName: "border-[#f3bf26]/30 bg-[#f3bf26]/10 text-[#ffeac0]",
    iconClassName: "border-[#f3bf26]/35 bg-[#f3bf26]/12 text-[#f3bf26]",
  },
  unknown: {
    title: "Payment result received",
    eyebrow: "Review needed",
    description:
      "The payment return used a status this app does not recognize. Check your credits page before starting another checkout.",
    icon: AlertTriangle,
    panelClassName: "border-[#3b494c] bg-[#1c1b1b] text-[#bac9cc]",
    iconClassName: "border-[#3b494c] bg-[#0e0e0e] text-[#bac9cc]",
  },
};

function normalizeStatus(value: string | undefined): PaymentResultStatus {
  if (value === "success" || value === "failed" || value === "cancelled") {
    return value;
  }

  if (value === "canceled") {
    return "cancelled";
  }

  return "unknown";
}

export function PaymentResultPage() {
  const { status: rawStatus } = useParams();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const status = normalizeStatus(rawStatus);
  const copy = resultCopy[status];
  const Icon = copy.icon;
  const canResumeCheckout =
    Boolean(orderId) && (status === "failed" || status === "cancelled");

  return (
    <DashboardShell>
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-[980px] space-y-5">
          <header className="rounded-lg border border-[#262626] bg-[#121212] p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00e5ff]">
              {copy.eyebrow}
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bac9cc] sm:text-base">
              {copy.description}
            </p>
          </header>

          <section className={`rounded-lg border p-5 ${copy.panelClassName}`}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <span
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-md border ${copy.iconClassName}`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold uppercase tracking-[0.14em]">
                  Status: {status}
                </p>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-md border border-white/10 bg-[#0e0e0e]/70 p-3">
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                      Order id
                    </dt>
                    <dd className="mt-2 break-words font-mono text-[#e5e2e1]">
                      {orderId ?? "Not returned"}
                    </dd>
                  </div>
                  <div className="rounded-md border border-white/10 bg-[#0e0e0e]/70 p-3">
                    <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#849396]">
                      Source
                    </dt>
                    <dd className="mt-2 font-semibold text-[#e5e2e1]">
                      Sandbox gateway return
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[#3b494c] bg-[#1c1b1b] p-4">
            <div className="flex gap-3">
              <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-[#00e5ff]" />
              <div>
                <h2 className="text-sm font-bold text-white">
                  Billing remains backend-owned
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#bac9cc]">
                  This page only displays the return URL result. It does not
                  grant credits or subscriptions. VietQR manual bank transfers
                  still require admin verification before access changes.
                </p>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#00e5ff] px-5 py-2.5 text-sm font-bold text-[#001f24] transition hover:bg-[#9cf0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf0ff]"
              to="/credits"
            >
              Back to credits
              <ArrowRight className="h-4 w-4" />
            </Link>
            {canResumeCheckout && orderId ? (
              <Link
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#00e5ff]/35 px-5 py-2.5 text-sm font-bold text-[#9cf0ff] transition hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                to={`/credits/checkout/${orderId}`}
              >
                <RotateCcw className="h-4 w-4" />
                Resume checkout
              </Link>
            ) : null}
            {status === "success" ? (
              <Link
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-5 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                to="/dashboard"
              >
                Open dashboard
              </Link>
            ) : null}
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}
