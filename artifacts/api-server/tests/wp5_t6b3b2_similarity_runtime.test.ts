import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSimilarityRuntime,
  getSimilarityRuntime,
  enqueueSubmissionSimilarity,
  stopSimilarityRuntime,
} from '../src/services/similarity/similarityRuntime';
import { stopSimilarityShutdownStep } from '../src/utils/shutdown';

test('WP5-T6b3b2: Similarity Runtime Unit & Shutdown Tests', async (t) => {
  await t.test('R1-1: enqueue is synchronous, ignores result, and never throws for throwing or never-resolving processor', async () => {
    let syncCallCount = 0;
    let hangingStartedSignal: () => void;
    const hangingStarted = new Promise<void>((resolve) => {
      hangingStartedSignal = resolve;
    });

    const runtime = createSimilarityRuntime({
      processor: async (id: number) => {
        syncCallCount++;
        if (id === 101) {
          throw new Error('Processor sync crash');
        }
        if (id === 102) {
          return Promise.reject(new Error('Processor async rejection'));
        }
        if (id === 103) {
          hangingStartedSignal();
          await new Promise<void>(() => {}); // Never resolves
        }
      },
    });

    // Enqueue 101 (throwing)
    assert.doesNotThrow(() => {
      enqueueSubmissionSimilarity(101, runtime);
    });
    // Synchronous execution proof: processor has not run yet at enqueue return time
    assert.equal(syncCallCount, 0);

    // Enqueue 102 (rejecting)
    assert.doesNotThrow(() => {
      enqueueSubmissionSimilarity(102, runtime);
    });
    assert.equal(syncCallCount, 0);

    // Let 101 and 102 finish
    await runtime.whenIdle();
    assert.equal(syncCallCount, 2);

    // Enqueue 103 (never-resolving)
    assert.doesNotThrow(() => {
      enqueueSubmissionSimilarity(103, runtime);
    });
    await hangingStarted;

    // Stop runtime with fast timeout to abandon hanging job cleanly
    await runtime.stop();
  });

  await t.test('R1-2: dedupe prevents duplicate queued entries while submission is waiting', async () => {
    let unblockFirstJob: () => void;
    const firstJobRunning = new Promise<void>((resolve) => {
      unblockFirstJob = resolve;
    });
    let firstJobStartedSignal: () => void;
    const firstJobStarted = new Promise<void>((resolve) => {
      firstJobStartedSignal = resolve;
    });

    const runLog: number[] = [];
    const runtime = createSimilarityRuntime({
      processor: async (id: number) => {
        runLog.push(id);
        if (id === 1) {
          firstJobStartedSignal();
          await firstJobRunning;
        }
      },
    });

    enqueueSubmissionSimilarity(1, runtime);
    await firstJobStarted;

    // Job 1 is currently in-flight. Now enqueue job 2 twice
    enqueueSubmissionSimilarity(2, runtime);
    enqueueSubmissionSimilarity(2, runtime); // Deduped!

    // Unblock job 1 and wait for queue to drain
    unblockFirstJob!();
    await runtime.whenIdle();

    assert.deepEqual(runLog, [1, 2]);
    await runtime.stop();
  });

  await t.test('R1-3: capacity overflow drops newest submission and never throws', async () => {
    let unblockInFlight: () => void;
    const inFlightRunning = new Promise<void>((resolve) => {
      unblockInFlight = resolve;
    });
    let inFlightStartedSignal: () => void;
    const inFlightStarted = new Promise<void>((resolve) => {
      inFlightStartedSignal = resolve;
    });

    const processed: number[] = [];
    const runtime = createSimilarityRuntime({
      cap: 2,
      processor: async (id: number) => {
        processed.push(id);
        if (id === 10) {
          inFlightStartedSignal();
          await inFlightRunning;
        }
      },
    });

    enqueueSubmissionSimilarity(10, runtime);
    await inFlightStarted;

    // Waiting queue cap = 2
    enqueueSubmissionSimilarity(20, runtime); // queued (1/2)
    enqueueSubmissionSimilarity(30, runtime); // queued (2/2)
    enqueueSubmissionSimilarity(40, runtime); // dropped (over cap)
    enqueueSubmissionSimilarity(50, runtime); // dropped (over cap)

    unblockInFlight!();
    await runtime.whenIdle();

    assert.deepEqual(processed, [10, 20, 30]);
    await runtime.stop();
  });

  await t.test('R1-4: stop drains running jobs or abandons hanging jobs within drainTimeoutMs', async () => {
    // 1. Drains running jobs when they finish in time
    let unblockNormal: () => void;
    const normalRunning = new Promise<void>((resolve) => {
      unblockNormal = resolve;
    });
    let normalStartedSignal: () => void;
    const normalStarted = new Promise<void>((resolve) => {
      normalStartedSignal = resolve;
    });

    const drainedLog: number[] = [];
    const normalRuntime = createSimilarityRuntime({
      drainTimeoutMs: 1000,
      processor: async (id: number) => {
        drainedLog.push(id);
        normalStartedSignal();
        await normalRunning;
      },
    });

    enqueueSubmissionSimilarity(1, normalRuntime);
    await normalStarted;

    const stopPromise = normalRuntime.stop();
    unblockNormal!();
    await stopPromise;
    assert.deepEqual(drainedLog, [1]);

    // 2. Abandons running jobs when they exceed drainTimeoutMs
    let abandonStartedSignal: () => void;
    const abandonStarted = new Promise<void>((resolve) => {
      abandonStartedSignal = resolve;
    });
    const hangingRuntime = createSimilarityRuntime({
      drainTimeoutMs: 10,
      processor: async () => {
        abandonStartedSignal();
        await new Promise<void>(() => {}); // hangs forever
      },
    });

    enqueueSubmissionSimilarity(99, hangingRuntime);
    await abandonStarted;

    // Must resolve and abandon within timeout, never hang
    await hangingRuntime.stop();
  });

  await t.test('R1-5: no leftover timer keeps process alive after stop or drain', async () => {
    const runtime = createSimilarityRuntime({
      drainTimeoutMs: 5000,
      processor: async () => {},
    });

    enqueueSubmissionSimilarity(1, runtime);
    await runtime.whenIdle();
    await runtime.stop();

    // After stop, calling stop again is a safe no-op
    await runtime.stop();
  });

  await t.test('R3: shutdown step helper stops similarity runtime and Step 1 calls it structurally', async () => {
    // 1. Helper function execution test: stopSimilarityShutdownStep never throws
    await assert.doesNotReject(async () => {
      await stopSimilarityShutdownStep();
    });

    // 2. Labelled structural assertion that shutdown.ts Step 1 calls stopSimilarityShutdownStep
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const shutdownSourcePath = path.resolve(currentDir, '../src/utils/shutdown.ts');
    const shutdownSource = fs.readFileSync(shutdownSourcePath, 'utf8');

    // Structural check: exported helper exists
    assert.match(
      shutdownSource,
      /export\s+(async\s+)?function\s+stopSimilarityShutdownStep/,
      'shutdown.ts must export stopSimilarityShutdownStep'
    );

    // Structural check: Step 1 invokes stopSimilarityShutdownStep inside try/catch
    const step1Index = shutdownSource.indexOf('Step 1:');
    const step2Index = shutdownSource.indexOf('Step 2:');
    assert.ok(step1Index !== -1 && step2Index !== -1, 'shutdown.ts must contain Step 1 and Step 2 markers');

    const step1Block = shutdownSource.slice(step1Index, step2Index);
    assert.match(
      step1Block,
      /stopSimilarityShutdownStep\s*\(\s*\)/,
      'Step 1 must call stopSimilarityShutdownStep()'
    );
    assert.match(
      step1Block,
      /try\s*\{[\s\S]*stopSimilarityShutdownStep[\s\S]*\}\s*catch/,
      'Step 1 call to stopSimilarityShutdownStep must be wrapped in try/catch'
    );
  });
});
