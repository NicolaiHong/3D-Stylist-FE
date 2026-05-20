import { apiClient } from "../../services/apiClient";
import { normalizeUser, type ApiAuthUser } from "../auth/auth.api";
import type { AuthUser } from "../auth/auth.types";

export interface OnboardingPayload {
  displayName?: string;
  occupation?: string;
  stylePreferences?: string[];
  preferredColors?: string[];
  outfitVibe?: string;
  complete?: boolean;
  skip?: boolean;
}

interface OnboardingResponse {
  success: true;
  data?: {
    user?: ApiAuthUser;
  };
  user?: ApiAuthUser;
}

export const onboardingApi = {
  async patchOnboarding(payload: OnboardingPayload): Promise<AuthUser> {
    const { data } = await apiClient.patch<OnboardingResponse>(
      "/users/me/onboarding",
      payload,
    );
    const user = data.data?.user ?? data.user;

    if (!user) {
      throw new Error("Onboarding response is missing user data");
    }

    return normalizeUser(user);
  },
};
