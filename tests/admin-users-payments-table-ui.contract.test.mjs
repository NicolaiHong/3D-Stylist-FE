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

function assertMessageParity(keys) {
  for (const key of keys) {
    const matches = messagesSource.match(new RegExp(`"${key}":`, "g")) ?? [];
    assert.equal(matches.length, 2, `${key} must exist in EN and VI`);
  }
}

const transactionsBody = functionBody("TransactionsTable");
const usersBody = functionBody("UsersTable");
const paginationBody = functionBody("AdminPaginationControls");

test("payment transactions use compact activity rows instead of the old seven-column scroller", () => {
  assert.match(transactionsBody, /<article\b/);
  assert.doesNotMatch(transactionsBody, /<table\b/);
  assert.doesNotMatch(transactionsBody, /min-w-\[980px\]/);
  assert.doesNotMatch(transactionsBody, /internal-scroll-region/);
  assert.match(transactionsBody, /admin\.transactions\.orderStatus/);
  assert.match(transactionsBody, /admin\.table\.signature/);
});

test("payment transaction metadata stays inline and amount is not an oversized card", () => {
  assert.doesNotMatch(
    transactionsBody,
    /rounded-md border border-\[#3b494c\]\/70 bg-\[#0e0e0e\]\/80 p-3/,
  );
  assert.doesNotMatch(
    transactionsBody,
    /rounded-md bg-white\/\[0\.035\] px-3 py-2/,
  );
  assert.match(transactionsBody, /font-display text-base font-semibold/);
  assert.match(transactionsBody, /flex min-w-0 flex-wrap gap-x-4 gap-y-1\.5/);
});

test("transaction activity prioritizes reference, status, amount, user, provider, and date", () => {
  const referenceIndex = transactionsBody.indexOf("visibleTransactionReference");
  const statusIndex = transactionsBody.indexOf(
    "<StatusBadge status={transaction.status}",
  );
  const amountIndex = transactionsBody.indexOf('t("admin.table.amount")');
  const userIndex = transactionsBody.indexOf('t("admin.table.user")');
  const providerIndex = transactionsBody.indexOf('t("admin.table.provider")');
  const dateIndex = transactionsBody.indexOf(
    "{formatDateTime(transactionDate",
    providerIndex,
  );
  const signatureIndex = transactionsBody.indexOf(
    't("admin.table.signature")',
    dateIndex,
  );

  assert.ok(referenceIndex >= 0, "transaction reference is missing");
  assert.ok(statusIndex > referenceIndex, "payment status must sit with the reference");
  assert.ok(amountIndex > statusIndex, "amount must follow the reference/status");
  assert.ok(userIndex > amountIndex, "user context must follow amount");
  assert.ok(userIndex > statusIndex, "user context must follow the primary row");
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

test("Recent Users uses account activity rows instead of the old five-column scroller", () => {
  assert.match(usersBody, /<article\b/);
  assert.doesNotMatch(usersBody, /<table\b/);
  assert.doesNotMatch(usersBody, /min-w-\[820px\]/);
  assert.doesNotMatch(usersBody, /internal-scroll-region/);
  assert.match(usersBody, /<StatusBadge status=\{adminUser\.status\}/);
  assert.match(usersBody, /<StatusBadge status=\{adminUser\.role\}/);
  assert.match(usersBody, /const onboardingStatus = adminUser\.onboardingCompleted/);
  assert.match(usersBody, /admin\.users\.subscription/);
  assert.match(usersBody, /admin\.users\.credits/);
  assert.match(usersBody, /admin\.users\.updatedAt/);
});

test("users and transactions keep frontend-only pagination with existing limits", () => {
  assert.match(adminPageSource, /const PAYMENT_TRANSACTIONS_PAGE_LIMIT = 8;/);
  assert.match(adminPageSource, /const ADMIN_USERS_PAGE_LIMIT = 6;/);
  assert.match(
    adminPageSource,
    /const \[transactionsPageNumber, setTransactionsPageNumber\] = useState\(1\);/,
  );
  assert.match(
    adminPageSource,
    /const \[usersPageNumber, setUsersPageNumber\] = useState\(1\);/,
  );
  assert.match(
    adminPageSource,
    /adminApi\.getAdminPaymentTransactions\(\{\s*page: transactionsPageNumber,\s*limit: PAYMENT_TRANSACTIONS_PAGE_LIMIT,/s,
  );
  assert.match(
    adminPageSource,
    /adminApi\.getAdminUsers\(\{\s*page: usersPageNumber,\s*limit: ADMIN_USERS_PAGE_LIMIT,/s,
  );
  assert.match(adminPageSource, /<AdminPaginationControls\b/);
  assert.match(
    adminApiSource,
    /async getAdminPaymentTransactions\(\s*filters: AdminPaymentTransactionsFilters = \{\},\s*\): Promise<AdminPagination<AdminPaymentTransaction>>/,
  );
  assert.match(
    adminApiSource,
    /async getAdminUsers\(\s*filters: AdminUsersFilters = \{\},\s*\): Promise<AdminPagination<AdminUser>>/,
  );
  assert.match(
    adminTypesSource,
    /export interface AdminPagination<T> \{\s*page: number;\s*limit: number;\s*total: number;\s*totalPages: number;\s*items: T\[\];\s*\}/,
  );
});

test("one-page pagination shows compact copy instead of disabled Previous and Next controls", () => {
  const singlePageIndex = paginationBody.indexOf("if (isKnownSinglePage)");
  const allItemsIndex = paginationBody.indexOf("t(allItemsKey", singlePageIndex);
  const previousButtonIndex = paginationBody.indexOf(
    't("admin.pagination.previous")',
    singlePageIndex,
  );
  const nextButtonIndex = paginationBody.indexOf(
    't("admin.pagination.next")',
    singlePageIndex,
  );

  assert.ok(singlePageIndex >= 0, "known one-page branch is missing");
  assert.ok(allItemsIndex > singlePageIndex, "known one-page branch must render all-items copy");
  assert.ok(previousButtonIndex > allItemsIndex, "Previous must be outside the one-page branch");
  assert.ok(nextButtonIndex > allItemsIndex, "Next must be outside the one-page branch");
  assert.doesNotMatch(paginationBody, /admin\.pagination\.totalWithPages/);
});

test("multi-page and fallback pagination render range/page copy with guarded buttons", () => {
  assert.match(paginationBody, /admin\.pagination\.showingRange/);
  assert.match(paginationBody, /admin\.pagination\.pageItems/);
  assert.match(paginationBody, /const previousDisabled = isLoading \|\| currentPage <= 1;/);
  assert.match(
    paginationBody,
    /hasKnownTotalPages\s*\?\s*currentPage >= page\.totalPages\s*:\s*receivedCount < requestedLimit/s,
  );
  assert.match(paginationBody, /admin\.pagination\.previous/);
  assert.match(paginationBody, /admin\.pagination\.next/);
});

test("search and filter changes reset their scoped page state to page one", () => {
  assert.match(
    adminPageSource,
    /function handleSearchSubmit[\s\S]*setUsersPageNumber\(1\);[\s\S]*setActiveSearch\(searchInput\.trim\(\)\);/,
  );
  assert.match(
    adminPageSource,
    /setTransactionStatus\(nextStatus\);\s*setTransactionsPageNumber\(1\);/,
  );
});

test("payment status filtering includes redirected and layout prevents equal-height stretching", () => {
  assert.match(
    adminPageSource,
    /const transactionStatusOptions: PaymentStatusFilter\[\] = \[[\s\S]*"redirected"[\s\S]*\];/,
  );
  assert.match(adminTypesSource, /export type AdminPaymentStatus =[\s\S]*\| "redirected"/);
  assert.match(
    adminPageSource,
    /<section className="grid items-start gap-5 xl:grid-cols-12">/,
  );
  assert.doesNotMatch(adminPageSource, /xl:col-span-5 h-full/);
});

test("new admin row and pagination copy has EN/VI parity", () => {
  assertMessageParity([
    "admin.pagination.previous",
    "admin.pagination.next",
    "admin.pagination.showingRange",
    "admin.pagination.showingAllTransactions",
    "admin.pagination.showingAllUsers",
    "admin.pagination.pageItems",
    "admin.transactions.emptyDetail",
    "admin.transactions.processedAt",
    "admin.transactions.createdAt",
    "admin.transactions.orderStatus",
    "admin.transactions.referenceAria",
    "admin.transactions.paginationLabel",
    "admin.users.emptyDetail",
    "admin.users.paginationLabel",
    "admin.users.subscription",
    "admin.users.noSubscription",
    "admin.users.credits",
    "admin.users.updatedAt",
    "admin.users.plan.free",
    "admin.users.plan.starter",
    "admin.users.plan.creator",
    "admin.users.plan.pro",
  ]);
});
