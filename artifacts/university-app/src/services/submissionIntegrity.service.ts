import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

export interface SubmissionIntegrityPolicy {
  id?: number;
  exactDuplicateBlock: boolean;
  similarityThreshold: number | null;
  isDefault: boolean;
  updatedById?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateSubmissionIntegrityPolicyPayload {
  exactDuplicateBlock: boolean;
  similarityThreshold: number | null;
}

const submissionIntegrityService = {
  getPolicy: (): Promise<ApiResponse<SubmissionIntegrityPolicy>> =>
    apiRequest(() => api.get('/submission-integrity/policy'), {
      preferRawMessage: true,
    }),

  updatePolicy: (
    data: UpdateSubmissionIntegrityPolicyPayload
  ): Promise<ApiResponse<SubmissionIntegrityPolicy>> =>
    apiRequest(() => api.put('/submission-integrity/policy', data), {
      preferRawMessage: true,
    }),
};

export default submissionIntegrityService;
