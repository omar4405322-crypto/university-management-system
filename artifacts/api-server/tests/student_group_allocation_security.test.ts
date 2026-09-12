import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  MAX_STUDENT_GROUPS_PER_REQUEST,
  validatePositiveSafeInteger,
  validateRequestedGroupCount,
} from '../src/utils/studentGroupAllocation.utils';

for (const [caseName, value] of [
  ['zero', 0],
  ['negative', -1],
  ['fractional', 1.5],
  ['NaN', Number.NaN],
  ['unsafe-integer', Number.MAX_SAFE_INTEGER + 1],
] as const) {
  test(`rejects ${caseName}`, () => {
    assert.match(
      validatePositiveSafeInteger(value, 'numberOfGroups') ?? '',
      /positive safe integer/
    );
  });
}

test('rejects cap+1', () => {
  assert.match(
    validateRequestedGroupCount(MAX_STUDENT_GROUPS_PER_REQUEST + 1, 1_000) ?? '',
    /cannot exceed 500/
  );
});

test('accepts a positive safe integer', () => {
  assert.equal(validatePositiveSafeInteger(1, 'numberOfGroups'), null);
});

test('enforces the dynamic per-cohort cap', () => {
  assert.match(validateRequestedGroupCount(11, 10) ?? '', /cannot exceed 10/);
  assert.equal(validateRequestedGroupCount(10, 10), null);
});

const controller = readFileSync(
  new URL('../src/controllers/studentGroups.controller.ts', import.meta.url),
  'utf8'
);
test('checks allocation caps before transactions open', () => {
  for (const marker of ['groupCountError', 'subgroupCountError']) {
    assert.ok(
      controller.indexOf(marker) < controller.indexOf('await prisma.$transaction', controller.indexOf(marker)),
      `${marker} must be checked before its transaction opens`
    );
  }
});
