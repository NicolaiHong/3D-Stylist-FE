import type { AxiosProgressEvent } from "axios";
import { apiClient, resolveApiAssetUrl } from "../../services/apiClient";
import type {
  CreatePreviewVariationPayload,
  CreateRetexturePayload,
  FigureDto,
  FigureListResult,
  GenerateFigureFromReferencePayload,
  GenerateFigurePayload,
  ListFiguresParams,
  OptimizePromptPayload,
  PromptOptimizationResult,
  ReferenceImageAssetDto,
  RegenerateFigurePayload,
  UploadReferenceImageOptions,
} from "./figures.types";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

function unwrapData<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new Error(response.message || "Figure request failed");
  }

  return response.data;
}

function normalizeFigure(figure: FigureDto): FigureDto {
  return {
    ...figure,
    prompt: figure.prompt ?? "",
    previewUrl: resolveApiAssetUrl(figure.previewUrl),
    modelViewerUrl: resolveApiAssetUrl(figure.modelViewerUrl),
    modelUrl: resolveApiAssetUrl(figure.modelUrl),
    thumbnailUrl: resolveApiAssetUrl(figure.thumbnailUrl),
  };
}

function normalizeReferenceImageAsset(
  asset: ReferenceImageAssetDto,
): ReferenceImageAssetDto {
  return {
    ...asset,
    previewUrl: resolveApiAssetUrl(asset.previewUrl),
  };
}

function compactPayload(payload: GenerateFigurePayload): GenerateFigurePayload {
  return {
    prompt: payload.prompt,
    ...(payload.stylePresetId ? { stylePresetId: payload.stylePresetId } : {}),
    ...(payload.inputAssetId ? { inputAssetId: payload.inputAssetId } : {}),
  };
}

function compactReferencePayload(
  payload: GenerateFigureFromReferencePayload,
): GenerateFigureFromReferencePayload {
  return {
    inputAssetId: payload.inputAssetId,
    ...(payload.prompt?.trim() ? { prompt: payload.prompt.trim() } : {}),
  };
}

function compactPromptOptimizationPayload(
  payload: OptimizePromptPayload,
): OptimizePromptPayload {
  return {
    prompt: payload.prompt.trim(),
  };
}

function compactRegenerationPayload(
  payload: RegenerateFigurePayload = {},
): RegenerateFigurePayload {
  return {
    ...(payload.variationInstruction?.trim()
      ? { variationInstruction: payload.variationInstruction.trim() }
      : {}),
  };
}

function compactPreviewVariationPayload(
  payload: CreatePreviewVariationPayload = {},
): CreatePreviewVariationPayload {
  return {
    ...(payload.instruction?.trim()
      ? { instruction: payload.instruction.trim() }
      : {}),
  };
}

function compactRetexturePayload(
  payload: CreateRetexturePayload,
): CreateRetexturePayload {
  return {
    instruction: payload.instruction.trim(),
  };
}

export async function generateFigure(
  payload: GenerateFigurePayload,
): Promise<FigureDto> {
  const { data } = await apiClient.post<ApiResponse<{ figure: FigureDto }>>(
    "/figures/generate",
    compactPayload(payload),
  );

  return normalizeFigure(unwrapData(data).figure);
}

export async function generateFigureFromReference(
  payload: GenerateFigureFromReferencePayload,
): Promise<FigureDto> {
  const { data } = await apiClient.post<ApiResponse<{ figure: FigureDto }>>(
    "/figures/generate-from-reference",
    compactReferencePayload(payload),
  );

  return normalizeFigure(unwrapData(data).figure);
}

export async function optimizePrompt(
  payload: OptimizePromptPayload,
): Promise<PromptOptimizationResult> {
  const { data } = await apiClient.post<ApiResponse<PromptOptimizationResult>>(
    "/figures/prompt-optimizations",
    compactPromptOptimizationPayload(payload),
  );

  return unwrapData(data);
}

export async function regenerateFigure(
  id: string,
  payload: RegenerateFigurePayload = {},
): Promise<FigureDto> {
  const { data } = await apiClient.post<ApiResponse<{ figure: FigureDto }>>(
    `/figures/${id}/regenerations`,
    compactRegenerationPayload(payload),
  );

  return normalizeFigure(unwrapData(data).figure);
}

export async function createPreviewVariation(
  id: string,
  payload: CreatePreviewVariationPayload = {},
): Promise<FigureDto> {
  const { data } = await apiClient.post<ApiResponse<{ figure: FigureDto }>>(
    `/figures/${id}/variations`,
    compactPreviewVariationPayload(payload),
  );

  return normalizeFigure(unwrapData(data).figure);
}

export async function createRetexture(
  id: string,
  payload: CreateRetexturePayload,
): Promise<FigureDto> {
  const { data } = await apiClient.post<ApiResponse<{ figure: FigureDto }>>(
    `/figures/${id}/retextures`,
    compactRetexturePayload(payload),
  );

  return normalizeFigure(unwrapData(data).figure);
}

export async function uploadReferenceImageAsset({
  consentAccepted,
  file,
  onUploadProgress,
  referenceKind,
}: UploadReferenceImageOptions): Promise<ReferenceImageAssetDto> {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("referenceKind", referenceKind);
  formData.append("consentAccepted", String(consentAccepted));

  const { data } = await apiClient.post<ApiResponse<ReferenceImageAssetDto>>(
    "/assets/reference-images",
    formData,
    {
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (!onUploadProgress || !event.total) {
          return;
        }

        onUploadProgress(Math.round((event.loaded / event.total) * 100));
      },
    },
  );

  return normalizeReferenceImageAsset(unwrapData(data));
}

export async function listFigures(
  params: ListFiguresParams = {},
): Promise<FigureListResult> {
  const { data } = await apiClient.get<ApiResponse<FigureListResult>>(
    "/figures",
    {
      params,
    },
  );
  const result = unwrapData(data);

  return {
    ...result,
    figures: result.figures.map(normalizeFigure),
  };
}

export async function getFigure(id: string): Promise<FigureDto> {
  const { data } = await apiClient.get<ApiResponse<{ figure: FigureDto }>>(
    `/figures/${id}`,
  );

  return normalizeFigure(unwrapData(data).figure);
}

export async function getFigureStatus(id: string): Promise<FigureDto> {
  const { data } = await apiClient.get<ApiResponse<{ figure: FigureDto }>>(
    `/figures/${id}/status`,
  );

  return normalizeFigure(unwrapData(data).figure);
}

export const figuresApi = {
  generateFigure,
  generateFigureFromReference,
  optimizePrompt,
  regenerateFigure,
  createPreviewVariation,
  createRetexture,
  uploadReferenceImageAsset,
  listFigures,
  getFigure,
  getFigureStatus,
};
