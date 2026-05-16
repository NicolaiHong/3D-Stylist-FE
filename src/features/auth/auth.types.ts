export const AUTH_ROLES = {
  USER: "user",
  ADMIN: "admin",
} as const;

export type AuthRole = (typeof AUTH_ROLES)[keyof typeof AUTH_ROLES];

export interface AuthUser {
  id: string;
  email: string | null;
  fullName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: AuthRole;
  status: string;
  createdAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}
