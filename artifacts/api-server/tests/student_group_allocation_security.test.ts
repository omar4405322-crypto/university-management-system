import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_STUDENT_GROUPS_PER_REQUEST,
  validatePositiveSafeInteger,
  validateRequestedGroupCount,
} from '../src/utils/studentGroupAllocation.utils';

for (const value of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
  assert.match(
    validatePositiveSafeInteger(value, 'numberOfGroups') ?? '',
    /positive safe integer/
  );
}
assert.equal(validatePositiveSafeInteger(1, 'numberOfGroups'), null);

assert.match(validateRequestedGroupCount(11, 10) ?? '', /cannot exceed 10/);
assert.match(
  validateRequestedGroupCount(MAX_STUDENT_GROUPS_PER_REQUEST + 1, 1_000) ?? '',
  /cannot exceed 500/
);
assert.equal(validateRequestedGroupCount(10, 10), null);

const controller = readFileSync(
  new URL('../src/controllers/studentGroups.controller.ts', import.meta.url),
  'utf8'
);
for (const marker of ['groupCountError', 'subgroupCountError']) {
  assert.ok(
    controller.indexOf(marker) < controller.indexOf('await prisma.$transaction', controller.indexOf(marker)),
    `${marker} must be checked before its transaction opens`
  );
}

console.log('SEC-43 student group allocation validation checks passed');
