import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

export type SimilarityFlagStatus = 'PENDING' | 'CONFIRMED' | 'DISMISSED';
export type SimilarityFlagDecision = 'CONFIRMED' | 'DISMISSED';

export interface SimilaritySideDTO {
  submissionId: number;
  studentId: string;
  studentName: string;
  fileName: string | null;
  submittedAt: string;
}

export interface SubmissionSimilarityFlagItem {
  id: string;
  status: SimilarityFlagStatus | string;
  similarityScore: number;
  thresholdUsed: number;
  createdAt: string;
  reviewedById: number | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  submissionA: SimilaritySideDTO;
  submissionB: SimilaritySideDTO;
}

export interface DecideSimilarityFlagPayload {
  decision: SimilarityFlagDecision;
  note?: string;
}

const submissionSimilarityService = {
  listFlags: (
    taskId: number | string
  ): Promise<ApiResponse<SubmissionSimilarityFlagItem[]>> =>
    apiRequest(() => api.get(`/tasks/${taskId}/similarity-flags`), {
      preferRawMessage: true,
    }),

  decideFlag: (
    taskId: number | string,
    flagId: string,
    payload: DecideSimilarityFlagPayload
  ): Promise<ApiResponse<SubmissionSimilarityFlagItem>> => {
    const body: DecideSimilarityFlagPayload =
      payload.note !== undefined
        ? { decision: payload.decision, note: payload.note }
        : { decision: payload.decision };

    return apiRequest(
      () =>
        api.patch(
          `/tasks/${taskId}/similarity-flags/${encodeURIComponent(flagId)}`,
          body
        ),
      { preferRawMessage: true }
    );
  },
};

export default submissionSimilarityService;
