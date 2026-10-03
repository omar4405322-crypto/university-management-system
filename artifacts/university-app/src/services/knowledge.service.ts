import api from './api';

export interface KnowledgeDocumentVersionItem {
  id: string;
  documentId: string;
  version: number;
  versionTag: string | null;
  originalFilename: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  uploadedAt: string;
  processingStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'REQUIRES_OCR' | 'FAILED';
  processingError: string | null;
  effectiveDate: string | null;
  supersededAt: string | null;
  chunkCount: number;
}

export interface KnowledgeDocumentItem {
  id: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  documentType: 'BYLAW' | 'REGULATION' | 'HANDBOOK' | 'POLICY' | 'PROCEDURE' | 'ANNOUNCEMENT';
  scope: 'GLOBAL' | 'COLLEGE' | 'DEPARTMENT';
  collegeId: number | null;
  departmentId: number | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdById: number | null;
  createdAt: string;
  updatedAt: string;
  activeVersionId: string | null;
  activeVersion?: KnowledgeDocumentVersionItem | null;
  versions?: KnowledgeDocumentVersionItem[];
  createdBy?: { id: number; email: string; role: string };
  _count?: { versions: number; chunks: number };
}

export interface ListKnowledgeDocumentsParams {
  scope?: string;
  documentType?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export const fetchKnowledgeDocuments = async (
  params?: ListKnowledgeDocumentsParams
): Promise<{ documents: KnowledgeDocumentItem[]; total: number }> => {
  const query = new URLSearchParams();
  if (params?.scope) query.set('scope', params.scope);
  if (params?.documentType) query.set('documentType', params.documentType);
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));

  const response = await api.get(`/knowledge/documents?${query.toString()}`);
  return {
    documents: response.data?.data || [],
    total: response.data?.meta?.total || 0,
  };
};

export const fetchKnowledgeDocumentDetail = async (
  id: string
): Promise<KnowledgeDocumentItem> => {
  const response = await api.get(`/knowledge/documents/${id}`);
  return response.data?.data;
};

export const uploadKnowledgeDocument = async (formData: FormData): Promise<KnowledgeDocumentItem> => {
  const response = await api.post('/knowledge/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data?.data;
};

export const uploadKnowledgeVersion = async (
  documentId: string,
  formData: FormData
): Promise<KnowledgeDocumentItem> => {
  const response = await api.post(`/knowledge/documents/${documentId}/versions`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data?.data;
};

export const activateDocumentVersion = async (
  documentId: string,
  versionId: string
): Promise<KnowledgeDocumentItem> => {
  const response = await api.patch(`/knowledge/documents/${documentId}/activate/${versionId}`);
  return response.data?.data;
};

export const archiveKnowledgeDocument = async (
  documentId: string
): Promise<KnowledgeDocumentItem> => {
  const response = await api.patch(`/knowledge/documents/${documentId}/archive`);
  return response.data?.data;
};
