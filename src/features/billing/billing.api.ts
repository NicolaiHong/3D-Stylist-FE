import { apiClient } from "../../services/apiClient";
import type {
  BillingCatalog,
  BillingCheckoutResult,
  BillingOrder,
  BillingOrderStatus,
  BillingProvider,
  BillingSummary,
  CancelCurrentSubscriptionResult,
  PayBillingOrderResult,
} from "./billing.types";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

function unwrapData<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new Error(response.message || "Billing request failed");
  }

  return response.data;
}

export async function getBillingCatalog(): Promise<BillingCatalog> {
  const { data } = await apiClient.get<ApiResponse<BillingCatalog>>(
    "/billing/catalog",
  );

  return unwrapData(data);
}

export async function getBillingMe(): Promise<BillingSummary> {
  const { data } = await apiClient.get<ApiResponse<BillingSummary>>(
    "/billing/me",
  );

  return unwrapData(data);
}

export async function createBillingOrder(
  productCode: string,
): Promise<BillingOrder> {
  const { data } = await apiClient.post<ApiResponse<{ order: BillingOrder }>>(
    "/billing/orders",
    { productCode },
  );

  return unwrapData(data).order;
}

export async function createBillingCheckout(
  productCode: string,
  intent: "add_to_cart" | "buy_now" = "buy_now",
): Promise<BillingCheckoutResult> {
  const { data } = await apiClient.post<ApiResponse<BillingCheckoutResult>>(
    "/billing/checkout",
    { productCode, intent },
  );

  return unwrapData(data);
}

export async function getBillingOrders(
  status?: BillingOrderStatus,
): Promise<BillingOrder[]> {
  const { data } = await apiClient.get<
    ApiResponse<{ orders: BillingOrder[] }>
  >("/billing/orders", {
    params: status ? { status } : undefined,
  });

  return unwrapData(data).orders;
}

export async function getBillingOrder(
  orderId: string,
): Promise<BillingOrder> {
  const { data } = await apiClient.get<ApiResponse<{ order: BillingOrder }>>(
    `/billing/orders/${orderId}`,
  );

  return unwrapData(data).order;
}

export async function payBillingOrder(
  orderId: string,
  provider: BillingProvider,
): Promise<PayBillingOrderResult> {
  const { data } = await apiClient.post<ApiResponse<PayBillingOrderResult>>(
    `/billing/orders/${orderId}/pay`,
    { provider },
  );

  return unwrapData(data);
}

export async function confirmBillingTransfer(
  orderId: string,
): Promise<BillingOrder> {
  const { data } = await apiClient.post<ApiResponse<{ order: BillingOrder }>>(
    `/billing/orders/${orderId}/transfer-confirmation`,
    {},
  );

  return unwrapData(data).order;
}

export async function cancelCurrentSubscription(
  confirmation: string,
): Promise<CancelCurrentSubscriptionResult> {
  const { data } = await apiClient.post<
    ApiResponse<CancelCurrentSubscriptionResult>
  >("/billing/subscriptions/current/cancellation", { confirmation });

  return unwrapData(data);
}

export const billingApi = {
  getBillingCatalog,
  getBillingMe,
  createBillingCheckout,
  createBillingOrder,
  getBillingOrders,
  getBillingOrder,
  payBillingOrder,
  confirmBillingTransfer,
  cancelCurrentSubscription,
};
