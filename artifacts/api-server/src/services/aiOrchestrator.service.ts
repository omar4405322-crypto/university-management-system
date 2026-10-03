import { AppError } from '../utils/appError';
import {
  getAiModelForProvider,
  getAiProvider,
  getAiFallbackProvider,
  isProviderConfigured,
  getPerAttemptTimeoutMs,
  getTotalRequestBudgetMs,
  getMaxRetriesPerProvider,
} from '../utils/aiConfig';
import {
  createAiProviderSession,
  type AiProviderClient,
  type HistoryMessage,
} from './aiProvider.service';
import {
  classifyAiError,
  isRetryableAiTaxonomy,
  AiProviderError,
  type SanitizedAiErrorDiagnostics,
} from '../utils/aiErrorClassifier';
import { aiCircuitBreaker } from './aiCircuitBreaker.service';
import type { AuthActor } from '../types/auth.types';
import { executeAiTool, getAllowedAiTools } from './aiTools.service';
import { buildCapabilitySystemInstructions } from './aiCapabilityRegistry.service';
import logger from '../utils/logger';

export interface CitationItem {
  documentTitle: string;
  documentTitleAr?: string | null;
  version?: number;
  pageNumber?: number | null;
  sectionTitle?: string | null;
  articleNumber?: string | null;
  quote?: string | null;
  documentVersionId: string;
  chunkId?: string | null;
}

export interface AiReplyDetailed {
  reply: string;
  citations: CitationItem[];
  fallbackUsed?: boolean;
  providerUsed?: 'openai' | 'gemini';
  attemptsCount?: number;
  invokedTools?: string[];
}

export interface OrchestratorOptions {
  signal?: AbortSignal;
  delayFn?: (ms: number) => Promise<void>;
  primaryClient?: AiProviderClient;
  fallbackClient?: AiProviderClient;
  toolContext?: {
    conversationId?: string;
    sourceUserMessageId?: string;
  };
  onDelta?: (delta: string) => void;
  onStatus?: (phase: 'thinking' | 'tools' | 'answering', message?: string) => void;
  onCitation?: (citation: CitationItem) => void;
}

const defaultDelay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Executes a single AI provider session across tool rounds (up to 3 rounds).
 * Reuses requestToolCache across attempts and fallbacks to eliminate duplicate
 * expensive read-only university data operations.
 */
async function executeProviderSession(
  provider: 'openai' | 'gemini',
  message: string,
  model: string,
  instructions: string,
  tools: ReturnType<typeof getAllowedAiTools>,
  actor: AuthActor | undefined,
  client: AiProviderClient | undefined,
  historyMessages: HistoryMessage[],
  runTool: typeof executeAiTool,
  requestToolCache: Map<string, Record<string, unknown>>,
  collectedCitations: CitationItem[],
  signal?: AbortSignal,
  isRetryOrFallback = false,
  toolContext?: { conversationId?: string; sourceUserMessageId?: string },
  onDelta?: (delta: string) => void,
  onStatus?: (phase: 'thinking' | 'tools' | 'answering', message?: string) => void,
  onCitation?: (citation: CitationItem) => void,
): Promise<{ reply: string; toolCallsCount: number; invokedTools: string[] }> {
  if (signal?.aborted) {
    throw new AppError('AI request aborted', 499);
  }

  const session = createAiProviderSession(
    provider,
    message,
    model,
    instructions,
    tools,
    client,
    historyMessages,
  );

  let toolCallsCount = 0;
  const invokedToolNames = new Set<string>();

  for (let round = 0; round <= 2; round++) {
    if (signal?.aborted) {
      throw new AppError('AI request aborted', 499);
    }

    if (round === 0 && tools.length > 0) {
      onStatus?.('thinking');
    }

    const nextPromise = session.next(onDelta);
    const response = signal
      ? await Promise.race([
          nextPromise,
          new Promise<never>((_, reject) => {
            if (signal.aborted) {
              reject(new AppError('AI request aborted', 499));
            } else {
              signal.addEventListener(
                'abort',
                () => reject(new AppError('AI request aborted', 499)),
                { once: true },
              );
            }
          }),
        ])
      : await nextPromise;
    const calls = response.calls;

    if (!calls.length) {
      const reply = response.reply?.trim();
      if (!reply) throw new Error('Empty AI response');
      return { reply, toolCallsCount, invokedTools: Array.from(invokedToolNames) };
    }

    if (!actor || round === 2 || toolCallsCount + calls.length > 3) {
      return {
        reply: 'That university data capability is not available yet.',
        toolCallsCount,
        invokedTools: Array.from(invokedToolNames),
      };
    }

    onStatus?.('tools', 'جاري التحقق من بياناتك...');
    toolCallsCount += calls.length;
    for (const call of calls) {
      // 1. RBAC & capability check: MUST verify tool is allowed for this actor
      if (!tools.some((t) => t.name === call.name)) {
        return {
          reply: 'That university data capability is not available yet.',
          toolCallsCount,
          invokedTools: Array.from(invokedToolNames),
        };
      }

      invokedToolNames.add(call.name);

      // 2. Request-scoped memoization for read-only tools
      // Note: All university AI tools in this phase are read-only.
      // Invariant: Provider retry != business action retry.
      const cacheKey = `${call.name}:${call.arguments}`;
      let result: Record<string, unknown>;

      if (isRetryOrFallback && requestToolCache.has(cacheKey)) {
        result = requestToolCache.get(cacheKey)!;
      } else {
        try {
          result = await runTool(call.name, call.arguments, actor, undefined, toolContext);
          requestToolCache.set(cacheKey, result);
        } catch {
          return {
            reply: 'That university data capability is temporarily unavailable.',
            toolCallsCount,
            invokedTools: Array.from(invokedToolNames),
          };
        }
      }

      // Collect citations if knowledge tool was called
      if (
        call.name === 'search_university_regulations' &&
        result?.hasData &&
        Array.isArray(result.sources)
      ) {
        for (const src of result.sources as any[]) {
          if (src.documentVersionId && !collectedCitations.some((c) => c.chunkId === src.chunkId)) {
            const newCitation: CitationItem = {
              documentTitle: src.documentTitle,
              documentTitleAr: src.documentTitleAr,
              version: src.version,
              pageNumber: src.pageNumber,
              sectionTitle: src.sectionTitle,
              articleNumber: src.articleNumber,
              quote: typeof src.excerpt === 'string' ? src.excerpt.slice(0, 300) : null,
              documentVersionId: src.documentVersionId,
              chunkId: src.chunkId,
            };
            collectedCitations.push(newCitation);
            onCitation?.(newCitation);
          }
        }
      }

      session.addResult(call, result);
    }
  }

  return {
    reply: 'That university data capability is not available yet.',
    toolCallsCount,
    invokedTools: Array.from(invokedToolNames),
  };
}

export async function orchestrateAiRequest(
  message: string,
  primaryClient?: AiProviderClient,
  actor?: AuthActor,
  runTool: typeof executeAiTool = executeAiTool,
  historyMessages: HistoryMessage[] = [],
  options: OrchestratorOptions = {},
): Promise<AiReplyDetailed> {
  const startedAt = Date.now();
  const totalBudgetMs = getTotalRequestBudgetMs();
  const maxRetries = getMaxRetriesPerProvider();
  const delay = options.delayFn ?? defaultDelay;
  const signal = options.signal;

  let primaryProvider: 'openai' | 'gemini';
  try {
    primaryProvider = getAiProvider();
  } catch {
    throw new AppError('AI assistant is unavailable', 503);
  }
  const fallbackProvider = getAiFallbackProvider();

  // Validate primary configuration
  if (!isProviderConfigured(primaryProvider)) {
    throw new AppError('AI assistant is unavailable', 503);
  }

  const tools = getAllowedAiTools(actor);
  const instructions = buildCapabilitySystemInstructions(actor);
  const requestToolCache = new Map<string, Record<string, unknown>>();
  const collectedCitations: CitationItem[] = [];

  let attemptsCount = 0;
  let primaryError: unknown = null;
  let lastDiagnostics: SanitizedAiErrorDiagnostics | null = null;
  let hasEmittedVisibleDelta = false;
  let partialAnswerText = '';

  const wrappedOnDelta = options.onDelta
    ? (delta: string) => {
        hasEmittedVisibleDelta = true;
        partialAnswerText += delta;
        options.onDelta!(delta);
      }
    : undefined;

  // 1. Check primary circuit breaker
  const canUsePrimary = Boolean(primaryClient) || aiCircuitBreaker.canExecute(primaryProvider);

  if (canUsePrimary) {
    const primaryModel = getAiModelForProvider(primaryProvider);

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      if (signal?.aborted) {
        throw new AppError('AI request aborted', 499);
      }

      const elapsed = Date.now() - startedAt;
      if (elapsed >= totalBudgetMs) {
        lastDiagnostics = {
          provider: primaryProvider,
          taxonomy: 'TIMEOUT',
          category: 'timeout/network',
          retryable: false,
          statusCode: 408,
        };
        break;
      }

      attemptsCount++;
      try {
        const { reply, toolCallsCount, invokedTools } = await executeProviderSession(
          primaryProvider,
          message,
          primaryModel,
          instructions,
          tools,
          actor,
          primaryClient,
          historyMessages,
          runTool,
          requestToolCache,
          collectedCitations,
          signal,
          attempt > 1,
          options.toolContext,
          wrappedOnDelta,
          options.onStatus,
          options.onCitation,
        );

        aiCircuitBreaker.recordSuccess(primaryProvider);

        logger.info('[AI] provider call succeeded', {
          provider: primaryProvider,
          fallbackUsed: false,
          attempts: attemptsCount,
          latencyMs: Date.now() - startedAt,
          toolCallsCount,
        });

        return {
          reply,
          citations: collectedCitations,
          fallbackUsed: false,
          providerUsed: primaryProvider,
          attemptsCount,
          invokedTools,
        };
      } catch (err: unknown) {
        if (
          signal?.aborted ||
          (err instanceof AppError && err.statusCode === 499) ||
          (err as any)?.name === 'AbortError' ||
          (err as any)?.message === 'CLIENT_DISCONNECTED' ||
          (err as any)?.message === 'REQUEST_TIMEOUT'
        ) {
          throw err instanceof AppError ? err : new AppError('AI request aborted', 499);
        }
        primaryError = err;
        const diagnostics = classifyAiError(err, primaryProvider);
        lastDiagnostics = diagnostics;

        // Quota exhaustion immediately trips circuit breaker
        if (diagnostics.taxonomy === 'DAILY_QUOTA_EXHAUSTED') {
          aiCircuitBreaker.recordFailure(primaryProvider, diagnostics.taxonomy);
          break;
        }

        // Section 6 Invariant: If a visible delta has already been emitted,
        // NEVER retry or switch providers mid-stream.
        if (hasEmittedVisibleDelta) {
          logger.warn('[AI] provider failed after visible streaming started, halting to preserve consistency', {
            primaryProvider,
            partialLength: partialAnswerText.length,
          });
          const streamErr = new AppError('AI stream was interrupted during generation', 500);
          (streamErr as any).isStreamInterrupted = true;
          (streamErr as any).partialText = partialAnswerText;
          throw streamErr;
        }

        const remainingBudget = totalBudgetMs - (Date.now() - startedAt);

        // Check if retryable before any delta was emitted
        if (
          !hasEmittedVisibleDelta &&
          diagnostics.retryable &&
          attempt <= maxRetries &&
          remainingBudget > 1500 &&
          !signal?.aborted
        ) {
          // Bounded exponential backoff with jitter
          const baseBackoff = 200 * Math.pow(2, attempt - 1);
          const jitter = Math.floor(Math.random() * 80);
          let delayMs = Math.min(baseBackoff + jitter, 1500);

          if (diagnostics.retryAfterMs && diagnostics.retryAfterMs > 0) {
            delayMs = Math.min(Math.max(delayMs, diagnostics.retryAfterMs), remainingBudget - 500);
          }

          logger.warn('[AI] primary provider transient failure, retrying', {
            provider: primaryProvider,
            attempt,
            maxRetries,
            taxonomy: diagnostics.taxonomy,
            delayMs,
          });

          await delay(delayMs);
          continue;
        }

        // Non-retryable or retries exhausted -> record request-level failure in circuit breaker
        aiCircuitBreaker.recordFailure(primaryProvider, diagnostics.taxonomy);
        break;
      }
    }
  } else {
    logger.warn('[AI] primary provider circuit is OPEN, considering fallback', {
      provider: primaryProvider,
    });
  }

  // 2. Fallback Provider Evaluation
  // Fallback is ONLY permitted on transient provider outages before any visible delta was emitted.
  const isPrimaryFailureEligibleForFallback =
    !canUsePrimary ||
    lastDiagnostics?.taxonomy === 'DAILY_QUOTA_EXHAUSTED' ||
    (lastDiagnostics !== null && isRetryableAiTaxonomy(lastDiagnostics.taxonomy));

  const isFallbackViable =
    !hasEmittedVisibleDelta &&
    isPrimaryFailureEligibleForFallback &&
    fallbackProvider !== 'none' &&
    fallbackProvider !== primaryProvider &&
    (isProviderConfigured(fallbackProvider) || Boolean(options.fallbackClient)) &&
    aiCircuitBreaker.canExecute(fallbackProvider) &&
    Date.now() - startedAt + 2000 < totalBudgetMs &&
    !signal?.aborted;

  if (isFallbackViable) {
    logger.info('[AI] invoking secondary fallback provider', {
      primaryProvider,
      fallbackProvider,
      primaryReason: lastDiagnostics?.taxonomy ?? 'CIRCUIT_OPEN',
    });

    const fallbackModel = getAiModelForProvider(fallbackProvider);
    attemptsCount++;

    try {
      const { reply, toolCallsCount, invokedTools } = await executeProviderSession(
        fallbackProvider,
        message,
        fallbackModel,
        instructions,
        tools,
        actor,
        options.fallbackClient,
        historyMessages,
        runTool,
        requestToolCache,
        collectedCitations,
        signal,
        true,
        options.toolContext,
        wrappedOnDelta,
        options.onStatus,
        options.onCitation,
      );

      aiCircuitBreaker.recordSuccess(fallbackProvider);

      logger.info('[AI] fallback provider succeeded', {
        fallbackProvider,
        fallbackUsed: true,
        attempts: attemptsCount,
        latencyMs: Date.now() - startedAt,
        toolCallsCount,
      });

      return {
        reply,
        citations: collectedCitations,
        fallbackUsed: true,
        providerUsed: fallbackProvider,
        attemptsCount,
        invokedTools,
      };
    } catch (fbErr: unknown) {
      const fbDiagnostics = classifyAiError(fbErr, fallbackProvider);
      aiCircuitBreaker.recordFailure(fallbackProvider, fbDiagnostics.taxonomy);

      logger.warn('[AI] fallback provider also failed', {
        fallbackProvider,
        taxonomy: fbDiagnostics.taxonomy,
        category: fbDiagnostics.category,
      });

      throw new AiProviderError(
        'AI assistant secondary fallback provider also failed',
        503,
        fbDiagnostics,
      );
    }
  }

  // Fallback not viable or unavailable: throw classified primary error
  const finalDiagnostics = lastDiagnostics ?? classifyAiError(primaryError, primaryProvider);
  throw new AiProviderError(
    'AI assistant is temporarily unavailable',
    503,
    finalDiagnostics,
  );
}
