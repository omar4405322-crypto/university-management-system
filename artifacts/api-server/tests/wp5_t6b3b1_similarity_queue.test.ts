import test from 'node:test';
import assert from 'node:assert/strict';
import { SimilarityQueue } from '../src/services/similarity/similarityQueue';
import {
  SIMILARITY_QUEUE_CAP,
  SIMILARITY_STOP_DRAIN_MS,
} from '../src/services/similarity/similarityPipeline.constants';

test('wp5_t6b3b1 SimilarityQueue Suite', async (t) => {
  await t.test('Q1 cap 3: enqueue 5 distinct ids while processor is blocked', async () => {
    let unblockProcessor: (() => void) | null = null;
    const processorStarted = new Promise<void>((resolve) => {
      // triggers when first job starts
      const origUnblock = unblockProcessor;
    });

    let firstJobStartedResolve: () => void;
    const firstJobStarted = new Promise<void>((resolve) => {
      firstJobStartedResolve = resolve;
    });

    const processedIds: number[] = [];
    const queue = new SimilarityQueue(
      async (id: number) => {
        processedIds.push(id);
        if (id === 1) {
          firstJobStartedResolve();
          await new Promise<void>((resolve) => {
            unblockProcessor = resolve;
          });
        }
      },
      { cap: 3 }
    );

    // Enqueue job 1
    const res1 = queue.enqueue(1);
    assert.equal(res1, 'QUEUED');

    // Wait until job 1 is running and blocked
    await firstJobStarted;

    // While processor is blocked running job 1:
    // We enqueue 5 distinct ids: 2, 3, 4, 5, 6
    // Capacity of waiting queue is 3.
    // Derived exact sequence:
    // id 2 -> QUEUED (waiting size 1)
    // id 3 -> QUEUED (waiting size 2)
    // id 4 -> QUEUED (waiting size 3, waiting list full)
    // id 5 -> DROPPED_FULL (newest dropped)
    // id 6 -> DROPPED_FULL (newest dropped)
    const res2 = queue.enqueue(2);
    const res3 = queue.enqueue(3);
    const res4 = queue.enqueue(4);
    const res5 = queue.enqueue(5);
    const res6 = queue.enqueue(6);

    assert.equal(res2, 'QUEUED');
    assert.equal(res3, 'QUEUED');
    assert.equal(res4, 'QUEUED');
    assert.equal(res5, 'DROPPED_FULL');
    assert.equal(res6, 'DROPPED_FULL');

    // Unblock job 1 so waiting jobs (2, 3, 4) can process
    unblockProcessor!();
    await queue.whenIdle();

    // Verify exactly jobs 1, 2, 3, 4 processed; 5 and 6 never ran
    assert.deepEqual(processedIds, [1, 2, 3, 4]);
  });

  await t.test('Q2 DEDUPED for an id already waiting, QUEUED again for an id that is running', async () => {
    let unblock1: () => void;
    const job1Running = new Promise<void>((resolve) => {
      unblock1 = resolve;
    });

    let signalJob1Started: () => void;
    const job1Started = new Promise<void>((resolve) => {
      signalJob1Started = resolve;
    });

    const runCount: Record<number, number> = {};
    const queue = new SimilarityQueue(async (id: number) => {
      runCount[id] = (runCount[id] ?? 0) + 1;
      if (id === 10 && runCount[10] === 1) {
        signalJob1Started();
        await job1Running;
      }
    });

    const r1 = queue.enqueue(10);
    assert.equal(r1, 'QUEUED');
    await job1Started;

    // Enqueue 20 (waiting)
    const r2 = queue.enqueue(20);
    assert.equal(r2, 'QUEUED');

    // Enqueue 20 again while still waiting -> DEDUPED
    const r3 = queue.enqueue(20);
    assert.equal(r3, 'DEDUPED');

    // Enqueue 10 again while currently running -> QUEUED again
    const r4 = queue.enqueue(10);
    assert.equal(r4, 'QUEUED');

    unblock1!();
    await queue.whenIdle();

    assert.equal(runCount[10], 2);
    assert.equal(runCount[20], 1);
  });

  await t.test('Q3 max observed concurrency is 1 over 20 jobs', async () => {
    let active = 0;
    let maxObservedActive = 0;
    const queue = new SimilarityQueue(
      async () => {
        active++;
        if (active > maxObservedActive) {
          maxObservedActive = active;
        }
        await new Promise<void>((resolve) => setImmediate(resolve));
        active--;
      },
      { cap: 50 }
    );

    for (let i = 1; i <= 20; i++) {
      const res = queue.enqueue(i);
      assert.equal(res, 'QUEUED');
    }

    await queue.whenIdle();
    assert.equal(maxObservedActive, 1);
    assert.equal(active, 0);
  });

  await t.test('Q4 a throwing and a rejecting processor do not stop later jobs', async () => {
    const executed: number[] = [];
    const queue = new SimilarityQueue(async (id: number) => {
      executed.push(id);
      if (id === 100) {
        throw new Error('Sync throw');
      }
      if (id === 200) {
        return Promise.reject(new Error('Async rejection'));
      }
    });

    queue.enqueue(100);
    queue.enqueue(200);
    queue.enqueue(300);

    await queue.whenIdle();
    assert.deepEqual(executed, [100, 200, 300]);
  });

  await t.test('Q5 enqueue is synchronous, returns before processor starts', async () => {
    let callCount = 0;
    const queue = new SimilarityQueue(async () => {
      callCount++;
    });

    const res = queue.enqueue(999);
    assert.equal(res, 'QUEUED');
    // Processor must not have run synchronously
    assert.equal(callCount, 0);

    await queue.whenIdle();
    assert.equal(callCount, 1);
  });

  await t.test('Q6 stop(): in-flight finishes within drain, waiting cleared, later enqueue REJECTED_STOPPED', async () => {
    let unblockInFlight: () => void;
    const inFlightStarted = new Promise<void>((resolve) => {
      // trigger
    });
    let signalStarted: () => void;
    const startedPromise = new Promise<void>((r) => {
      signalStarted = r;
    });

    const executed: number[] = [];
    const queue = new SimilarityQueue(async (id: number) => {
      executed.push(id);
      if (id === 1) {
        signalStarted();
        await new Promise<void>((resolve) => {
          unblockInFlight = resolve;
        });
      }
    });

    queue.enqueue(1);
    await startedPromise;

    // Enqueue waiting jobs
    queue.enqueue(2);
    queue.enqueue(3);

    // Call stop with default/generous drain timeout
    const stopPromise = queue.stop({ drainTimeoutMs: SIMILARITY_STOP_DRAIN_MS });

    // Subsequent enqueue must return REJECTED_STOPPED
    const rejectRes = queue.enqueue(4);
    assert.equal(rejectRes, 'REJECTED_STOPPED');

    // Unblock job 1 so it finishes within drain timeout
    unblockInFlight!();
    const stopOutcome = await stopPromise;
    assert.equal(stopOutcome, 'DRAINED');

    // Waiting jobs 2 and 3 were cleared and never ran
    assert.deepEqual(executed, [1]);

    // Test ABANDONED when processor never resolves within drain timeout
    const hangingQueue = new SimilarityQueue(async () => {
      await new Promise<void>(() => {});
    });

    let hangStartedSignal: () => void;
    const hangStarted = new Promise<void>((r) => {
      hangStartedSignal = r;
    });
    const queueWithSignal = new SimilarityQueue(async () => {
      hangStartedSignal();
      await new Promise<void>(() => {});
    });

    queueWithSignal.enqueue(50);
    await hangStarted;

    const abandonedOutcome = await queueWithSignal.stop({ drainTimeoutMs: 1 });
    assert.equal(abandonedOutcome, 'ABANDONED');
    assert.equal(queueWithSignal.enqueue(51), 'REJECTED_STOPPED');
  });

  await t.test('Q7 whenIdle resolves after all jobs', async () => {
    let completed = 0;
    const queue = new SimilarityQueue(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
      completed++;
    });

    // whenIdle on empty queue resolves immediately
    await queue.whenIdle();
    assert.equal(completed, 0);

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    await queue.whenIdle();
    assert.equal(completed, 3);
  });
});
