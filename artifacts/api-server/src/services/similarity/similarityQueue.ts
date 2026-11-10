import logger from '../../utils/logger';
import {
  SIMILARITY_QUEUE_CAP,
  SIMILARITY_STOP_DRAIN_MS,
  SIMILARITY_EMPTY_COUNT,
} from './similarityPipeline.constants';

export type QueueEnqueueOutcome =
  | 'QUEUED'
  | 'DEDUPED'
  | 'DROPPED_FULL'
  | 'REJECTED_STOPPED';

export type QueueStopOutcome = 'DRAINED' | 'ABANDONED';

export interface SimilarityQueueOptions {
  cap?: number;
  logger?: {
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
    info?: (msg: string, meta?: Record<string, unknown>) => void;
  };
}

export class SimilarityQueue {
  private readonly processor: (submissionId: number) => Promise<unknown>;
  private readonly cap: number;
  private readonly queueLogger: {
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };
  private readonly waiting: number[] = [];
  private runningId: number | null = null;
  private running = false;
  private stopped = false;
  private scheduled = false;
  private readonly idleResolvers: Array<() => void> = [];
  private readonly drainResolvers: Array<() => void> = [];

  constructor(
    processor: (submissionId: number) => Promise<unknown>,
    options?: SimilarityQueueOptions
  ) {
    this.processor = processor;
    this.cap = options?.cap ?? SIMILARITY_QUEUE_CAP;
    this.queueLogger = options?.logger ?? logger;
  }

  public enqueue(submissionId: number): QueueEnqueueOutcome {
    if (this.stopped) {
      return 'REJECTED_STOPPED';
    }

    if (this.waiting.includes(submissionId)) {
      return 'DEDUPED';
    }

    if (this.waiting.length >= this.cap) {
      this.queueLogger.warn('Similarity queue full, dropping newest submission', {
        submissionId,
        cap: this.cap,
      });
      return 'DROPPED_FULL';
    }

    this.waiting.push(submissionId);
    this.scheduleProcessing();
    return 'QUEUED';
  }

  public whenIdle(): Promise<void> {
    if (!this.running && this.waiting.length === SIMILARITY_EMPTY_COUNT) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  public stop(options?: { drainTimeoutMs?: number }): Promise<QueueStopOutcome> {
    this.stopped = true;
    this.waiting.length = SIMILARITY_EMPTY_COUNT;

    if (!this.running) {
      this.checkIdle();
      return Promise.resolve('DRAINED');
    }

    const drainTimeoutMs = options?.drainTimeoutMs ?? SIMILARITY_STOP_DRAIN_MS;

    return new Promise<QueueStopOutcome>((resolve) => {
      let timer: NodeJS.Timeout | null = null;
      let settled = false;

      const finish = (outcome: QueueStopOutcome) => {
        if (settled) return;
        settled = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        this.checkIdle();
        resolve(outcome);
      };

      timer = setTimeout(() => {
        finish('ABANDONED');
      }, drainTimeoutMs);

      this.drainResolvers.push(() => {
        finish('DRAINED');
      });
    });
  }

  private scheduleProcessing(): void {
    if (this.scheduled || this.running || this.stopped) {
      return;
    }
    this.scheduled = true;
    setImmediate(() => {
      this.scheduled = false;
      void this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.running || this.waiting.length === SIMILARITY_EMPTY_COUNT) {
      this.checkIdle();
      return;
    }

    const nextId = this.waiting.shift()!;
    this.runningId = nextId;
    this.running = true;

    try {
      await this.processor(nextId);
    } catch {
      this.queueLogger.error('Similarity queue processor error', {
        submissionId: nextId,
      });
    } finally {
      this.running = false;
      this.runningId = null;

      const drainCallbacks = this.drainResolvers.slice();
      this.drainResolvers.length = SIMILARITY_EMPTY_COUNT;
      for (const cb of drainCallbacks) {
        cb();
      }

      this.checkIdle();

      if (!this.stopped && this.waiting.length > SIMILARITY_EMPTY_COUNT) {
        this.scheduleProcessing();
      }
    }
  }

  private checkIdle(): void {
    if (!this.running && this.waiting.length === SIMILARITY_EMPTY_COUNT) {
      const resolvers = this.idleResolvers.slice();
      this.idleResolvers.length = SIMILARITY_EMPTY_COUNT;
      for (const resolve of resolvers) {
        resolve();
      }
    }
  }
}
