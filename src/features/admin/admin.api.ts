import { apiClient } from "../../services/apiClient";
import { AUTH_ROLES } from "../auth/auth.types";
import type { AdminHealth, AdminUser } from "./admin.types";

type ApiAdminUser = Omit<AdminUser, "role"> & {
  role: string;
};

interface AdminHealthResponse {
  success: true;
  data: AdminHealth;
}

interface AdminUsersResponse {
  success: true;
  data: {
    users: ApiAdminUser[];
  };
}

function normalizeAdminUser(user: ApiAdminUser): AdminUser {
  if (user.role !== AUTH_ROLES.ADMIN && user.role !== AUTH_ROLES.USER) {
    throw new Error("Admin users response contains an invalid role");
  }

  return {
    ...user,
    role: user.role,
  };
}

export const adminApi = {
  async getAdminHealth(): Promise<AdminHealth> {
    const { data } =
      await apiClient.get<AdminHealthResponse>("/admin/health");

    return data.data;
  },

  async getAdminUsers(): Promise<AdminUser[]> {
    const { data } = await apiClient.get<AdminUsersResponse>("/admin/users");

    return data.data.users.map(normalizeAdminUser);
  },
};
