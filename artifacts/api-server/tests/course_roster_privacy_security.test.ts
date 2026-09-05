import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { AuthorizationError } from '../src/utils/appError';
import { getCourseById, getCourseRoster } from '../src/controllers/courses.controller';

async function invokeController(
  controller: any,
  request: Record<string, unknown>
): Promise<{ error?: unknown; body?: any }> {
  return new Promise((resolve) => {
    const response: any = {
      status: () => response,
      json: (body: any) => resolve({ body }),
    };
    controller(request, response, (error?: unknown) => resolve({ error }));
  });
}

async function runCourseRosterPrivacySecurityTests() {
  const originalCourseFindFirst = prisma.course.findFirst;
  const originalCourseFindUnique = prisma.course.findUnique;
  const originalSlotFindFirst = prisma.scheduleSlot.findFirst;
  const originalStudentFindMany = prisma.student.findMany;
  const originalAttendanceFindMany = prisma.attendance.findMany;
  let capturedArgs: any;
  let sensitiveQueryCalled = false;

  try {
    (prisma.course as any).findFirst = async (args: any) => {
      capturedArgs = args;
      return { id: 10, isPublished: true };
    };

    const studentDetail = await invokeController(getCourseById, {
      params: { id: '10' },
      user: { role: 'STUDENT', student: { id: 3, departmentId: 7, year: 2 } },
    });
    assert.equal(studentDetail.error, undefined);
    assert.equal(
      Object.hasOwn(capturedArgs.include, 'enrollments'),
      false,
      'Student course queries must not load the embedded roster or peer user records'
    );

    await invokeController(getCourseById, {
      params: { id: '10' },
      user: { role: 'SUPER_ADMIN' },
    });
    assert.equal(Object.hasOwn(capturedArgs.include, 'enrollments'), true);

    (prisma.course as any).findUnique = async () => {
      sensitiveQueryCalled = true;
      return null;
    };
    (prisma.student as any).findMany = async () => {
      sensitiveQueryCalled = true;
      return [];
    };
    (prisma.attendance as any).findMany = async () => {
      sensitiveQueryCalled = true;
      return [];
    };

    const studentRoster = await invokeController(getCourseRoster, {
      params: { id: '10' },
      query: { date: '2026-09-05' },
      user: { role: 'STUDENT', student: { id: 3, departmentId: 7, year: 2 } },
    });
    assert.ok(studentRoster.error instanceof AuthorizationError);
    assert.equal(sensitiveQueryCalled, false, 'Student roster access must stop before roster queries');

    (prisma.scheduleSlot as any).findFirst = async () => null;
    const unassignedDoctorRoster = await invokeController(getCourseRoster, {
      params: { id: '10' },
      query: {},
      user: { role: 'DOCTOR', doctor: { id: 12 } },
    });
    assert.ok(unassignedDoctorRoster.error instanceof AuthorizationError);
    assert.equal(sensitiveQueryCalled, false, 'Unassigned staff must not reach roster queries');
  } finally {
    (prisma.course as any).findFirst = originalCourseFindFirst;
    (prisma.course as any).findUnique = originalCourseFindUnique;
    (prisma.scheduleSlot as any).findFirst = originalSlotFindFirst;
    (prisma.student as any).findMany = originalStudentFindMany;
    (prisma.attendance as any).findMany = originalAttendanceFindMany;
  }
}

await runCourseRosterPrivacySecurityTests();
console.log('Course roster privacy security checks passed');
