import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { env } from "../config/env";
import { tokenStorage } from "./tokenStorage";

type RetryRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

interface RefreshResponse {
  success: boolean;
  data?: {
    user?: unknown;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  };
  user?: unknown;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

let refreshSessionPromise: Promise<RefreshResponse> | null = null;

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export function resolveApiAssetUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (!value.startsWith("/")) {
    return value;
  }

  try {
    return `${new URL(env.apiBaseUrl).origin}${value}`;
  } catch {
    return value;
  }
}

function getRefreshedAccessToken(response: RefreshResponse): string | undefined {
  return response.data?.accessToken ?? response.accessToken;
}

export async function refreshAuthSession(): Promise<RefreshResponse> {
  if (!refreshSessionPromise) {
    refreshSessionPromise = axios
      .post<RefreshResponse>(
        `${env.apiBaseUrl}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .then(({ data }) => {
        const accessToken = getRefreshedAccessToken(data);

        if (!accessToken) {
          throw new Error("Refresh response did not include an access token");
        }

        tokenStorage.setAccessToken(accessToken);
        return data;
      })
      .finally(() => {
        refreshSessionPromise = null;
      });
  }

  return refreshSessionPromise;
}

apiClient.interceptors.request.use((config) => {
  const accessToken = tokenStorage.getAccessToken();

  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    config.headers.set("Content-Type", undefined);
  }

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryRequestConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url?.includes("/auth/refresh")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const data = await refreshAuthSession();
      const accessToken = getRefreshedAccessToken(data);

      if (!accessToken) {
        throw new Error("Refresh response did not include an access token");
      }

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;

      return apiClient(originalRequest);
    } catch (refreshError) {
      tokenStorage.clear();

      const isAuthRoute =
        window.location.pathname.startsWith("/login") ||
        window.location.pathname.startsWith("/register") ||
        window.location.pathname.startsWith("/auth/");

      if (!isAuthRoute) {
        window.location.assign("/login");
      }

      return Promise.reject(refreshError);
    }
  },
);

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; error?: { message?: string } }
      | undefined;

    return (
      data?.message ||
      data?.error?.message ||
      error.message ||
      "Something went wrong"
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong";
}
