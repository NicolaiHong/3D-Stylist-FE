const ACCESS_TOKEN_KEY = "3d-stylist.access-token";
const REFRESH_TOKEN_KEY = "3d-stylist.refresh-token";

export const tokenStorage = {
  getAccessToken(): string | null {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  setAccessToken(accessToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
