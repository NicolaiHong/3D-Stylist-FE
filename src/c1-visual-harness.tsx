import React from "react";
import ReactDOM from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { DashboardShell } from "./components/dashboard/DashboardShell";
import { billingApi } from "./features/billing/billing.api";
import type { BillingSummary } from "./features/billing/billing.types";
import { useAuthStore } from "./features/auth/auth.store";
import type { AuthUser } from "./features/auth/auth.types";
import { figuresApi } from "./features/figures/figures.api";
import type { FigureDto } from "./features/figures/figures.types";
import { I18nProvider } from "./i18n/I18nProvider";
import { StudioPage } from "./pages/StudioPage";
import "./styles.css";

const now = "2026-06-11T07:00:00.000Z";
const previewUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='1100' viewBox='0 0 900 1100'%3E%3Crect width='900' height='1100' fill='%230f1418'/%3E%3Cpath d='M450 130 615 275 560 900 340 900 285 275Z' fill='%23223138' stroke='%2300e5ff' stroke-width='8'/%3E%3Cpath d='M285 275 120 430M615 275 780 430' stroke='%23bac9cc' stroke-width='34' stroke-linecap='round'/%3E%3C/svg%3E";

const figures: FigureDto[] = [
  {
    id: "figure-c1-primary",
    prompt:
      "Precision graphite evening coat with structured shoulders and a long editorial silhouette.\n\nStyle direction: minimal luxury, refined tailoring, premium materials.",
    status: "success",
    provider: "mock",
    previewUrl,
    modelUrl: "https://example.com/model.glb",
    thumbnailUrl: previewUrl,
    creditCost: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "figure-c1-secondary",
    prompt:
      "Technical streetwear layers with restrained cyan details.\n\nStyle direction: cyber streetwear, futuristic urban layering.",
    status: "processing",
    provider: "mock",
    previewUrl,
    modelUrl: null,
    thumbnailUrl: previewUrl,
    creditCost: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "figure-c1-tertiary",
    prompt:
      "Editorial runway tailoring with a monochrome palette.\n\nStyle direction: formal runway, polished silhouette.",
    status: "success",
    provider: "mock",
    previewUrl,
    modelUrl: "https://example.com/model-2.glb",
    thumbnailUrl: previewUrl,
    creditCost: 1,
    createdAt: now,
    updatedAt: now,
  },
];

const summary: BillingSummary = {
  plan: {
    code: "creator",
    name: "Creator",
    status: "active",
    currentPeriodEnd: "2026-07-11T07:00:00.000Z",
  },
  subscription: null,
  credits: { balance: 24 },
  capabilities: {
    canGeneratePreview: true,
    canGenerateHd: true,
    canExportModel: true,
    canDownloadModel: true,
  },
  pendingOrders: [],
  latestPayment: null,
};

const user: AuthUser = {
  id: "c1-user",
  email: "visual.qa@example.test",
  fullName: "Visual QA",
  displayName: "Visual QA",
  avatarUrl: null,
  occupation: "Stylist",
  stylePreferences: [],
  preferredColors: [],
  outfitVibe: null,
  onboardingCompleted: true,
  role: "admin",
  status: "active",
  createdAt: now,
};

figuresApi.listFigures = async () => ({
  figures,
  pagination: { page: 1, limit: 12, total: figures.length },
});
figuresApi.getFigure = async () => figures[0];
figuresApi.getFigureStatus = async (id: string) =>
  figures.find((figure) => figure.id === id) ?? figures[0];
billingApi.getBillingMe = async () => summary;

useAuthStore.setState({
  user,
  accessToken: "visual-harness",
  isAuthenticated: true,
  isBootstrapping: false,
  isLoading: false,
  error: null,
});

const view = new URLSearchParams(window.location.search).get("view");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <MemoryRouter initialEntries={[view === "admin" ? "/admin" : "/studio"]}>
      {view === "admin" ? (
        <DashboardShell planLabel={summary.plan.name} variant="admin">
          <main className="min-h-screen p-6">
            <h1 className="font-display text-3xl text-white">
              Admin shell QA
            </h1>
          </main>
        </DashboardShell>
      ) : (
        <StudioPage />
      )}
    </MemoryRouter>
  </I18nProvider>,
);
