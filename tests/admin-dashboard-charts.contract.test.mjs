import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminPageSource = readFileSync("src/pages/AdminPage.tsx", "utf8");
const chartsSource = readFileSync(
  "src/features/admin/components/AdminDashboardCharts.tsx",
  "utf8",
);
const messagesSource = readFileSync("src/i18n/messages.ts", "utf8");
const revenueTrendSource = chartsSource.slice(
  chartsSource.indexOf("function RevenueOrdersTrendChart"),
  chartsSource.indexOf("function PaymentStatusDistributionChart"),
);

function getChangedFiles() {
  const root = execFileSync("git", ["-C", "..", "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
  const diffFiles = execFileSync("git", ["-C", root, "diff", "--name-only"], {
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean);
  const stagedFiles = execFileSync(
    "git",
    ["-C", root, "diff", "--cached", "--name-only"],
    { encoding: "utf8" },
  )
    .split(/\r?\n/)
    .filter(Boolean);

  return [...new Set([...diffFiles, ...stagedFiles])];
}

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

test("revenue trend keeps real paid order value bars without an order-count overlay", () => {
  assert.ok(
    revenueTrendSource.length > 0,
    "RevenueOrdersTrendChart source is missing",
  );
  assert.match(revenueTrendSource, /stats\?\.recentOrders/);
  assert.match(chartsSource, /order\.status === "paid"/);
  assert.match(chartsSource, /current\.revenue \+= order\.totalAmount/);
  assert.match(revenueTrendSource, /fill="url\(#admin-trend-bar\)"/);
  assert.match(revenueTrendSource, /barPoints\.map/);
  assert.doesNotMatch(revenueTrendSource, /orderPath|linePoints|maxOrders/);
  assert.doesNotMatch(revenueTrendSource, /<path\b|<circle\b/);
  assert.doesNotMatch(revenueTrendSource, /admin\.charts\.legend\.orders/);
  assert.doesNotMatch(revenueTrendSource, /ordersTooltip/);
  assert.doesNotMatch(revenueTrendSource, /stroke="#f3bf26"/);
});

test("order count remains visible as a revenue trend summary metric", () => {
  assert.match(chartsSource, /current\.orders \+= 1/);
  assert.match(revenueTrendSource, /const totalOrders = points\.reduce/);
  assert.match(revenueTrendSource, /admin\.charts\.trend\.sampleOrders/);
  assert.match(revenueTrendSource, /formatI18nNumber\(totalOrders, language\)/);
});

test("revenue trend labels describe a revenue-only chart in both languages", () => {
  assert.match(
    messagesSource,
    /"admin\.charts\.trend\.title": "Revenue Trend"/,
  );
  assert.match(
    messagesSource,
    /"admin\.charts\.trend\.title": "Xu hướng doanh thu"/,
  );
  assert.match(
    messagesSource,
    /"admin\.charts\.trend\.aria": "Recent paid order value bars\."/,
  );
  assert.doesNotMatch(messagesSource, /Revenue & Orders Trend/);
  assert.doesNotMatch(messagesSource, /Xu hướng doanh thu và đơn hàng/);
  assert.doesNotMatch(messagesSource, /order count line/);
});

test("revenue trend still has an empty state when no paid orders exist", () => {
  assert.match(revenueTrendSource, /const hasPaidRevenue = totalRevenue > 0/);
  assert.match(revenueTrendSource, /hasPaidRevenue \?/);
  assert.match(revenueTrendSource, /<ChartEmptyState \/>/);
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

test("admin chart UI change does not touch backend admin API or payment behavior files", () => {
  const changedFiles = getChangedFiles();
  const disallowed = changedFiles.filter(
    (file) =>
      file.startsWith("3D-Stylist-BE/") ||
      file === "3D-Stylist-FE/src/features/admin/admin.api.ts" ||
      file === "3D-Stylist-FE/src/features/admin/admin.types.ts" ||
      /^3D-Stylist-FE\/src\/features\/(billing|credits|payment|payments)\//.test(
        file,
      ) ||
      /^3D-Stylist-FE\/src\/pages\/(Billing|Checkout|Credits|Payment)/.test(
        file,
      ),
  );

  assert.deepEqual(disallowed, []);
});
