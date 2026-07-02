import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminPageSource = readFileSync("src/pages/AdminPage.tsx", "utf8");
const adminApiSource = readFileSync("src/features/admin/admin.api.ts", "utf8");
const adminTypesSource = readFileSync("src/features/admin/admin.types.ts", "utf8");
const messagesSource = readFileSync("src/i18n/messages.ts", "utf8");

function functionBody(name) {
  const start = adminPageSource.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} is missing`);

  const nextFunction = adminPageSource.indexOf("\nfunction ", start + 1);
  return adminPageSource.slice(
    start,
    nextFunction >= 0 ? nextFunction : adminPageSource.length,
  );
}

const transactionsBody = functionBody("TransactionsTable");
const usersBody = functionBody("UsersTable");

test("payment transactions use an activity layout instead of the old seven-column scroller", () => {
  assert.match(transactionsBody, /<article\b/);
  assert.doesNotMatch(transactionsBody, /<table\b/);
  assert.doesNotMatch(transactionsBody, /min-w-\[980px\]/);
  assert.match(transactionsBody, /admin\.transactions\.orderStatus/);
  assert.match(transactionsBody, /admin\.table\.signature/);
});

test("transaction activity prioritizes reference, status, amount, user, provider, and date", () => {
  const referenceIndex = transactionsBody.indexOf("visibleTransactionReference");
  const statusIndex = transactionsBody.indexOf(
    "<StatusBadge status={transaction.status}",
  );
  const amountIndex = transactionsBody.indexOf(
    't("admin.table.amount")',
  );
  const userIndex = transactionsBody.indexOf('t("admin.table.user")');
  const providerIndex = transactionsBody.indexOf(
    't("admin.table.provider")',
  );
  const dateIndex = transactionsBody.indexOf(
    "{transactionDateLabel}",
    providerIndex,
  );
  const signatureIndex = transactionsBody.indexOf(
    't("admin.table.signature")',
    dateIndex,
  );

  assert.ok(referenceIndex >= 0, "transaction reference is missing");
  assert.ok(statusIndex > referenceIndex, "payment status must sit with the reference");
  assert.ok(amountIndex > statusIndex, "amount must be in the primary row group");
  assert.ok(userIndex > amountIndex, "user context must follow primary fields");
  assert.ok(providerIndex > userIndex, "provider context must be visible");
  assert.ok(dateIndex > providerIndex, "processed/created date must be visible");
  assert.ok(signatureIndex > dateIndex, "signature must remain secondary metadata");
});

test("long transaction references are truncated but exposed through title and aria label", () => {
  assert.match(transactionsBody, /className="[^"]*\btruncate\b[^"]*font-mono/);
  assert.match(transactionsBody, /title=\{fullTransactionReference\}/);
  assert.match(
    transactionsBody,
    /aria-label=\{t\("admin\.transactions\.referenceAria"/,
  );
});

test("payment transaction pagination is frontend-only and preserves the existing limit", () => {
  assert.match(adminPageSource, /const PAYMENT_TRANSACTIONS_PAGE_LIMIT = 8;/);
  assert.match(
    adminPageSource,
    /const \[transactionsPageNumber, setTransactionsPageNumber\] = useState\(1\);/,
  );
  assert.match(
    adminPageSource,
    /adminApi\.getAdminPaymentTransactions\(\{\s*page: transactionsPageNumber,\s*limit: PAYMENT_TRANSACTIONS_PAGE_LIMIT,/s,
  );
  assert.match(adminPageSource, /<AdminPaginationControls\b/);
  assert.match(adminPageSource, /admin\.pagination\.previous/);
  assert.match(adminPageSource, /admin\.pagination\.next/);
  assert.match(
    adminApiSource,
    /async getAdminPaymentTransactions\(\s*filters: AdminPaymentTransactionsFilters = \{\},\s*\): Promise<AdminPagination<AdminPaymentTransaction>>/,
  );
  assert.match(
    adminTypesSource,
    /export interface AdminPagination<T> \{\s*page: number;\s*limit: number;\s*total: number;\s*totalPages: number;\s*items: T\[\];\s*\}/,
  );
});

test("payment status filtering includes redirected and resets transactions to page one", () => {
  assert.match(
    adminPageSource,
    /const transactionStatusOptions: PaymentStatusFilter\[\] = \[[\s\S]*"redirected"[\s\S]*\];/,
  );
  assert.match(
    adminPageSource,
    /setTransactionStatus\(nextStatus\);\s*setTransactionsPageNumber\(1\);/,
  );
  assert.match(adminTypesSource, /export type AdminPaymentStatus =[\s\S]*\| "redirected"/);
});

test("pagination disables previous on page one and next on known final or fallback short page", () => {
  const paginationBody = functionBody("AdminPaginationControls");

  assert.match(paginationBody, /const previousDisabled = isLoading \|\| currentPage <= 1;/);
  assert.match(
    paginationBody,
    /hasKnownTotalPages\s*\?\s*currentPage >= page\.totalPages\s*:\s*receivedCount < requestedLimit/s,
  );
});

test("Recent Users remains outside Batch A1 pagination and layout changes", () => {
  assert.match(usersBody, /<table className="min-w-\[820px\] w-full text-left">/);
  assert.doesNotMatch(adminPageSource, /usersPageNumber|setUsersPageNumber/);
  assert.doesNotMatch(usersBody, /AdminPaginationControls/);
});

test("new admin transaction and pagination copy has EN/VI parity", () => {
  for (const key of [
    "admin.pagination.previous",
    "admin.pagination.next",
    "admin.pagination.range",
    "admin.pagination.page",
    "admin.pagination.total",
    "admin.pagination.totalWithPages",
    "admin.pagination.pageItems",
    "admin.transactions.emptyDetail",
    "admin.transactions.processedAt",
    "admin.transactions.createdAt",
    "admin.transactions.orderStatus",
    "admin.transactions.referenceAria",
    "admin.transactions.paginationLabel",
  ]) {
    const matches = messagesSource.match(new RegExp(`"${key}":`, "g")) ?? [];
    assert.equal(matches.length, 2, `${key} must exist in EN and VI`);
  }
});
