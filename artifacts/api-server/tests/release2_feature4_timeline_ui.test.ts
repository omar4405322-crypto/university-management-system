import prisma from '../src/utils/prismaClient';
import TimelineService from '../src/services/timeline.service';
import { ActivityRepository } from '../src/repositories/activity.repository';
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
  console.log('=== RELEASE 2 FEATURE 4: TIMELINE UI INTEGRATION & CONTRACT TESTS ===\n');

  let course = await prisma.course.findFirst();
  let doctorUser = await prisma.user.findFirst({ where: { role: 'DOCTOR' } });

  if (!course || !doctorUser) {
    console.log('⚠️ Missing test course or doctor user. Skipping DB execution.');
    return;
  }

  let doctorObj = await prisma.doctor.findUnique({ where: { userId: doctorUser.id } });
  if (!doctorObj) {
    doctorObj = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        firstName: 'Test',
        lastName: 'Doctor',
        doctorId: 'DOC_UI_' + Date.now(),
      },
    });
  }

  // Create test dummy task
  const testTask = await prisma.task.create({
    data: {
      title: 'UI Integration Task ' + Date.now(),
      description: 'Testing frontend timeline integration contracts',
      course: { connect: { id: course.id } },
      doctor: { connect: { id: doctorObj.id } },
      dueDate: new Date(Date.now() + 86400000),
      maxScore: 100,
    },
  });

  // 1. Test Empty State Response (0 events created yet)
  const emptyTimeline = await TimelineService.getTaskTimeline(
    { role: 'DOCTOR' },
    testTask.id
  );
  assertEqual(emptyTimeline.events.length, 0, 'Empty timeline returns 0 events for empty state');
  assertEqual(emptyTimeline.pagination.hasMore, false, 'Empty timeline hasMore is false');

  // Seed events for testing pagination & UI filters
  await ActivityRepository.create({
    entityType: ActivityEntityType.TASK,
    entityId: testTask.id,
    courseId: course.id,
    eventType: ActivityEventType.ASSIGNMENT_CREATED,
    severity: EventSeverity.INFO,
    visibility: EventVisibility.STUDENTS,
    title: 'Assignment Created',
    summary: 'Assignment created by instructor',
  });

  await ActivityRepository.create({
    entityType: ActivityEntityType.TASK,
    entityId: testTask.id,
    courseId: course.id,
    eventType: ActivityEventType.DEADLINE_EXTENDED,
    severity: EventSeverity.IMPORTANT,
    visibility: EventVisibility.STUDENTS,
    title: 'Deadline Extended',
    summary: 'Deadline extended by 3 days',
    diffPayload: { previousDueDate: '2026-08-10', newDueDate: '2026-08-13' },
  });

  await ActivityRepository.create({
    entityType: ActivityEntityType.TASK,
    entityId: testTask.id,
    courseId: course.id,
    eventType: ActivityEventType.PORTAL_CLOSED,
    severity: EventSeverity.WARNING,
    visibility: EventVisibility.STUDENTS,
    title: 'Portal Closed',
    summary: 'Submission portal manually closed',
  });

  // 2. Test Timeline Query with UI Params (Limit 2 for pagination test)
  const page1 = await TimelineService.getTaskTimeline(
    { role: 'DOCTOR' },
    testTask.id,
    { limit: 2 }
  );
  assertEqual(page1.events.length, 2, 'Page 1 returns limit 2 events');
  assertEqual(page1.pagination.hasMore, true, 'Page 1 hasMore is true');
  assertEqual(typeof page1.pagination.nextCursor, 'number', 'Page 1 returns nextCursor ID for pagination');

  // Page 2 using cursor from Page 1
  const page2 = await TimelineService.getTaskTimeline(
    { role: 'DOCTOR' },
    testTask.id,
    { limit: 2, cursorId: page1.pagination.nextCursor! }
  );
  assertEqual(page2.events.length, 1, 'Page 2 appends remaining 1 event');
  assertEqual(page2.pagination.hasMore, false, 'Page 2 hasMore is false');

  // 3. Test Filter Reset Pagination
  const warningFiltered = await TimelineService.getTaskTimeline(
    { role: 'DOCTOR' },
    testTask.id,
    { severity: EventSeverity.WARNING }
  );
  assertEqual(warningFiltered.events.length, 1, 'Filter reset returns 1 matching WARNING event');
  assertEqual(warningFiltered.events[0].eventType, ActivityEventType.PORTAL_CLOSED, 'Matching event is PORTAL_CLOSED');

  // Cleanup test task
  await prisma.task.delete({ where: { id: testTask.id } });

  console.log('\n✨ ALL RELEASE 2 FEATURE 4 TIMELINE UI TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
