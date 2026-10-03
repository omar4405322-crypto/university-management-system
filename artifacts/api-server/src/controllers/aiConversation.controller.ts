import type { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import logger from '../utils/logger';
import { getAiModel, getAiProvider, isAiAssistantEnabled } from '../utils/aiConfig';
import { AppError } from '../utils/appError';
import { AiProviderError, classifyAiError } from '../utils/aiErrorClassifier';
import { createClientDisconnectAbortController } from '../utils/requestCancellation';
import * as aiConversationService from '../services/aiConversation.service';
import type { executeAiTool } from '../services/aiTools.service';
import type { AiProviderClient } from '../services/aiProvider.service';

export interface AiConversationControllerOptions {
  client?: AiProviderClient;
  runTool?: typeof executeAiTool;
}

import { initSseResponse, sendSseEvent } from '../utils/aiStream.utils';

function isStreamingRequest(req: Request): boolean {
  return Boolean(
    req.path?.endsWith('/stream') ||
    req.headers?.accept?.includes('text/event-stream') ||
    req.query?.stream === 'true' ||
    req.body?.stream === true
  );
}

export const createAiConversationController = (options: AiConversationControllerOptions = {}) =>
  catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { title, message, attachmentIds } = req.body;
    const isStream = isStreamingRequest(req);

    if (message && !isAiAssistantEnabled()) {
      throw new AppError('AI assistant is unavailable', 503);
    }

    const { abortController, cleanup } = createClientDisconnectAbortController(req, res);

    if (isStream) {
      initSseResponse(res);
    }

    const startedAt = Date.now();
    try {
      const streaming = isStream
        ? {
            onMeta: (meta: any) => sendSseEvent(res, 'meta', meta),
            onStatus: (status: any) => sendSseEvent(res, 'status', status),
            onDelta: (delta: string) => sendSseEvent(res, 'delta', { text: delta }),
            onCitation: (citation: any) => sendSseEvent(res, 'citation', { citation }),
            onAction: (actionProposal: any) => sendSseEvent(res, 'action', { actionProposal }),
          }
        : undefined;

      const result = await aiConversationService.createConversation(userId, {
        title,
        initialMessage: message,
        actor: req.user!,
        client: options.client,
        runTool: options.runTool,
        attachmentIds: Array.isArray(attachmentIds) ? attachmentIds : undefined,
        signal: abortController.signal,
        streaming,
      });

      if (isStream) {
        sendSseEvent(res, 'done', {
          conversationId: result.conversation.id,
          assistantMessageId: result.assistantMessage?.id,
          reply: result.reply || '',
          citations: result.citations || [],
          actionProposals: result.actionProposals || [],
          attachmentReferences: result.attachmentReferences || [],
        });
        return res.end();
      }

      return res.status(201).json({ success: true, data: result });
    } catch (err: unknown) {
      if (abortController.signal.aborted || (res.socket && res.socket.destroyed) || res.destroyed) {
        logger.info('[AI] conversation creation cancelled due to client disconnect or timeout', {
          userId,
          latencyMs: Date.now() - startedAt,
        });
        if (isStream && !res.writableEnded) {
          sendSseEvent(res, 'interrupted', { reason: 'CLIENT_ABORTED' });
          res.end();
        }
        return;
      }

      if (isStream && !res.writableEnded) {
        if ((err as any)?.isStreamInterrupted) {
          sendSseEvent(res, 'interrupted', {
            reason: 'PROVIDER_FAILED_MID_STREAM',
            partialText: (err as any).partialText,
          });
        } else {
          sendSseEvent(res, 'error', {
            message: 'AI assistant is temporarily unavailable',
            code: 'PROVIDER_ERROR',
          });
        }
        return res.end();
      }

      if (err instanceof AppError && !(err instanceof AiProviderError)) {
        throw err;
      }
      handleProviderError(err, req, startedAt);
    } finally {
      cleanup();
    }
  });

export const listAiConversationsController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { search, archived, page, limit } = req.query;

  const result = await aiConversationService.listConversations(userId, {
    search: typeof search === 'string' ? search : undefined,
    isArchived: archived === 'true',
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return res.json({ success: true, data: result });
});

export const getAiConversationController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const conversationId = String(req.params.id);

  const conversation = await aiConversationService.getConversation(userId, conversationId);
  return res.json({ success: true, data: { conversation } });
});

export const updateAiConversationController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const conversationId = String(req.params.id);
  const { title, isArchived, isPinned } = req.body;

  const conversation = await aiConversationService.updateConversation(userId, conversationId, {
    title,
    isArchived,
    isPinned,
  });

  return res.json({ success: true, data: { conversation } });
});

export const deleteAiConversationController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const conversationId = String(req.params.id);

  await aiConversationService.deleteConversation(userId, conversationId);
  return res.json({ success: true, message: 'Conversation deleted' });
});

export const addAiMessageController = (options: AiConversationControllerOptions = {}) =>
  catchAsync(async (req: Request, res: Response) => {
    if (!isAiAssistantEnabled()) throw new AppError('AI assistant is unavailable', 503);

    const userId = req.user!.id;
    const conversationId = String(req.params.id);
    const { message, attachmentIds } = req.body;
    const isStream = isStreamingRequest(req);

    const { abortController, cleanup } = createClientDisconnectAbortController(req, res);

    if (isStream) {
      initSseResponse(res);
    }

    const startedAt = Date.now();
    try {
      const streaming = isStream
        ? {
            onMeta: (meta: any) => sendSseEvent(res, 'meta', meta),
            onStatus: (status: any) => sendSseEvent(res, 'status', status),
            onDelta: (delta: string) => sendSseEvent(res, 'delta', { text: delta }),
            onCitation: (citation: any) => sendSseEvent(res, 'citation', { citation }),
            onAction: (actionProposal: any) => sendSseEvent(res, 'action', { actionProposal }),
          }
        : undefined;

      const result = await aiConversationService.addMessageToConversation(
        userId,
        conversationId,
        message,
        req.user!,
        options.client,
        options.runTool,
        {
          signal: abortController.signal,
          attachmentIds: Array.isArray(attachmentIds) ? attachmentIds : undefined,
          streaming,
        },
      );

      logger.info('[AI] conversation message completed', {
        userId,
        conversationId,
        latencyMs: Date.now() - startedAt,
        success: true,
      });

      if (isStream) {
        sendSseEvent(res, 'done', {
          conversationId,
          assistantMessageId: result.assistantMessage?.id,
          reply: result.reply || '',
          citations: result.citations || [],
          actionProposals: result.actionProposals || [],
          attachmentReferences: result.attachmentReferences || [],
        });
        return res.end();
      }

      return res.status(201).json({ success: true, data: result });
    } catch (err: unknown) {
      if (abortController.signal.aborted || (res.socket && res.socket.destroyed) || res.destroyed) {
        logger.info('[AI] conversation message cancelled due to client disconnect or timeout', {
          userId,
          conversationId,
          latencyMs: Date.now() - startedAt,
        });
        if (isStream && !res.writableEnded) {
          sendSseEvent(res, 'interrupted', { reason: 'CLIENT_ABORTED' });
          res.end();
        }
        return;
      }

      if (isStream && !res.writableEnded) {
        if ((err as any)?.isStreamInterrupted) {
          sendSseEvent(res, 'interrupted', {
            reason: 'PROVIDER_FAILED_MID_STREAM',
            partialText: (err as any).partialText,
          });
        } else {
          sendSseEvent(res, 'error', {
            message: 'AI assistant is temporarily unavailable',
            code: 'PROVIDER_ERROR',
          });
        }
        return res.end();
      }

      if (err instanceof AppError && !(err instanceof AiProviderError)) {
        throw err;
      }
      handleProviderError(err, req, startedAt);
    } finally {
      cleanup();
    }
  });

function handleProviderError(err: unknown, req: Request, startedAt: number): never {
  let provider: 'openai' | 'gemini' = 'openai';
  try {
    provider = getAiProvider();
  } catch {
    /* fallback */
  }

  const diagnostics = err instanceof AiProviderError ? err.diagnostics : classifyAiError(err, provider);
  const latencyMs = Date.now() - startedAt;

  logger.warn(
    `[AI] conversation chat failed: provider=${diagnostics.provider} category=${diagnostics.category}` +
      `${diagnostics.statusCode ? ` status=${diagnostics.statusCode}` : ''}` +
      `${diagnostics.errorName ? ` error=${diagnostics.errorName}` : ''}` +
      `${diagnostics.errorCode ? ` code=${diagnostics.errorCode}` : ''} (${latencyMs}ms)`,
    {
      userId: req.user!.id,
      role: req.user!.role,
      requestId: req.headers['x-request-id'],
      model: getAiModel(),
      latencyMs,
      success: false,
      provider: diagnostics.provider,
      errorCategory: diagnostics.category,
      errorName: diagnostics.errorName,
      statusCode: diagnostics.statusCode,
      errorCode: diagnostics.errorCode,
    },
  );

  throw new AppError('AI assistant is temporarily unavailable', 503);
}
