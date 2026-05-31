import * as Sentry from "@sentry/react";
import { env } from "./env";

const FILTERED = "[Filtered]";
const FILTERED_URL = "[Filtered URL]";

const SENSITIVE_KEY_PARTS = [
  "authorization",
  "cookie",
  "setcookie",
  "accesstoken",
  "refreshtoken",
  "oauthtoken",
  "oauthcode",
  "authorizationcode",
  "prompt",
  "provider",
  "signed",
  "image",
  "avatar",
  "selfie",
];

type SafeApiError = {
  errorCode?: string;
  method?: string;
  path?: string;
  status?: number;
};

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function shouldFilterKey(key: string): boolean {
  const normalized = normalizeKey(key);

  return (
    normalized === "body" ||
    normalized === "payload" ||
    normalized.includes("url") ||
    SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part))
  );
}

function stripQueryString(value: string): string {
  return value.split(/[?#]/, 1)[0];
}

function scrubString(value: string, key: string): string {
  if (shouldFilterKey(key)) {
    return key.toLowerCase().includes("url") ? FILTERED_URL : FILTERED;
  }

  return value
    .replace(/Bearer\s+[^\s,;]+/gi, `Bearer ${FILTERED}`)
    .replace(/https?:\/\/[^\s"'<>]+/gi, FILTERED_URL)
    .replace(
      /([?&](?:code|token|access_token|refresh_token|signature|key)=)[^&\s]+/gi,
      `$1${FILTERED}`,
    );
}

function scrubSentryData<T>(value: T, key = ""): T {
  if (typeof value === "string") {
    return scrubString(value, key) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => scrubSentryData(entry, key)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        shouldFilterKey(entryKey)
          ? FILTERED
          : scrubSentryData(entryValue, entryKey),
      ]),
    ) as T;
  }

  return value;
}

function scrubSentryEvent<
  T extends {
    request?: {
      cookies?: unknown;
      data?: unknown;
      query_string?: unknown;
      url?: string;
    };
  },
>(event: T): T {
  const requestUrl = event.request?.url;
  const scrubbed = scrubSentryData(event);

  if (scrubbed.request) {
    delete scrubbed.request.data;
    delete scrubbed.request.cookies;
    delete scrubbed.request.query_string;

    if (requestUrl) {
      scrubbed.request.url = stripQueryString(requestUrl);
    }
  }

  return scrubbed;
}

export function initSentry(): void {
  Sentry.init({
    dsn: env.sentry.dsn || undefined,
    enabled: Boolean(env.sentry.dsn),
    environment: env.sentry.environment,
    release: env.sentry.release,
    sendDefaultPii: false,
    tracesSampleRate: env.sentry.tracesSampleRate,
    beforeSend: (event) => scrubSentryEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubSentryData(breadcrumb),
  });
}

export function captureApiClientError(error: SafeApiError): void {
  Sentry.withScope((scope) => {
    scope.setTag("api.error_code", error.errorCode || "UNKNOWN");
    scope.setTag("api.method", error.method || "UNKNOWN");
    scope.setTag("api.path", error.path || "UNKNOWN");

    if (error.status !== undefined) {
      scope.setTag("api.status", String(error.status));
    }

    Sentry.captureException(
      new Error(
        error.status === undefined
          ? "API network request failed"
          : `API request failed with status ${error.status}`,
      ),
    );
  });
}
