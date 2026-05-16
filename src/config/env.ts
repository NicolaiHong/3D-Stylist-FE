const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const env = {
  apiBaseUrl: trimTrailingSlash(
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1",
  ),
  frontendBaseUrl: trimTrailingSlash(
    import.meta.env.VITE_FRONTEND_BASE_URL || "http://localhost:5173",
  ),
} as const;
