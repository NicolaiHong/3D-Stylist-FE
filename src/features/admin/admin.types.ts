import type { AuthRole } from "../auth/auth.types";

export const ADMIN_RANGES = {
  SEVEN_DAYS: "7d",
  THIRTY_DAYS: "30d",
  ALL: "all",
} as const;

export type AdminRange = (typeof ADMIN_RANGES)[keyof typeof ADMIN_RANGES];

export type AdminUserStatus = "active" | "blocked";

export type AdminOrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired";

export type AdminPaymentStatus =
  | "initiated"
  | "redirected"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired";

export type AdminBillingProvider = "momo" | "vnpay";

export type AdminProductKind = "subscription_plan" | "credit_pack";

export interface AdminHealth {
  status: string;
  timestamp?: string;
  api?: {
    status: string;
  };
  database?: {
    status: string;
    latencyMs?: number;
  };
  billing?: {
    momoSandboxConfigured: boolean;
    vnpaySandboxConfigured: boolean;
    manualMarkPaidEnabled: boolean;
  };
}

export interface AdminUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: AuthRole;
  status: AdminUserStatus;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  billing: {
    planCode: string;
    subscriptionStatus: string | null;
    creditBalance: number;
  };
}

export interface AdminOrderItem {
  productCode: string;
  productName: string;
  productKind: AdminProductKind;
  quantity: number;
  unitPrice: number;
  credits: number | null;
  planCode: string | null;
}

export interface AdminTransactionSummary {
  id: string;
  provider: AdminBillingProvider;
  status: AdminPaymentStatus;
  txnRef: string;
  providerTxnId: string | null;
  amount: number;
  currency: string;
  signatureVerified: boolean;
  processedAt: string | null;
  createdAt: string;
}

export interface AdminOrder {
  id: string;
  status: AdminOrderStatus;
  totalAmount: number;
  currency: string;
  provider: AdminBillingProvider | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    status: AdminUserStatus;
  };
  items: AdminOrderItem[];
  latestTransaction: AdminTransactionSummary | null;
  actions: {
    canManualMarkPaid: boolean;
  };
}

export interface AdminPaymentTransaction extends AdminTransactionSummary {
  orderId: string;
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
  };
  orderStatus: AdminOrderStatus;
}

export interface AdminProduct {
  id: string;
  code: string;
  name: string;
  kind: AdminProductKind;
  priceVnd: number;
  currency: string;
  credits: number | null;
  planCode: string | null;
  interval: "monthly" | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductSummary {
  total: number;
  active: number;
  inactive: number;
  missingMvpProducts: string[];
}

export interface AdminStats {
  range: AdminRange;
  users: {
    total: number;
    active: number;
    blocked: number;
    admins: number;
    completedOnboarding: number;
    newInRange: number;
  };
  orders: {
    total: number;
    pending: number;
    paid: number;
    failed: number;
    cancelled: number;
    expired: number;
    sandboxVolumeVnd: number;
  };
  payments: {
    totalTransactions: number;
    momo: number;
    vnpay: number;
    succeeded: number;
    failed: number;
    cancelled: number;
    expired: number;
    redirected: number;
  };
  subscriptions: {
    active: number;
    byPlan: Array<{
      planCode: string;
      count: number;
    }>;
  };
  credits: {
    totalBalance: number;
    purchasedInRange: number;
    consumedInRange: number;
  };
  products: AdminProductSummary;
  health: {
    status: string;
    manualMarkPaidEnabled: boolean;
  };
  recentUsers: AdminUser[];
  recentOrders: AdminOrder[];
  recentTransactions: AdminPaymentTransaction[];
}

export interface AdminPagination<T> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: T[];
}

export interface AdminUsersFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: AuthRole;
  status?: AdminUserStatus;
}

export interface AdminOrdersFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: AdminOrderStatus;
}

export interface AdminPaymentTransactionsFilters {
  page?: number;
  limit?: number;
  status?: AdminPaymentStatus;
  provider?: AdminBillingProvider;
}

export interface AdminProductsResult {
  products: AdminProduct[];
  summary: AdminProductSummary;
}

export interface AdminBillingTransaction {
  id: string;
  provider: AdminBillingProvider;
  status: AdminPaymentStatus;
  txnRef: string;
  providerTxnId: string | null;
  amount: number;
  currency: string;
  paymentUrl: string | null;
  signatureVerified: boolean;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMarkedPaidOrder {
  id: string;
  status: AdminOrderStatus;
  totalAmount: number;
  currency: string;
  provider: AdminBillingProvider | null;
  providerOrderId: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<AdminOrderItem & { id: string }>;
  transactions: AdminBillingTransaction[];
}

export interface AdminMarkPaidResult {
  order: AdminMarkedPaidOrder;
  transaction: AdminBillingTransaction | null;
  payment: {
    provider?: AdminBillingProvider;
    status: AdminPaymentStatus;
    signatureVerified: boolean;
  };
}
