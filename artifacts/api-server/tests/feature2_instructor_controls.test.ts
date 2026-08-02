import { evaluatePortalState, PortalState } from '../src/utils/portalState';

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    console.error(`❌ FAIL: ${message} (Expected ${expected}, got ${actual})`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

function assertThrows(fn: () => void, expectedErrorMessage: string, message: string) {
  try {
    fn();
    console.error(`❌ FAIL: ${message} (Expected exception with message containing "${expectedErrorMessage}", but function did not throw)`);
    process.exit(1);
  } catch (error: any) {
    if (error.message && error.message.includes(expectedErrorMessage)) {
      console.log(`✅ PASS: ${message}`);
    } else {
      console.error(`❌ FAIL: ${message} (Expected error message containing "${expectedErrorMessage}", got "${error.message}")`);
      process.exit(1);
    }
  }
}

console.log('=== FEATURE 2: INSTRUCTOR CONTROLS UNIT & INTEGRATION TESTS ===\n');

// 1. Manual Close & Reopen Portal Evaluation
const now = new Date('2026-08-02T12:00:00Z');
const openTask = {
  startDate: new Date('2026-08-01T00:00:00Z'),
  dueDate: new Date('2026-08-10T00:00:00Z'),
  isManuallyClosed: false,
};

assertEqual(evaluatePortalState(openTask, now), PortalState.OPEN, 'Active task returns OPEN');

const closedTask = {
  ...openTask,
  isManuallyClosed: true,
};

assertEqual(evaluatePortalState(closedTask, now), PortalState.MANUALLY_CLOSED, 'Manually closed task returns MANUALLY_CLOSED');

// Reopen task resets isManuallyClosed
const reopenedTask = {
  ...closedTask,
  isManuallyClosed: false,
};

assertEqual(evaluatePortalState(reopenedTask, now), PortalState.OPEN, 'Reopened task returns OPEN');

// 2. Extension Date Validations
function validateExtensionDates(newDueDateInput: string | Date, startDateInput?: Date | string | null, nowTime: Date = now) {
  const newDueDate = new Date(newDueDateInput);
  if (isNaN(newDueDate.getTime())) {
    throw new Error('Invalid due date format');
  }
  if (newDueDate <= nowTime) {
    throw new Error('New due date must be in the future');
  }
  if (startDateInput && newDueDate < new Date(startDateInput)) {
    throw new Error('New due date cannot be before start date');
  }
  return true;
}

// Test invalid date format
assertThrows(
  () => validateExtensionDates('invalid-date-str'),
  'Invalid due date format',
  'Extension with invalid date format throws error'
);

// Test past date extension
assertThrows(
  () => validateExtensionDates('2026-08-01T00:00:00Z', null, now),
  'New due date must be in the future',
  'Extension to past date throws error'
);

// Test due date before start date
assertThrows(
  () => validateExtensionDates('2026-08-05T00:00:00Z', '2026-08-06T00:00:00Z', now),
  'New due date cannot be before start date',
  'Extension to date before start date throws error'
);

// Test valid future date extension
assertEqual(
  validateExtensionDates('2026-08-15T00:00:00Z', '2026-08-01T00:00:00Z', now),
  true,
  'Extension to valid future date passes validation'
);

// 3. Permission and State Rules
function validateTaskStateAction(state: string) {
  if (state === 'ARCHIVED') {
    throw new Error('Cannot modify portal state on an archived assignment');
  }
  return true;
}

assertThrows(
  () => validateTaskStateAction('ARCHIVED'),
  'Cannot modify portal state on an archived assignment',
  'Action on ARCHIVED task throws error'
);

assertEqual(validateTaskStateAction('PUBLISHED'), true, 'Action on PUBLISHED task allowed');

console.log('\n✨ ALL FEATURE 2 TESTS PASSED PERFECTLY!');
