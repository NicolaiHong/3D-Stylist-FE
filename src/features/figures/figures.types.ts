export type FigureStatus =
  | "draft"
  | "queued"
  | "processing"
  | "success"
  | "failed"
  | "canceled";

export type FigureProvider = "mock" | "meshy" | "tripo" | string;

export type FigureGenerationMode =
  | "text_to_3d"
  | "text_regeneration"
  | string;

export type ReferenceImageKind =
  | "face"
  | "full_body"
  | "clothing_style"
  | "generic_reference";

export interface FigureDto {
  id: string;
  prompt: string | null;
  generationMode?: FigureGenerationMode;
  parentFigureId?: string | null;
  status: FigureStatus;
  provider?: FigureProvider | null;
  providerTaskId?: string | null;
  previewUrl?: string | null;
  modelAssetReady?: boolean;
  modelViewerUrl?: string | null;
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

export interface RegenerateFigurePayload {
  promptOverride?: string;
}

export interface ReferenceImageAssetDto {
  assetId: string;
  previewUrl: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  dimensions?: {
    width: number;
    height: number;
  } | null;
  referenceKind: ReferenceImageKind;
  createdAt: string;
}

export interface UploadReferenceImageOptions {
  file: File;
  referenceKind: ReferenceImageKind;
  consentAccepted: boolean;
  onUploadProgress?: (progressPercent: number) => void;
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
