import type { AiTaxonomyCode } from '../utils/aiErrorClassifier';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ProviderCircuitStatus {
  provider: 'openai' | 'gemini';
  state: CircuitState;
  consecutiveFailures: number;
  cooldownRemainingMs: number;
  isQuotaExhausted: boolean;
  lastFailureTime?: number;
  lastFailureTaxonomy?: AiTaxonomyCode;
}

interface InternalCircuitState {
  state: CircuitState;
  consecutiveFailures: number;
  cooldownExpiresAt: number;
  isQuotaExhausted: boolean;
  lastFailureTime?: number;
  lastFailureTaxonomy?: AiTaxonomyCode;
  halfOpenInFlight: boolean;
}

const FAILURE_THRESHOLD = 3;
const NORMAL_COOLDOWN_MS = 30_000;
const QUOTA_COOLDOWN_MS = 300_000; // 5 minutes for quota exhaustion

/**
 * In-memory circuit breakers for AI providers.
 * Note on Horizontal Scaling:
 * Circuit breaker state is tracked in-memory per node to guarantee zero overhead
 * and avoid extra Redis network round-trips on LLM request paths. Each worker node
 * independently protects its own outbound connections and upstreams from thrashing.
 */
class AiCircuitBreakerRegistry {
  private circuits: Record<'openai' | 'gemini', InternalCircuitState> = {
    openai: {
      state: 'CLOSED',
      consecutiveFailures: 0,
      cooldownExpiresAt: 0,
      isQuotaExhausted: false,
      halfOpenInFlight: false,
    },
    gemini: {
      state: 'CLOSED',
      consecutiveFailures: 0,
      cooldownExpiresAt: 0,
      isQuotaExhausted: false,
      halfOpenInFlight: false,
    },
  };

  public canExecute(provider: 'openai' | 'gemini', now = Date.now()): boolean {
    const circuit = this.circuits[provider];
    if (circuit.state === 'CLOSED') {
      return true;
    }

    if (circuit.state === 'OPEN') {
      if (now >= circuit.cooldownExpiresAt) {
        // Cooldown elapsed -> transition to HALF_OPEN to probe
        circuit.state = 'HALF_OPEN';
        circuit.halfOpenInFlight = true;
        return true;
      }
      return false;
    }

    if (circuit.state === 'HALF_OPEN') {
      // Allow only one probe at a time in half-open state
      if (!circuit.halfOpenInFlight) {
        circuit.halfOpenInFlight = true;
        return true;
      }
      return false;
    }

    return true;
  }

  public recordSuccess(provider: 'openai' | 'gemini'): void {
    const circuit = this.circuits[provider];
    circuit.state = 'CLOSED';
    circuit.consecutiveFailures = 0;
    circuit.cooldownExpiresAt = 0;
    circuit.isQuotaExhausted = false;
    circuit.halfOpenInFlight = false;
    circuit.lastFailureTaxonomy = undefined;
  }

  public recordFailure(
    provider: 'openai' | 'gemini',
    taxonomy: AiTaxonomyCode,
    now = Date.now(),
  ): void {
    const circuit = this.circuits[provider];
    circuit.consecutiveFailures++;
    circuit.lastFailureTime = now;
    circuit.lastFailureTaxonomy = taxonomy;
    circuit.halfOpenInFlight = false;

    if (taxonomy === 'DAILY_QUOTA_EXHAUSTED') {
      // Immediate trip on daily quota exhaustion with extended cooldown
      circuit.state = 'OPEN';
      circuit.isQuotaExhausted = true;
      circuit.cooldownExpiresAt = now + QUOTA_COOLDOWN_MS;
      return;
    }

    if (circuit.state === 'HALF_OPEN') {
      // Probe failed -> trip back to OPEN immediately
      circuit.state = 'OPEN';
      circuit.cooldownExpiresAt = now + NORMAL_COOLDOWN_MS;
      return;
    }

    if (circuit.consecutiveFailures >= FAILURE_THRESHOLD) {
      circuit.state = 'OPEN';
      circuit.cooldownExpiresAt = now + NORMAL_COOLDOWN_MS;
    }
  }

  public getStatus(provider: 'openai' | 'gemini', now = Date.now()): ProviderCircuitStatus {
    const circuit = this.circuits[provider];
    let state = circuit.state;

    if (state === 'OPEN' && now >= circuit.cooldownExpiresAt) {
      state = 'HALF_OPEN';
    }

    const cooldownRemainingMs = Math.max(0, circuit.cooldownExpiresAt - now);

    return {
      provider,
      state,
      consecutiveFailures: circuit.consecutiveFailures,
      cooldownRemainingMs,
      isQuotaExhausted: circuit.isQuotaExhausted,
      lastFailureTime: circuit.lastFailureTime,
      lastFailureTaxonomy: circuit.lastFailureTaxonomy,
    };
  }

  public reset(provider?: 'openai' | 'gemini'): void {
    const providers: ('openai' | 'gemini')[] = provider ? [provider] : ['openai', 'gemini'];
    for (const p of providers) {
      this.circuits[p] = {
        state: 'CLOSED',
        consecutiveFailures: 0,
        cooldownExpiresAt: 0,
        isQuotaExhausted: false,
        halfOpenInFlight: false,
      };
    }
  }
}

export const aiCircuitBreaker = new AiCircuitBreakerRegistry();
