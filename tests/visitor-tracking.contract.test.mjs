import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";

const landingPageSource = readFileSync(
  new URL("../src/pages/LandingPage.tsx", import.meta.url),
  "utf8",
);
const visitorApiSource = readFileSync(
  new URL("../src/features/analytics/visitor.api.ts", import.meta.url),
  "utf8",
);
const messagesSource = readFileSync(
  new URL("../src/i18n/messages.ts", import.meta.url),
  "utf8",
);

test("landing records one stored anonymous browser id and renders the total", () => {
  assert.match(
    landingPageSource,
    /getOrCreateAnonymousVisitorId\(\)/,
  );
  assert.match(
    landingPageSource,
    /visitorAnalyticsApi\.record\(visitorId\)/,
  );
  assert.match(landingPageSource, /result\.totalVisitors/);
  assert.match(landingPageSource, /aria-live=\{isLive \? "polite"/);
});

test("authenticated landing visits fetch the total without creating an id", () => {
  assert.match(
    landingPageSource,
    /const visitorId = isAuthenticated\s*\?\s*null\s*:\s*getOrCreateAnonymousVisitorId\(\)/,
  );
  assert.match(
    landingPageSource,
    /visitorId\s*\?\s*await visitorAnalyticsApi\.record\(visitorId\)\s*:\s*await visitorAnalyticsApi\.getTotal\(\)/,
  );
});

test("visitor API persists a UUID locally and uses the public analytics route", () => {
  assert.match(visitorApiSource, /3d-stylist:anonymous-visitor-id/);
  assert.match(visitorApiSource, /window\.crypto\.randomUUID\(\)/);
  assert.equal(
    visitorApiSource.match(/"\/analytics\/visitors"/g)?.length,
    2,
  );
});

test("visitor count copy has matching EN and VI states", () => {
  for (const key of [
    "landing.metric.creditsDetail",
    "landing.metric.visitorLoading",
    "landing.metric.visitorUnavailable",
  ]) {
    assert.equal(
      messagesSource.match(new RegExp(`"${key.replaceAll(".", "\\.")}"`, "g"))
        ?.length,
      2,
    );
  }
});
