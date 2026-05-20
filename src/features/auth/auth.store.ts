import { create } from "zustand";
import { authApi } from "./auth.api";
import type { AuthUser, LoginInput, RegisterInput } from "./auth.types";
import { getApiErrorMessage } from "../../services/apiClient";
import { tokenStorage } from "../../services/tokenStorage";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isLoading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (input: LoginInput) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  completeOAuth: () => Promise<AuthUser>;
  refreshUser: () => Promise<AuthUser>;
  setUser: (user: AuthUser) => void;
  logout: () => Promise<void>;
  clearError: () => void;
}

function getInitialTokens() {
  return {
    accessToken: tokenStorage.getAccessToken(),
  };
}

export const useAuthStore = create<AuthState>((set) => {
  const initialTokens = getInitialTokens();

  return {
    user: null,
    accessToken: initialTokens.accessToken,
    isAuthenticated: Boolean(initialTokens.accessToken),
    isBootstrapping: true,
    isLoading: false,
    error: null,

    async hydrate() {
      const accessToken = tokenStorage.getAccessToken();

      if (!accessToken) {
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isBootstrapping: false,
        });
        return;
      }

      try {
        const user = await authApi.me();

        set({
          user,
          accessToken: tokenStorage.getAccessToken(),
          isAuthenticated: true,
          isBootstrapping: false,
        });
      } catch {
        tokenStorage.clear();
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isBootstrapping: false,
        });
      }
    },

    async login(input) {
      set({ isLoading: true, error: null });

      try {
        const session = await authApi.login(input);
        tokenStorage.setAccessToken(session.accessToken);
        const user = await authApi.me();

        set({
          user,
          accessToken: session.accessToken,
          isAuthenticated: true,
          isLoading: false,
        });

        return user;
      } catch (error) {
        tokenStorage.clear();
        set({ error: getApiErrorMessage(error), isLoading: false });
        throw error;
      }
    },

    async register(input) {
      set({ isLoading: true, error: null });

      try {
        const session = await authApi.register(input);
        tokenStorage.setAccessToken(session.accessToken);
        const user = await authApi.me();

        set({
          user,
          accessToken: session.accessToken,
          isAuthenticated: true,
          isLoading: false,
        });

        return user;
      } catch (error) {
        tokenStorage.clear();
        set({ error: getApiErrorMessage(error), isLoading: false });
        throw error;
      }
    },

    async completeOAuth() {
      set({ isLoading: true, error: null });

      try {
        const session = await authApi.refresh();
        const user = await authApi.me();

        set({
          user,
          accessToken: tokenStorage.getAccessToken() ?? session.accessToken,
          isAuthenticated: true,
          isLoading: false,
        });

        return user;
      } catch (error) {
        tokenStorage.clear();
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: getApiErrorMessage(error),
        });
        throw error;
      }
    },

    async refreshUser() {
      const user = await authApi.me();

      set({
        user,
        accessToken: tokenStorage.getAccessToken(),
        isAuthenticated: true,
      });

      return user;
    },

    setUser(user) {
      set({
        user,
        accessToken: tokenStorage.getAccessToken(),
        isAuthenticated: true,
      });
    },

    async logout() {
      set({ isLoading: true, error: null });

      try {
        await authApi.logout();
      } catch {
        // Local logout should still complete if the token is already invalid.
      } finally {
        tokenStorage.clear();
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    },

    clearError() {
      set({ error: null });
    },
  };
});
