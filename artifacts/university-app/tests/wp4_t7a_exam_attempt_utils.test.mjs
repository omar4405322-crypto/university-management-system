import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webSrcDir = path.resolve(__dirname, '../src');

async function loadProductionExamAttemptUtils() {
  const rootPackageJson = path.resolve(__dirname, '../../../package.json');
  const req = createRequire(rootPackageJson);
  const ts = req('typescript');

  const helperPath = path.join(webSrcDir, 'pages/exams/examAttempt.utils.ts');
  const source = fs.readFileSync(helperPath, 'utf8');

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const dataUri =
    'data:text/javascript;base64,' +
    Buffer.from(transpiled).toString('base64');
  return await import(dataUri);
}

describe('WP-4 Task T-7a: Web examAttempt.utils behaviour execution', () => {
  it('1. getMcqDisplayOptions renders server optionOrder with positional labels A-D and preserves original keys', async () => {
    const { getMcqDisplayOptions } = await loadProductionExamAttemptUtils();

    const questionWithShuffledOrder = {
      id: 101,
      text: 'What is 2 + 2?',
      optionA: 'Option Alpha (original A)',
      optionB: 'Option Beta (original B)',
      optionC: 'Option Gamma (original C)',
      optionD: 'Option Delta (original D)',
      optionOrder: ['optionC', 'optionA', 'optionD', 'optionB'],
    };

    const options = getMcqDisplayOptions(questionWithShuffledOrder);

    assert.equal(options.length, 4);
    assert.deepEqual(options[0], {
      displayLetter: 'A',
      originalKey: 'C',
      text: 'Option Gamma (original C)',
    });
    assert.deepEqual(options[1], {
      displayLetter: 'B',
      originalKey: 'A',
      text: 'Option Alpha (original A)',
    });
    assert.deepEqual(options[2], {
      displayLetter: 'C',
      originalKey: 'D',
      text: 'Option Delta (original D)',
    });
    assert.deepEqual(options[3], {
      displayLetter: 'D',
      originalKey: 'B',
      text: 'Option Beta (original B)',
    });
  });

  it('2. getMcqDisplayOptions falls back gracefully when optionOrder is absent', async () => {
    const { getMcqDisplayOptions } = await loadProductionExamAttemptUtils();

    const legacyQuestion = {
      id: 102,
      text: 'What is the capital of France?',
      optionA: 'Paris',
      optionB: 'London',
      optionC: 'Berlin',
      optionD: 'Madrid',
    };

    const options = getMcqDisplayOptions(legacyQuestion);

    assert.equal(options.length, 4);
    assert.deepEqual(options[0], { displayLetter: 'A', originalKey: 'A', text: 'Paris' });
    assert.deepEqual(options[1], { displayLetter: 'B', originalKey: 'B', text: 'London' });
    assert.deepEqual(options[2], { displayLetter: 'C', originalKey: 'C', text: 'Berlin' });
    assert.deepEqual(options[3], { displayLetter: 'D', originalKey: 'D', text: 'Madrid' });
  });

  it('3. calculateRemainingSeconds calculates remaining seconds using monotonic clock performance.now', async () => {
    const { calculateRemainingSeconds } = await loadProductionExamAttemptUtils();

    // Server time: 10:00:00Z
    // Attempt ends at: 10:30:00Z (30 minutes = 1800 seconds)
    const serverNow = '2026-10-25T10:00:00.000Z';
    const attemptEndsAt = '2026-10-25T10:30:00.000Z';

    // Monotonic timestamp when response was received (e.g. from performance.now)
    const clientReceivedPerfMs = 15234.5;

    // 100 seconds later (100,000 ms) in monotonic time
    const currentClientPerfMs = clientReceivedPerfMs + 100 * 1000;

    const remaining = calculateRemainingSeconds(
      attemptEndsAt,
      serverNow,
      clientReceivedPerfMs,
      currentClientPerfMs
    );

    // Remaining should be exactly 1800 - 100 = 1700 seconds
    assert.equal(remaining, 1700);

    // After attemptEndsAt has passed (e.g. 1900 seconds later in monotonic time)
    const expiredPerfMs = clientReceivedPerfMs + 1900 * 1000;
    const remainingExpired = calculateRemainingSeconds(
      attemptEndsAt,
      serverNow,
      clientReceivedPerfMs,
      expiredPerfMs
    );
    assert.equal(remainingExpired, 0);
  });

  it('4. shouldRefetchQuestions detects when reload occurs on PENDING attempt with empty question list', async () => {
    const { shouldRefetchQuestions } = await loadProductionExamAttemptUtils();

    assert.equal(shouldRefetchQuestions([], 'PENDING'), true);
    assert.equal(shouldRefetchQuestions(null, 'PENDING'), true);
    assert.equal(shouldRefetchQuestions(undefined, 'PENDING'), true);

    // Not pending or questions already present
    assert.equal(shouldRefetchQuestions([{ id: 1 }], 'PENDING'), false);
    assert.equal(shouldRefetchQuestions([], 'COMPLETED'), false);
    assert.equal(shouldRefetchQuestions([], 'SUBMITTED'), false);
    assert.equal(shouldRefetchQuestions([], 'CANCELLED'), false);
    assert.equal(shouldRefetchQuestions([], null), false);
  });

  it('5. resolveAttemptView maps submission status to attempt view and gates start button', async () => {
    const { resolveAttemptView, canStartExam } = await loadProductionExamAttemptUtils();

    // PENDING -> in progress
    assert.equal(resolveAttemptView('PENDING'), 'IN_PROGRESS');

    // COMPLETED / SUBMITTED / GRADED -> completed
    assert.equal(resolveAttemptView('COMPLETED'), 'COMPLETED');
    assert.equal(resolveAttemptView('SUBMITTED'), 'COMPLETED');
    assert.equal(resolveAttemptView('GRADED'), 'COMPLETED');

    // CANCELLED_CHEATING and every other cancelled status -> read-only cancelled view
    assert.equal(resolveAttemptView('CANCELLED_CHEATING'), 'CANCELLED');
    assert.equal(resolveAttemptView('CANCELLED'), 'CANCELLED');
    assert.equal(resolveAttemptView('CANCELLED_TIMEOUT'), 'CANCELLED');
    assert.equal(resolveAttemptView('CANCELLED_MANUAL'), 'CANCELLED');

    // No submission -> PREPARING
    assert.equal(resolveAttemptView(null), 'PREPARING');
    assert.equal(resolveAttemptView(undefined), 'PREPARING');
    assert.equal(resolveAttemptView(''), 'PREPARING');

    // The Start button renders ONLY when there is no submission
    assert.equal(canStartExam(false, 'PREPARING'), true);
    assert.equal(canStartExam(true, 'PREPARING'), false);
    assert.equal(canStartExam(true, 'IN_PROGRESS'), false);
    assert.equal(canStartExam(true, 'COMPLETED'), false);
    assert.equal(canStartExam(true, 'CANCELLED'), false);
  });
});
