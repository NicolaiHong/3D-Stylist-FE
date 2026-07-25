import { apiClient } from "../../services/apiClient";

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface VisitorAnalytics {
  totalVisitors: number;
  isNewVisitor?: boolean;
  tracked?: boolean;
}

const ANONYMOUS_VISITOR_ID_STORAGE_KEY =
  "3d-stylist:anonymous-visitor-id";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getOrCreateAnonymousVisitorId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const existingId = window.localStorage.getItem(
      ANONYMOUS_VISITOR_ID_STORAGE_KEY,
    );

    if (existingId && UUID_PATTERN.test(existingId)) {
      return existingId;
    }

    if (typeof window.crypto?.randomUUID !== "function") {
      return null;
    }

    const visitorId = window.crypto.randomUUID();
    window.localStorage.setItem(ANONYMOUS_VISITOR_ID_STORAGE_KEY, visitorId);
    return visitorId;
  } catch {
    return null;
  }
}

export const visitorAnalyticsApi = {
  async getTotal(): Promise<VisitorAnalytics> {
    const { data } = await apiClient.get<
      ApiSuccessResponse<VisitorAnalytics>
    >("/analytics/visitors");

    return data.data;
  },

  async record(visitorId: string): Promise<VisitorAnalytics> {
    const { data } = await apiClient.post<
      ApiSuccessResponse<VisitorAnalytics>
    >("/analytics/visitors", { visitorId });

    return data.data;
  },
};
