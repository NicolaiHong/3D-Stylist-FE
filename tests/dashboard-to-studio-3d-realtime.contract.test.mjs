import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboardSource = readFileSync("src/pages/DashboardPage.tsx", "utf8");
const studioSource = readFileSync("src/pages/StudioPage.tsx", "utf8");
const messagesSource = readFileSync("src/i18n/messages.ts", "utf8");

test("Dashboard auto-opens Studio with React Router SPA navigation", () => {
  assert.match(dashboardSource, /useNavigate/);
  assert.match(dashboardSource, /const navigate = useNavigate\(\);/);
  assert.match(dashboardSource, /navigate\(getStudio3dRoute\(figureId\)\);/);
  assert.match(
    dashboardSource,
    /createSearchParams\(\{\s*figureId,\s*view: "3d",\s*focus: "preview",\s*\}\)/,
  );
});

test("Dashboard and Studio do not use browser-level navigation for Studio routing", () => {
  const combinedSource = `${dashboardSource}\n${studioSource}`;

  assert.doesNotMatch(
    combinedSource,
    /window\.open|window\.location\.href|window\.location\.assign|location\.reload/,
  );
});

test("Dashboard auto-navigation requires a completed 3D-ready figure", () => {
  const readyGuard = dashboardSource.match(
    /function isStudio3dReadyFigure\(figure: FigureDto \| null\) \{[\s\S]*?\n\}/,
  )?.[0];

  assert.ok(readyGuard, "3D readiness guard is missing");
  assert.match(readyGuard, /Boolean\(figure\?\.id\)/);
  assert.match(readyGuard, /figure\?\.status === "success"/);
  assert.match(readyGuard, /figure\.modelAssetReady === true/);
  assert.doesNotMatch(readyGuard, /queued|processing|failed|canceled/);
  assert.match(
    dashboardSource,
    /if \(!activeFigure \|\| !isStudio3dReadyFigure\(activeFigure\)\) \{\s*return;\s*\}/,
  );
});

test("Dashboard auto-navigation is guarded once and reset for new generations", () => {
  assert.match(dashboardSource, /const hasAutoOpenedStudioRef = useRef\(false\);/);
  assert.match(
    dashboardSource,
    /const autoOpenFigureIdRef = useRef<string \| null>\(null\);/,
  );
  assert.match(dashboardSource, /const resetStudioAutoOpenGuard = useCallback/);
  assert.match(dashboardSource, /clearAutoOpenStudioTimeout\(\);/);
  assert.match(dashboardSource, /window\.clearTimeout/);
  assert.match(dashboardSource, /DASHBOARD_STUDIO_AUTO_OPEN_DELAY_MS = 500/);

  const resetCalls = dashboardSource.match(/resetStudioAutoOpenGuard\(\);/g) ?? [];
  assert.equal(
    resetCalls.length,
    2,
    "normal and reference generation should both reset the guard",
  );
});

test("manual Open 3D Studio routes include figureId, view=3d, and preview focus", () => {
  const manualRouteUses = dashboardSource.match(/to=\{getStudio3dRoute\(figure\.id\)\}/g) ?? [];

  assert.ok(
    manualRouteUses.length >= 2,
    "Dashboard cards and active panel should route through getStudio3dRoute",
  );
  assert.match(messagesSource, /"dashboard\.figure\.open3dStudio": "Open 3D Studio"/);
  assert.match(messagesSource, /"dashboard\.notice\.openStudio": "Open 3D Studio"/);
});

test("Studio reads view=3d and applies the 3D tab without reloading", () => {
  assert.match(studioSource, /const requestedViewParam = searchParams\.get\("view"\);/);
  assert.match(studioSource, /requestedViewParam === "3d"/);
  assert.match(studioSource, /setViewMode\(requestedViewMode\);/);
  assert.match(studioSource, /onViewModeChange=\{handleViewModeChange\}/);
  assert.match(
    studioSource,
    /getStudioRouteSearchParams\(\s*selectedFigureId,\s*nextViewMode,/,
  );
});

test("Studio reads focus=preview and focuses the preview area after render", () => {
  assert.match(studioSource, /searchParams\.get\("focus"\) === "preview"/);
  assert.match(
    studioSource,
    /const previewRegionRef = useRef<HTMLDivElement \| null>\(null\);/,
  );
  assert.match(studioSource, /previewRegionRef\.current\.scrollIntoView/);
  assert.match(studioSource, /previewRegionRef\.current\.focus\(\{ preventScroll: true \}\);/);
  assert.match(studioSource, /aria-label=\{t\("studio\.previewFocusLabel"\)\}/);
});

test("Studio falls back to image preview copy when 3D is not ready", () => {
  assert.match(studioSource, /t\("studio\.modelPreparingFallback"\)/);
  assert.match(
    messagesSource,
    /"studio\.modelPreparingFallback":\s*"The 3D model is still preparing\. Showing the image preview for now\."/,
  );
});

test("image modal opens only from explicit View image actions", () => {
  const setSelectedFigureCalls =
    dashboardSource.match(/setSelectedFigure\(/g) ?? [];

  assert.equal(
    setSelectedFigureCalls.length,
    2,
    "selectedFigure should only be set by explicit view and close handlers",
  );
  assert.match(
    dashboardSource,
    /const handleViewFigure = useCallback\(\(figure: FigureDto\) => \{\s*setSelectedFigure\(figure\);/,
  );
  assert.match(dashboardSource, /onClick=\{\(\) => onView\(figure\)\}/);
  assert.doesNotMatch(dashboardSource, /setSelectedFigure\(activeFigure\)/);
  assert.doesNotMatch(dashboardSource, /setSelectedFigure\(updatedFigure\)/);
});

test("Dashboard normal generation payload remains prompt-only", () => {
  assert.match(
    dashboardSource,
    /figuresApi\.generateFigure\(\{\s*prompt: composedPrompt,\s*\}\);/,
  );
});
