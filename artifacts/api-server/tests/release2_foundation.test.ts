import { ActivityRepository, CreateActivityEventData } from '../src/repositories/activity.repository';
import { IEventDispatcher } from '../src/dispatchers/eventDispatcher.interface';
import { LocalEventDispatcher } from '../src/dispatchers/localEventDispatcher';
import { TimelineService } from '../src/services/timeline.service';
import {
  ActivityEntityType,
  ActivityEventType,
  EventVisibility,
  EventSeverity,
} from '@prisma/client';

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    console.error(`❌ FAIL: ${message} (Expected ${expected}, got ${actual})`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runTests() {
  console.log('=== RELEASE 2 FEATURE 1: FOUNDATION UNIT TESTS ===\n');

  // Test 1: Direct ActivityRepository creation and retrieval
  const testEventData: CreateActivityEventData = {
    entityType: ActivityEntityType.TASK,
    entityId: 9999, // Test dummy entity ID
    courseId: 1,
    eventType: ActivityEventType.DEADLINE_EXTENDED,
    severity: EventSeverity.IMPORTANT,
    visibility: EventVisibility.STUDENTS,
    title: 'Deadline Extended',
    summary: 'Deadline extended by 2 days by Test Doctor.',
    diffPayload: { oldDueDate: '2026-08-10', newDueDate: '2026-08-12' },
  };

  const createdRecord = await ActivityRepository.create(testEventData);
  assertEqual(createdRecord.entityType, ActivityEntityType.TASK, 'Repository creates ActivityTimelineEvent record');
  assertEqual(createdRecord.eventType, ActivityEventType.DEADLINE_EXTENDED, 'Record contains correct eventType enum');
  assertEqual(createdRecord.title, 'Deadline Extended', 'Record contains correct title');

  const fetchedRecords = await ActivityRepository.findByEntity(ActivityEntityType.TASK, 9999);
  assertEqual(fetchedRecords.length >= 1, true, 'Repository fetches created records by entity');

  // Test 2: Mock IEventDispatcher Injection in TimelineService
  class MockEventDispatcher implements IEventDispatcher {
    public dispatchedEvents: CreateActivityEventData[] = [];
    async dispatch(eventData: CreateActivityEventData): Promise<void> {
      this.dispatchedEvents.push(eventData);
    }
  }

  const mockDispatcher = new MockEventDispatcher();
  TimelineService.setDispatcher(mockDispatcher);

  const eventToRecord: CreateActivityEventData = {
    entityType: ActivityEntityType.TASK,
    entityId: 8888,
    courseId: 1,
    eventType: ActivityEventType.PORTAL_CLOSED,
    title: 'Portal Closed',
    summary: 'Submission portal manually closed.',
  };

  await TimelineService.recordEvent(eventToRecord);

  assertEqual(mockDispatcher.dispatchedEvents.length, 1, 'TimelineService dispatches event to registered IEventDispatcher');
  assertEqual(mockDispatcher.dispatchedEvents[0].eventType, ActivityEventType.PORTAL_CLOSED, 'Mock dispatcher receives correct payload');

  // Test 3: LocalEventDispatcher instance check
  const localDispatcher = new LocalEventDispatcher();
  TimelineService.setDispatcher(localDispatcher);
  assertEqual(TimelineService.getDispatcher() instanceof LocalEventDispatcher, true, 'TimelineService accepts LocalEventDispatcher');

  console.log('\n✨ ALL RELEASE 2 FOUNDATION TESTS PASSED PERFECTLY!');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
