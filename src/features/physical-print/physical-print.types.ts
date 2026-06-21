export type PhysicalPrintPackageCode =
  | "MINI_PRINT"
  | "STANDARD_PRINT"
  | "PREMIUM_PRINT";

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
  paymentStatus: string;
  fulfillmentStatus: string;
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
  shippedAt: string | null;
  completedAt: string | null;
}

export interface PhysicalPrintCheckoutResult {
  order: PhysicalPrintOrder;
  payment: {
    provider: "payos";
    checkoutUrl: string;
    paymentStatus: string;
  };
}
