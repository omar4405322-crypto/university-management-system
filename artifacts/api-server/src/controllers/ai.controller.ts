import type { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import logger from '../utils/logger';
import { getAiModel, getAiProvider, isAiAssistantEnabled } from '../utils/aiConfig';
import { AppError } from '../utils/appError';
import { AiProviderError, classifyAiError } from '../utils/aiErrorClassifier';
import { createClientDisconnectAbortController } from '../utils/requestCancellation';
import { generateAiReply } from '../services/ai.service';
import { getPersonalizedQuickActions } from '../services/aiQuickAction.service';

export const createAiChatController = (chat: typeof generateAiReply = generateAiReply) =>
  catchAsync(async (req: Request, res: Response) => {
    if (!isAiAssistantEnabled()) throw new AppError('AI assistant is unavailable', 503);

    const { abortController, cleanup } = createClientDisconnectAbortController(req, res);

    const startedAt = Date.now();
    try {
      const reply = await chat(req.body.message, undefined, req.user!, undefined, undefined, { signal: abortController.signal });
      logger.info('[AI] chat completed', {
        userId: req.user!.id,
        role: req.user!.role,
        requestId: req.headers['x-request-id'],
        model: getAiModel(),
        latencyMs: Date.now() - startedAt,
        success: true,
      });
      return res.json({ success: true, data: { reply } });
    } catch (err: unknown) {
      if (abortController.signal.aborted && (!res.socket || res.socket.destroyed || res.destroyed)) {
        logger.info('[AI] chat request cancelled due to client disconnect or timeout', {
          userId: req.user?.id,
          latencyMs: Date.now() - startedAt,
        });
        return;
      }
      if (err instanceof AppError && !(err instanceof AiProviderError)) {
        throw err;
      }
      let provider: 'openai' | 'gemini' = 'openai';
      try { provider = getAiProvider(); } catch { /* default fallback */ }
      const diagnostics = err instanceof AiProviderError
        ? err.diagnostics
        : classifyAiError(err, provider);
      const latencyMs = Date.now() - startedAt;

      logger.warn(
        `[AI] chat failed: provider=${diagnostics.provider} category=${diagnostics.category}` +
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
        }
      );
      throw new AppError('AI assistant is temporarily unavailable', 503);
    } finally {
      cleanup();
    }
  });

export const getAiQuickActionsController = catchAsync(async (req: Request, res: Response) => {
  const actor = req.user!;
  const quickActions = await getPersonalizedQuickActions(actor);
  return res.json({ success: true, data: { quickActions } });
});
