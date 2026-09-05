import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import prisma from '../src/utils/prismaClient';
import { createTimetable } from '../src/controllers/timetable.controller';
import { syncGridToMaster } from '../src/controllers/schedules.controller';
import { AuthorizationError } from '../src/utils/appError';

async function captureControllerError(controller: any, request: Record<string, unknown>) {
  return new Promise<unknown>((resolve, reject) => {
    const response = {
      status: () => response,
      json: () => reject(new Error('Expected the operation to be rejected')),
    };
    controller(request, response, (error?: unknown) => resolve(error));
  });
}

async function invokeController(controller: any, request: Record<string, unknown>) {
  return new Promise<any>((resolve, reject) => {
    const response = {
      status: () => response,
      json: (body: unknown) => resolve(body),
    };
    controller(request, response, (error?: unknown) => reject(error));
  });
}

async function runTimetableGridResolutionSecurityTests() {
  const originalDepartmentFindFirst = prisma.department.findFirst;
  const originalTimetableFindUnique = prisma.timetable.findUnique;
  const originalTimetableFindFirst = prisma.timetable.findFirst;
  const originalCourseFindMany = prisma.course.findMany;
  const originalDoctorFindMany = prisma.doctor.findMany;
  const originalTeachingAssistantFindMany = prisma.teachingAssistant.findMany;
  const originalScheduleFindMany = prisma.scheduleSlot.findMany;
  const originalTransaction = prisma.$transaction;
  const originalAuditCreate = prisma.auditLog.create;
  let capturedDepartmentWhere: unknown;
  let capturedDoctorWhere: unknown;
  let capturedTeachingAssistantWhere: unknown;
  let mutationCalled = false;

  try {
    (prisma.department as any).findFirst = async (args: any) => {
      capturedDepartmentWhere = args.where;
      return null;
    };
    (prisma.timetable as any).findUnique = async () => {
      mutationCalled = true;
      return null;
    };
    (prisma as any).$transaction = async () => {
      mutationCalled = true;
    };

    const relationshipError = await captureControllerError(createTimetable, {
      user: { role: 'COLLEGE_ADMIN', managedCollegeId: 4 },
      body: {
        collegeId: 4,
        departmentId: 9,
        academicYear: 2,
        semester: 1,
        title: 'Scoped timetable',
      },
    });
    assert.ok(relationshipError instanceof AuthorizationError);
    assert.deepEqual(capturedDepartmentWhere, {
      AND: [
        { id: 9, collegeId: 4 },
        { collegeId: 4 },
      ],
    });
    assert.equal(mutationCalled, false, 'Invalid college/department pairs stop before writes');

    (prisma.timetable as any).findFirst = async () => null;
    (prisma.course as any).findMany = async () => [
      { id: 10, name: 'Algorithms', courseCode: 'CS201', departmentId: 7 },
      { id: 11, name: 'Algorithms', courseCode: 'CS202', departmentId: 7 },
    ];
    (prisma.doctor as any).findMany = async (args: any) => {
      capturedDoctorWhere = args.where;
      return [];
    };
    (prisma.teachingAssistant as any).findMany = async (args: any) => {
      capturedTeachingAssistantWhere = args.where;
      return [];
    };
    (prisma.scheduleSlot as any).findMany = async () => [];
    (prisma.auditLog as any).create = async () => ({ id: 1 });
    (prisma as any).$transaction = async () => {
      mutationCalled = true;
    };

    mutationCalled = false;
    const syncResult = await invokeController(syncGridToMaster, {
      user: { id: 1, role: 'SUPER_ADMIN' },
      body: {
        departmentId: 7,
        academicYear: 2,
        semester: 1,
        slots: [
          {
            day: 'MONDAY',
            startTime: '09:00',
            endTime: '10:00',
            courseName: 'Algorithms',
            instructor: 'Same Name',
            slotType: 'LECTURE',
          },
          {
            day: 'TUESDAY',
            startTime: '09:00',
            endTime: '10:00',
            courseName: 'Other',
            courseId: 999,
            doctorId: 50,
            slotType: 'LECTURE',
          },
        ],
      },
    });
    assert.equal(syncResult.success, true);
    assert.equal(syncResult.data.syncedCount, 0);
    assert.equal(syncResult.data.skippedCount, 2);
    assert.match(syncResult.data.skippedSlots[0].reason, /^AMBIGUOUS_COURSE_MATCH/);
    assert.match(syncResult.data.skippedSlots[1].reason, /^COURSE_ID_NOT_IN_SCOPE/);
    assert.deepEqual(capturedDoctorWhere, { departmentId: 7 });
    assert.deepEqual(capturedTeachingAssistantWhere, { departmentId: 7 });
    assert.equal(mutationCalled, false, 'Ambiguous/out-of-scope matches require manual review');

    const controllerSource = await readFile(
      new URL('../src/controllers/schedules.controller.ts', import.meta.url),
      'utf8'
    );
    assert.doesNotMatch(controllerSource, /exactUnscoped|containsUnscoped|globalDoctors/);
  } finally {
    (prisma.department as any).findFirst = originalDepartmentFindFirst;
    (prisma.timetable as any).findUnique = originalTimetableFindUnique;
    (prisma.timetable as any).findFirst = originalTimetableFindFirst;
    (prisma.course as any).findMany = originalCourseFindMany;
    (prisma.doctor as any).findMany = originalDoctorFindMany;
    (prisma.teachingAssistant as any).findMany = originalTeachingAssistantFindMany;
    (prisma.scheduleSlot as any).findMany = originalScheduleFindMany;
    (prisma as any).$transaction = originalTransaction;
    (prisma.auditLog as any).create = originalAuditCreate;
  }
}

await runTimetableGridResolutionSecurityTests();
console.log('Timetable grid resolution security checks passed');
