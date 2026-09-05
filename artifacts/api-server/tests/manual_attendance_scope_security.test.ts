import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import attendanceEngine from '../src/attendance/attendance.engine';
import { ManualDriver } from '../src/attendance/drivers/ManualDriver';
import { AuthorizationError } from '../src/utils/appError';
import {
  getManualAttendanceCourseWhere,
  getManualAttendanceSessionWhere,
  requireManualAttendanceAccess,
} from '../src/utils/manualAttendanceScope.utils';

const DENY_ALL = {
  AND: [{ id: { equals: 0 } }, { id: { not: 0 } }],
};

async function runManualAttendanceScopeSecurityTests() {
  assert.deepEqual(
    getManualAttendanceCourseWhere(
      { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
      11
    ),
    { AND: [{ id: 11 }, { departmentId: 7 }] }
  );
  assert.deepEqual(
    getManualAttendanceCourseWhere(
      { role: 'ADMIN', managedCollegeId: null, collegeId: 3 },
      11
    ),
    { AND: [{ id: 11 }, DENY_ALL] }
  );
  assert.deepEqual(
    getManualAttendanceSessionWhere(
      { role: 'DOCTOR', doctor: { id: 5 } },
      13,
      11
    ),
    {
      AND: [
        { id: 13 },
        { scheduleSlot: { is: { courseId: 11, doctorId: 5 } } },
      ],
    }
  );
  assert.deepEqual(
    getManualAttendanceSessionWhere(
      { role: 'TEACHING_ASSISTANT', teachingAssistant: { id: 'ta-4' } },
      13
    ),
    {
      AND: [
        { id: 13 },
        {
          scheduleSlot: {
            is: { teachingAssistantId: 'ta-4' },
          },
        },
      ],
    }
  );

  const originalCourseFindFirst = prisma.course.findFirst;
  const originalSessionFindFirst = prisma.attendanceSession.findFirst;
  let courseQueries = 0;
  let sessionQueries = 0;
  let capturedWhere: unknown;

  try {
    (prisma.course as any).findFirst = async (args: any) => {
      courseQueries += 1;
      capturedWhere = args.where;
      return { id: 11 };
    };
    const doctorContext = {
      userId: 25,
      actor: { role: 'DOCTOR', doctor: { id: 5 } },
      courseId: 11,
    };
    const firstAccess = await requireManualAttendanceAccess({}, doctorContext);
    const secondAccess = await requireManualAttendanceAccess(
      { courseId: 11 },
      doctorContext
    );
    assert.deepEqual(firstAccess, { courseId: 11 });
    assert.deepEqual(secondAccess, firstAccess);
    assert.equal(courseQueries, 1, 'Driver and engine checks share one resolved target');
    assert.deepEqual(capturedWhere, {
      AND: [
        { id: 11 },
        { scheduleSlots: { some: { doctorId: 5 } } },
      ],
    });

    (prisma.attendanceSession as any).findFirst = async (args: any) => {
      sessionQueries += 1;
      capturedWhere = args.where;
      return { scheduleSlot: { courseId: 11 } };
    };
    const sessionContext = {
      userId: 30,
      actor: {
        role: 'TEACHING_ASSISTANT',
        teachingAssistant: { id: 'ta-4' },
      },
      sessionId: 13,
    };
    const sessionAccess = await requireManualAttendanceAccess({}, sessionContext);
    const resolvedAccess = await requireManualAttendanceAccess(
      { sessionId: 13, courseId: 11 },
      sessionContext
    );
    assert.deepEqual(sessionAccess, { sessionId: 13, courseId: 11 });
    assert.deepEqual(resolvedAccess, sessionAccess);
    assert.equal(sessionQueries, 1, 'Resolved session/course authorization is cached');
    assert.deepEqual(capturedWhere, {
      AND: [
        { id: 13 },
        {
          scheduleSlot: {
            is: { teachingAssistantId: 'ta-4' },
          },
        },
      ],
    });

    await assert.rejects(
      requireManualAttendanceAccess(
        { courseId: 11 },
        { userId: 1 }
      ),
      AuthorizationError
    );

    const driver = new ManualDriver();
    await assert.rejects(
      driver.validate(
        { studentId: 4, courseId: 11, status: 'PRESENT' },
        { userId: 1 }
      ),
      AuthorizationError
    );

    await assert.rejects(
      attendanceEngine.recordBulkManual(
        [{ studentId: 4, status: 'PRESENT' }],
        { userId: 1, courseId: 11 }
      ),
      AuthorizationError
    );
  } finally {
    (prisma.course as any).findFirst = originalCourseFindFirst;
    (prisma.attendanceSession as any).findFirst = originalSessionFindFirst;
  }
}

await runManualAttendanceScopeSecurityTests();
console.log('Manual attendance scope security checks passed');
