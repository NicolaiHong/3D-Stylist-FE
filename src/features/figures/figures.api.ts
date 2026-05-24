import { apiClient, resolveApiAssetUrl } from "../../services/apiClient";
import type {
  FigureDto,
  FigureListResult,
  GenerateFigurePayload,
  ListFiguresParams,
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
    modelUrl: resolveApiAssetUrl(figure.modelUrl),
    thumbnailUrl: resolveApiAssetUrl(figure.thumbnailUrl),
  };
}

function compactPayload(payload: GenerateFigurePayload): GenerateFigurePayload {
  return {
    prompt: payload.prompt,
    ...(payload.stylePresetId ? { stylePresetId: payload.stylePresetId } : {}),
    ...(payload.inputAssetId ? { inputAssetId: payload.inputAssetId } : {}),
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
  listFigures,
  getFigure,
  getFigureStatus,
};
