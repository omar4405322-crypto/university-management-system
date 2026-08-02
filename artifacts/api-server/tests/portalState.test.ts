import { evaluatePortalState, PortalState } from '../src/utils/portalState';

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    console.error(`❌ FAIL: ${message} (Expected ${expected}, got ${actual})`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

const now = new Date('2026-08-02T12:00:00Z');

// Test 1: MANUALLY_CLOSED takes priority
assertEqual(
  evaluatePortalState(
    {
      startDate: new Date('2026-08-01T00:00:00Z'),
      dueDate: new Date('2026-08-10T00:00:00Z'),
      isManuallyClosed: true,
    },
    now
  ),
  PortalState.MANUALLY_CLOSED,
  'Manually closed portal returns MANUALLY_CLOSED'
);

// Test 2: SCHEDULED before start date
assertEqual(
  evaluatePortalState(
    {
      startDate: new Date('2026-08-05T00:00:00Z'),
      dueDate: new Date('2026-08-10T00:00:00Z'),
      isManuallyClosed: false,
    },
    now
  ),
  PortalState.SCHEDULED,
  'Future start date returns SCHEDULED'
);

// Test 3: OPEN when between start date and due date
assertEqual(
  evaluatePortalState(
    {
      startDate: new Date('2026-08-01T00:00:00Z'),
      dueDate: new Date('2026-08-10T00:00:00Z'),
      isManuallyClosed: false,
    },
    now
  ),
  PortalState.OPEN,
  'Between start and due date returns OPEN'
);

// Test 4: CLOSED when after due date
assertEqual(
  evaluatePortalState(
    {
      startDate: new Date('2026-08-01T00:00:00Z'),
      dueDate: new Date('2026-08-01T18:00:00Z'),
      isManuallyClosed: false,
    },
    now
  ),
  PortalState.CLOSED,
  'Past due date returns CLOSED'
);

console.log('\n✨ ALL PORTAL STATE TESTS PASSED!');
