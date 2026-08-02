import prisma from '../src/utils/prismaClient';
import TimelineService from '../src/services/timeline.service';
import { ActivityRepository } from '../src/repositories/activity.repository';
import { serializeTimelineEvent } from '../src/serializers/timeline.serializer';
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
  console.log('=== RELEASE 2 FEATURE 3: TIMELINE API & SERIALIZATION TESTS ===\n');

  let course = await prisma.course.findFirst();
  let doctorUser = await prisma.user.findFirst({ where: { role: 'DOCTOR' } });

  if (!course || !doctorUser) {
    console.log('⚠️ Skipping tests: Course or Doctor missing in DB.');
    return;
  }

  let doctorObj = await prisma.doctor.findUnique({ where: { userId: doctorUser.id } });
  if (!doctorObj) {
    doctorObj = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        firstName: 'Test',
        lastName: 'Doctor',
        doctorId: 'DOC_' + Date.now(),
      },
    });
  }

  const dummyTask = await prisma.task.create({
    data: {
      title: 'Timeline API Test Task ' + Date.now(),
      description: 'Testing API endpoints and serializers',
      course: { connect: { id: course.id } },
      doctor: { connect: { id: doctorObj.id } },
      dueDate: new Date(Date.now() + 86400000),
      maxScore: 100,
    },
  });

  // Seed sample timeline events with various visibilities and severities
  await ActivityRepository.create({
    entityType: ActivityEntityType.TASK,
    entityId: dummyTask.id,
    courseId: course.id,
    eventType: ActivityEventType.ASSIGNMENT_CREATED,
    severity: EventSeverity.INFO,
    visibility: EventVisibility.STUDENTS,
    title: 'Assignment Created',
    summary: 'Assignment created by instructor',
  });

  await ActivityRepository.create({
    entityType: ActivityEntityType.TASK,
    entityId: dummyTask.id,
    courseId: course.id,
    eventType: ActivityEventType.MAX_SCORE_UPDATED,
    severity: EventSeverity.INFO,
    visibility: EventVisibility.INSTRUCTORS,
    title: 'Max Score Updated',
    summary: 'Internal grading change',
  });

  await ActivityRepository.create({
    entityType: ActivityEntityType.TASK,
    entityId: dummyTask.id,
    courseId: course.id,
    eventType: ActivityEventType.DEADLINE_EXTENDED,
    severity: EventSeverity.IMPORTANT,
    visibility: EventVisibility.STUDENTS,
    title: 'Deadline Extended',
    summary: 'Deadline extended by 2 days',
    diffPayload: { previousDueDate: '2026-08-10', newDueDate: '2026-08-12' },
  });

  // 1. Test Serializer DTO mapping
  const rawEvents = await ActivityRepository.findByEntity(ActivityEntityType.TASK, dummyTask.id);
  const dto = serializeTimelineEvent(rawEvents.events[0]);
  assertEqual(typeof dto.id, 'number', 'Serializer maps id as number');
  assertEqual(typeof dto.summary, 'string', 'Serializer maps summary as string');
  assertEqual(typeof dto.actor.name, 'string', 'Serializer maps actor.name');
  assertEqual(dto.relatedEntityRefs !== undefined, true, 'Serializer exposes clean relatedEntityRefs DTO');

  // 2. Test Student Role Visibility Filtering (Student should NOT see INSTRUCTORS visibility event)
  const studentResult = await TimelineService.getTaskTimeline(
    { role: 'STUDENT' },
    dummyTask.id
  );
  assertEqual(
    studentResult.events.some((e: any) => e.visibility === 'INSTRUCTORS'),
    false,
    'Student role cannot see INSTRUCTORS-only events'
  );
  assertEqual(
    studentResult.events.length,
    2,
    'Student role receives 2 student-visible events'
  );

  // 3. Test Instructor Role Visibility Filtering (Doctor should see INSTRUCTORS events)
  const doctorResult = await TimelineService.getTaskTimeline(
    { role: 'DOCTOR' },
    dummyTask.id
  );
  assertEqual(
    doctorResult.events.length,
    3,
    'Doctor role receives all 3 instructor-visible events'
  );

  // 4. Test EventType Filter
  const filteredTypeResult = await TimelineService.getTaskTimeline(
    { role: 'DOCTOR' },
    dummyTask.id,
    { eventType: ActivityEventType.DEADLINE_EXTENDED }
  );
  assertEqual(filteredTypeResult.events.length, 1, 'eventType filter returns matching events only');
  assertEqual(
    filteredTypeResult.events[0].eventType,
    ActivityEventType.DEADLINE_EXTENDED,
    'Filtered event is DEADLINE_EXTENDED'
  );

  // 5. Test Severity Filter
  const filteredSeverityResult = await TimelineService.getTaskTimeline(
    { role: 'DOCTOR' },
    dummyTask.id,
    { severity: EventSeverity.IMPORTANT }
  );
  assertEqual(filteredSeverityResult.events.length, 1, 'severity filter returns matching events only');
  assertEqual(
    filteredSeverityResult.events[0].severity,
    EventSeverity.IMPORTANT,
    'Filtered event severity is IMPORTANT'
  );

  // 6. Test Cursor Pagination (Limit 1)
  const page1 = await TimelineService.getTaskTimeline(
    { role: 'DOCTOR' },
    dummyTask.id,
    { limit: 1 }
  );
  assertEqual(page1.events.length, 1, 'Page 1 limit 1 returns 1 event');
  assertEqual(page1.pagination.hasMore, true, 'Page 1 hasMore is true');
  assertEqual(typeof page1.pagination.nextCursor, 'number', 'Page 1 returns valid nextCursor ID');

  const page2 = await TimelineService.getTaskTimeline(
    { role: 'DOCTOR' },
    dummyTask.id,
    { limit: 1, cursorId: page1.pagination.nextCursor! }
  );
  assertEqual(page2.events.length, 1, 'Page 2 limit 1 returns 1 event');
  assertEqual(page2.events[0].id < page1.events[0].id, true, 'Page 2 event ID is smaller than Page 1 event ID');

  // 7. Test Invalid Task Error
  try {
    await TimelineService.getTaskTimeline({ role: 'STUDENT' }, 9999999);
    assertEqual(true, false, 'Invalid task ID should throw error');
  } catch (e: any) {
    assertEqual(e.message, 'Task not found', 'Invalid task ID throws Task not found error');
  }

  // Cleanup test task
  await prisma.task.delete({ where: { id: dummyTask.id } });

  console.log('\n✨ ALL RELEASE 2 FEATURE 3 TIMELINE API TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
