import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const nudgeSource = readFileSync(
  "src/features/physical-print/components/PhysicalPrintNudge.tsx",
  "utf8",
);
const nudgeSessionSource = readFileSync(
  "src/features/physical-print/physical-print-nudge-session.ts",
  "utf8",
);
const sectionSource = readFileSync(
  "src/features/physical-print/components/PhysicalPrintSection.tsx",
  "utf8",
);
const studioSource = readFileSync("src/pages/StudioPage.tsx", "utf8");
const dashboardSource = readFileSync("src/pages/DashboardPage.tsx", "utf8");
const messagesSource = readFileSync("src/i18n/messages.ts", "utf8");

function readSourceTree(dir) {
  return readdirSync(dir)
    .flatMap((entry) => {
      const path = join(dir, entry);
      const stat = statSync(path);

      if (stat.isDirectory()) {
        return readSourceTree(path);
      }

      return /\.(?:ts|tsx|js|jsx)$/.test(entry)
        ? readFileSync(path, "utf8")
        : [];
    })
    .join("\n");
}

test("physical print nudge waits 20 seconds and resets by figure eligibility", () => {
  assert.match(
    nudgeSource,
    /const PHYSICAL_PRINT_NUDGE_DELAY_MS = 20_000;/,
  );
  assert.match(nudgeSource, /window\.setTimeout/);
  assert.match(nudgeSource, /window\.clearTimeout/);
  assert.match(nudgeSource, /\[figureId, isEligible\]/);
  assert.match(
    studioSource,
    /selectedFigure\.status === "success"[\s\S]*selectedFigure\.modelAssetReady === true/,
  );
  assert.match(studioSource, /viewMode === "3d"/);
  assert.match(
    studioSource,
    /isEligible=\{isPhysicalPrintNudgeEligible\}/,
  );
});

test("physical print nudge exposes dismiss and try actions with EN and VI copy", () => {
  assert.match(nudgeSource, /t\("physicalPrint\.nudge\.dismiss"\)/);
  assert.match(nudgeSource, /t\("physicalPrint\.nudge\.try"\)/);
  assert.match(nudgeSource, /event\.key === "Escape"/);
  assert.match(nudgeSource, /role="status"/);
  assert.match(
    messagesSource,
    /"physicalPrint\.nudge\.title": "Turn this model into a real display piece\?"/,
  );
  assert.match(
    messagesSource,
    /"physicalPrint\.nudge\.try": "Let's try"/,
  );
  assert.match(
    messagesSource,
    /"physicalPrint\.nudge\.title":\s*"Biến mẫu này thành sản phẩm trưng bày thật\?"/,
  );
  assert.match(
    messagesSource,
    /"physicalPrint\.nudge\.try": "Xem gói in"/,
  );
});

test("Let's try smoothly scrolls and focuses the existing physical print section", () => {
  assert.match(studioSource, /id="physical-print-section"/);
  assert.match(
    studioSource,
    /physicalPrintSectionRef\.current\.scrollIntoView\(\{\s*behavior: "smooth",\s*block: "start",\s*\}\);/,
  );
  assert.match(
    studioSource,
    /querySelector<HTMLElement>\("#physical-print-title"\)[\s\S]*focus\(\{ preventScroll: true \}\)/,
  );
  assert.match(studioSource, /onTry=\{handlePhysicalPrintNudgeTry\}/);
  assert.match(sectionSource, /id="physical-print-title"\s+tabIndex=\{-1\}/);
});

test("manual print-section visibility or interaction suppresses the nudge", () => {
  assert.match(studioSource, /new IntersectionObserver/);
  assert.match(studioSource, /entry\.intersectionRatio >= 0\.2/);
  assert.match(studioSource, /onFocusCapture=\{handlePhysicalPrintInteraction\}/);
  assert.match(
    studioSource,
    /onPointerDownCapture=\{handlePhysicalPrintInteraction\}/,
  );
  assert.match(nudgeSessionSource, /"physical-print-nudge-dismissed:"/);
  assert.match(
    nudgeSessionSource,
    /`\$\{PHYSICAL_PRINT_NUDGE_STORAGE_PREFIX\}\$\{figureId\}`/,
  );
});

test("nudge never creates an order, starts payOS, or selects a package", () => {
  assert.doesNotMatch(
    nudgeSource,
    /physicalPrintApi|createPhysicalPrintOrder|createPhysicalPrintPayosCheckout|payos-checkout|setSelectedPackageCode/,
  );
});

test("generation, Meshy, and model URL guards remain intact", () => {
  const frontendSource = readSourceTree("src");

  assert.match(
    dashboardSource,
    /figuresApi\.generateFigure\(\{\s*prompt: composedPrompt,\s*\}\);/,
  );
  assert.doesNotMatch(
    frontendSource,
    /MESHY_API_KEY|api\.meshy\.ai|openapi\/v1|openapi\/v2/,
  );
  assert.doesNotMatch(
    `${studioSource}\n${dashboardSource}`,
    /modelViewerUrl[\s\S]{0,160}(?:href|download|window\.open|provider|source|input)/,
  );
});
