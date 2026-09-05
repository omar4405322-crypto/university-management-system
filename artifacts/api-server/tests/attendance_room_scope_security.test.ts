import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { AttendanceService } from '../src/services/attendance.service';
import { updateRoomCoordinates } from '../src/controllers/room.controller';
import { AuthorizationError } from '../src/utils/appError';
import { getFlagOverrideAttendanceWhere } from '../src/utils/attendanceAuditScope.utils';
import { getRoomCoordinateAccessWhere } from '../src/utils/roomScope.utils';

const DENY_ALL = {
  AND: [{ id: { equals: 0 } }, { id: { not: 0 } }],
};

async function captureControllerError(controller: any, request: Record<string, unknown>) {
  return new Promise<unknown>((resolve, reject) => {
    const response = {
      status: () => response,
      json: () => reject(new Error('Expected the room update to be rejected')),
    };
    controller(request, response, (error?: unknown) => resolve(error));
  });
}

async function runAttendanceRoomScopeSecurityTests() {
  assert.deepEqual(
    getFlagOverrideAttendanceWhere(
      { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
      20
    ),
    { AND: [{ id: 20 }, { course: { departmentId: 7 } }] }
  );
  assert.deepEqual(
    getFlagOverrideAttendanceWhere({ role: 'DOCTOR', doctor: { id: 12 } }, 20),
    {
      AND: [
        { id: 20 },
        { course: { scheduleSlots: { some: { doctorId: 12 } } } },
        {
          session: {
            is: {
              OR: [
                { doctorId: 12 },
                { scheduleSlot: { is: { doctorId: 12 } } },
              ],
            },
          },
        },
      ],
    }
  );
  assert.deepEqual(
    getRoomCoordinateAccessWhere(
      { role: 'COLLEGE_ADMIN', managedCollegeId: 4 },
      3
    ),
    {
      AND: [
        { id: 3 },
        {
          scheduleSlots: {
            some: { course: { department: { collegeId: 4 } } },
          },
        },
      ],
    }
  );
  assert.deepEqual(
    getRoomCoordinateAccessWhere(
      { role: 'COLLEGE_ADMIN', collegeId: 4, managedCollegeId: null },
      3
    ),
    {
      AND: [
        { id: 3 },
        { scheduleSlots: { some: { course: DENY_ALL } } },
      ],
    }
  );

  const originalAttendanceGroupBy = prisma.attendance.groupBy;
  const originalAttendanceFindFirst = prisma.attendance.findFirst;
  const originalAttendanceUpdateMany = prisma.attendance.updateMany;
  const originalAttendanceFindUnique = prisma.attendance.findUnique;
  const originalStudentFindMany = prisma.student.findMany;
  const originalRoomFindFirst = prisma.room.findFirst;
  const originalRoomUpdateMany = prisma.room.updateMany;
  const originalRoomFindUnique = prisma.room.findUnique;
  let capturedWhere: unknown;
  let queryCalled = false;
  let roomQueryCalled = false;
  let mutationCalled = false;

  try {
    (prisma.attendance as any).groupBy = async (args: any) => {
      queryCalled = true;
      capturedWhere = args.where;
      return [
        { deviceId: 'device-a', studentId: 5 },
        { deviceId: 'device-a', studentId: 6 },
        { deviceId: 'device-b', studentId: 7 },
      ];
    };
    (prisma.student as any).findMany = async () => [
      { id: 5, studentId: 'S5', firstName: 'A', lastName: 'One', user: { email: 'a@test' } },
      { id: 6, studentId: 'S6', firstName: 'B', lastName: 'Two', user: { email: 'b@test' } },
    ];

    await assert.rejects(
      AttendanceService.getAuditDuplicateDevices({
        role: 'COLLEGE_ADMIN',
        collegeId: 4,
        managedCollegeId: null,
      }),
      AuthorizationError
    );
    assert.equal(queryCalled, false, 'Missing managed scope must stop before aggregation');

    const duplicates = await AttendanceService.getAuditDuplicateDevices({
      role: 'DEPARTMENT_ADMIN',
      managedDepartmentId: 7,
    });
    assert.deepEqual(capturedWhere, {
      deviceId: { not: null },
      course: { departmentId: 7 },
    });
    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0].deviceId, 'device-a');
    assert.equal(duplicates[0].studentCount, 2);

    (prisma.attendance as any).findFirst = async (args: any) => {
      capturedWhere = args.where;
      return null;
    };
    (prisma.attendance as any).updateMany = async () => {
      mutationCalled = true;
      return { count: 1 };
    };

    await assert.rejects(
      AttendanceService.overrideFlaggedRecord(
        { role: 'COLLEGE_ADMIN', managedCollegeId: 4, email: 'admin@test' },
        20,
        'Reviewed'
      ),
      /Record not found/
    );
    assert.deepEqual(capturedWhere, {
      AND: [{ id: 20 }, { course: { department: { collegeId: 4 } } }],
    });
    assert.equal(mutationCalled, false);

    (prisma.room as any).findFirst = async (args: any) => {
      roomQueryCalled = true;
      capturedWhere = args.where;
      return null;
    };
    (prisma.room as any).updateMany = async () => {
      mutationCalled = true;
      return { count: 1 };
    };

    const coordinateError = await captureControllerError(updateRoomCoordinates, {
      params: { id: '3' },
      user: { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
      body: { latitude: 91, longitude: 30 },
    });
    assert.ok(coordinateError instanceof Error);
    assert.equal(roomQueryCalled, false);
    assert.equal(mutationCalled, false);

    const roomScopeError = await captureControllerError(updateRoomCoordinates, {
      params: { id: '3' },
      user: { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
      body: { latitude: 30, longitude: 31 },
    });
    assert.ok(roomScopeError instanceof AuthorizationError);
    assert.equal(roomQueryCalled, true);
    assert.deepEqual(capturedWhere, {
      AND: [
        { id: 3 },
        {
          scheduleSlots: { some: { course: { departmentId: 7 } } },
        },
      ],
    });
    assert.equal(mutationCalled, false);
  } finally {
    (prisma.attendance as any).groupBy = originalAttendanceGroupBy;
    (prisma.attendance as any).findFirst = originalAttendanceFindFirst;
    (prisma.attendance as any).updateMany = originalAttendanceUpdateMany;
    (prisma.attendance as any).findUnique = originalAttendanceFindUnique;
    (prisma.student as any).findMany = originalStudentFindMany;
    (prisma.room as any).findFirst = originalRoomFindFirst;
    (prisma.room as any).updateMany = originalRoomUpdateMany;
    (prisma.room as any).findUnique = originalRoomFindUnique;
  }
}

await runAttendanceRoomScopeSecurityTests();
console.log('Attendance and room scope security checks passed');
