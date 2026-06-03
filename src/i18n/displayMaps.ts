import type { Language } from "./types";
import { messages } from "./messages";

const displayKeyByScope: Record<string, Record<string, string>> = {
  role: {
    user: "display.role.user",
    admin: "display.role.admin",
  },
  accountStatus: {
    active: "display.status.active",
    blocked: "display.status.blocked",
  },
  orderStatus: {
    pending: "display.order.pending",
    paid: "display.order.paid",
    failed: "display.order.failed",
    cancelled: "display.order.cancelled",
    expired: "display.order.expired",
  },
  paymentStatus: {
    initiated: "display.payment.initiated",
    redirected: "display.payment.redirected",
    succeeded: "display.payment.succeeded",
    failed: "display.payment.failed",
    cancelled: "display.payment.cancelled",
    expired: "display.payment.expired",
    pending_verification: "display.payment.pending_verification",
  },
  verificationStatus: {
    awaiting_transfer: "display.verification.awaiting_transfer",
    user_reported_transferred: "display.verification.user_reported_transferred",
    pending_admin_verification:
      "display.verification.pending_admin_verification",
    admin_verified: "display.verification.admin_verified",
    rejected: "display.verification.rejected",
    expired: "display.verification.expired",
  },
  figureStatus: {
    draft: "display.figure.draft",
    queued: "display.figure.queued",
    processing: "display.figure.processing",
    success: "display.figure.success",
    failed: "display.figure.failed",
    canceled: "display.figure.canceled",
  },
  productKind: {
    subscription_plan: "display.productKind.subscription_plan",
    credit_pack: "display.productKind.credit_pack",
  },
  healthStatus: {
    ok: "display.health.ok",
    unknown: "display.health.unknown",
    configured: "display.health.configured",
    pending: "display.health.pending",
    enabled: "display.health.enabled",
    disabled: "display.health.disabled",
  },
};

function interpolate(template: string, value: string) {
  return template.replace("{value}", value);
}

export function getDisplayLabel(
  scope: keyof typeof displayKeyByScope,
  value: string | null | undefined,
  language: Language,
) {
  if (!value) {
    return messages[language]["common.unknown"];
  }

  const key = displayKeyByScope[scope][value];

  if (key) {
    return messages[language][key] ?? messages.en[key] ?? value;
  }

  return interpolate(
    messages[language]["display.unknownValue"] ??
      messages.en["display.unknownValue"],
    value,
  );
}

export function getKnownDisplayLabel(
  value: string | null | undefined,
  language: Language,
) {
  if (!value) {
    return messages[language]["common.unknown"];
  }

  for (const scope of Object.keys(displayKeyByScope) as Array<
    keyof typeof displayKeyByScope
  >) {
    const key = displayKeyByScope[scope][value];

    if (key) {
      return messages[language][key] ?? messages.en[key] ?? value;
    }
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
