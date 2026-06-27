import type {
  PhysicalPrintFulfillmentStatus,
  PhysicalPrintOrder,
  PhysicalPrintPaymentStatus,
} from "./physical-print.types";

type Translate = (key: string) => string;

const paymentLabelKeys: Record<PhysicalPrintPaymentStatus, string> = {
  PENDING: "physicalPrint.tracking.payment.pending",
  PAID: "physicalPrint.tracking.payment.paid",
  FAILED: "physicalPrint.tracking.payment.failed",
  CANCELLED: "physicalPrint.tracking.payment.cancelled",
  EXPIRED: "physicalPrint.tracking.payment.expired",
  REFUNDED: "physicalPrint.tracking.payment.refunded",
};

const fulfillmentLabelKeys: Record<PhysicalPrintFulfillmentStatus, string> = {
  NOT_STARTED: "physicalPrint.tracking.fulfillment.notStarted",
  WAITING_FULFILLMENT:
    "physicalPrint.tracking.fulfillment.waitingFulfillment",
  ASSIGNED_TO_PRINT_PARTNER:
    "physicalPrint.tracking.fulfillment.assignedToPartner",
  PRINTING: "physicalPrint.tracking.fulfillment.printing",
  PRINTED: "physicalPrint.tracking.fulfillment.printed",
  SHIPPED: "physicalPrint.tracking.fulfillment.shipped",
  COMPLETED: "physicalPrint.tracking.fulfillment.completed",
  CANCELLED: "physicalPrint.tracking.fulfillment.cancelled",
};

export function getPhysicalPrintPaymentLabel(
  status: PhysicalPrintPaymentStatus,
  t: Translate,
): string {
  return t(paymentLabelKeys[status]);
}

export function getPhysicalPrintFulfillmentLabel(
  status: PhysicalPrintFulfillmentStatus,
  t: Translate,
): string {
  return t(fulfillmentLabelKeys[status]);
}

export function getPhysicalPrintPaymentTone(
  status: PhysicalPrintPaymentStatus,
): string {
  if (status === "PAID") {
    return "border-[#00e5ff]/30 bg-[#00e5ff]/10 text-[#9cf0ff]";
  }

  if (status === "PENDING") {
    return "border-[#f3bf26]/30 bg-[#f3bf26]/10 text-[#ffeac0]";
  }

  if (status === "REFUNDED") {
    return "border-[#9db1ff]/30 bg-[#394269]/25 text-[#dbe1ff]";
  }

  return "border-[#ffb4ab]/30 bg-[#93000a]/25 text-[#ffdad6]";
}

export function getPhysicalPrintFulfillmentTone(
  status: PhysicalPrintFulfillmentStatus,
): string {
  if (status === "COMPLETED") {
    return "border-[#00e5ff]/30 bg-[#00e5ff]/10 text-[#9cf0ff]";
  }

  if (status === "CANCELLED") {
    return "border-[#ffb4ab]/30 bg-[#93000a]/25 text-[#ffdad6]";
  }

  if (status === "NOT_STARTED") {
    return "border-white/10 bg-white/[0.05] text-[#bac9cc]";
  }

  return "border-[#6dd6b0]/25 bg-[#123c31]/45 text-[#a7f3d0]";
}

export function canRetryPhysicalPrintCheckout(
  order: Pick<PhysicalPrintOrder, "paymentStatus" | "fulfillmentStatus">,
): boolean {
  return getPhysicalPrintCheckoutAction(order) !== null;
}

export function getPhysicalPrintCheckoutAction(
  order: Pick<PhysicalPrintOrder, "paymentStatus" | "fulfillmentStatus">,
): "continue" | "pay_again" | null {
  if (order.fulfillmentStatus !== "NOT_STARTED") {
    return null;
  }

  if (order.paymentStatus === "PENDING") {
    return "continue";
  }

  return (
    ["FAILED", "CANCELLED", "EXPIRED"] as PhysicalPrintPaymentStatus[]
  ).includes(order.paymentStatus)
    ? "pay_again"
    : null;
}
