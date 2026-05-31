import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { env } from "../config/env";
import { captureApiClientError } from "../config/sentry";
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

const AUTOMATIC_REFRESH_EXCLUDED_AUTH_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/refresh-token",
];

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

function shouldSkipAutomaticRefresh(url?: string): boolean {
  if (!url) {
    return false;
  }

  const path = url.split(/[?#]/, 1)[0];

  return (
    AUTOMATIC_REFRESH_EXCLUDED_AUTH_PATHS.some((excludedPath) =>
      path.endsWith(excludedPath),
    ) || path.includes("/auth/oauth/")
  );
}

function getSafeApiPath(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url, env.apiBaseUrl).pathname;
  } catch {
    return url.split(/[?#]/, 1)[0];
  }
}

function captureUnexpectedApiError(error: AxiosError): void {
  const status = error.response?.status;

  if (error.code === "ERR_CANCELED" || (status !== undefined && status < 500)) {
    return;
  }

  captureApiClientError({
    errorCode: error.code,
    method: error.config?.method?.toUpperCase(),
    path: getSafeApiPath(error.config?.url),
    status,
  });
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
      .catch((error: unknown) => {
        if (axios.isAxiosError(error)) {
          captureUnexpectedApiError(error);
        }

        throw error;
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
    captureUnexpectedApiError(error);

    const originalRequest = error.config as RetryRequestConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      shouldSkipAutomaticRefresh(originalRequest.url) ||
      !tokenStorage.getAccessToken()
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

export function getApiErrorCode(error: unknown): string | null {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  const data = error.response?.data as
    | { code?: string; error?: { code?: string } }
    | undefined;

  return data?.error?.code ?? data?.code ?? null;
}
