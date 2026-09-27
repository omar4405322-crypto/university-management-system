import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import {
  confirmedPurgeStudent,
  deleteStudent,
} from '../src/controllers/students.controller';
import { deleteCourse } from '../src/controllers/courses.controller';
import { deleteTimetable } from '../src/controllers/timetable.controller';
import { archiveSchedule, deleteSchedule, restoreSchedule } from '../src/controllers/schedules.controller';
import { deleteDepartment } from '../src/controllers/department.controller';
import { deleteTeachingAssistant } from '../src/controllers/teachingAssistants.controller';
import { hardDeleteUser } from '../src/controllers/user.controller';
import { AttendanceService } from '../src/services/attendance.service';
import { calculateAttendanceAttempts } from '../src/attendance/attendance.calculation';

type InvocationResult = { body?: any; error?: any; statusCode?: number };

function invoke(handler: any, request: any): Promise<InvocationResult> {
  return new Promise((resolve) => {
    const result: InvocationResult = {};
    const response: any = {
      status(code: number) {
        result.statusCode = code;
        return response;
      },
      json(body: any) {
        result.body = body;
        resolve(result);
        return response;
      },
    };
    handler(request, response, (error?: unknown) => {
      result.error = error;
      resolve(result);
    });
  });
}

async function studentDeletionRequiresExplicitElevatedPurge() {
  const originalStudentFindUnique = prisma.student.findUnique;
  const originalTransaction = prisma.$transaction;
  const originalAuditCreate = prisma.auditLog.create;
  let destructiveWrites = 0;

  try {
    (prisma.student.findUnique as any) = async () => ({
      userId: 42,
      departmentId: 7,
      department: { collegeId: 3 },
    });
    (prisma.auditLog.create as any) = async () => ({ id: 1 });
    (prisma as any).$transaction = async (callback: (tx: any) => unknown) =>
      callback({
        enrollment: { findFirst: async () => ({ id: 1 }) },
        quizSubmission: { findFirst: async () => null, deleteMany: async () => ({ count: 0 }) },
        taskSubmission: { findFirst: async () => null, deleteMany: async () => ({ count: 0 }) },
        examSubmission: { findFirst: async () => null },
        payment: { findFirst: async () => null, deleteMany: async () => ({ count: 0 }) },
        attendance: { deleteMany: async () => ({ count: 0 }) },
        student: {
          update: async () => { destructiveWrites += 1; },
          delete: async () => { destructiveWrites += 1; },
        },
        studentSuccessMetric: {
          findUnique: async () => null,
          delete: async () => { destructiveWrites += 1; },
        },
        user: { delete: async () => { destructiveWrites += 1; } },
        auditLog: { create: async () => ({ id: 1 }) },
      });

    const blocked = await invoke(deleteStudent, {
      params: { id: '7' },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(blocked.error?.statusCode, 409);
    assert.equal(destructiveWrites, 0);

    const denied = await invoke(confirmedPurgeStudent, {
      params: { id: '7' },
      body: { confirmPurge: true },
      user: { id: 2, role: 'ADMIN', managedCollegeId: 3 },
    });
    assert.equal(denied.error?.statusCode, 403);
    assert.equal(destructiveWrites, 0);

    const missingConfirmation = await invoke(confirmedPurgeStudent, {
      params: { id: '7' },
      body: {},
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(missingConfirmation.error?.statusCode, 400);
    assert.equal(destructiveWrites, 0);

    const purged = await invoke(confirmedPurgeStudent, {
      params: { id: '7' },
      body: { confirmPurge: true },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(purged.body?.success, true);
    assert.ok(destructiveWrites > 0);
  } finally {
    prisma.student.findUnique = originalStudentFindUnique;
    prisma.$transaction = originalTransaction;
    prisma.auditLog.create = originalAuditCreate;
  }
}

async function permanentUserDeletionIsConfirmedAndSuperAdminOnly() {
  const originalUserFindUnique = prisma.user.findUnique;
  const originalTransaction = prisma.$transaction;
  let userDeleted = false;

  try {
    (prisma.user.findUnique as any) = async () => ({
      email: 'student@example.com',
      role: 'STUDENT',
      student: { id: 7 },
    });
    (prisma as any).$transaction = async (callback: (tx: any) => unknown) =>
      callback({
        auditLog: {
          updateMany: async () => ({ count: 0 }),
          create: async () => ({ id: 1 }),
        },
        user: {
          delete: async () => {
            userDeleted = true;
            return { id: 42 };
          },
        },
      });

    const denied = await invoke(hardDeleteUser, {
      params: { id: '42' },
      body: { confirmPurge: true },
      user: { id: 2, role: 'ADMIN' },
    });
    assert.equal(denied.error?.statusCode, 403);
    assert.equal(userDeleted, false);

    const unconfirmed = await invoke(hardDeleteUser, {
      params: { id: '42' },
      body: {},
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(unconfirmed.error?.statusCode, 400);
    assert.equal(userDeleted, false);

    const confirmed = await invoke(hardDeleteUser, {
      params: { id: '42' },
      body: { confirmPurge: true },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(confirmed.body?.success, true);
    assert.equal(userDeleted, true);
  } finally {
    prisma.user.findUnique = originalUserFindUnique;
    prisma.$transaction = originalTransaction;
  }
}

async function courseEnrollmentHistoryBlocksDeletion() {
  const originalCourseFindUnique = prisma.course.findUnique;
  const originalTransaction = prisma.$transaction;
  let courseDeleted = false;
  try {
    (prisma.course.findUnique as any) = async () => ({
      id: 10,
      department: { collegeId: 3 },
    });
    (prisma as any).$transaction = async (callback: (tx: any) => unknown) =>
      callback({
        enrollment: { findFirst: async () => ({ id: 91 }) },
        course: { delete: async () => { courseDeleted = true; } },
      });

    const result = await invoke(deleteCourse, {
      params: { id: '10' },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(result.error?.statusCode, 409);
    assert.equal(courseDeleted, false);
  } finally {
    prisma.course.findUnique = originalCourseFindUnique;
    prisma.$transaction = originalTransaction;
  }
}

async function attendanceEvidenceBlocksTimetableAndSlotDeletion() {
  const originalTimetableFindUnique = prisma.timetable.findUnique;
  const originalSlotFindUnique = prisma.scheduleSlot.findUnique;
  const originalTransaction = prisma.$transaction;
  let deletes = 0;

  try {
    (prisma.timetable.findUnique as any) = async () => ({
      id: 5,
      collegeId: 3,
      departmentId: 7,
    });
    (prisma.scheduleSlot.findUnique as any) = async () => ({
      id: 9,
      doctorId: null,
      teachingAssistantId: null,
      course: { departmentId: 7, department: { collegeId: 3 } },
    });
    (prisma as any).$transaction = async (callback: (tx: any) => unknown) =>
      callback({
        scheduleSlot: {
          findFirst: async () => ({ id: 9 }),
          delete: async () => { deletes += 1; },
        },
        timetable: { delete: async () => { deletes += 1; } },
      });

    const timetableResult = await invoke(deleteTimetable, {
      params: { id: '5' },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(timetableResult.error?.statusCode, 409);

    const slotResult = await invoke(deleteSchedule, {
      params: { id: '9' },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(slotResult.error?.statusCode, 409);
    assert.match(slotResult.error?.message ?? '', /Archive the slot instead/);
    assert.equal(deletes, 0);
  } finally {
    prisma.timetable.findUnique = originalTimetableFindUnique;
    prisma.scheduleSlot.findUnique = originalSlotFindUnique;
    prisma.$transaction = originalTransaction;
  }
}

async function evidencedSlotCanBeArchivedAndRestored() {
  const originalSlotFindUnique = prisma.scheduleSlot.findUnique;
  const originalSlotUpdate = prisma.scheduleSlot.update;
  const originalAuditCreate = prisma.auditLog.create;
  const writes: any[] = [];

  try {
    (prisma.scheduleSlot.findUnique as any) = async () => ({
      id: 9,
      doctorId: null,
      teachingAssistantId: null,
      course: { departmentId: 7, department: { collegeId: 3 } },
    });
    (prisma.scheduleSlot.update as any) = async (operation: any) => {
      writes.push(operation.data);
      return { id: 9, ...operation.data };
    };
    (prisma.auditLog.create as any) = async () => ({ id: 1 });

    const archived = await invoke(archiveSchedule, {
      params: { id: '9' },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(archived.body?.success, true);
    assert.equal(writes[0]?.isArchived, true);
    assert.ok(writes[0]?.archivedAt instanceof Date);

    const restored = await invoke(restoreSchedule, {
      params: { id: '9' },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(restored.body?.success, true);
    assert.deepEqual(writes[1], { isArchived: false, archivedAt: null });
  } finally {
    prisma.scheduleSlot.findUnique = originalSlotFindUnique;
    prisma.scheduleSlot.update = originalSlotUpdate;
    prisma.auditLog.create = originalAuditCreate;
  }
}

async function archivedSlotIsHiddenOperationallyButRetainedInAttendanceHistory() {
  const originalSlotFindMany = prisma.scheduleSlot.findMany;
  const originalGroupFindMany = prisma.studentGroup.findMany;
  const originalSessionFindMany = prisma.attendanceSession.findMany;
  const originalAttendanceFindMany = prisma.attendance.findMany;
  const slotQueries: any[] = [];
  const sessionDate = new Date('2026-09-01T09:00:00.000Z');

  try {
    (prisma.scheduleSlot.findMany as any) = async (args: any) => {
      slotQueries.push(args);
      if (args.include) return [];
      return [{
        id: 9,
        courseId: 41,
        groupId: null,
        isArchived: true,
        timetable: { semester: 1 },
        course: { semester: 1 },
      }];
    };
    (prisma.studentGroup.findMany as any) = async () => [];
    (prisma.attendanceSession.findMany as any) = async () => [
      { id: 91, scheduleSlotId: 9, createdAt: sessionDate },
    ];
    (prisma.attendance.findMany as any) = async () => [
      {
        id: 901,
        studentId: 7,
        courseId: 41,
        semester: 1,
        academicYear: 2026,
        sessionId: 91,
        status: 'PRESENT',
        remarks: null,
        date: sessionDate,
      },
    ];

    const operationalSlots = await AttendanceService.getMySlots({
      role: 'SUPER_ADMIN',
    });
    assert.deepEqual(operationalSlots, []);
    assert.equal(slotQueries[0].where.isArchived, false);

    const calculations = await calculateAttendanceAttempts([{
      id: 1,
      studentId: 7,
      courseId: 41,
      semester: 1,
      academicYear: 2026,
      groupId: null,
      enrolledAt: new Date('2026-08-01T00:00:00.000Z'),
      exemptionPeriods: [],
    }]);
    assert.equal(slotQueries[1].where.isArchived, undefined);
    assert.equal(calculations.get(1)?.total, 1);
    assert.equal(calculations.get(1)?.present, 1);
  } finally {
    prisma.scheduleSlot.findMany = originalSlotFindMany;
    prisma.studentGroup.findMany = originalGroupFindMany;
    prisma.attendanceSession.findMany = originalSessionFindMany;
    prisma.attendance.findMany = originalAttendanceFindMany;
  }
}

async function departmentAndTaRequireExplicitReassignment() {
  const originalDepartmentFindFirst = prisma.department.findFirst;
  const originalDepartmentDelete = prisma.department.delete;
  const originalTaFindUnique = prisma.teachingAssistant.findUnique;
  const originalTransaction = prisma.$transaction;
  let destructiveWrites = 0;

  try {
    (prisma.department.findFirst as any) = async () => ({
      id: 7,
      _count: {
        students: 1,
        courses: 0,
        doctors: 0,
        teachingAssistants: 0,
        admins: 0,
        managedAdmins: 0,
        registrationRequests: 0,
        timetables: 0,
        studentGroups: 0,
      },
    });
    (prisma.department.delete as any) = async () => { destructiveWrites += 1; };

    const departmentResult = await invoke(deleteDepartment, {
      params: { id: '7' },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(departmentResult.error?.statusCode, 409);

    (prisma.teachingAssistant.findUnique as any) = async () => ({
      id: 'ta-1',
      userId: 42,
      departmentId: 7,
      department: { collegeId: 3 },
      scheduleSlots: [{ id: 9 }],
    });
    (prisma as any).$transaction = async () => {
      destructiveWrites += 1;
    };

    const taResult = await invoke(deleteTeachingAssistant, {
      params: { id: 'ta-1' },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(taResult.error?.statusCode, 400);
    assert.equal(destructiveWrites, 0);
  } finally {
    prisma.department.findFirst = originalDepartmentFindFirst;
    prisma.department.delete = originalDepartmentDelete;
    prisma.teachingAssistant.findUnique = originalTaFindUnique;
    prisma.$transaction = originalTransaction;
  }
}

await studentDeletionRequiresExplicitElevatedPurge();
await permanentUserDeletionIsConfirmedAndSuperAdminOnly();
await courseEnrollmentHistoryBlocksDeletion();
await attendanceEvidenceBlocksTimetableAndSlotDeletion();
await evidencedSlotCanBeArchivedAndRestored();
await archivedSlotIsHiddenOperationallyButRetainedInAttendanceHistory();
await departmentAndTaRequireExplicitReassignment();
console.log('Destructive deletion guard checks passed');
