import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { env } from "../config/env";
import { captureApiClientError } from "../config/sentry";
import { tokenStorage } from "./tokenStorage";

type RetryRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type ApiErrorPayload = {
  message?: unknown;
  code?: unknown;
  error?: {
    message?: unknown;
    code?: unknown;
  };
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
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/refresh",
  "/auth/refresh-token",
];

const CODE_ERROR_MESSAGES: Record<string, string> = {
  ACTIVE_SUBSCRIPTION_EXISTS:
    "Cancel your current plan before buying another subscription.",
  ACTIVE_SUBSCRIPTION_NOT_FOUND: "No active subscription was found.",
  AUTH_ERROR: "Your session has expired. Please sign in again.",
  AUTH_REQUIRED: "Please sign in to continue.",
  BILLING_PRODUCT_NOT_FOUND: "This product is no longer available.",
  DATABASE_ERROR: "Something went wrong. Please try again.",
  EMAIL_TAKEN: "An account with this email already exists.",
  FILE_REQUIRED: "Choose a file before continuing.",
  FILE_TOO_LARGE: "This file is too large. Choose a smaller image.",
  FIGURE_NOT_FOUND: "This generation could not be found.",
  GENERATION_PROMPT_TOO_LONG: "Shorten your prompt and try again.",
  GENERATION_PROVIDER_NOT_ALLOWED:
    "This generation mode is not available for this account.",
  GENERATION_REFERENCE_IMAGE_REQUIRED:
    "Upload a reference image before continuing.",
  IMAGE_DIMENSIONS_TOO_LARGE:
    "This image is too large. Choose a smaller image.",
  IMAGE_EXTENSION_MISMATCH: "The image extension does not match the file.",
  IMAGE_EXTENSION_REQUIRED: "Use an image file with a valid extension.",
  IMAGE_TOO_SMALL: "This image is too small. Choose a clearer image.",
  INSUFFICIENT_GENERATION_CREDITS:
    "You do not have enough credits for this generation.",
  INSUFFICIENT_ROLE: "You do not have permission to view this page.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
  INVALID_CANCELLATION_CONFIRMATION:
    "Type the confirmation text exactly as shown.",
  INVALID_CREDENTIALS: "Email or password is incorrect.",
  INVALID_IMAGE_DATA: "This image could not be read. Choose another image.",
  INVALID_IMAGE_SIGNATURE: "This file does not look like a supported image.",
  INVALID_REFERENCE_ASSET: "This reference image is no longer available.",
  INVALID_RESET_CODE: "The reset code is invalid or has expired.",
  INVALID_ROLE: "You do not have permission to view this page.",
  NOT_FOUND: "We could not find that item.",
  ORDER_ALREADY_PAID: "This order is already paid.",
  ORDER_EXPIRED: "This order has expired. Create a new checkout to continue.",
  ORDER_HAS_NO_ITEMS: "This order has no items.",
  ORDER_NOT_AWAITING_TRANSFER:
    "This order is not waiting for a transfer report.",
  ORDER_NOT_FOUND: "This order could not be found.",
  ORDER_NOT_PAYABLE: "This order cannot be paid in its current state.",
  PAYMENT_METHOD_ALREADY_SELECTED:
    "A payment method is already selected for this order.",
  PAYMENT_VERIFICATION_REQUIRED:
    "Report the transfer before manual verification can continue.",
  PAYOS_CONFIG_MISSING: "payOS is not available for this order.",
  PAYOS_DISABLED: "payOS is not available for this order.",
  PAYOS_LINK_ACTIVE: "A payOS checkout link is already active for this order.",
  PAYOS_LINK_CREATE_FAILED:
    "We could not create the payOS checkout link. Try again.",
  PAYOS_LINK_CREATION_PENDING:
    "A payOS checkout link is being prepared. Try again shortly.",
  PAYOS_STATUS_INVALID_SIGNATURE: "The payment status could not be verified.",
  PAYOS_STATUS_UNAVAILABLE:
    "Payment status is temporarily unavailable. Try again shortly.",
  PAYWALL_REQUIRED: "A paid plan is required for this action.",
  PHYSICAL_PRINT_FIGURE_NOT_FOUND:
    "This model is not available for physical print.",
  PHYSICAL_PRINT_FIGURE_NOT_READY:
    "The 3D model must be complete before ordering a print.",
  PHYSICAL_PRINT_INVALID_TRANSITION:
    "This fulfillment status change is not available.",
  PHYSICAL_PRINT_MODEL_INVALID:
    "The model file is not ready for physical print.",
  PHYSICAL_PRINT_MODEL_REQUIRED:
    "A completed 3D model is required before ordering a print.",
  PHYSICAL_PRINT_ORDER_NOT_FOUND:
    "This physical print order could not be found.",
  PHYSICAL_PRINT_ORDER_NOT_PAYABLE:
    "This physical print order cannot be paid in its current state.",
  PHYSICAL_PRINT_PAYMENT_REQUIRED:
    "Payment must be confirmed before fulfillment can continue.",
  PHYSICAL_PRINT_PAYOS_CONFIG_MISSING:
    "payOS is not available for this physical print order.",
  PHYSICAL_PRINT_PAYOS_DISABLED:
    "payOS is not available for this physical print order.",
  PHYSICAL_PRINT_PAYOS_LINK_CREATION_PENDING:
    "A payOS checkout link is being prepared. Try again shortly.",
  PHYSICAL_PRINT_PAYOS_LINK_UNAVAILABLE:
    "We could not open payOS checkout for this order. Try again.",
  RATE_LIMIT_EXCEEDED: "Too many attempts. Try again in a moment.",
  REFERENCE_IMAGE_CONSENT_REQUIRED:
    "Confirm you have permission to use this reference image.",
  REFERENCE_KIND_UNSUPPORTED: "This reference image type is not supported yet.",
  REMOTE_IMAGE_URL_NOT_ALLOWED: "Upload an image file from your device.",
  RESET_ATTEMPTS_EXCEEDED:
    "Too many reset attempts. Request a new code and try again.",
  ROLE_NOT_FOUND: "You do not have permission to view this page.",
  TOKEN_EXPIRED: "Your session has expired. Please sign in again.",
  TOKEN_REUSE_DETECTED: "Please sign in again to protect your account.",
  UNSUPPORTED_FILE_TYPE: "Use a supported image file.",
  UNSUPPORTED_IMAGE_ENCODING: "Use a standard JPEG, PNG, or WebP image.",
  USER_BLOCKED: "This account is blocked. Contact support if this looks wrong.",
  USER_NOT_FOUND: "This account could not be found.",
  VALIDATION_ERROR: "Review the details and try again.",
};

const STATUS_ERROR_MESSAGES: Record<number, string> = {
  400: "Review the details and try again.",
  401: "Your session has expired. Please sign in again.",
  402: "A paid plan or more credits are required for this action.",
  403: "You do not have permission to perform this action.",
  404: "We could not find that item.",
  409: "This action cannot be completed in the current state.",
  422: "Review the details and try again.",
  429: "Too many attempts. Try again in a moment.",
  500: "Something went wrong. Please try again.",
  503: "This service is temporarily unavailable. Try again shortly.",
};

const TECHNICAL_MESSAGE_PATTERN =
  /\b(?:api|backend|callback|controller|database|db|endpoint|internal|middleware|prisma|redis|render|route|server|sql|stack|supabase|vercel|webhook)\b|\/api\/|https?:\/\/|[A-Z0-9]+_[A-Z0-9_]+/i;

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export function resolveApiAssetUrl(
  value: string | null | undefined,
): string | null {
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

function getRefreshedAccessToken(
  response: RefreshResponse,
): string | undefined {
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
    const data = getApiErrorData(error);
    const code = getApiErrorCodeFromData(data);

    return (
      getKnownApiErrorMessage(code) ||
      getSafeResponseMessage(data) ||
      getStatusErrorMessage(error.response?.status) ||
      "Something went wrong. Please try again."
    );
  }

  if (error instanceof Error) {
    return (
      getSafePlainMessage(error.message) ||
      "Something went wrong. Please try again."
    );
  }

  return "Something went wrong. Please try again.";
}

export function getApiErrorCode(error: unknown): string | null {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  return getApiErrorCodeFromData(getApiErrorData(error));
}

function getApiErrorData(error: AxiosError): ApiErrorPayload | undefined {
  return error.response?.data as ApiErrorPayload | undefined;
}

function getApiErrorCodeFromData(
  data: ApiErrorPayload | undefined,
): string | null {
  const code = data?.error?.code ?? data?.code;

  return typeof code === "string" ? code : null;
}

function getKnownApiErrorMessage(code: string | null): string | null {
  if (!code) {
    return null;
  }

  if (CODE_ERROR_MESSAGES[code]) {
    return CODE_ERROR_MESSAGES[code];
  }

  if (code.includes("RATE_LIMIT")) {
    return "Too many attempts. Try again in a moment.";
  }

  if (code.startsWith("OAUTH_")) {
    return "Sign-in could not be completed. Try again.";
  }

  if (code.includes("EMAIL_VERIFICATION")) {
    return "Email verification could not be completed. Try again.";
  }

  if (code.includes("PASSWORD_RESET")) {
    return "Password reset could not be completed. Try again.";
  }

  if (code.startsWith("PHYSICAL_PRINT_PAYOS_")) {
    return "payOS checkout is temporarily unavailable for this print order. Try again.";
  }

  if (code.startsWith("PHYSICAL_PRINT_")) {
    return "This physical print action cannot be completed right now.";
  }

  if (code.startsWith("PAYOS_")) {
    return "payOS checkout is temporarily unavailable. Try again.";
  }

  if (code.startsWith("GENERATION_") || code.startsWith("MESHY_")) {
    return "Generation is temporarily unavailable. Try again.";
  }

  if (code.includes("NOT_FOUND")) {
    return "We could not find that item.";
  }

  if (
    code.includes("UNAVAILABLE") ||
    code.includes("DISABLED") ||
    code.includes("CONFIG")
  ) {
    return "This action is temporarily unavailable. Try again later.";
  }

  if (
    code.includes("INVALID") ||
    code.includes("MISMATCH") ||
    code.includes("REQUIRED")
  ) {
    return "Review the details and try again.";
  }

  return null;
}

function getSafeResponseMessage(
  data: ApiErrorPayload | undefined,
): string | null {
  const message = data?.message ?? data?.error?.message;

  return typeof message === "string" ? getSafePlainMessage(message) : null;
}

function getSafePlainMessage(message: string): string | null {
  const normalized = message.trim();

  if (!normalized || TECHNICAL_MESSAGE_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

function getStatusErrorMessage(status: number | undefined): string {
  if (!status) {
    return "We could not connect. Check your connection and try again.";
  }

  if (STATUS_ERROR_MESSAGES[status]) {
    return STATUS_ERROR_MESSAGES[status];
  }

  if (status >= 500) {
    return "Something went wrong. Please try again.";
  }

  if (status >= 400) {
    return "Review the details and try again.";
  }

  return "Something went wrong. Please try again.";
}
