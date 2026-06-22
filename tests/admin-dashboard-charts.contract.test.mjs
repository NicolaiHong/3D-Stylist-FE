import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminPageSource = readFileSync("src/pages/AdminPage.tsx", "utf8");
const chartsSource = readFileSync(
  "src/features/admin/components/AdminDashboardCharts.tsx",
  "utf8",
);

test("admin analytics charts mount once after the KPI grid", () => {
  const mounts = adminPageSource.match(/<AdminDashboardCharts\b/g) ?? [];
  const kpiIndex = adminPageSource.indexOf("{kpis.map((kpi)");
  const chartsIndex = adminPageSource.indexOf("<AdminDashboardCharts");
  const ordersIndex = adminPageSource.indexOf(
    'title={t("admin.orders.title")}',
  );

  assert.equal(mounts.length, 1);
  assert.ok(kpiIndex >= 0, "KPI grid is missing");
  assert.ok(chartsIndex > kpiIndex, "charts must render after KPI cards");
  assert.ok(ordersIndex > chartsIndex, "charts must render before order tables");
});

test("admin analytics use current API data and honest empty states", () => {
  assert.match(chartsSource, /stats\?\.recentOrders/);
  assert.match(chartsSource, /stats\?\.payments/);
  assert.match(chartsSource, /product\.kind === "subscription_plan"/);
  assert.match(chartsSource, /stats\?\.credits\.purchasedInRange/);
  assert.match(chartsSource, /admin\.charts\.empty\.title/);
  assert.doesNotMatch(chartsSource, /\[\s*\d{4,}\s*,\s*\d{4,}/);
});

test("admin page keeps the current top navigation shell and adds no sidebar", () => {
  assert.match(adminPageSource, /<DashboardShell planLabel=/);
  assert.doesNotMatch(adminPageSource, /variant=["']admin["']/);
  assert.doesNotMatch(
    `${adminPageSource}\n${chartsSource}`,
    /sidebar|side-nav|sideNav|left-nav|leftNav/i,
  );
});

test("admin charts do not call generation providers or expose model actions", () => {
  assert.doesNotMatch(
    chartsSource,
    /Meshy|MESHY_API_KEY|api\.meshy\.ai|modelUrl|modelViewerUrl|window\.open|download=/,
  );
});
