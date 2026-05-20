const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const defaultApiPath = "/api/v1";

function normalizeApiBaseUrl(value: string) {
  const trimmed = trimTrailingSlash(value);

  if (!trimmed) {
    return defaultApiPath;
  }

  try {
    const url = new URL(trimmed);
    const pathname = trimTrailingSlash(url.pathname);

    if (!pathname) {
      url.pathname = defaultApiPath;
      return trimTrailingSlash(url.toString());
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

export const env = {
  apiBaseUrl: normalizeApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1",
  ),
  frontendBaseUrl: trimTrailingSlash(
    import.meta.env.VITE_FRONTEND_BASE_URL || "http://localhost:5173",
  ),
} as const;
