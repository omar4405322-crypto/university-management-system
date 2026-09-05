import assert from 'node:assert/strict';
import type { NextFunction, Request, Response } from 'express';
import { enforcePaginationBounds } from '../src/middleware/requestLimits.middleware';
import {
  isBoundedAnswerCollection,
  isBoundedAntiCheatLogCollection,
  MAX_ANSWER_ITEMS,
  MAX_ANTI_CHEAT_LOGS,
  MAX_PAGE_NUMBER,
  MAX_PAGE_SIZE,
} from '../src/utils/requestLimits';

function runPaginationGuard(query: Record<string, unknown>): {
  error: Error | undefined;
  query: Record<string, unknown>;
} {
  let result: Error | undefined;
  const request = { query } as unknown as Request;
  enforcePaginationBounds(
    request,
    {} as Response,
    ((error?: Error) => {
      result = error;
    }) as NextFunction
  );
  return { error: result, query: request.query as Record<string, unknown> };
}

function runRequestLimitSecurityTests() {
  assert.equal(runPaginationGuard({}).error, undefined);
  assert.equal(
    runPaginationGuard({ page: '1', limit: String(MAX_PAGE_SIZE) }).error,
    undefined
  );

  for (const value of ['0', '-1', '1.5', '1e2', 'Infinity', 'NaN', '', ['10']]) {
    assert.ok(runPaginationGuard({ limit: value }).error, `Expected limit=${String(value)} to fail`);
  }
  const clamped = runPaginationGuard({ page: '2', limit: String(MAX_PAGE_SIZE + 1) });
  assert.equal(clamped.error, undefined);
  assert.deepEqual(clamped.query, { page: '2', limit: String(MAX_PAGE_SIZE) });
  assert.ok(runPaginationGuard({ page: String(MAX_PAGE_NUMBER + 1) }).error);

  assert.equal(isBoundedAnswerCollection({ 1: 'A', 2: 'short answer' }), true);
  assert.equal(isBoundedAnswerCollection([{ questionId: 1, answer: 'A' }]), true);
  assert.equal(
    isBoundedAnswerCollection(
      Array.from({ length: MAX_ANSWER_ITEMS + 1 }, (_, index) => ({
        questionId: index + 1,
        answer: 'A',
      }))
    ),
    false
  );
  assert.equal(isBoundedAnswerCollection({ 1: 'x'.repeat(4_001) }), false);
  assert.equal(
    isBoundedAnswerCollection([{ questionId: 1, answer: 'A', ignoredLargeField: 'x' }]),
    false
  );

  assert.equal(
    isBoundedAntiCheatLogCollection([
      { type: 'TAB_SWITCH', occurredAt: '2026-09-05T10:00:00.000Z', details: 'blur' },
    ]),
    true
  );
  assert.equal(
    isBoundedAntiCheatLogCollection(
      Array.from({ length: MAX_ANTI_CHEAT_LOGS + 1 }, () => ({ type: 'BLUR' }))
    ),
    false
  );
  assert.equal(
    isBoundedAntiCheatLogCollection([{ type: 'BLUR', details: 'x'.repeat(2_001) }]),
    false
  );
}

runRequestLimitSecurityTests();
console.log('Request limit security checks passed');
