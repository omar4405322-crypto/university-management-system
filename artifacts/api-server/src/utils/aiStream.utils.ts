import type { Response } from 'express';
import logger from './logger';

export interface SseMetaEvent {
  conversationId: string;
  userMessageId: string;
  sequence: number;
}

export interface SseStatusEvent {
  phase: 'thinking' | 'tools' | 'answering';
  message?: string;
}

export interface SseDeltaEvent {
  text: string;
}

export interface SseCitationEvent {
  citation: Record<string, unknown>;
}

export interface SseActionEvent {
  actionProposal: Record<string, unknown>;
}

export interface SseDoneEvent {
  assistantMessageId: string;
  reply: string;
  citations: unknown[];
  actionProposals: unknown[];
  attachmentReferences?: unknown[];
}

export interface SseInterruptedEvent {
  reason: string;
  partialText?: string;
}

export interface SseErrorEvent {
  message: string;
  code: string;
}

export function initSseResponse(res: Response): boolean {
  if (res.headersSent) return false;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in Nginx / Railway / reverse proxies
  res.flushHeaders?.();
  return true;
}

export function sendSseEvent(
  res: Response,
  event: 'meta' | 'status' | 'delta' | 'citation' | 'action' | 'done' | 'interrupted' | 'error',
  data: unknown,
): boolean {
  if (res.writableEnded || res.destroyed || (res.socket && res.socket.destroyed)) {
    return false;
  }

  try {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`event: ${event}\ndata: ${payload}\n\n`);
    return true;
  } catch (err) {
    logger.warn('[Sse] Failed to write event to response stream', { event, error: (err as Error).message });
    return false;
  }
}
