import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { createSchedule, updateSchedule } from '../src/controllers/schedules.controller';
import { AuthorizationError } from '../src/utils/appError';
import { requireExistingCourseStaffAssignments } from '../src/utils/scheduleAssignment.utils';

async function captureControllerError(controller: any, request: Record<string, unknown>) {
  return new Promise<unknown>((resolve, reject) => {
    const response = {
      status: () => response,
      json: () => reject(new Error('Expected the schedule mutation to be rejected')),
    };
    controller(request, response, (error?: unknown) => resolve(error));
  });
}

async function runScheduleAssignmentSecurityTests() {
  const assignmentQueries: any[] = [];
  const assignmentClient = {
    scheduleSlot: {
      findFirst: async (args: any) => {
        assignmentQueries.push(args);
        return null;
      },
    },
  };

  await assert.rejects(
    requireExistingCourseStaffAssignments(assignmentClient, {
      courseId: 41,
      doctorId: 12,
      excludeSlotId: 5,
    }),
    AuthorizationError
  );
  assert.deepEqual(assignmentQueries[0], {
    where: { courseId: 41, doctorId: 12, id: { not: 5 } },
    select: { id: true },
  });

  assignmentQueries.length = 0;
  await assert.rejects(
    requireExistingCourseStaffAssignments(assignmentClient, {
      courseId: 41,
      teachingAssistantId: 'ta-12',
    }),
    AuthorizationError
  );
  assert.deepEqual(assignmentQueries[0], {
    where: { courseId: 41, teachingAssistantId: 'ta-12' },
    select: { id: true },
  });

  const originalCourseFindUnique = prisma.course.findUnique;
  const originalDoctorFindUnique = prisma.doctor.findUnique;
  const originalTimetableFindFirst = prisma.timetable.findFirst;
  const originalScheduleSlotFindUnique = prisma.scheduleSlot.findUnique;
  const originalTransaction = prisma.$transaction;
  let transactionCalled = false;
  let capturedAssignmentWhere: unknown;

  try {
    (prisma.course as any).findUnique = async () => ({
      id: 41,
      departmentId: 7,
      year: 2,
      semester: 1,
      department: { id: 7, collegeId: 3 },
    });
    (prisma.doctor as any).findUnique = async () => ({ id: 12, userId: 99 });
    (prisma.timetable as any).findFirst = async () => null;
    (prisma as any).$transaction = async (callback: any) => {
      transactionCalled = true;
      return callback({
        scheduleSlot: {
          findFirst: async (args: any) => {
            capturedAssignmentWhere = args.where;
            return null;
          },
        },
      });
    };

    const unassignedDoctorError = await captureControllerError(createSchedule, {
      user: { id: 99, role: 'DOCTOR', doctor: { id: 12 } },
      body: {
        courseId: 41,
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '10:00',
      },
    });
    assert.ok(unassignedDoctorError instanceof AuthorizationError);
    assert.equal(transactionCalled, true);
    assert.deepEqual(capturedAssignmentWhere, { courseId: 41, doctorId: 12 });

    transactionCalled = false;
    capturedAssignmentWhere = undefined;
    const unassignedTeachingAssistantError = await captureControllerError(createSchedule, {
      user: {
        id: 100,
        role: 'TEACHING_ASSISTANT',
        teachingAssistant: { id: 'ta-12' },
      },
      body: {
        courseId: 41,
        dayOfWeek: 'TUESDAY',
        startTime: '11:00',
        endTime: '12:00',
      },
    });
    assert.ok(unassignedTeachingAssistantError instanceof AuthorizationError);
    assert.equal(transactionCalled, true);
    assert.deepEqual(capturedAssignmentWhere, {
      courseId: 41,
      teachingAssistantId: 'ta-12',
    });

    transactionCalled = false;
    const crossStaffCreateError = await captureControllerError(createSchedule, {
      user: { id: 99, role: 'DOCTOR', doctor: { id: 12 } },
      body: {
        courseId: 41,
        doctorId: 12,
        teachingAssistantId: 'ta-elsewhere',
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '10:00',
      },
    });
    assert.ok(crossStaffCreateError instanceof AuthorizationError);
    assert.equal(transactionCalled, false, 'A doctor must not be able to assign a TA');

    (prisma.scheduleSlot as any).findUnique = async () => ({
      id: 5,
      courseId: 41,
      doctorId: 12,
      groupId: null,
      teachingAssistantId: null,
      timetableId: null,
      dayOfWeek: 'MONDAY',
      startTime: '09:00',
      endTime: '10:00',
      room: null,
      course: {
        id: 41,
        departmentId: 7,
        year: 2,
        semester: 1,
        department: { id: 7, collegeId: 3 },
      },
    });

    transactionCalled = false;
    const doctorReassignmentError = await captureControllerError(updateSchedule, {
      params: { id: '5' },
      user: { id: 99, role: 'DOCTOR', doctor: { id: 12 } },
      body: { doctorId: 15 },
    });
    assert.ok(doctorReassignmentError instanceof AuthorizationError);
    assert.equal(transactionCalled, false, 'An owning doctor must not transfer slot ownership');

    transactionCalled = false;
    capturedAssignmentWhere = undefined;
    const unassignedAdminTargetError = await captureControllerError(updateSchedule, {
      params: { id: '5' },
      user: { id: 1, role: 'SUPER_ADMIN' },
      body: { doctorId: 15 },
    });
    assert.ok(unassignedAdminTargetError instanceof AuthorizationError);
    assert.equal(transactionCalled, true);
    assert.deepEqual(capturedAssignmentWhere, {
      courseId: 41,
      doctorId: 15,
      id: { not: 5 },
    });
  } finally {
    (prisma.course as any).findUnique = originalCourseFindUnique;
    (prisma.doctor as any).findUnique = originalDoctorFindUnique;
    (prisma.timetable as any).findFirst = originalTimetableFindFirst;
    (prisma.scheduleSlot as any).findUnique = originalScheduleSlotFindUnique;
    (prisma as any).$transaction = originalTransaction;
  }
}

await runScheduleAssignmentSecurityTests();
console.log('Schedule assignment security checks passed');
