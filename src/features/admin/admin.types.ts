import type { AuthRole } from "../auth/auth.types";

export interface AdminHealth {
  status: string;
}

export interface AdminUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: AuthRole;
  status: string;
  createdAt: string;
  updatedAt: string;
}
