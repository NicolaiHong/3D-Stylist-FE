export const BILLING_PROVIDERS = {
  MOMO: "momo",
  VNPAY: "vnpay",
} as const;

export const BILLING_PRODUCT_CODES = {
  STARTER_MONTHLY: "plan_starter_monthly",
  CREATOR_MONTHLY: "plan_creator_monthly",
  PRO_MONTHLY: "plan_pro_monthly",
  CREDITS_10: "credits_10",
  CREDITS_25: "credits_25",
  CREDITS_100: "credits_100",
} as const;

export type BillingProvider =
  (typeof BILLING_PROVIDERS)[keyof typeof BILLING_PROVIDERS];

export type BillingProductKind = "subscription_plan" | "credit_pack";

export type BillingOrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired";

export type BillingPaymentStatus =
  | "initiated"
  | "redirected"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired";

export interface BillingProductFeatures {
  canExportModel?: boolean;
  canDownloadModel?: boolean;
  queue?: string;
  texture?: string;
  [key: string]: unknown;
}

export interface BillingProduct {
  id: string;
  code: string;
  name: string;
  description: string | null;
  kind: BillingProductKind;
  priceVnd: number;
  currency: string;
  credits: number | null;
  planCode: string | null;
  interval: "monthly" | null;
  features: BillingProductFeatures | null;
  sortOrder: number;
}

export interface BillingCatalog {
  products: BillingProduct[];
  plans: BillingProduct[];
  creditPacks: BillingProduct[];
}

export interface BillingTransaction {
  id: string;
  provider: BillingProvider | string;
  status: BillingPaymentStatus;
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

export interface BillingOrderItem {
  id: string;
  productCode: string;
  productName: string;
  productKind: BillingProductKind | string;
  quantity: number;
  unitPrice: number;
  credits: number | null;
  planCode: string | null;
}

export interface BillingOrder {
  id: string;
  orderCode: string | null;
  status: BillingOrderStatus;
  totalAmount: number;
  currency: string;
  provider: BillingProvider | string | null;
  providerOrderId: string | null;
  paymentMethod: string | null;
  paymentVerification: string | null;
  bankTransferContent: string | null;
  bankTransferAmount: number | null;
  userReportedTransferredAt: string | null;
  verifiedAt: string | null;
  verifiedByAdminUserId: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: BillingOrderItem[];
  transactions: BillingTransaction[];
  payment: VietQrPaymentInstruction | null;
}

export interface BillingSummary {
  plan: {
    code: string;
    name: string;
    status: "free" | "active";
    currentPeriodEnd: string | null;
  };
  subscription: {
    id: string;
    planCode: string;
    productCode: string;
    status: string;
    currentPeriodEnd: string;
  } | null;
  credits: {
    balance: number;
  };
  capabilities: {
    canGeneratePreview: boolean;
    canGenerateHd: boolean;
    canExportModel: boolean;
    canDownloadModel: boolean;
  };
  pendingOrders: BillingOrder[];
  latestPayment: BillingTransaction | null;
}

export interface PayBillingOrderResult {
  order: BillingOrder;
  transaction: BillingTransaction;
  payment: {
    provider: BillingProvider;
    mode: "sandbox";
    redirectUrl: string;
  };
}

export interface VietQrPaymentInstruction {
  method: "vietqr_bank_transfer" | string;
  status: string;
  amount: number;
  currency: string;
  transferContent: string;
  bank: {
    bankBin: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  qr: {
    payload: string;
    imageUrl: string;
  };
  instructions: string[];
}

export interface BillingCheckoutResult {
  checkout: {
    id: string;
    status: "converted_to_order";
    productCode: string;
    quantity: 1;
    totalAmount: number;
    currency: string;
    expiresAt: string | null;
  };
  product: BillingProduct;
  eligibility: {
    canCheckout: true;
    blocker: null;
  };
  order: BillingOrder;
  payment: VietQrPaymentInstruction | null;
}
