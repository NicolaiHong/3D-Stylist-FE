export type PhysicalPrintPackageCode =
  | "MINI_PRINT"
  | "STANDARD_PRINT"
  | "PREMIUM_PRINT";

export type PhysicalPrintPaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED";

export type PhysicalPrintFulfillmentStatus =
  | "NOT_STARTED"
  | "WAITING_FULFILLMENT"
  | "ASSIGNED_TO_PRINT_PARTNER"
  | "PRINTING"
  | "PRINTED"
  | "SHIPPED"
  | "COMPLETED"
  | "CANCELLED";

export interface PhysicalPrintPackage {
  code: PhysicalPrintPackageCode;
  name: string;
  estimatedSizeLabel: string;
  qualityLabel: string;
  basePriceVnd: number;
  handlingFeeVnd: number;
  finalPriceVnd: number;
  productionTimeLabel: string;
  currency: "VND";
  displayOrder: number;
}

export interface CreatePhysicalPrintOrderPayload {
  figureId: string;
  packageCode: PhysicalPrintPackageCode;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  customerNote?: string;
}

export interface PhysicalPrintOrder {
  id: string;
  figureId: string;
  package: {
    code: PhysicalPrintPackageCode;
    name: string;
    estimatedSizeLabel: string;
    qualityLabel: string;
    productionTimeLabel: string;
  };
  price: {
    basePriceVnd: number;
    handlingFeeVnd: number;
    finalPriceVnd: number;
    currency: string;
  };
  paymentStatus: PhysicalPrintPaymentStatus;
  fulfillmentStatus: PhysicalPrintFulfillmentStatus;
  shipping: {
    name: string;
    phone: string;
    address: string;
  };
  customerNote: string | null;
  trackingCode: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  assignedAt: string | null;
  printedAt: string | null;
  shippedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface PhysicalPrintOrderListItem {
  id: string;
  figureId: string;
  package: {
    code: PhysicalPrintPackageCode;
    name: string;
    estimatedSizeLabel: string;
    productionTimeLabel: string;
  };
  price: {
    finalPriceVnd: number;
    currency: string;
  };
  paymentStatus: PhysicalPrintPaymentStatus;
  fulfillmentStatus: PhysicalPrintFulfillmentStatus;
  trackingCode: string | null;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface PhysicalPrintOrderListResult {
  orders: PhysicalPrintOrderListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PhysicalPrintOrderListFilters {
  page?: number;
  limit?: number;
  paymentStatus?: PhysicalPrintPaymentStatus;
  fulfillmentStatus?: PhysicalPrintFulfillmentStatus;
  packageCode?: PhysicalPrintPackageCode;
}

export interface PhysicalPrintCheckoutResult {
  order: PhysicalPrintOrder;
  payment: {
    provider: "payos";
    checkoutUrl: string;
    paymentStatus: string;
  };
}
