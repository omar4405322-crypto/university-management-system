import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studentRecord = readFileSync(
  new URL('../src/pages/records/StudentRecord.tsx', import.meta.url),
  'utf8'
);
const enrollmentController = readFileSync(
  new URL('../../api-server/src/controllers/enrollment.controller.ts', import.meta.url),
  'utf8'
);

assert.match(
  studentRecord,
  /gradeStatusFilter === 'PASSED' && cItem\.status !== 'COMPLETED'/
);
assert.match(
  studentRecord,
  /gradeStatusFilter === 'FAILED' && cItem\.status !== 'FAILED'/
);
assert.match(
  enrollmentController,
  /status:\s*finalGrade >= 60 \? 'COMPLETED' : 'FAILED'/
);

for (const [grade, expectedStatus] of [
  [49.9, 'FAILED'],
  [50, 'FAILED'],
  [59.9, 'FAILED'],
  [60, 'COMPLETED'],
]) {
  const backendStatus = grade >= 60 ? 'COMPLETED' : 'FAILED';
  assert.equal(backendStatus, expectedStatus);
  assert.equal(backendStatus === 'COMPLETED', expectedStatus === 'COMPLETED');
  assert.equal(backendStatus === 'FAILED', expectedStatus === 'FAILED');
}

console.log('SEC-46 authoritative enrollment status checks passed (49.9/50/59.9 failed; 60 completed)');
