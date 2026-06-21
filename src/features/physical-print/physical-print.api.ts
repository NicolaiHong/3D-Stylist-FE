import { apiClient } from "../../services/apiClient";
import type {
  CreatePhysicalPrintOrderPayload,
  PhysicalPrintCheckoutResult,
  PhysicalPrintOrder,
  PhysicalPrintPackage,
} from "./physical-print.types";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

function unwrapData<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new Error(response.message || "Physical print request failed");
  }

  return response.data;
}

export async function getPhysicalPrintPackages(): Promise<
  PhysicalPrintPackage[]
> {
  const { data } = await apiClient.get<
    ApiResponse<{ packages: PhysicalPrintPackage[] }>
  >("/physical-print/packages");

  return unwrapData(data).packages;
}

export async function createPhysicalPrintOrder(
  payload: CreatePhysicalPrintOrderPayload,
): Promise<PhysicalPrintOrder> {
  const { data } = await apiClient.post<
    ApiResponse<{ order: PhysicalPrintOrder }>
  >("/physical-print/orders", payload);

  return unwrapData(data).order;
}

export async function getPhysicalPrintOrder(
  orderId: string,
): Promise<PhysicalPrintOrder> {
  const { data } = await apiClient.get<
    ApiResponse<{ order: PhysicalPrintOrder }>
  >(`/physical-print/orders/${orderId}`);

  return unwrapData(data).order;
}

export async function createPhysicalPrintPayosCheckout(
  orderId: string,
): Promise<PhysicalPrintCheckoutResult> {
  const { data } = await apiClient.post<
    ApiResponse<PhysicalPrintCheckoutResult>
  >(`/physical-print/orders/${orderId}/payos-checkout`, {});

  return unwrapData(data);
}

export const physicalPrintApi = {
  getPhysicalPrintPackages,
  createPhysicalPrintOrder,
  getPhysicalPrintOrder,
  createPhysicalPrintPayosCheckout,
};
