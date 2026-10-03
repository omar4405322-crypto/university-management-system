import api, { getAccessToken, getDynamicBaseUrl } from './api';
import { requestAiReply } from './aiAssistant.utils';

export type AIActionStatus =
  | 'PROPOSED'
  | 'CONFIRMED'
  | 'EXECUTING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELED'
  | 'EXPIRED'
  | 'STALE';

export interface AIActionProposalItem {
  id: string;
  actionType: 'CREATE_TASK' | 'MARK_NOTIFICATION_READ' | 'CREATE_ANNOUNCEMENT';
  status: AIActionStatus;
  humanReadableSummary: string;
  humanReadableSummaryAr?: string | null;
  previewData?: Record<string, any> | null;
  expiresAt: string;
  confirmedAt?: string | null;
  executedAt?: string | null;
  canceledAt?: string | null;
  failureCode?: string | null;
  failureReason?: string | null;
  executionResult?: Record<string, any> | null;
  sourceUserMessageId?: string | null;
  createdAt: string;
}

export interface ConversationItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  pinnedAt?: string | null;
  isPinned?: boolean;
  messageCount: number;
  lastMessagePreview: string | null;
  lastMessageRole: 'USER' | 'ASSISTANT' | null;
  lastMessageAt: string;
}

export interface CitationItem {
  id?: string;
  documentTitle: string;
  documentTitleAr?: string | null;
  version?: number;
  pageNumber?: number | null;
  sectionTitle?: string | null;
  articleNumber?: string | null;
  quote?: string | null;
  documentVersionId?: string;
  chunkId?: string | null;
}

export interface AIAttachmentItem {
  id: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  fileHash: string;
  processingStatus: 'READY' | 'REQUIRES_OCR' | 'FAILED';
  pageCount: number | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface AIAttachmentReference {
  attachmentId: string;
  filename: string;
  pageNumber?: number | null;
  excerptSnippet?: string;
}

export interface ConversationDetailMessage {
  id: string;
  ['role']: 'USER' | 'ASSISTANT';
  content: string;
  sequence: number;
  createdAt: string;
  citations?: CitationItem[];
  attachmentReferences?: AIAttachmentReference[];
  isInterrupted?: boolean;
}

export interface ConversationDetail {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  pinnedAt?: string | null;
  isPinned?: boolean;
  messages: ConversationDetailMessage[];
  actionProposals?: AIActionProposalItem[];
  attachments?: AIAttachmentItem[];
}

export interface ListConversationsResponse {
  conversations: ConversationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MessageReplyResult {
  reply: string;
  userMessage: ConversationDetailMessage;
  assistantMessage: ConversationDetailMessage;
  citations?: CitationItem[];
  actionProposals?: AIActionProposalItem[];
}

export const sendAiMessage = (message: string): Promise<string> => requestAiReply(api, message);

export const fetchConversations = async (params?: {
  search?: string;
  archived?: boolean;
  page?: number;
  limit?: number;
}): Promise<ListConversationsResponse> => {
  const query = new URLSearchParams();
  if (params?.search?.trim()) query.set('search', params.search.trim());
  if (params?.archived !== undefined) query.set('archived', String(params.archived));
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const url = `/ai/conversations${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await api.get<{ success: boolean; data: ListConversationsResponse }>(url);
  return response.data.data;
};

export const fetchConversation = async (conversationId: string): Promise<ConversationDetail> => {
  const response = await api.get<{ success: boolean; data: { conversation: ConversationDetail } }>(
    `/ai/conversations/${conversationId}`
  );
  return response.data.data.conversation;
};

export const createConversation = async (data: {
  title?: string;
  message?: string;
}): Promise<{
  conversation: { id: string; title: string; createdAt: string; updatedAt: string; archivedAt: string | null };
  userMessage?: ConversationDetailMessage;
  assistantMessage?: ConversationDetailMessage;
  reply?: string;
  citations?: CitationItem[];
  actionProposals?: AIActionProposalItem[];
}> => {
  const response = await api.post<{
    success: boolean;
    data: {
      conversation: { id: string; title: string; createdAt: string; updatedAt: string; archivedAt: string | null };
      userMessage?: ConversationDetailMessage;
      assistantMessage?: ConversationDetailMessage;
      reply?: string;
      citations?: CitationItem[];
      actionProposals?: AIActionProposalItem[];
    };
  }>('/ai/conversations', data);
  return response.data.data;
};

export const updateConversation = async (
  conversationId: string,
  data: { title?: string; isArchived?: boolean; isPinned?: boolean }
): Promise<ConversationItem> => {
  const response = await api.patch<{ success: boolean; data: { conversation: ConversationItem } }>(
    `/ai/conversations/${conversationId}`,
    data
  );
  return response.data.data.conversation;
};

export const deleteConversation = async (conversationId: string): Promise<void> => {
  await api.delete(`/ai/conversations/${conversationId}`);
};

export const sendConversationMessage = async (
  conversationId: string,
  message: string
): Promise<MessageReplyResult> => {
  const response = await api.post<{ success: boolean; data: MessageReplyResult }>(
    `/ai/conversations/${conversationId}/messages`,
    { message }
  );
  return response.data.data;
};

// ============================================================================
// PHASE 14: Action Proposal API
// ============================================================================

export const getActionProposal = async (proposalId: string): Promise<AIActionProposalItem> => {
  const response = await api.get<{ success: boolean; data: AIActionProposalItem }>(
    `/ai/actions/${proposalId}`
  );
  return response.data.data;
};

export const confirmActionProposal = async (proposalId: string): Promise<{
  success: boolean;
  status: 'SUCCEEDED';
  alreadyExecuted?: boolean;
  actionType: string;
  proposalId: string;
  executionResult: Record<string, any>;
  executedAt: string;
  summary: string;
  summaryAr: string;
}> => {
  const response = await api.post<{
    success: boolean;
    data: {
      success: boolean;
      status: 'SUCCEEDED';
      alreadyExecuted?: boolean;
      actionType: string;
      proposalId: string;
      executionResult: Record<string, any>;
      executedAt: string;
      summary: string;
      summaryAr: string;
    };
  }>(`/ai/actions/${proposalId}/confirm`);
  return response.data.data;
};

export const cancelActionProposal = async (proposalId: string): Promise<{
  success: boolean;
  status: 'CANCELED';
  message: string;
}> => {
  const response = await api.post<{
    success: boolean;
    data: {
      success: boolean;
      status: 'CANCELED';
      message: string;
    };
  }>(`/ai/actions/${proposalId}/cancel`);
  return response.data.data;
};

// ============================================================================
// PHASE 15: Attachments API
// ============================================================================

export const uploadConversationAttachment = async (
  conversationId: string,
  file: File,
): Promise<AIAttachmentItem> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<{
    success: boolean;
    data: { attachment: AIAttachmentItem };
  }>(`/ai/conversations/${conversationId}/attachments`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.data.attachment;
};

export const listConversationAttachments = async (
  conversationId: string,
): Promise<AIAttachmentItem[]> => {
  const response = await api.get<{
    success: boolean;
    data: { attachments: AIAttachmentItem[] };
  }>(`/ai/conversations/${conversationId}/attachments`);
  return response.data.data.attachments;
};

export const deleteConversationAttachment = async (
  conversationId: string,
  attachmentId: string,
): Promise<void> => {
  await api.delete(`/ai/conversations/${conversationId}/attachments/${attachmentId}`);
};

// ============================================================================
// PHASE 15: Streaming API (SSE Transport)
// ============================================================================

export interface StreamMessageCallbacks {
  onMeta?: (meta: { conversationId: string; userMessageId?: string; sequence?: number }) => void;
  onStatus?: (status: { phase: 'thinking' | 'tools' | 'answering'; message?: string }) => void;
  onDelta?: (delta: string) => void;
  onCitation?: (citation: CitationItem) => void;
  onAction?: (actionProposal: AIActionProposalItem) => void;
  onDone?: (result: {
    conversationId: string;
    assistantMessageId?: string;
    reply: string;
    citations?: CitationItem[];
    actionProposals?: AIActionProposalItem[];
    attachmentReferences?: AIAttachmentReference[];
  }) => void;
  onInterrupted?: (data: { reason: string; partialText?: string }) => void;
  onError?: (err: { message: string; code?: string }) => void;
}

export const streamConversationMessage = async (
  conversationId: string,
  payload: { message: string; attachmentIds?: string[] },
  callbacks: StreamMessageCallbacks,
  signal?: AbortSignal,
): Promise<void> => {
  const token = getAccessToken();
  const url = `${getDynamicBaseUrl()}/ai/conversations/${conversationId}/messages/stream`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    let errMsg = 'Failed to generate response';
    try {
      const errJson = await response.json();
      errMsg = errJson.message || errMsg;
    } catch {
      // ignore
    }
    callbacks.onError?.({ message: errMsg, code: `HTTP_${response.status}` });
    return;
  }

  if (!response.body) {
    callbacks.onError?.({ message: 'No response body stream received', code: 'STREAM_UNAVAILABLE' });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (!block.trim()) continue;
        let eventType = 'message';
        let dataStr = '';

        for (const line of block.split('\n')) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.slice(6).trim();
          }
        }

        if (!dataStr) continue;

        let parsed: any;
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          parsed = dataStr;
        }

        switch (eventType) {
          case 'meta':
            callbacks.onMeta?.(parsed);
            break;
          case 'status':
            callbacks.onStatus?.(parsed);
            break;
          case 'delta':
            if (typeof parsed?.text === 'string') {
              callbacks.onDelta?.(parsed.text);
            }
            break;
          case 'citation':
            if (parsed?.citation) {
              callbacks.onCitation?.(parsed.citation);
            }
            break;
          case 'action':
            if (parsed?.actionProposal) {
              callbacks.onAction?.(parsed.actionProposal);
            }
            break;
          case 'done':
            callbacks.onDone?.(parsed);
            break;
          case 'interrupted':
            callbacks.onInterrupted?.(parsed);
            break;
          case 'error':
            callbacks.onError?.(parsed);
            break;
        }
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError' || signal?.aborted) {
      callbacks.onInterrupted?.({ reason: 'CLIENT_ABORTED' });
    } else {
      callbacks.onError?.({ message: err.message || 'Stream connection lost', code: 'STREAM_ERROR' });
    }
  } finally {
    reader.releaseLock();
  }
};

export const createAndStreamConversation = async (
  payload: { title?: string; message: string; attachmentIds?: string[] },
  callbacks: StreamMessageCallbacks,
  signal?: AbortSignal,
): Promise<void> => {
  const token = getAccessToken();
  const url = `${getDynamicBaseUrl()}/ai/conversations/stream`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    let errMsg = 'Failed to create conversation';
    try {
      const errJson = await response.json();
      errMsg = errJson.message || errMsg;
    } catch {
      // ignore
    }
    callbacks.onError?.({ message: errMsg, code: `HTTP_${response.status}` });
    return;
  }

  if (!response.body) {
    callbacks.onError?.({ message: 'No response body stream received', code: 'STREAM_UNAVAILABLE' });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (!block.trim()) continue;
        let eventType = 'message';
        let dataStr = '';

        for (const line of block.split('\n')) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.slice(6).trim();
          }
        }

        if (!dataStr) continue;

        let parsed: any;
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          parsed = dataStr;
        }

        switch (eventType) {
          case 'meta':
            callbacks.onMeta?.(parsed);
            break;
          case 'status':
            callbacks.onStatus?.(parsed);
            break;
          case 'delta':
            if (typeof parsed?.text === 'string') {
              callbacks.onDelta?.(parsed.text);
            }
            break;
          case 'citation':
            if (parsed?.citation) {
              callbacks.onCitation?.(parsed.citation);
            }
            break;
          case 'action':
            if (parsed?.actionProposal) {
              callbacks.onAction?.(parsed.actionProposal);
            }
            break;
          case 'done':
            callbacks.onDone?.(parsed);
            break;
          case 'interrupted':
            callbacks.onInterrupted?.(parsed);
            break;
          case 'error':
            callbacks.onError?.(parsed);
            break;
        }
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError' || signal?.aborted) {
      callbacks.onInterrupted?.({ reason: 'CLIENT_ABORTED' });
    } else {
      callbacks.onError?.({ message: err.message || 'Stream connection lost', code: 'STREAM_ERROR' });
    }
  } finally {
    reader.releaseLock();
  }
};

export interface QuickActionItem {
  key: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  prompt: string;
  promptEn: string;
  promptKey: string;
  icon: string;
  iconBg: string;
  iconColor: string;
}

export async function fetchQuickActions(): Promise<QuickActionItem[]> {
  try {
    const response = await api.get<{ success: boolean; data: { quickActions: QuickActionItem[] } }>('/ai/quick-actions');
    return response.data?.data?.quickActions || [];
  } catch (err) {
    console.warn('[AI] Failed to fetch personalized quick actions, falling back', err);
    return [];
  }
}
