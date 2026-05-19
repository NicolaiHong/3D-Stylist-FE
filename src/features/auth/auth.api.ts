import {
  apiClient,
  refreshAuthSession,
  resolveApiAssetUrl,
} from "../../services/apiClient";
import { env } from "../../config/env";
import { AUTH_ROLES } from "./auth.types";
import type {
  AuthRole,
  AuthSession,
  AuthUser,
  LoginInput,
  RegisterInput,
} from "./auth.types";

export type ApiAuthUser = Omit<
  AuthUser,
  | "role"
  | "occupation"
  | "stylePreferences"
  | "preferredColors"
  | "outfitVibe"
  | "onboardingCompleted"
> & {
  role: string;
  occupation?: string | null;
  stylePreferences?: string[] | null;
  preferredColors?: string[] | null;
  outfitVibe?: string | null;
  onboardingCompleted?: boolean | null;
};

interface AuthResponse {
  success: true;
  data?: {
    user?: ApiAuthUser;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  };
  user?: ApiAuthUser;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

interface MeResponse {
  success: true;
  data?: {
    user?: ApiAuthUser;
  };
  id?: string;
  email?: string | null;
  fullName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  occupation?: string | null;
  stylePreferences?: string[] | null;
  preferredColors?: string[] | null;
  outfitVibe?: string | null;
  onboardingCompleted?: boolean | null;
  role?: string;
  status?: string;
  createdAt?: string;
}

function normalizeRole(role: string): AuthRole {
  if (role === AUTH_ROLES.ADMIN || role === AUTH_ROLES.USER) {
    return role;
  }

  throw new Error("Profile response contains an invalid role");
}

export function normalizeUser(user: ApiAuthUser): AuthUser {
  return {
    ...user,
    avatarUrl: resolveApiAssetUrl(user.avatarUrl),
    occupation: user.occupation ?? null,
    stylePreferences: Array.isArray(user.stylePreferences)
      ? user.stylePreferences
      : [],
    preferredColors: Array.isArray(user.preferredColors)
      ? user.preferredColors
      : [],
    outfitVibe: user.outfitVibe ?? null,
    onboardingCompleted: Boolean(user.onboardingCompleted),
    role: normalizeRole(user.role),
  };
}

function normalizeAuthResponse(response: AuthResponse): AuthSession {
  const user = response.data?.user ?? response.user;
  const accessToken = response.data?.accessToken ?? response.accessToken;

  if (!user || !accessToken) {
    throw new Error("Authentication response is missing user or access token");
  }

  return {
    user: normalizeUser(user),
    accessToken,
    refreshToken: response.data?.refreshToken ?? response.refreshToken,
    expiresIn: response.data?.expiresIn ?? response.expiresIn,
  };
}

function normalizeMeResponse(response: MeResponse): AuthUser {
  const user = response.data?.user;

  if (user) {
    return normalizeUser(user);
  }

  if (response.id && response.role && response.status && response.createdAt) {
    return {
      id: response.id,
      email: response.email ?? null,
      fullName: response.fullName ?? response.displayName ?? null,
      displayName: response.displayName ?? response.fullName ?? null,
      avatarUrl: resolveApiAssetUrl(response.avatarUrl),
      occupation: response.occupation ?? null,
      stylePreferences: Array.isArray(response.stylePreferences)
        ? response.stylePreferences
        : [],
      preferredColors: Array.isArray(response.preferredColors)
        ? response.preferredColors
        : [],
      outfitVibe: response.outfitVibe ?? null,
      onboardingCompleted: Boolean(response.onboardingCompleted),
      role: normalizeRole(response.role),
      status: response.status,
      createdAt: response.createdAt,
    };
  }

  throw new Error("Profile response is missing user data");
}

export const authApi = {
  async login(input: LoginInput): Promise<AuthSession> {
    const { data } = await apiClient.post<AuthResponse>("/auth/login", input);
    return normalizeAuthResponse(data);
  },

  async register(input: RegisterInput): Promise<AuthSession> {
    const { data } = await apiClient.post<AuthResponse>("/auth/register", {
      email: input.email,
      password: input.password,
      fullName: input.fullName,
      displayName: input.fullName,
    });

    return normalizeAuthResponse(data);
  },

  async me(): Promise<AuthUser> {
    const { data } = await apiClient.get<MeResponse>("/auth/me");
    return normalizeMeResponse(data);
  },

  async refresh(): Promise<AuthSession> {
    const data = (await refreshAuthSession()) as AuthResponse;
    return normalizeAuthResponse(data);
  },

  async logout(): Promise<void> {
    await apiClient.post("/auth/logout", {});
  },

  getOAuthUrl(provider: "google" | "facebook"): string {
    return `${env.apiBaseUrl}/auth/${provider}`;
  },
};
