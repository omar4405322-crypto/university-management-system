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
  console.log('=== RELEASE 2 FEATURE 5: GLOBAL COURSE TIMELINE TESTS ===\n');

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
        doctorId: 'DOC_CRS_' + Date.now(),
      },
    });
  }

  // Create 2 test tasks under the same course
  const task1 = await prisma.task.create({
    data: {
      title: 'Course Task 1 ' + Date.now(),
      description: 'Task 1 for course timeline test',
      course: { connect: { id: course.id } },
      doctor: { connect: { id: doctorObj.id } },
      dueDate: new Date(Date.now() + 86400000),
      maxScore: 100,
    },
  });

  const task2 = await prisma.task.create({
    data: {
      title: 'Course Task 2 ' + Date.now(),
      description: 'Task 2 for course timeline test',
      course: { connect: { id: course.id } },
      doctor: { connect: { id: doctorObj.id } },
      dueDate: new Date(Date.now() + 172800000),
      maxScore: 100,
    },
  });

  // Seed events for task1 and task2 under the same course
  await ActivityRepository.create({
    entityType: ActivityEntityType.TASK,
    entityId: task1.id,
    courseId: course.id,
    eventType: ActivityEventType.ASSIGNMENT_CREATED,
    severity: EventSeverity.INFO,
    visibility: EventVisibility.STUDENTS,
    title: 'Assignment 1 Created',
    summary: 'Task 1 created in course',
  });

  await ActivityRepository.create({
    entityType: ActivityEntityType.TASK,
    entityId: task2.id,
    courseId: course.id,
    eventType: ActivityEventType.DEADLINE_EXTENDED,
    severity: EventSeverity.IMPORTANT,
    visibility: EventVisibility.STUDENTS,
    title: 'Assignment 2 Extended',
    summary: 'Task 2 deadline extended in course',
  });

  await ActivityRepository.create({
    entityType: ActivityEntityType.TASK,
    entityId: task2.id,
    courseId: course.id,
    eventType: ActivityEventType.MAX_SCORE_UPDATED,
    severity: EventSeverity.INFO,
    visibility: EventVisibility.INSTRUCTORS,
    title: 'Task 2 Grading Policy Updated',
    summary: 'Internal doctor note',
  });

  // 1. Test Global Course Feed aggregations for Doctor
  const doctorCourseFeed = await TimelineService.getCourseTimeline(
    { role: 'DOCTOR' },
    course.id
  );
  assertEqual(
    doctorCourseFeed.events.length >= 3,
    true,
    'Doctor course timeline aggregates events across multiple tasks'
  );

  // 2. Test Student Role Visibility Filtering (Student should not see INSTRUCTORS events)
  const studentCourseFeed = await TimelineService.getCourseTimeline(
    { role: 'STUDENT' },
    course.id
  );
  assertEqual(
    studentCourseFeed.events.some((e: any) => e.visibility === 'INSTRUCTORS'),
    false,
    'Student role cannot view INSTRUCTORS events in course timeline'
  );

  // 3. Test Invalid Course 404
  try {
    await TimelineService.getCourseTimeline({ role: 'STUDENT' }, 9999999);
    assertEqual(true, false, 'Invalid course ID should throw error');
  } catch (e: any) {
    assertEqual(e.message, 'Course not found', 'Invalid course ID throws Course not found error');
  }

  // Cleanup test tasks
  await prisma.task.delete({ where: { id: task1.id } });
  await prisma.task.delete({ where: { id: task2.id } });

  console.log('\n✨ ALL RELEASE 2 FEATURE 5 GLOBAL COURSE TIMELINE TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
