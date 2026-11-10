import logger from '../../utils/logger';
import { SimilarityQueue } from './similarityQueue';
import { processSubmissionSimilarity } from './submissionSimilarityPipeline';
import {
  SIMILARITY_QUEUE_CAP,
  SIMILARITY_STOP_DRAIN_MS,
} from './similarityPipeline.constants';

export interface SimilarityRuntimeOptions {
  processor?: (submissionId: number) => Promise<unknown>;
  cap?: number;
  drainTimeoutMs?: number;
}

export interface SimilarityRuntime {
  enqueue: (submissionId: number) => void;
  whenIdle: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createSimilarityRuntime(options: SimilarityRuntimeOptions = {}): SimilarityRuntime {
  const drainTimeout = options.drainTimeoutMs ?? SIMILARITY_STOP_DRAIN_MS;
  const queue = new SimilarityQueue(
    options.processor ?? ((submissionId: number) => processSubmissionSimilarity(submissionId)),
    { cap: options.cap ?? SIMILARITY_QUEUE_CAP }
  );

  return {
    enqueue(submissionId: number): void {
      try {
        queue.enqueue(submissionId);
      } catch (err: any) {
        logger.error('Similarity runtime enqueue error', {
          submissionId,
          code: err?.code ?? err?.name ?? 'UNKNOWN_ERROR',
        });
      }
    },
    whenIdle(): Promise<void> {
      return queue.whenIdle();
    },
    async stop(): Promise<void> {
      try {
        await queue.stop({ drainTimeoutMs: drainTimeout });
      } catch (err: any) {
        logger.error('Similarity runtime stop error', {
          code: err?.code ?? err?.name ?? 'UNKNOWN_ERROR',
        });
      }
    },
  };
}

let activeRuntime: SimilarityRuntime | null = null;

// The queue is the ONLY executor of the pipeline; concurrency 1 per process.
// Note: More than one API replica would need a Postgres advisory lock (M-502).
export function getSimilarityRuntime(override?: SimilarityRuntime): SimilarityRuntime {
  if (override) {
    activeRuntime = override;
    return activeRuntime;
  }
  if (!activeRuntime) {
    activeRuntime = createSimilarityRuntime({
      processor: (submissionId: number) => processSubmissionSimilarity(submissionId),
    });
  }
  return activeRuntime;
}

export function enqueueSubmissionSimilarity(
  submissionId: number,
  runtime: SimilarityRuntime = getSimilarityRuntime()
): void {
  try {
    runtime.enqueue(submissionId);
  } catch (err: any) {
    logger.error('Similarity runtime safe wrapper error', {
      submissionId,
      code: err?.code ?? err?.name ?? 'UNKNOWN_ERROR',
    });
  }
}

export async function stopSimilarityRuntime(
  drainTimeoutMs: number = SIMILARITY_STOP_DRAIN_MS
): Promise<void> {
  try {
    if (activeRuntime) {
      const runtime = activeRuntime;
      activeRuntime = null;
      await runtime.stop();
    }
  } catch (err: any) {
    logger.error('Similarity runtime stop error', {
      code: err?.code ?? err?.name ?? 'UNKNOWN_ERROR',
    });
  }
}
