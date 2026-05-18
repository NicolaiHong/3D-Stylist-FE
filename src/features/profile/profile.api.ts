import { apiClient, resolveApiAssetUrl } from "../../services/apiClient";

interface UpdateProfileResponse {
  success: true;
  data: {
    user: unknown;
  };
}

interface UploadSelfieResponse {
  success: true;
  data: {
    selfieUrl: string;
  };
}

export const profileApi = {
  async updateDisplayName(displayName: string): Promise<void> {
    await apiClient.patch<UpdateProfileResponse>("/users/me", { displayName });
  },

  async uploadSelfie(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);

    const { data } = await apiClient.post<UploadSelfieResponse>(
      "/users/me/selfie",
      formData,
    );

    return resolveApiAssetUrl(data.data.selfieUrl) ?? data.data.selfieUrl;
  },
};
