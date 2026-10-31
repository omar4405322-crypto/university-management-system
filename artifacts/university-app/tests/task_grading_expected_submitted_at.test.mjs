import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const modalSource = readFileSync(
  new URL('../src/components/tasks/SubmissionsGradingModal.tsx', import.meta.url),
  'utf8'
);

test('Item A: SubmissionsGradingModal passes expectedSubmittedAt and handles 409 conflict refetch', () => {
  // 1. Must pass expectedSubmittedAt matching row.submission.submittedAt
  const expectedSubmittedAtMatch = modalSource.includes('expectedSubmittedAt: row.submission.submittedAt');
  assert.equal(
    expectedSubmittedAtMatch,
    true,
    'handleSave must send expectedSubmittedAt from row.submission.submittedAt'
  );

  // 2. SubmissionRowProps must accept onConflict callback
  assert.ok(
    /onConflict\??:\s*\(\)\s*=>\s*void/.test(modalSource),
    'SubmissionRowProps must declare onConflict callback'
  );

  // 3. handleSave catch block must detect 409 status and invoke onConflict
  assert.ok(
    modalSource.includes('409') && modalSource.includes('onConflict'),
    'handleSave must check 409 status and invoke onConflict callback'
  );

  // 4. Must use localized gradeConflictError message
  assert.ok(
    modalSource.includes('tasks.gradeConflictError'),
    'handleSave must use localized tasks.gradeConflictError key on conflict'
  );

  // 5. Parent SubmissionsGradingModal must wire onConflict to fetchData
  assert.ok(
    /<SubmissionRow[\s\S]*?onConflict=\{fetchData\}/.test(modalSource),
    'SubmissionsGradingModal must pass onConflict={fetchData} to SubmissionRow'
  );
});

