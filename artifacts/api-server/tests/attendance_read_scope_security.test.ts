import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { AttendanceService } from '../src/services/attendance.service';
import { AttendanceSessionService } from '../src/services/attendance-session.service';

async function runAttendanceReadScopeSecurityTests() {
  const originalStudentFindFirst = prisma.student.findFirst;
  const originalStudentFindUnique = prisma.student.findUnique;
  const originalDoctorFindUnique = prisma.doctor.findUnique;
  const originalSlotFindMany = prisma.scheduleSlot.findMany;
  const originalSlotFindUnique = prisma.scheduleSlot.findUnique;
  const originalSessionFindMany = prisma.attendanceSession.findMany;

  const doctor = { role: 'DOCTOR', id: 100, doctor: { id: 5 } };

  try {
    let slotQueryCount = 0;
    let capturedSlotWhere: unknown;
    (prisma.scheduleSlot as any).findMany = async (args: any) => {
      slotQueryCount += 1;
      capturedSlotWhere = args.where;
      return [];
    };

    const noSlots = await AttendanceService.getMySlots(doctor);
    assert.deepEqual(noSlots, []);
    assert.equal(slotQueryCount, 1, 'An empty scoped query must not trigger a fallback query');
    assert.deepEqual(capturedSlotWhere, {
      course: { scheduleSlots: { some: { doctorId: 5 } } },
    });

    let capturedEnrollmentWhere: unknown;
    let attendanceQueryReached = false;
    (prisma.student as any).findFirst = async () => ({ id: 44 });
    (prisma.student as any).findUnique = async (args: any) => {
      capturedEnrollmentWhere = args.include.enrollments.where;
      return { id: 44, groupId: null, enrollments: [] };
    };
    (prisma.scheduleSlot as any).findMany = async () => {
      attendanceQueryReached = true;
      return [];
    };

    const inaccessibleAttendance = await AttendanceService.getStudentAttendance(
      doctor,
      44,
      22
    );
    assert.deepEqual(inaccessibleAttendance.data, []);
    assert.equal(inaccessibleAttendance.pagination.total, 0);
    assert.equal(attendanceQueryReached, false);
    assert.deepEqual(capturedEnrollmentWhere, {
      status: 'ENROLLED',
      course: { scheduleSlots: { some: { doctorId: 5 } } },
    });

    let capturedActiveWhere: any;
    (prisma.attendanceSession as any).findMany = async (args: any) => {
      capturedActiveWhere = args.where;
      return [];
    };

    await AttendanceSessionService.getActiveSessions(doctor, {});
    assert.deepEqual(capturedActiveWhere, {
      isActive: true,
      scheduleSlot: {
        is: {
          course: { scheduleSlots: { some: { doctorId: 5 } } },
        },
      },
    });

    await AttendanceSessionService.getActiveSessions(doctor, { courseId: 22 });
    assert.deepEqual(capturedActiveWhere, {
      isActive: true,
      scheduleSlot: {
        is: {
          course: { scheduleSlots: { some: { doctorId: 5 } } },
          courseId: 22,
        },
      },
    });

    await AttendanceSessionService.getActiveSessions(
      {
        role: 'TEACHING_ASSISTANT',
        teachingAssistant: { id: 'ta-9' },
      },
      {}
    );
    assert.deepEqual(capturedActiveWhere, {
      isActive: true,
      scheduleSlot: {
        is: {
          course: {
            OR: [
              {
                scheduleSlots: {
                  some: { teachingAssistantId: 'ta-9' },
                },
              },
            ],
          },
        },
      },
    });

    await AttendanceSessionService.getActiveSessions(
      { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
      {}
    );
    assert.deepEqual(capturedActiveWhere, {
      isActive: true,
      scheduleSlot: { is: { course: { departmentId: 7 } } },
    });

    await AttendanceSessionService.getActiveSessions(
      { role: 'COLLEGE_ADMIN', managedCollegeId: 3 },
      {}
    );
    assert.deepEqual(capturedActiveWhere, {
      isActive: true,
      scheduleSlot: {
        is: { course: { department: { collegeId: 3 } } },
      },
    });

    await AttendanceSessionService.getActiveSessions({ role: 'SUPER_ADMIN' }, {});
    assert.deepEqual(capturedActiveWhere, { isActive: true });

    let slotSessionReadReached = false;
    (prisma.scheduleSlot as any).findUnique = async () => ({
      id: 202,
      courseId: 22,
      doctorId: 99,
      teachingAssistantId: null,
    });
    (prisma.doctor as any).findUnique = async () => ({ id: 5 });
    (prisma.attendanceSession as any).findMany = async () => {
      slotSessionReadReached = true;
      return [];
    };

    await assert.rejects(
      AttendanceSessionService.getSlotSessions(doctor, 202),
      (error: any) => error?.statusCode === 403
    );
    assert.equal(slotSessionReadReached, false);
  } finally {
    (prisma.student as any).findFirst = originalStudentFindFirst;
    (prisma.student as any).findUnique = originalStudentFindUnique;
    (prisma.doctor as any).findUnique = originalDoctorFindUnique;
    (prisma.scheduleSlot as any).findMany = originalSlotFindMany;
    (prisma.scheduleSlot as any).findUnique = originalSlotFindUnique;
    (prisma.attendanceSession as any).findMany = originalSessionFindMany;
  }
}

await runAttendanceReadScopeSecurityTests();
console.log('Attendance read scope security checks passed');
