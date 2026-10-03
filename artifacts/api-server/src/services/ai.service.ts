import { AppError } from '../utils/appError';
import {
  getAiProvider,
  getAiFallbackProvider,
  isAiAssistantEnabled,
  isProviderConfigured,
} from '../utils/aiConfig';
import type { AiProviderClient, HistoryMessage } from './aiProvider.service';
export type { HistoryMessage };
import type { AuthActor } from '../types/auth.types';
import { executeAiTool } from './aiTools.service';
import {
  orchestrateAiRequest,
  type AiReplyDetailed,
  type CitationItem,
  type OrchestratorOptions,
} from './aiOrchestrator.service';
import { aiCircuitBreaker } from './aiCircuitBreaker.service';
import { aiUserConcurrency } from './aiConcurrency.service';

export type { CitationItem, AiReplyDetailed, OrchestratorOptions };

export interface AiHealthReport {
  status: 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE';
  primary: {
    provider: 'openai' | 'gemini';
    configured: boolean;
    circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    isQuotaExhausted: boolean;
  };
  fallback: {
    provider: 'openai' | 'gemini' | 'none';
    configured: boolean;
    circuitState?: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    isQuotaExhausted?: boolean;
  };
}

export function getAiProviderHealth(now = Date.now()): AiHealthReport {
  if (!isAiAssistantEnabled()) {
    return {
      status: 'UNAVAILABLE',
      primary: { provider: 'openai', configured: false, circuitState: 'CLOSED', isQuotaExhausted: false },
      fallback: { provider: 'none', configured: false },
    };
  }

  let primary: 'openai' | 'gemini' = 'openai';
  try {
    primary = getAiProvider();
  } catch {
    /* ignore */
  }

  const fallback = getAiFallbackProvider();
  const primaryConfigured = isProviderConfigured(primary);
  const primaryStatus = aiCircuitBreaker.getStatus(primary, now);

  const fallbackConfigured = fallback !== 'none' ? isProviderConfigured(fallback) : false;
  const fallbackStatus = fallback !== 'none' ? aiCircuitBreaker.getStatus(fallback, now) : undefined;

  let overallStatus: 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE' = 'UNAVAILABLE';

  if (primaryConfigured && primaryStatus.state === 'CLOSED') {
    overallStatus = 'AVAILABLE';
  } else if (
    primaryConfigured &&
    primaryStatus.state !== 'CLOSED' &&
    fallbackConfigured &&
    fallbackStatus?.state === 'CLOSED'
  ) {
    overallStatus = 'DEGRADED';
  } else if (primaryConfigured && primaryStatus.state === 'HALF_OPEN') {
    overallStatus = 'DEGRADED';
  } else {
    overallStatus = 'UNAVAILABLE';
  }

  return {
    status: overallStatus,
    primary: {
      provider: primary,
      configured: primaryConfigured,
      circuitState: primaryStatus.state,
      isQuotaExhausted: primaryStatus.isQuotaExhausted,
    },
    fallback: {
      provider: fallback,
      configured: fallbackConfigured,
      ...(fallbackStatus
        ? { circuitState: fallbackStatus.state, isQuotaExhausted: fallbackStatus.isQuotaExhausted }
        : {}),
    },
  };
}

export async function generateAiReplyDetailed(
  message: string,
  client?: AiProviderClient,
  actor?: AuthActor,
  runTool: typeof executeAiTool = executeAiTool,
  historyMessages: HistoryMessage[] = [],
  options?: OrchestratorOptions,
): Promise<AiReplyDetailed> {
  if (!isAiAssistantEnabled()) {
    throw new AppError('AI assistant is unavailable', 503);
  }

  const userId = actor?.id;
  if (userId !== undefined) {
    const acquired = aiUserConcurrency.acquire(userId);
    if (!acquired) {
      throw new AppError('Please wait for previous AI query to complete', 429);
    }
  }

  try {
    return await orchestrateAiRequest(
      message,
      client,
      actor,
      runTool,
      historyMessages,
      options,
    );
  } finally {
    if (userId !== undefined) {
      aiUserConcurrency.release(userId);
    }
  }
}

export async function generateAiReply(
  message: string,
  client?: AiProviderClient,
  actor?: AuthActor,
  runTool: typeof executeAiTool = executeAiTool,
  historyMessages: HistoryMessage[] = [],
  options?: OrchestratorOptions,
): Promise<string> {
  const detailed = await generateAiReplyDetailed(message, client, actor, runTool, historyMessages, options);
  return detailed.reply;
}
