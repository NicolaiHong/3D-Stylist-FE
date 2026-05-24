export type FigureStatus =
  | "draft"
  | "queued"
  | "processing"
  | "success"
  | "failed"
  | "canceled";

export type FigureProvider = "mock" | "meshy" | "tripo" | string;

export interface FigureDto {
  id: string;
  prompt: string | null;
  status: FigureStatus;
  provider?: FigureProvider | null;
  providerTaskId?: string | null;
  previewUrl?: string | null;
  modelUrl?: string | null;
  thumbnailUrl?: string | null;
  creditCost?: number;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateFigurePayload {
  prompt: string;
  stylePresetId?: string;
  inputAssetId?: string;
}

export interface ListFiguresParams {
  page?: number;
  limit?: number;
  status?: FigureStatus | string;
}

export interface FigurePagination {
  page: number;
  limit: number;
  total: number;
}

export interface FigureListResult {
  figures: FigureDto[];
  pagination: FigurePagination;
}
