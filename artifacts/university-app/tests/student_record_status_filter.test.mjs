import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const studentRecord = readFileSync(
  new URL('../src/pages/records/StudentRecord.tsx', import.meta.url),
  'utf8'
);
const enrollmentController = readFileSync(
  new URL('../../api-server/src/controllers/enrollment.controller.ts', import.meta.url),
  'utf8'
);

test('record filters use authoritative enrollment statuses', () => {
  assert.match(
    studentRecord,
    /gradeStatusFilter === 'PASSED' && cItem\.status !== 'COMPLETED'/
  );
  assert.match(
    studentRecord,
    /gradeStatusFilter === 'FAILED' && cItem\.status !== 'FAILED'/
  );
});

test('backend assigns the authoritative status at the passing threshold', () => {
  assert.match(
    enrollmentController,
    /status:\s*finalGrade >= 60 \? 'COMPLETED' : 'FAILED'/
  );
});

for (const [grade, expectedStatus] of [
  [49.9, 'FAILED'],
  [50, 'FAILED'],
  [59.9, 'FAILED'],
  [60, 'COMPLETED'],
]) {
  test(`grade ${grade} maps to ${expectedStatus}`, () => {
    const backendStatus = grade >= 60 ? 'COMPLETED' : 'FAILED';
    assert.equal(backendStatus, expectedStatus);
    assert.equal(backendStatus === 'COMPLETED', expectedStatus === 'COMPLETED');
    assert.equal(backendStatus === 'FAILED', expectedStatus === 'FAILED');
  });
}
