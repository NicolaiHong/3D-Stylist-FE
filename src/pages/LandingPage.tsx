import { Component, ErrorInfo, ReactNode, Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  ChevronRight,
  Check,
  CircuitBoard,
  CreditCard,
  Download,
  Layers3,
  LayoutDashboard,
  LogIn,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useAuthStore } from "../features/auth/auth.store";
import { AUTH_ROLES } from "../features/auth/auth.types";

const FashionPreview3D = lazy(
  () => import("../components/landing/FashionPreview3D"),
);

interface PreviewBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface PreviewBoundaryState {
  hasError: boolean;
}

class PreviewErrorBoundary extends Component<
  PreviewBoundaryProps,
  PreviewBoundaryState
> {
  state: PreviewBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PreviewBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("Landing 3D preview failed to load", error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function PreviewLoadingFallback() {
  return (
    <div
      className="landing-preview-fallback"
      role="status"
      aria-live="polite"
    >
      <Sparkles className="h-6 w-6 text-[#00e5ff]" />
      <span>Preparing 3D fashion preview</span>
    </div>
  );
}

function PreviewErrorFallback() {
  return (
    <div className="landing-preview-fallback" role="alert">
      <CircuitBoard className="h-6 w-6 text-[#ffeac0]" />
      <span>3D preview is temporarily unavailable.</span>
    </div>
  );
}

const valueCards = [
  {
    title: "AI outfit generation",
    description:
      "Turn prompts, figure context, and style preferences into premium outfit directions for the studio workflow.",
    icon: Wand2,
  },
  {
    title: "3D preview direction",
    description:
      "Keep the interactive fashion viewer at the center of review, silhouette checks, and export planning.",
    icon: Layers3,
  },
  {
    title: "Credits and plans",
    description:
      "Connect generation access to the existing credits and subscription workflow without frontend-only grants.",
    icon: CreditCard,
  },
  {
    title: "VietQR MVP checkout",
    description:
      "Support the manual bank-transfer path with clear order codes and admin verification before access is granted.",
    icon: Banknote,
  },
];

const workflowSteps = [
  {
    title: "Prompt",
    description: "Describe the outfit, occasion, body context, and visual vibe.",
  },
  {
    title: "Generate",
    description: "Create AI styling direction through the authenticated studio flow.",
  },
  {
    title: "Preview",
    description: "Inspect proportion and silhouette in the interactive 3D viewer.",
  },
  {
    title: "Download",
    description: "Save supported outputs from the workspace when assets are ready.",
  },
];

const subscriptionPlans = [
  {
    name: "Starter",
    price: "99.000 đ",
    cadence: "/ month",
    description: "For individual creators exploring the 3D styling workflow.",
    badge: "Studio entry",
    features: [
      "10 included HD generations",
      "Download model and basic export",
      "Standard queue and basic export",
    ],
  },
  {
    name: "Creator",
    price: "199.000 đ",
    cadence: "/ month",
    description: "For fashion teams that need more renders and stronger texture quality.",
    badge: "Most balanced",
    isFeatured: true,
    features: [
      "30 included HD generations",
      "Download model and basic export",
      "Faster queue and better texture",
    ],
  },
  {
    name: "Pro",
    price: "399.000 đ",
    cadence: "/ month",
    description: "For high-volume concepting with priority production polish.",
    badge: "Priority studio",
    features: [
      "80 included HD generations",
      "Download model and basic export",
      "Priority render and high quality texture",
    ],
  },
];

const creditPacks = [
  { name: "10 credits", price: "49.000 đ" },
  { name: "25 credits", price: "99.000 đ" },
  { name: "100 credits", price: "299.000 đ" },
];

export function LandingPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const workspacePath = user?.role === AUTH_ROLES.ADMIN ? "/admin" : "/dashboard";
  const primaryHref = isAuthenticated ? workspacePath : "/register";
  const primaryLabel = isAuthenticated ? "Open studio" : "Start generating";
  const pricingHref = isAuthenticated ? "/credits" : "/register";
  const pricingCtaLabel = isAuthenticated ? "Open credits" : "Create account";

  return (
    <main className="landing-surface min-h-screen overflow-hidden bg-[#0a0a0a] text-[#e5e2e1]">
      <header className="relative z-30 border-b border-white/[0.08] bg-[#0a0a0a]/90">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            className="flex min-w-0 items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00e5ff]"
            to="/"
            aria-label="3D Stylist home"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#12dff3]/55 bg-[#12dff3]/15 text-[#c3f5ff]">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="truncate font-display text-base font-bold text-white">
              3D Stylist
            </span>
          </Link>

          <nav
            className="hidden items-center gap-6 text-sm font-semibold text-[#bac9cc] lg:flex"
            aria-label="Landing sections"
          >
            <a className="transition hover:text-white" href="#features">
              Features
            </a>
            <a className="transition hover:text-white" href="#workflow">
              Workflow
            </a>
            <a className="transition hover:text-white" href="#pricing">
              Credits
            </a>
            <a className="transition hover:text-white" href="#preview">
              Preview
            </a>
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link
                className="hidden min-h-10 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-3 py-2 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/40 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff] sm:inline-flex"
                to={workspacePath}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            ) : (
              <Link
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-[#bac9cc] transition hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff]"
                to="/login"
              >
                <LogIn className="hidden h-4 w-4 sm:block" />
                Sign in
              </Link>
            )}
            <Link
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#12dff3] bg-[#12dff3] px-4 py-2 text-sm font-bold text-[#001f24] shadow-[0_16px_42px_rgba(0,229,255,0.26)] transition hover:bg-[#c3f5ff] hover:shadow-[0_18px_50px_rgba(0,229,255,0.34)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c3f5ff]"
              to={primaryHref}
            >
              {isAuthenticated ? "Open studio" : "Get started"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section
        id="preview"
        className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 px-4 pb-20 pt-10 sm:px-6 md:pt-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:pb-24"
      >
        <div className="max-w-3xl">
          <p className="inline-flex rounded-md border border-[#12dff3]/45 bg-[#12dff3]/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#c3f5ff]">
            AI 3D fashion studio
          </p>
          <h1 className="mt-7 max-w-3xl font-display text-5xl font-bold leading-[1.02] text-white sm:text-6xl lg:text-7xl">
            Turn prompts into production-ready{" "}
            <span className="text-[#00e5ff]">AI fashion previews.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#bac9cc] sm:text-xl">
            Generate outfit direction from style intent, then inspect silhouette
            and proportion in an interactive 3D review surface before moving
            into the credits-backed studio workflow.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#12dff3] px-5 py-3 text-sm font-bold text-[#001f24] shadow-[0_18px_56px_rgba(0,229,255,0.28)] transition hover:bg-[#c3f5ff] hover:shadow-[0_22px_64px_rgba(0,229,255,0.38)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c3f5ff]"
              to={primaryHref}
            >
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            {isAuthenticated ? (
              <Link
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/[0.12] bg-[#121212] px-5 py-3 text-sm font-bold text-white transition hover:border-[#00e5ff]/40 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff]"
                to="/credits"
              >
                Explore credits
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <a
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/[0.12] bg-[#121212] px-5 py-3 text-sm font-bold text-white transition hover:border-[#00e5ff]/40 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff]"
                href="#pricing"
              >
                View plans
                <ChevronRight className="h-4 w-4" />
              </a>
            )}
          </div>

          <dl className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              ["Prompt", "Figure context"],
              ["Credits", "Checkout guardrails"],
              ["3D", "Preview review"],
            ].map(([label, detail]) => (
              <div
                className="rounded-lg border border-white/[0.08] bg-[#121212]/90 p-4"
                key={label}
              >
                <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#849396]">
                  {label}
                </dt>
                <dd className="mt-2 text-sm font-semibold text-[#e5e2e1]">
                  {detail}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="landing-preview-stage h-[390px] sm:h-[460px] md:h-[540px] lg:h-[640px]">
          <div className="landing-preview-card">
            <div className="landing-preview-toolbar">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#00e5ff]" />
                Interactive 3D preview
              </span>
              <span>GLB</span>
            </div>
            <PreviewErrorBoundary fallback={<PreviewErrorFallback />}>
              <Suspense fallback={<PreviewLoadingFallback />}>
                <FashionPreview3D />
              </Suspense>
            </PreviewErrorBoundary>
            <div className="landing-preview-caption">
              <span>Prompt-ready styling surface</span>
              <span className="text-[#9cf0ff]">Orbit preview</span>
            </div>
          </div>
          <div className="landing-preview-meta left-0 top-8">
            <BadgeCheck className="h-4 w-4 text-[#9cf0ff]" />
            <span>Auth-safe studio flow</span>
          </div>
          <div className="landing-preview-meta bottom-10 right-0">
            <CircuitBoard className="h-4 w-4 text-[#ffeac0]" />
            <span>Credits before production</span>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c3f5ff]">
            Studio infrastructure
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
            Premium fashion generation, wired to the MVP flows that already
            matter.
          </h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {valueCards.map((item) => {
            const Icon = item.icon;

            return (
              <article
                className="rounded-lg border border-white/[0.08] bg-[#121212]/90 p-5 transition hover:border-[#00e5ff]/30 hover:bg-[#151515]"
                key={item.title}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-md border border-[#12dff3]/40 bg-[#12dff3]/14 text-[#c3f5ff]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#bac9cc]">
                  {item.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section
        id="workflow"
        className="relative z-10 border-y border-white/[0.08] bg-[#0e0e0e]/90"
      >
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c3f5ff]">
                How it works
              </p>
              <h2 className="mt-4 max-w-xl font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Prompt to generation to 3D review, without pretending checkout
                is magic.
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-[#bac9cc] lg:justify-self-end">
              The landing page stays visual and aspirational, while the product
              path still respects authentication, credits, and payment
              verification.
            </p>
          </div>

          <ol className="mt-10 grid gap-3 md:grid-cols-4">
            {workflowSteps.map((step, index) => (
              <li
                className="landing-step-card rounded-lg border border-white/[0.08] bg-[#121212]/90 p-5"
                key={step.title}
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#12dff3]/45 bg-[#12dff3]/15 text-sm font-bold text-[#c3f5ff]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#bac9cc]">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="pricing"
        className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c3f5ff]">
            Plans and credit packs
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
            Choose a studio plan, then complete payment inside the existing
            credits flow.
          </h2>
          <p className="mt-4 text-base leading-7 text-[#bac9cc]">
            Landing pricing is a preview only. Credits and subscriptions are
            granted only after the current checkout and VietQR/manual
            verification flow completes.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {subscriptionPlans.map((plan) => (
            <article
              className={`relative flex min-h-full flex-col rounded-lg border p-5 transition ${
                plan.isFeatured
                  ? "border-[#12dff3]/70 bg-[#132326] shadow-[0_0_44px_rgba(0,229,255,0.18)]"
                  : "border-white/[0.08] bg-[#121212]/92 hover:border-[#12dff3]/40"
              }`}
              key={plan.name}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#849396]">
                    {plan.badge}
                  </p>
                  <h3 className="mt-3 font-display text-2xl font-semibold text-white">
                    {plan.name}
                  </h3>
                </div>
                {plan.isFeatured ? (
                  <span className="rounded-md border border-[#12dff3]/50 bg-[#12dff3]/15 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#c3f5ff]">
                    Popular
                  </span>
                ) : null}
              </div>

              <p className="mt-4 text-sm leading-6 text-[#bac9cc]">
                {plan.description}
              </p>

              <div className="mt-6 flex items-end gap-2">
                <span className="font-display text-4xl font-semibold leading-none text-white">
                  {plan.price}
                </span>
                <span className="pb-1 text-sm font-semibold text-[#849396]">
                  {plan.cadence}
                </span>
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li
                    className="flex gap-3 text-sm font-semibold leading-6 text-[#e5e2e1]"
                    key={feature}
                  >
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#12dff3]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                className={`mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c3f5ff] ${
                  plan.isFeatured
                    ? "bg-[#12dff3] text-[#001f24] shadow-[0_16px_48px_rgba(0,229,255,0.28)] hover:bg-[#c3f5ff]"
                    : "border border-white/[0.12] text-[#e5e2e1] hover:border-[#12dff3]/55 hover:bg-[#12dff3]/10"
                }`}
                to={pricingHref}
              >
                {pricingCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {creditPacks.map((pack) => (
            <Link
              className="group rounded-lg border border-[#2a3f42] bg-[#0f1617]/92 p-4 transition hover:border-[#12dff3]/65 hover:bg-[#132326] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12dff3]"
              key={pack.name}
              to={pricingHref}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#849396]">
                    Credit pack
                  </p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-white">
                    {pack.name}
                  </h3>
                </div>
                <CreditCard className="h-5 w-5 text-[#12dff3] transition group-hover:text-[#c3f5ff]" />
              </div>
              <p className="mt-4 font-display text-2xl font-semibold text-[#c3f5ff]">
                {pack.price}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#12dff3] px-5 py-3 text-sm font-bold text-[#001f24] shadow-[0_18px_56px_rgba(0,229,255,0.28)] transition hover:bg-[#c3f5ff] hover:shadow-[0_22px_64px_rgba(0,229,255,0.38)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c3f5ff] sm:w-auto"
            to={pricingHref}
          >
            {isAuthenticated ? "Open credits" : "Start generating"}
            <ArrowRight className="h-4 w-4" />
          </Link>
          {!isAuthenticated ? (
            <Link
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-white/[0.12] px-5 py-3 text-sm font-bold text-[#e5e2e1] transition hover:border-[#12dff3]/55 hover:bg-[#12dff3]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12dff3] sm:w-auto"
              to="/login"
            >
              Sign in
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </section>

      <section className="relative z-10 border-y border-white/[0.08] bg-[#0e0e0e]/90">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 text-center sm:px-6 lg:px-8">
          <Download className="mx-auto h-8 w-8 text-[#9cf0ff]" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#849396]">
              Ready for the studio
            </p>
            <h2 className="mx-auto mt-4 max-w-3xl font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Start with a premium 3D preview surface, then move into the full
              styling workspace.
            </h2>
          </div>
          <div className="mx-auto flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#12dff3] px-5 py-3 text-sm font-bold text-[#001f24] shadow-[0_18px_56px_rgba(0,229,255,0.24)] transition hover:bg-[#c3f5ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c3f5ff]"
              to={primaryHref}
            >
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-5 py-3 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/40 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff]"
              href="#features"
            >
              View features
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 text-sm text-[#849396] sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div>
          <Link
            className="inline-flex items-center gap-2 font-display font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00e5ff]"
            to="/"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#12dff3] text-[#001f24]">
              <Sparkles className="h-4 w-4" />
            </span>
            3D Stylist
          </Link>
          <p className="mt-3 max-w-md leading-6">
            AI fashion generation MVP with authentication, credits, and a
            cinematic 3D preview experience.
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-5 gap-y-3 font-semibold"
        >
          <a className="transition hover:text-white" href="#features">
            Features
          </a>
          <a className="transition hover:text-white" href="#workflow">
            Workflow
          </a>
          <Link className="transition hover:text-white" to={pricingHref}>
            Credits
          </Link>
          <Link
            className="transition hover:text-white"
            to={isAuthenticated ? workspacePath : "/login"}
          >
            {isAuthenticated ? "Dashboard" : "Sign in"}
          </Link>
        </nav>
      </footer>
    </main>
  );
}
