import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const filterBarSource = readFileSync(
  new URL('../src/pages/tasks/components/TasksFilterBar.tsx', import.meta.url),
  'utf8'
);

test('Item B: TasksFilterBar status and sort options strictly align with backend validators', () => {
  // Extract all <option value="..."> within TasksFilterBar
  const statusSelectMatch = filterBarSource.match(/updateParam\("status",\s*e\.target\.value\)([\s\S]*?)<\/select>/);
  assert.ok(statusSelectMatch, 'status select must be present');
  const statusBlock = statusSelectMatch[1];
  const statusOptions = Array.from(statusBlock.matchAll(/value="([^"]*)"/g)).map((m) => m[1]);

  // Extract sortBy options
  const sortSelectMatch = filterBarSource.match(/updateParam\("sortBy",\s*e\.target\.value\)([\s\S]*?)<\/select>/);
  assert.ok(sortSelectMatch, 'sortBy select must be present');
  const sortBlock = sortSelectMatch[1];
  const sortOptions = Array.from(sortBlock.matchAll(/value="([^"]*)"/g)).map((m) => m[1]);

  const ALLOWED_BACKEND_STATUSES = new Set(['', 'ACTIVE', 'OVERDUE']);
  const ALLOWED_BACKEND_SORTS = new Set([
    '',
    'DUE_DATE_ASC',
    'DUE_DATE_DESC',
    'CREATED_AT_ASC',
    'CREATED_AT_DESC',
    'SUBMISSIONS_COUNT_ASC',
    'SUBMISSIONS_COUNT_DESC',
  ]);

  // Verify no invalid status options exist
  assert.equal(statusOptions.includes('PENDING'), false, 'status select must not include PENDING');
  assert.equal(statusOptions.includes('COMPLETED'), false, 'status select must not include COMPLETED (no backend equivalent)');
  assert.ok(statusOptions.includes('ACTIVE'), 'status select must include ACTIVE');
  assert.ok(statusOptions.includes('OVERDUE'), 'status select must include OVERDUE');
  for (const opt of statusOptions) {
    assert.ok(
      ALLOWED_BACKEND_STATUSES.has(opt),
      `Status option "${opt}" must be accepted by backend task.routes.ts validator`
    );
  }

  // Verify no invalid sort options exist
  assert.equal(sortOptions.includes('due_asc'), false, 'sort select must not include due_asc');
  assert.equal(sortOptions.includes('due_desc'), false, 'sort select must not include due_desc');
  assert.equal(sortOptions.includes('created_desc'), false, 'sort select must not include created_desc');
  assert.ok(sortOptions.includes('DUE_DATE_ASC'), 'sort select must include DUE_DATE_ASC');
  assert.ok(sortOptions.includes('DUE_DATE_DESC'), 'sort select must include DUE_DATE_DESC');
  assert.ok(sortOptions.includes('CREATED_AT_DESC'), 'sort select must include CREATED_AT_DESC');
  for (const opt of sortOptions) {
    assert.ok(
      ALLOWED_BACKEND_SORTS.has(opt),
      `Sort option "${opt}" must be accepted by backend task.routes.ts validator`
    );
  }
});

