import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sectionSource = readFileSync(
  "src/features/physical-print/components/PhysicalPrintSection.tsx",
  "utf8",
);
const apiSource = readFileSync(
  "src/features/physical-print/physical-print.api.ts",
  "utf8",
);

test("order-created checkout failure retries the existing order without creating another order", () => {
  assert.match(
    sectionSource,
    /function handleRetryCheckout\(\)[\s\S]*redirectToCheckout\(createdOrder,/,
  );
  assert.match(
    sectionSource,
    /createPhysicalPrintPayosCheckout\(order\.id\)/,
  );
  assert.match(
    apiSource,
    /`\/physical-print\/orders\/\$\{orderId\}\/payos-checkout`, \{\}/,
  );

  const retryFunction =
    sectionSource.match(
      /function handleRetryCheckout\(\) \{[\s\S]*?\n {2}\}/,
    )?.[0] ?? "";

  assert.doesNotMatch(retryFunction, /createPhysicalPrintOrder/);
});

test("checkout failure keeps the order and shows the safe backend error", () => {
  assert.match(
    sectionSource,
    /setCreatedOrder\(order\);[\s\S]*await redirectToCheckout\(order,/,
  );
  assert.match(
    sectionSource,
    /getApiErrorMessage\(checkoutFailure\)/,
  );
});
