import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routesSource = readFileSync("src/routes/AppRoutes.tsx", "utf8");
const apiSource = readFileSync(
  "src/features/physical-print/physical-print.api.ts",
  "utf8",
);
const presentationSource = readFileSync(
  "src/features/physical-print/physical-print.presentation.ts",
  "utf8",
);
const typesSource = readFileSync(
  "src/features/physical-print/physical-print.types.ts",
  "utf8",
);
const listSource = readFileSync(
  "src/pages/PhysicalPrintOrdersPage.tsx",
  "utf8",
);
const detailSource = readFileSync(
  "src/pages/PhysicalPrintOrderDetailPage.tsx",
  "utf8",
);
const checkoutStatusSource = readFileSync(
  "src/pages/PhysicalPrintCheckoutStatusPage.tsx",
  "utf8",
);
const messagesSource = readFileSync("src/i18n/messages.ts", "utf8");
const trackingSources = [
  apiSource,
  listSource,
  detailSource,
  checkoutStatusSource,
].join("\n");

test("physical print user routes are protected by the existing user route group", () => {
  assert.match(routesSource, /<Route element=\{<ProtectedRoute \/>\}>/);
  assert.match(routesSource, /path="\/physical-print\/orders"/);
  assert.match(routesSource, /path="\/physical-print\/orders\/:orderId"/);
  assert.match(routesSource, /path="\/physical-print\/checkout\/return"/);
  assert.match(routesSource, /path="\/physical-print\/checkout\/cancel"/);
});

test("owner list and detail use only physical-print user API paths", () => {
  assert.match(
    apiSource,
    /apiClient\.get<[\s\S]*?>\("\/physical-print\/orders",/,
  );
  assert.match(
    apiSource,
    /`\/physical-print\/orders\/\$\{orderId\}`/,
  );
  assert.doesNotMatch(trackingSources, /\/admin\/physical-print-orders/);
});

test("retry checkout uses the existing order and sends an empty body", () => {
  assert.match(
    apiSource,
    /`\/physical-print\/orders\/\$\{orderId\}\/payos-checkout`, \{\}/,
  );
  assert.match(
    detailSource,
    /createPhysicalPrintPayosCheckout\(\s*order\.id,\s*"retry"/,
  );
  assert.match(
    checkoutStatusSource,
    /createPhysicalPrintPayosCheckout\(\s*order\.id,\s*"retry"/,
  );
  assert.doesNotMatch(detailSource, /createPhysicalPrintOrder/);
  assert.doesNotMatch(checkoutStatusSource, /createPhysicalPrintOrder/);
});

test("checkout eligibility distinguishes continue, pay again, and blocked states", () => {
  assert.match(
    presentationSource,
    /order\.fulfillmentStatus !== "NOT_STARTED"[\s\S]*return null/,
  );
  assert.match(
    presentationSource,
    /order\.paymentStatus === "PENDING"[\s\S]*return "continue"/,
  );

  const retryableStatuses =
    presentationSource.match(
      /\["FAILED", "CANCELLED", "EXPIRED"\] as PhysicalPrintPaymentStatus\[\]/,
    )?.[0] ?? "";

  assert.ok(retryableStatuses);
  assert.doesNotMatch(retryableStatuses, /PAID|REFUNDED|PENDING/);
  assert.match(detailSource, /physicalPrint\.tracking\.continuePayment/);
  assert.match(detailSource, /physicalPrint\.tracking\.payAgain/);
  assert.match(checkoutStatusSource, /physicalPrint\.tracking\.continuePayment/);
  assert.match(checkoutStatusSource, /physicalPrint\.tracking\.payAgain/);
});

test("user timeline uses backend milestone timestamps without assignment fallback", () => {
  assert.match(typesSource, /printingAt: string \| null/);
  assert.match(
    detailSource,
    /key: "waiting"[\s\S]*timestamp: order\.paidAt/,
  );
  assert.match(
    detailSource,
    /key: "printing"[\s\S]*timestamp: order\.printingAt/,
  );
  assert.doesNotMatch(detailSource, /order\.assignedAt \?\? order\.paidAt/);
  assert.match(detailSource, /timestamp: order\.printedAt/);
  assert.match(detailSource, /timestamp: order\.shippedAt/);
  assert.match(detailSource, /timestamp: order\.completedAt/);
});

test("tracking UI cannot mark paid or call the webhook", () => {
  assert.doesNotMatch(trackingSources, /markPaid|mark paid|payos-webhook/i);
  assert.doesNotMatch(
    trackingSources,
    /paymentStatus\s*:\s*["']PAID["']|paidAt\s*:/,
  );
});

test("tracking UI exposes no model delivery, storage, or Meshy action", () => {
  assert.doesNotMatch(
    trackingSources,
    /modelUrl|modelViewerUrl|signedUrl|objectKey|bucket|MESHY_API_KEY|api\.meshy\.ai|openapi\/v[12]/,
  );
});

test("physical print tracking copy has EN and VI parity", () => {
  const viStart = messagesSource.indexOf("\n  vi: {");
  const enPart = messagesSource.slice(0, viStart);
  const viPart = messagesSource.slice(viStart);
  const getKeys = (source) =>
    new Set(
      (source.match(/^\s{4}"physicalPrint\.tracking\.[^"]+":/gm) ?? []).map(
        (line) => line.match(/"([^"]+)"/)[1],
      ),
    );
  const enKeys = getKeys(enPart);
  const viKeys = getKeys(viPart);

  assert.deepEqual([...enKeys].filter((key) => !viKeys.has(key)), []);
  assert.deepEqual([...viKeys].filter((key) => !enKeys.has(key)), []);
  assert.ok(enKeys.size >= 50);
});
