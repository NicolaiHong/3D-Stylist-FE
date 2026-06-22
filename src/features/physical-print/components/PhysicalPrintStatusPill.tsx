import type {
  PhysicalPrintFulfillmentStatus,
  PhysicalPrintPaymentStatus,
} from "../physical-print.types";
import {
  getPhysicalPrintFulfillmentLabel,
  getPhysicalPrintFulfillmentTone,
  getPhysicalPrintPaymentLabel,
  getPhysicalPrintPaymentTone,
} from "../physical-print.presentation";
import { useI18n } from "../../../i18n/useI18n";

type PhysicalPrintStatusPillProps =
  | {
      kind: "payment";
      status: PhysicalPrintPaymentStatus;
    }
  | {
      kind: "fulfillment";
      status: PhysicalPrintFulfillmentStatus;
    };

export function PhysicalPrintStatusPill(
  props: PhysicalPrintStatusPillProps,
) {
  const { t } = useI18n();
  const label =
    props.kind === "payment"
      ? getPhysicalPrintPaymentLabel(props.status, t)
      : getPhysicalPrintFulfillmentLabel(props.status, t);
  const tone =
    props.kind === "payment"
      ? getPhysicalPrintPaymentTone(props.status)
      : getPhysicalPrintFulfillmentTone(props.status);

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-md border px-2.5 py-1 text-xs font-bold ${tone}`}
    >
      {label}
    </span>
  );
}
