import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminPageSource = readFileSync("src/pages/AdminPage.tsx", "utf8");
const panelSource = readFileSync(
  "src/features/admin/components/PhysicalPrintOrdersPanel.tsx",
  "utf8",
);
const adminApiSource = readFileSync("src/features/admin/admin.api.ts", "utf8");

test("admin page loads the physical print fulfillment panel", () => {
  assert.match(adminPageSource, /<PhysicalPrintOrdersPanel\s*\/>/);
  assert.match(panelSource, /adminApi\.getPhysicalPrintOrders\(\{/);
});

test("payment and fulfillment filters are sent through the list request", () => {
  const listCall = panelSource.match(
    /adminApi\.getPhysicalPrintOrders\(\{[\s\S]*?\}\);/,
  )?.[0];

  assert.ok(listCall, "physical print list request is missing");
  assert.match(listCall, /paymentStatus:/);
  assert.match(listCall, /fulfillmentStatus:/);
  assert.match(listCall, /search:/);
});

test("order detail opens through the admin detail endpoint", () => {
  assert.match(panelSource, /function openDetail\(orderId: string\)/);
  assert.match(panelSource, /adminApi\.getPhysicalPrintOrder\(orderId\)/);
  assert.match(
    adminApiSource,
    /`\/admin\/physical-print-orders\/\$\{orderId\}`/,
  );
});

test("status update payload contains only fulfillment fields", () => {
  const payload = panelSource.match(
    /const payload: AdminPhysicalPrintStatusPayload = \{[\s\S]*?\n\s*\};/,
  )?.[0];

  assert.ok(payload, "status update payload is missing");
  assert.match(payload, /fulfillmentStatus:/);
  assert.match(payload, /internalNote:/);
  assert.match(payload, /trackingCode:/);
  assert.doesNotMatch(
    payload,
    /\b(?:paymentStatus|paidAt|finalPriceVnd|userId|credits?|subscription|entitlement|paymentProvider|modelUrl|modelViewerUrl|objectKey|signedUrl)\s*:/,
  );
});

test("admin fulfillment UI cannot mark a physical order paid", () => {
  assert.doesNotMatch(panelSource, /markPaid|mark paid/i);
  assert.doesNotMatch(
    adminApiSource,
    /physical-print-orders\/\$\{orderId\}\/(?:mark-paid|payment)/,
  );
});

test("admin physical print UI uses no model delivery URL or Meshy call", () => {
  assert.doesNotMatch(
    panelSource,
    /modelUrl|modelViewerUrl|signedUrl|objectKey|api\.meshy\.ai|MESHY_API_KEY/,
  );
});
