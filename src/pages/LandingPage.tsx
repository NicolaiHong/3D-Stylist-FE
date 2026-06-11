import { Component, ErrorInfo, ReactNode, Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
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
import { LanguageSwitch } from "../i18n/LanguageSwitch";
import { useI18n } from "../i18n/useI18n";

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
  const { t } = useI18n();

  return (
    <div
      className="landing-preview-fallback"
      role="status"
      aria-live="polite"
    >
      <Sparkles className="h-6 w-6 text-[#00e5ff]" />
      <span>{t("landing.preview.loading")}</span>
    </div>
  );
}

function PreviewErrorFallback() {
  const { t } = useI18n();

  return (
    <div className="landing-preview-fallback" role="alert">
      <CircuitBoard className="h-6 w-6 text-[#ffeac0]" />
      <span>{t("landing.preview.error")}</span>
    </div>
  );
}

const valueCards = [
  {
    titleKey: "landing.value.ai.title",
    descriptionKey: "landing.value.ai.description",
    icon: Wand2,
  },
  {
    titleKey: "landing.value.preview.title",
    descriptionKey: "landing.value.preview.description",
    icon: Layers3,
  },
  {
    titleKey: "landing.value.credits.title",
    descriptionKey: "landing.value.credits.description",
    icon: CreditCard,
  },
  {
    titleKey: "landing.value.checkout.title",
    descriptionKey: "landing.value.checkout.description",
    icon: Banknote,
  },
];

const workflowSteps = [
  {
    titleKey: "landing.workflow.prompt.title",
    descriptionKey: "landing.workflow.prompt.description",
  },
  {
    titleKey: "landing.workflow.generate.title",
    descriptionKey: "landing.workflow.generate.description",
  },
  {
    titleKey: "landing.workflow.preview.title",
    descriptionKey: "landing.workflow.preview.description",
  },
  {
    titleKey: "landing.workflow.download.title",
    descriptionKey: "landing.workflow.download.description",
  },
];

const subscriptionPlans = [
  {
    name: "Starter",
    price: "99.000 đ",
    descriptionKey: "landing.plan.starter.description",
    badgeKey: "landing.plan.starter.badge",
    features: [
      "landing.plan.feature.10",
      "landing.plan.feature.export",
      "landing.plan.feature.standardQueue",
    ],
  },
  {
    name: "Creator",
    price: "199.000 đ",
    descriptionKey: "landing.plan.creator.description",
    badgeKey: "landing.plan.creator.badge",
    isFeatured: true,
    features: [
      "landing.plan.feature.30",
      "landing.plan.feature.export",
      "landing.plan.feature.fasterQueue",
    ],
  },
  {
    name: "Pro",
    price: "399.000 đ",
    descriptionKey: "landing.plan.pro.description",
    badgeKey: "landing.plan.pro.badge",
    features: [
      "landing.plan.feature.80",
      "landing.plan.feature.export",
      "landing.plan.feature.priorityQueue",
    ],
  },
];

const creditPacks = [
  { nameKey: "landing.creditPack.10", price: "49.000 đ" },
  { nameKey: "landing.creditPack.25", price: "99.000 đ" },
  { nameKey: "landing.creditPack.100", price: "299.000 đ" },
];

export function LandingPage() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const workspacePath = user?.role === AUTH_ROLES.ADMIN ? "/admin" : "/dashboard";
  const primaryHref = isAuthenticated ? workspacePath : "/register";
  const primaryLabel = isAuthenticated
    ? t("landing.openStudio")
    : t("landing.startGenerating");
  const pricingHref = isAuthenticated ? "/credits" : "/register";
  const pricingCtaLabel = isAuthenticated
    ? t("landing.openCredits")
    : t("landing.createAccount");

  return (
    <main className="landing-surface graphite-theme min-h-screen overflow-x-hidden bg-canvas text-text-primary">
      <header className="relative z-30 border-b border-border-subtle bg-canvas/90">
        <div className="landing-header-inner mx-auto flex w-full max-w-7xl items-center justify-between px-3 py-4 sm:px-6 lg:px-8">
          <Link
            className="landing-header-brand flex min-w-0 items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00e5ff] sm:gap-3"
            to="/"
            aria-label={t("landing.homeAria")}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#12dff3]/55 bg-[#12dff3]/15 text-[#c3f5ff]">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="landing-brand-wordmark truncate font-display text-base font-bold text-white">
              3D Stylist
            </span>
          </Link>

          <nav
            className="hidden items-center gap-6 text-sm font-semibold text-[#bac9cc] lg:flex"
            aria-label={t("landing.sectionsAria")}
          >
            <a className="transition hover:text-white" href="#features">
              {t("landing.nav.features")}
            </a>
            <a className="transition hover:text-white" href="#workflow">
              {t("landing.nav.workflow")}
            </a>
            <a className="transition hover:text-white" href="#pricing">
              {t("landing.nav.credits")}
            </a>
            <a className="transition hover:text-white" href="#preview">
              {t("landing.nav.preview")}
            </a>
          </nav>

          <div className="landing-header-actions flex min-w-0 items-center gap-2">
            <LanguageSwitch />
            {isAuthenticated ? (
              <Link
                className="hidden min-h-10 items-center justify-center gap-2 rounded-md border border-white/[0.12] px-3 py-2 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/40 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff] sm:inline-flex"
                to={workspacePath}
              >
                <LayoutDashboard className="h-4 w-4" />
                {t("landing.nav.dashboard")}
              </Link>
            ) : (
              <Link
                className="landing-header-secondary inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-[#bac9cc] transition hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff]"
                to="/login"
                aria-label={t("landing.signIn")}
              >
                <LogIn className="hidden h-4 w-4 sm:block" />
                {t("landing.signIn")}
              </Link>
            )}
            <Link
              className="landing-header-primary inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#12dff3] bg-[#12dff3] px-3 py-2 text-sm font-bold text-[#001f24] shadow-[0_16px_42px_rgba(0,229,255,0.26)] transition hover:bg-[#c3f5ff] hover:shadow-[0_18px_50px_rgba(0,229,255,0.34)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c3f5ff] sm:px-4"
              to={primaryHref}
            >
              {isAuthenticated ? t("landing.openStudio") : t("landing.getStarted")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section
        id="preview"
        className="relative z-10 mx-auto grid w-full max-w-7xl min-w-0 gap-10 px-4 pb-16 pt-9 sm:px-6 md:pt-14 lg:px-8 lg:pb-20 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-center xl:pb-24"
      >
        <div className="min-w-0 max-w-3xl">
          <p className="landing-hero-eyebrow inline-flex max-w-full rounded-md border border-[#12dff3]/45 bg-[#12dff3]/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#c3f5ff]">
            {t("landing.hero.eyebrow")}
          </p>
          <h1 className="landing-hero-title mt-6 max-w-3xl font-display font-bold text-white sm:mt-7">
            {t("landing.hero.titleLead")}{" "}
            <span className="text-[#00e5ff]">
              {t("landing.hero.titleAccent")}
            </span>
          </h1>
          <p className="landing-hero-body mt-5 max-w-2xl text-base leading-7 text-[#bac9cc] sm:mt-6 sm:text-lg sm:leading-8 lg:text-xl">
            {t("landing.hero.body")}
          </p>

          <div className="landing-hero-cta mt-7 flex min-w-0 flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
            <Link
              className="inline-flex min-h-12 w-full max-w-full items-center justify-center gap-2 rounded-md bg-[#12dff3] px-5 py-3 text-center text-sm font-bold text-[#001f24] shadow-[0_18px_56px_rgba(0,229,255,0.28)] transition hover:bg-[#c3f5ff] hover:shadow-[0_22px_64px_rgba(0,229,255,0.38)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c3f5ff] sm:w-auto"
              to={primaryHref}
            >
              <span>{primaryLabel}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            {isAuthenticated ? (
              <Link
                className="inline-flex min-h-12 w-full max-w-full items-center justify-center gap-2 rounded-md border border-white/[0.12] bg-[#121212] px-5 py-3 text-center text-sm font-bold text-white transition hover:border-[#00e5ff]/40 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff] sm:w-auto"
                to="/credits"
              >
                <span>{t("landing.exploreCredits")}</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <a
                className="inline-flex min-h-12 w-full max-w-full items-center justify-center gap-2 rounded-md border border-white/[0.12] bg-[#121212] px-5 py-3 text-center text-sm font-bold text-white transition hover:border-[#00e5ff]/40 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff] sm:w-auto"
                href="#pricing"
              >
                <span>{t("landing.viewPlans")}</span>
                <ChevronRight className="h-4 w-4" />
              </a>
            )}
          </div>

          <dl className="landing-metrics-row mt-9 max-w-2xl min-w-0 divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface-muted/70 sm:mt-10 sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              [t("landing.metric.prompt"), t("landing.metric.promptDetail")],
              [t("landing.metric.credits"), t("landing.metric.creditsDetail")],
              [t("landing.metric.preview"), t("landing.metric.previewDetail")],
            ].map(([label, detail]) => (
              <div
                className="landing-metric-item min-w-0 px-4 py-4 sm:px-5"
                key={label}
              >
                <dt className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
                  {label}
                </dt>
                <dd className="mt-2 text-sm font-semibold text-text-primary">
                  {detail}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="landing-preview-stage mx-auto w-full max-w-4xl min-w-0 xl:max-w-none">
          <div className="landing-preview-card">
            <div className="landing-preview-toolbar">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#00e5ff]" />
                {t("landing.preview.toolbar")}
              </span>
              <span className="shrink-0">GLB</span>
            </div>
            <div className="landing-preview-viewport h-[320px] sm:h-[390px] md:h-[460px] lg:h-[500px] xl:h-[640px]">
              <PreviewErrorBoundary fallback={<PreviewErrorFallback />}>
                <Suspense fallback={<PreviewLoadingFallback />}>
                  <FashionPreview3D />
                </Suspense>
              </PreviewErrorBoundary>
            </div>
            <div className="landing-preview-caption">
              <span>{t("landing.preview.captionLeft")}</span>
              <span className="text-[#9cf0ff]">
                {t("landing.preview.captionRight")}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c3f5ff]">
            {t("landing.features.eyebrow")}
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
            {t("landing.features.title")}
          </h2>
        </div>
        <div className="landing-feature-list mt-8 grid min-w-0 border-y border-border-subtle md:grid-cols-2">
          {valueCards.map((item) => {
            const Icon = item.icon;

            return (
              <article
                className="landing-feature-row flex min-w-0 gap-4 py-6 md:px-6"
                key={item.titleKey}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-accent-cyan-soft bg-accent-cyan/10 text-focus-ring">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-semibold text-text-primary">
                    {t(item.titleKey)}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-text-secondary">
                    {t(item.descriptionKey)}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section
        id="workflow"
        className="relative z-10 border-y border-border-subtle bg-surface-muted/80"
      >
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c3f5ff]">
                {t("landing.workflow.eyebrow")}
              </p>
              <h2 className="mt-4 max-w-xl font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                {t("landing.workflow.title")}
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-[#bac9cc] lg:justify-self-end">
              {t("landing.workflow.body")}
            </p>
          </div>

          <ol className="landing-workflow-list mt-10 min-w-0 border-y border-border-subtle lg:ml-auto lg:max-w-5xl">
            {workflowSteps.map((step, index) => (
              <li
                className="landing-workflow-step grid min-w-0 gap-4 py-6 md:grid-cols-[5rem_minmax(0,1fr)] md:gap-6"
                key={step.titleKey}
              >
                <span className="landing-workflow-index inline-flex h-10 w-10 items-center justify-center rounded-md border border-accent-cyan-soft bg-accent-cyan/10 text-sm font-bold text-focus-ring">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-semibold text-text-primary">
                    {t(step.titleKey)}
                  </h3>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
                    {t(step.descriptionKey)}
                  </p>
                </div>
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
            {t("landing.pricing.eyebrow")}
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
            {t("landing.pricing.title")}
          </h2>
          <p className="mt-4 text-base leading-7 text-[#bac9cc]">
            {t("landing.pricing.body")}
          </p>
        </div>

        <div className="mt-10 grid min-w-0 gap-4 lg:grid-cols-3">
          {subscriptionPlans.map((plan) => (
            <article
              className={`landing-pricing-plan relative flex min-h-full min-w-0 flex-col rounded-lg border p-5 ${
                plan.isFeatured ? "landing-pricing-plan--featured" : ""
              }`}
              key={plan.name}
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#849396]">
                    {t(plan.badgeKey)}
                  </p>
                  <h3 className="mt-3 break-words font-display text-2xl font-semibold text-white">
                    {plan.name}
                  </h3>
                </div>
                {plan.isFeatured ? (
                  <span className="rounded-md border border-accent-cyan-soft bg-accent-cyan/10 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-focus-ring">
                    {t("landing.plan.popular")}
                  </span>
                ) : null}
              </div>

              <p className="mt-4 text-sm leading-6 text-[#bac9cc]">
                {t(plan.descriptionKey)}
              </p>

              <div className="mt-6 flex items-end gap-2">
                <span className="font-display text-4xl font-semibold leading-none text-white">
                  {plan.price}
                </span>
                <span className="pb-1 text-sm font-semibold text-[#849396]">
                  {t("landing.plan.cadence")}
                </span>
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li
                    className="flex min-w-0 gap-3 text-sm font-semibold leading-6 text-[#e5e2e1]"
                    key={feature}
                  >
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#12dff3]" />
                    <span className="min-w-0 break-words">{t(feature)}</span>
                  </li>
                ))}
              </ul>

              <Link
                className={`landing-plan-cta mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold ${
                  plan.isFeatured
                    ? "landing-plan-cta--featured"
                    : "landing-plan-cta--secondary"
                }`}
                to={pricingHref}
              >
                {pricingCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>

        <div className="landing-credit-pack-strip mt-6 grid min-w-0 gap-2 md:grid-cols-3">
          {creditPacks.map((pack) => (
            <Link
              className="landing-credit-pack-link group"
              key={pack.nameKey}
              to={pricingHref}
            >
              <span className="landing-credit-pack-marker" aria-hidden="true">
                <CreditCard className="h-4 w-4" />
              </span>
              <span className="landing-credit-pack-copy">
                <span className="landing-credit-pack-label">
                  {t("landing.creditPack")}
                </span>
                <span className="landing-credit-pack-title">
                  {t(pack.nameKey)}
                </span>
              </span>
              <span className="landing-credit-pack-price">{pack.price}</span>
            </Link>
          ))}
        </div>

        <div className="landing-pricing-quiet-cta mt-7 flex flex-col items-center justify-center gap-2 text-center sm:flex-row">
          <Link className="landing-pricing-text-link" to={pricingHref}>
            {pricingCtaLabel}
            <ChevronRight className="h-4 w-4" />
          </Link>
          {!isAuthenticated ? (
            <Link className="landing-pricing-muted-link" to="/login">
              {t("landing.signIn")}
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </section>

      <section className="landing-final-section relative z-10">
        <div className="mx-auto grid max-w-7xl gap-7 px-4 py-16 text-center sm:px-6 lg:px-8">
          <Download className="landing-final-icon mx-auto h-8 w-8" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#849396]">
              {t("landing.final.eyebrow")}
            </p>
            <h2 className="mx-auto mt-4 max-w-3xl font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
              {t("landing.final.title")}
            </h2>
          </div>
          <div className="mx-auto flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <Link className="landing-final-primary" to={primaryHref}>
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a className="landing-final-secondary" href="#features">
              {t("landing.viewFeatures")}
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
            {t("landing.footer.description")}
          </p>
        </div>
        <nav
          aria-label={t("landing.footerAria")}
          className="flex flex-wrap gap-x-5 gap-y-3 font-semibold"
        >
          <a className="transition hover:text-white" href="#features">
            {t("landing.nav.features")}
          </a>
          <a className="transition hover:text-white" href="#workflow">
            {t("landing.nav.workflow")}
          </a>
          <Link className="transition hover:text-white" to={pricingHref}>
            {t("landing.nav.credits")}
          </Link>
          <Link
            className="transition hover:text-white"
            to={isAuthenticated ? workspacePath : "/login"}
          >
            {isAuthenticated ? t("landing.nav.dashboard") : t("landing.signIn")}
          </Link>
        </nav>
      </footer>
    </main>
  );
}
