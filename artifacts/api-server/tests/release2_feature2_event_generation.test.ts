import prisma from '../src/utils/prismaClient';
import { TaskService } from '../src/services/task.service';
import TimelineService from '../src/services/timeline.service';
import { IEventDispatcher } from '../src/dispatchers/eventDispatcher.interface';
import { CreateActivityEventData, ActivityRepository } from '../src/repositories/activity.repository';
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

class TestMockDispatcher implements IEventDispatcher {
  public dispatchedEvents: CreateActivityEventData[] = [];
  async dispatch(eventData: CreateActivityEventData): Promise<void> {
    this.dispatchedEvents.push(eventData);
    await ActivityRepository.create(eventData);
  }

  clear() {
    this.dispatchedEvents = [];
  }
}

async function runTests() {
  console.log('=== RELEASE 2 FEATURE 2: AUTOMATIC TIMELINE EVENT GENERATION TESTS ===\n');

  const mockDispatcher = new TestMockDispatcher();
  TimelineService.setDispatcher(mockDispatcher);

  // Setup test environment (Doctor & Course)
  let doctorUser = await prisma.user.findFirst({ where: { role: 'DOCTOR' } });
  let course = await prisma.course.findFirst();

  if (!doctorUser || !course) {
    console.log('⚠️ Missing test doctor/course in database. Skipping live DB test execution.');
    return;
  }

  const dummyUser = { id: doctorUser.id, role: 'DOCTOR' };

  // Ensure doctor is assigned to course via ScheduleSlot or slot mock
  let doctorObj = await prisma.doctor.findUnique({ where: { userId: doctorUser.id } });
  if (doctorObj) {
    const slot = await prisma.scheduleSlot.findFirst({
      where: { courseId: course.id, doctorId: doctorObj.id },
    });
    if (!slot) {
      await prisma.scheduleSlot.create({
        data: {
          courseId: course.id,
          doctorId: doctorObj.id,
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '11:00',
          slotType: 'LECTURE',
        },
      });
    }
  }

  // 1. Test Assignment Creation Event
  mockDispatcher.clear();
  const futureDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const createdTask = await TaskService.createTask(dummyUser, {
    title: 'Test Timeline Task ' + Date.now(),
    description: 'Testing event generation on creation',
    courseId: course.id,
    dueDate: futureDueDate,
    maxScore: 100,
  });

  assertEqual(mockDispatcher.dispatchedEvents.length, 1, 'TaskService.createTask generates exactly 1 timeline event');
  assertEqual(
    mockDispatcher.dispatchedEvents[0].eventType,
    ActivityEventType.ASSIGNMENT_CREATED,
    'Generated event type is ASSIGNMENT_CREATED'
  );
  assertEqual(
    mockDispatcher.dispatchedEvents[0].visibility,
    EventVisibility.STUDENTS,
    'ASSIGNMENT_CREATED visibility is STUDENTS'
  );
  assertEqual(
    mockDispatcher.dispatchedEvents[0].severity,
    EventSeverity.INFO,
    'ASSIGNMENT_CREATED severity is INFO'
  );

  // 2. Test Deadline Extension Event
  mockDispatcher.clear();
  const extendedDueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const extendedTask = await TaskService.extendDeadline(
    dummyUser,
    createdTask.id,
    extendedDueDate
  );

  assertEqual(mockDispatcher.dispatchedEvents.length, 1, 'TaskService.extendDeadline generates exactly 1 timeline event');
  assertEqual(
    mockDispatcher.dispatchedEvents[0].eventType,
    ActivityEventType.DEADLINE_EXTENDED,
    'Generated event type is DEADLINE_EXTENDED'
  );
  assertEqual(
    mockDispatcher.dispatchedEvents[0].severity,
    EventSeverity.IMPORTANT,
    'DEADLINE_EXTENDED severity is IMPORTANT'
  );
  assertEqual(
    mockDispatcher.dispatchedEvents[0].diffPayload !== null,
    true,
    'DEADLINE_EXTENDED includes diffPayload'
  );

  // 3. Test Portal Close Event
  mockDispatcher.clear();
  await TaskService.togglePortalState(dummyUser, createdTask.id, 'CLOSE');

  assertEqual(mockDispatcher.dispatchedEvents.length, 1, 'TaskService.togglePortalState CLOSE generates exactly 1 event');
  assertEqual(
    mockDispatcher.dispatchedEvents[0].eventType,
    ActivityEventType.PORTAL_CLOSED,
    'Generated event type is PORTAL_CLOSED'
  );
  assertEqual(
    mockDispatcher.dispatchedEvents[0].severity,
    EventSeverity.WARNING,
    'PORTAL_CLOSED severity is WARNING'
  );

  // 4. Test Portal Reopen Event
  mockDispatcher.clear();
  await TaskService.togglePortalState(dummyUser, createdTask.id, 'REOPEN');

  assertEqual(mockDispatcher.dispatchedEvents.length, 1, 'TaskService.togglePortalState REOPEN generates exactly 1 event');
  assertEqual(
    mockDispatcher.dispatchedEvents[0].eventType,
    ActivityEventType.PORTAL_OPENED,
    'Generated event type is PORTAL_OPENED'
  );

  // 5. Test Failed Operations generate 0 events
  mockDispatcher.clear();
  try {
    // Attempt invalid past date extension
    await TaskService.extendDeadline(
      dummyUser,
      createdTask.id,
      new Date('2020-01-01T00:00:00Z')
    );
  } catch (e) {
    // Expected validation error
  }
  assertEqual(
    mockDispatcher.dispatchedEvents.length,
    0,
    'Failed business operations do NOT generate timeline events'
  );

  // Clean up created test task
  await prisma.task.delete({ where: { id: createdTask.id } });

  console.log('\n✨ ALL RELEASE 2 FEATURE 2 EVENT GENERATION TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
