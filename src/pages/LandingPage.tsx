import { Component, ErrorInfo, ReactNode, Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BrainCircuit,
  Camera,
  ChevronRight,
  CircuitBoard,
  Layers3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

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
      <Sparkles className="h-6 w-6 text-[#2cebcf]" />
      <span>Preparing atelier preview</span>
    </div>
  );
}

function PreviewErrorFallback() {
  return (
    <div className="landing-preview-fallback" role="alert">
      <CircuitBoard className="h-6 w-6 text-[#ffb199]" />
      <span>3D preview is temporarily unavailable.</span>
    </div>
  );
}

const featureItems = [
  {
    title: "Fit-aware styling",
    description:
      "Build outfit direction around figure signals, silhouette, and visual balance.",
    icon: Camera,
  },
  {
    title: "AI atelier flow",
    description:
      "Move from wardrobe intent to polished fashion concepts without losing creative control.",
    icon: BrainCircuit,
  },
  {
    title: "3D-first review",
    description:
      "Preview styling ideas as spatial assets before they become production work.",
    icon: Layers3,
  },
];

const workflowSteps = [
  "Capture figure context",
  "Generate style direction",
  "Review the 3D look",
  "Refine for production",
];

export function LandingPage() {
  return (
    <main className="landing-surface min-h-screen overflow-hidden bg-[#05070b] text-slate-100">
      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link
          className="flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7df9df]"
          to="/"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[#2cebcf]/30 bg-[#2cebcf]/10 text-[#7df9df]">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="text-base font-bold text-white">3D Stylist</span>
        </Link>

        <nav
          className="hidden items-center gap-6 text-sm font-semibold text-slate-300 md:flex"
          aria-label="Landing"
        >
          <a className="transition hover:text-white" href="#features">
            Features
          </a>
          <a className="transition hover:text-white" href="#workflow">
            Workflow
          </a>
          <a className="transition hover:text-white" href="#preview">
            Preview
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            className="hidden rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7df9df] sm:inline-flex"
            to="/login"
          >
            Sign in
          </Link>
          <Link
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#2cebcf]/30 bg-[#2cebcf] px-4 py-2 text-sm font-bold text-[#06100e] shadow-[0_16px_42px_rgba(44,235,207,0.2)] transition hover:bg-[#7df9df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7df9df]"
            to="/register"
          >
            Start
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section
        id="preview"
        className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-8 lg:pb-16 lg:pt-10"
      >
        <div className="max-w-3xl">
          <p className="inline-flex rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[#7df9df]">
            AI fashion-tech studio
          </p>
          <h1 className="mt-7 max-w-2xl text-5xl font-black leading-[0.96] text-white sm:text-6xl lg:text-7xl">
            3D Stylist
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
            A premium styling surface for turning figure context, wardrobe
            intent, and AI direction into an interactive fashion preview.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-bold text-[#05070b] transition hover:bg-[#e8fff9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              to="/register"
            >
              Create your studio
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white transition hover:border-[#2cebcf]/45 hover:bg-[#2cebcf]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7df9df]"
              to="/login"
            >
              Open workspace
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 hidden max-w-2xl gap-3 sm:grid sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <p className="text-2xl font-black text-white">GLB</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Model preview
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <p className="text-2xl font-black text-white">AI</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Styling layer
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <p className="text-2xl font-black text-white">3D</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Review flow
              </p>
            </div>
          </div>
        </div>

        <div className="landing-preview-stage h-[380px] md:h-[520px] lg:h-[620px]">
          <div className="landing-preview-meta left-0 top-6">
            <ShieldCheck className="h-4 w-4 text-[#7df9df]" />
            <span>Realtime studio surface</span>
          </div>
          <div className="landing-preview-meta bottom-8 right-0">
            <CircuitBoard className="h-4 w-4 text-[#ffb199]" />
            <span>Fashion asset pipeline</span>
          </div>
          <PreviewErrorBoundary fallback={<PreviewErrorFallback />}>
            <Suspense fallback={<PreviewLoadingFallback />}>
              <FashionPreview3D />
            </Suspense>
          </PreviewErrorBoundary>
        </div>
      </section>

      <section
        id="features"
        className="relative z-10 mx-auto grid w-full max-w-7xl gap-4 px-4 pb-16 sm:px-6 md:grid-cols-3 lg:px-8"
      >
        {featureItems.map((item) => {
          const Icon = item.icon;

          return (
            <article
              className="rounded-lg border border-white/10 bg-[#0a1017]/80 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]"
              key={item.title}
            >
              <Icon className="h-6 w-6 text-[#2cebcf]" />
              <h2 className="mt-5 text-xl font-bold text-white">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {item.description}
              </p>
            </article>
          );
        })}
      </section>

      <section
        id="workflow"
        className="relative z-10 border-y border-white/10 bg-white/[0.025]"
      >
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#ffb199]">
              AI workflow
            </p>
            <h2 className="mt-4 max-w-xl text-3xl font-black leading-tight text-white sm:text-4xl">
              From body context to spatial fashion direction.
            </h2>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2">
            {workflowSteps.map((step, index) => (
              <li
                className="flex min-h-24 items-center gap-4 rounded-lg border border-white/10 bg-[#080d13] p-4"
                key={step}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#2cebcf]/30 bg-[#2cebcf]/10 text-sm font-black text-[#7df9df]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-base font-bold text-slate-100">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#7df9df]">
            Ready for the atelier
          </p>
          <h2 className="mt-4 max-w-2xl text-3xl font-black leading-tight text-white sm:text-4xl">
            Start with a premium preview surface, then scale into the full
            styling workspace.
          </h2>
        </div>
        <Link
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#2cebcf] px-5 py-3 text-sm font-bold text-[#06100e] transition hover:bg-[#7df9df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7df9df]"
          to="/register"
        >
          Begin styling
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
