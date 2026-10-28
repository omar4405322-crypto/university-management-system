import { apiRequest } from '../lib/apiClient';
import api from './api';
import type { ApiResponse } from '../types/models';
import type {
  GradebookData,
  SaveGradebookDraftEntry,
  SaveGradebookDraftResult,
  PublishGradebookResult,
  CorrectGradebookResult,
  GradeCorrectionEntry,
  GradeStructureData,
  UpdateGradeStructurePayload,
} from '../types/gradebook';

export {
  mapGradebookError,
  validateGradeScore,
  validateCorrectionReason,
  extractChangedDraftEntries,
  MIN_CORRECTION_REASON_LENGTH,
  MAX_CORRECTION_REASON_LENGTH,
  MAX_POINTS_TECHNICAL_CEILING,
  MAX_COMPONENT_NAME_LENGTH,
  ALLOWED_GRADE_COMPONENT_SOURCES,
  mapGradeStructureError,
  computeLiveTotalPoints,
  validateGradeStructureDraft,
  isGradeStructureDirty,
  buildGradeStructurePutPayload,
} from '../utils/gradebook.utils';

export const MAX_DECIMAL_PLACES = 2;

import {
  mapGradebookError,
  validateGradeScore,
  validateCorrectionReason,
  extractChangedDraftEntries,
  MIN_CORRECTION_REASON_LENGTH,
  MAX_CORRECTION_REASON_LENGTH,
} from '../utils/gradebook.utils';

/**
 * Fetches the course gradebook for a specific term (or active term if termId is omitted).
 * Check res.success on every call.
 */
export async function getGradebook(
  courseId: number | string,
  termId?: number | string
): Promise<ApiResponse<GradebookData>> {
  return apiRequest(async () => {
    const params: Record<string, unknown> = {};
    if (termId !== undefined && termId !== null && termId !== '') {
      params.termId = termId;
    }
    return api.get<ApiResponse<GradebookData>>(`/courses/${courseId}/gradebook`, { params });
  }, { preferRawMessage: true });
}

/**
 * Saves draft grade entries for a course and term.
 * Check res.success on every call.
 */
export async function saveGradebookDraft(
  courseId: number | string,
  entries: SaveGradebookDraftEntry[],
  termId?: number | string
): Promise<ApiResponse<SaveGradebookDraftResult>> {
  return apiRequest(async () => {
    const params: Record<string, unknown> = {};
    if (termId !== undefined && termId !== null && termId !== '') {
      params.termId = termId;
    }
    return api.post<ApiResponse<SaveGradebookDraftResult>>(
      `/courses/${courseId}/gradebook/draft`,
      { entries },
      { params }
    );
  }, { preferRawMessage: true });
}

/**
 * Publishes gradebook entries and triggers completion evaluations (Doctor only).
 * Sends termId in query, no enrollmentIds (full publication).
 */
export async function publishGradebook(
  courseId: number | string,
  termId?: number | string
): Promise<ApiResponse<PublishGradebookResult>> {
  return apiRequest(async () => {
    const params: Record<string, unknown> = {};
    if (termId !== undefined && termId !== null && termId !== '') {
      params.termId = termId;
    }
    return api.post<ApiResponse<PublishGradebookResult>>(
      `/courses/${courseId}/gradebook/publish`,
      {},
      { params }
    );
  }, { preferRawMessage: true });
}

/**
 * Corrects published manual grade entries and recomputes totals in the same transaction (Doctor only).
 */
export async function correctGradebook(
  courseId: number | string,
  corrections: GradeCorrectionEntry[],
  termId?: number | string
): Promise<ApiResponse<CorrectGradebookResult>> {
  return apiRequest(async () => {
    const params: Record<string, unknown> = {};
    if (termId !== undefined && termId !== null && termId !== '') {
      params.termId = termId;
    }
    return api.post<ApiResponse<CorrectGradebookResult>>(
      `/courses/${courseId}/gradebook/correct`,
      { corrections },
      { params }
    );
  }, { preferRawMessage: true });
}

/**
 * Fetches the course grade structure for a specific academic term (or active term if termId is omitted).
 * Check res.success on every call.
 */
export async function getGradeStructure(
  courseId: number | string,
  termId?: number | string
): Promise<ApiResponse<GradeStructureData>> {
  return apiRequest(async () => {
    const params: Record<string, unknown> = {};
    if (termId !== undefined && termId !== null && termId !== '') {
      params.termId = termId;
    }
    return api.get<ApiResponse<GradeStructureData>>(`/courses/${courseId}/grade-structure`, { params });
  }, { preferRawMessage: true });
}

/**
 * Upserts the course grade structure for a specific academic term.
 * Check res.success on every call.
 */
export async function updateGradeStructure(
  courseId: number | string,
  payload: UpdateGradeStructurePayload,
  termId?: number | string
): Promise<ApiResponse<GradeStructureData>> {
  return apiRequest(async () => {
    const params: Record<string, unknown> = {};
    if (termId !== undefined && termId !== null && termId !== '') {
      params.termId = termId;
    }
    return api.put<ApiResponse<GradeStructureData>>(
      `/courses/${courseId}/grade-structure`,
      payload,
      { params }
    );
  }, { preferRawMessage: true });
}

export const gradebookService = {
  getGradebook,
  saveGradebookDraft,
  publishGradebook,
  correctGradebook,
  getGradeStructure,
  updateGradeStructure,
  mapGradebookError,
  validateGradeScore,
  validateCorrectionReason,
  extractChangedDraftEntries,
  MAX_DECIMAL_PLACES,
  MIN_CORRECTION_REASON_LENGTH,
  MAX_CORRECTION_REASON_LENGTH,
};

export default gradebookService;
