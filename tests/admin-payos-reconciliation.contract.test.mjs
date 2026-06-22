import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminPageSource = readFileSync("src/pages/AdminPage.tsx", "utf8");
const adminApiSource = readFileSync("src/features/admin/admin.api.ts", "utf8");

test("pending payOS orders expose the reconciliation action", () => {
  assert.match(
    adminPageSource,
    /const canReconcilePayos\s*=\s*\n?\s*paymentMethod === "payos" && order\.status === "pending";/,
  );
  assert.match(adminPageSource, /admin\.table\.reconcilePayos/);
  assert.doesNotMatch(adminPageSource, /payosNoVerification/);
});

test("payOS reconciliation sends only the local order id", () => {
  const method = adminApiSource.match(
    /async reconcilePayosOrder\([\s\S]*?\r?\n\s*},\r?\n/,
  )?.[0];

  assert.ok(method, "reconcilePayosOrder API method is missing");
  assert.match(
    method,
    /apiClient\.post<[\s\S]*?>\(`\/admin\/billing\/orders\/\$\{orderId\}\/payos-reconcile`\);/,
  );
});

test("payOS reconciliation has no frontend-controlled grant fields", () => {
  const method = adminApiSource.match(
    /async reconcilePayosOrder\([\s\S]*?\r?\n\s*},\r?\n/,
  )?.[0];

  assert.ok(method, "reconcilePayosOrder API method is missing");
  assert.doesNotMatch(
    method,
    /\b(?:paid|status|plan|credits?|amount|entitlement|grant)\s*:/i,
  );
});
