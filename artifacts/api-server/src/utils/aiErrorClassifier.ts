import { AppError } from './appError';

export type AiTaxonomyCode =
  | 'AUTH_CONFIG'
  | 'RATE_LIMIT'
  | 'DAILY_QUOTA_EXHAUSTED'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'PROVIDER_5XX'
  | 'INVALID_REQUEST'
  | 'MALFORMED_RESPONSE'
  | 'SAFETY_BLOCK'
  | 'TOOL_PROTOCOL_ERROR'
  | 'UNKNOWN';

export type AiErrorCategory =
  | 'authentication/configuration'
  | 'quota/rate limit'
  | 'timeout/network'
  | 'invalid request'
  | 'upstream 5xx'
  | 'malformed/empty provider response'
  | 'unknown provider failure';

export interface SanitizedAiErrorDiagnostics {
  provider: 'openai' | 'gemini';
  taxonomy: AiTaxonomyCode;
  category: AiErrorCategory;
  retryable: boolean;
  errorName?: string;
  statusCode?: number;
  errorCode?: string;
  retryAfterMs?: number;
}

export class AiProviderError extends AppError {
  public readonly diagnostics: SanitizedAiErrorDiagnostics;

  constructor(message: string, statusCode: number, diagnostics: SanitizedAiErrorDiagnostics) {
    super(message, statusCode);
    this.diagnostics = diagnostics;
  }
}

export function isRetryableAiTaxonomy(taxonomy: AiTaxonomyCode): boolean {
  switch (taxonomy) {
    case 'RATE_LIMIT':
    case 'TIMEOUT':
    case 'NETWORK':
    case 'PROVIDER_5XX':
      return true;
    case 'AUTH_CONFIG':
    case 'DAILY_QUOTA_EXHAUSTED':
    case 'INVALID_REQUEST':
    case 'MALFORMED_RESPONSE':
    case 'SAFETY_BLOCK':
    case 'TOOL_PROTOCOL_ERROR':
    case 'UNKNOWN':
    default:
      return false;
  }
}

function mapTaxonomyToLegacyCategory(taxonomy: AiTaxonomyCode): AiErrorCategory {
  switch (taxonomy) {
    case 'AUTH_CONFIG':
      return 'authentication/configuration';
    case 'RATE_LIMIT':
    case 'DAILY_QUOTA_EXHAUSTED':
      return 'quota/rate limit';
    case 'TIMEOUT':
    case 'NETWORK':
      return 'timeout/network';
    case 'INVALID_REQUEST':
    case 'SAFETY_BLOCK':
      return 'invalid request';
    case 'PROVIDER_5XX':
      return 'upstream 5xx';
    case 'MALFORMED_RESPONSE':
    case 'TOOL_PROTOCOL_ERROR':
      return 'malformed/empty provider response';
    case 'UNKNOWN':
    default:
      return 'unknown provider failure';
  }
}

function extractRetryAfterMs(errorObj: Record<string, unknown>): number | undefined {
  const headers = (errorObj.headers ?? (errorObj.response as Record<string, unknown> | undefined)?.headers) as
    | Record<string, unknown>
    | undefined;

  if (headers && typeof headers === 'object') {
    const rawVal = headers['retry-after'] ?? headers['Retry-After'];
    if (typeof rawVal === 'string' || typeof rawVal === 'number') {
      const numSec = Number(rawVal);
      if (Number.isFinite(numSec) && numSec > 0) {
        return Math.min(Math.round(numSec * 1000), 15_000);
      }
    }
  }
  return undefined;
}

export function classifyAiError(err: unknown, provider: 'openai' | 'gemini'): SanitizedAiErrorDiagnostics {
  if (err instanceof AiProviderError) {
    return err.diagnostics;
  }

  const errorObj = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : {};
  const rawStatus =
    typeof errorObj.status === 'number'
      ? errorObj.status
      : typeof errorObj.statusCode === 'number'
      ? errorObj.statusCode
      : undefined;
  const rawName =
    typeof errorObj.name === 'string' ? errorObj.name : err instanceof Error ? err.constructor?.name : undefined;
  const rawCode =
    typeof errorObj.code === 'string' && /^[A-Za-z0-9_-]+$/.test(errorObj.code) && errorObj.code.length <= 64
      ? errorObj.code
      : undefined;
  const rawMsg = typeof errorObj.message === 'string' ? errorObj.message.toLowerCase() : '';

  let taxonomy: AiTaxonomyCode = 'UNKNOWN';

  // 1. Safety Block
  if (
    rawMsg.includes('safety') ||
    rawMsg.includes('harm_category') ||
    rawMsg.includes('content_filter') ||
    rawMsg.includes('blocked by safety') ||
    rawName === 'SafetyError'
  ) {
    taxonomy = 'SAFETY_BLOCK';
  }
  // 2. Auth / Config
  else if (
    rawStatus === 401 ||
    rawStatus === 403 ||
    rawName === 'AuthenticationError' ||
    rawMsg.includes('not configured') ||
    rawMsg.includes('unauthenticated') ||
    rawMsg.includes('permission_denied') ||
    rawMsg.includes('api_key') ||
    rawMsg.includes('apikey')
  ) {
    taxonomy = 'AUTH_CONFIG';
  }
  // 3. Quota Exhaustion (Long-term / Billing / Daily cap)
  else if (
    rawMsg.includes('insufficient_quota') ||
    rawMsg.includes('quota exceeded for quota metric') ||
    rawMsg.includes('credit balance is too low') ||
    rawMsg.includes('billing') ||
    rawMsg.includes('daily limit') ||
    (rawStatus === 429 && rawMsg.includes('quota exceeded'))
  ) {
    taxonomy = 'DAILY_QUOTA_EXHAUSTED';
  }
  // 4. Transient Rate Limit
  else if (
    rawStatus === 429 ||
    rawName === 'RateLimitError' ||
    rawMsg.includes('quota') ||
    rawMsg.includes('rate limit') ||
    rawMsg.includes('resource_exhausted')
  ) {
    taxonomy = 'RATE_LIMIT';
  }
  // 5. Timeouts
  else if (
    rawStatus === 408 ||
    rawName === 'RequestTimeoutError' ||
    rawName === 'APIConnectionTimeoutError' ||
    rawName === 'TimeoutError' ||
    rawCode === 'ETIMEDOUT' ||
    rawCode === 'UND_ERR_CONNECT_TIMEOUT' ||
    rawMsg.includes('timeout') ||
    rawMsg.includes('timed out')
  ) {
    taxonomy = 'TIMEOUT';
  }
  // 6. Network / Abort
  else if (
    rawName === 'ConnectionError' ||
    rawName === 'RequestAbortedError' ||
    rawName === 'APIConnectionError' ||
    rawName === 'AbortError' ||
    rawName === 'FetchError' ||
    (rawCode !== undefined && ['ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND'].includes(rawCode)) ||
    rawMsg.includes('connection error') ||
    rawMsg.includes('network error') ||
    rawMsg.includes('econnreset')
  ) {
    taxonomy = 'NETWORK';
  }
  // 7. Tool Protocol / Parsing
  else if (
    rawMsg.includes('invalid ai tool call') ||
    rawMsg.includes('invalid ai tool arguments') ||
    rawMsg.includes('tool call argument parse error')
  ) {
    taxonomy = 'TOOL_PROTOCOL_ERROR';
  }
  // 8. Malformed / Incomplete Provider Response
  else if (
    rawMsg.includes('incomplete ai response') ||
    rawMsg.includes('empty ai response')
  ) {
    taxonomy = 'MALFORMED_RESPONSE';
  }
  // 9. Invalid Request
  else if (
    rawStatus === 400 ||
    rawStatus === 404 ||
    rawStatus === 422 ||
    rawName === 'InvalidRequestError' ||
    rawName === 'BadRequestError' ||
    rawMsg.includes('invalid_argument')
  ) {
    taxonomy = 'INVALID_REQUEST';
  }
  // 10. Provider Upstream 5xx
  else if (
    (rawStatus !== undefined && rawStatus >= 500 && rawStatus < 600) ||
    rawName === 'InternalServerError' ||
    rawMsg.includes('internal server error')
  ) {
    taxonomy = 'PROVIDER_5XX';
  }

  const category = mapTaxonomyToLegacyCategory(taxonomy);
  const retryable = isRetryableAiTaxonomy(taxonomy);
  const retryAfterMs = extractRetryAfterMs(errorObj);
  const safeErrorName =
    rawName && /^[A-Za-z0-9_$. -]+$/.test(rawName) && rawName.length <= 64 ? rawName : undefined;

  return {
    provider,
    taxonomy,
    category,
    retryable,
    ...(safeErrorName ? { errorName: safeErrorName } : {}),
    ...(rawStatus !== undefined ? { statusCode: rawStatus } : {}),
    ...(rawCode ? { errorCode: rawCode } : {}),
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
  };
}
