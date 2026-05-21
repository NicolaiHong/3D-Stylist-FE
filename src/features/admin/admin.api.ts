import { apiClient } from "../../services/apiClient";
import { AUTH_ROLES, type AuthRole } from "../auth/auth.types";
import type {
  AdminHealth,
  AdminMarkPaidResult,
  AdminOrder,
  AdminOrdersFilters,
  AdminPagination,
  AdminPaymentTransaction,
  AdminPaymentTransactionsFilters,
  AdminProduct,
  AdminProductSummary,
  AdminProductsResult,
  AdminRange,
  AdminStats,
  AdminUser,
  AdminUserStatus,
  AdminUsersFilters,
} from "./admin.types";

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

type ApiAdminUser = Omit<AdminUser, "role" | "status"> & {
  role: string;
  status: string;
};

interface ApiPaginatedData<T> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items?: T[];
}

interface ApiAdminUsersData extends ApiPaginatedData<ApiAdminUser> {
  users?: ApiAdminUser[];
}

interface ApiAdminOrdersData extends ApiPaginatedData<AdminOrder> {
  orders?: AdminOrder[];
}

interface ApiAdminTransactionsData
  extends ApiPaginatedData<AdminPaymentTransaction> {
  transactions?: AdminPaymentTransaction[];
}

type QueryValue = boolean | number | string | null | undefined;

function definedParams(input: Record<string, QueryValue>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== ""),
  );
}

function normalizeRole(role: string): AuthRole {
  if (role === AUTH_ROLES.ADMIN || role === AUTH_ROLES.USER) {
    return role;
  }

  throw new Error("Admin users response contains an invalid role");
}

function normalizeStatus(status: string): AdminUserStatus {
  if (status === "active" || status === "blocked") {
    return status;
  }

  throw new Error("Admin users response contains an invalid status");
}

function normalizeAdminUser(user: ApiAdminUser): AdminUser {
  return {
    ...user,
    role: normalizeRole(user.role),
    status: normalizeStatus(user.status),
  };
}

function normalizePagination<T>(
  data: ApiPaginatedData<T>,
  aliasItems: T[] | undefined,
): AdminPagination<T> {
  return {
    page: data.page,
    limit: data.limit,
    total: data.total,
    totalPages: data.totalPages,
    items: data.items ?? aliasItems ?? [],
  };
}

export const adminApi = {
  async getAdminHealth(): Promise<AdminHealth> {
    const { data } =
      await apiClient.get<ApiSuccessResponse<AdminHealth>>("/admin/health");

    return data.data;
  },

  async getAdminStats(range: AdminRange = "30d"): Promise<AdminStats> {
    const { data } = await apiClient.get<ApiSuccessResponse<AdminStats>>(
      "/admin/stats",
      {
        params: definedParams({ range }),
      },
    );

    return data.data;
  },

  async getAdminUsers(
    filters: AdminUsersFilters = {},
  ): Promise<AdminPagination<AdminUser>> {
    const { data } = await apiClient.get<ApiSuccessResponse<ApiAdminUsersData>>(
      "/admin/users",
      {
        params: definedParams({ ...filters }),
      },
    );

    const users = (data.data.users ?? data.data.items ?? []).map(
      normalizeAdminUser,
    );

    return {
      page: data.data.page,
      limit: data.data.limit,
      total: data.data.total,
      totalPages: data.data.totalPages,
      items: users,
    };
  },

  async getAdminOrders(
    filters: AdminOrdersFilters = {},
  ): Promise<AdminPagination<AdminOrder>> {
    const { data } = await apiClient.get<ApiSuccessResponse<ApiAdminOrdersData>>(
      "/admin/orders",
      {
        params: definedParams({ ...filters }),
      },
    );

    return normalizePagination(data.data, data.data.orders);
  },

  async getAdminPaymentTransactions(
    filters: AdminPaymentTransactionsFilters = {},
  ): Promise<AdminPagination<AdminPaymentTransaction>> {
    const { data } = await apiClient.get<
      ApiSuccessResponse<ApiAdminTransactionsData>
    >("/admin/payment-transactions", {
      params: definedParams({ ...filters }),
    });

    return normalizePagination(data.data, data.data.transactions);
  },

  async getAdminProducts(
    includeInactive = false,
  ): Promise<AdminProductsResult> {
    const { data } = await apiClient.get<
      ApiSuccessResponse<{
        products: AdminProduct[];
        summary: AdminProductSummary;
      }>
    >("/admin/products", {
      params: definedParams({ includeInactive }),
    });

    return data.data;
  },

  async markOrderPaid(orderId: string): Promise<AdminMarkPaidResult> {
    const { data } = await apiClient.post<ApiSuccessResponse<AdminMarkPaidResult>>(
      `/admin/billing/orders/${orderId}/mark-paid`,
      {},
    );

    return data.data;
  },
};
