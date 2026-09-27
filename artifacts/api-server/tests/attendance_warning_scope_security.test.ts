import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { AttendanceService } from '../src/services/attendance.service';

const originals = {
  courseFindMany: prisma.course.findMany,
  doctorFindUnique: prisma.doctor.findUnique,
  scheduleSlotFindMany: prisma.scheduleSlot.findMany,
  enrollmentFindMany: prisma.enrollment.findMany,
  policyFindMany: prisma.absenceThresholdPolicy.findMany,
};

async function doctorWithoutAssignedSlotsFailsClosed() {
  let departmentFallbackQueries = 0;
  let warningQueries = 0;

  (prisma.doctor.findUnique as any) = async () => ({ id: 5, departmentId: 9 });
  (prisma.scheduleSlot.findMany as any) = async () => [];
  (prisma.course.findMany as any) = async (args: any) => {
    if (args.where?.departmentId === 9) {
      departmentFallbackQueries += 1;
      return [{ id: 41 }];
    }
    return [];
  };
  (prisma.enrollment.findMany as any) = async () => {
    warningQueries += 1;
    return [];
  };
  (prisma.absenceThresholdPolicy.findMany as any) = async () => [];

  const result = await AttendanceService.getStaffAbsenceWarnings({
    role: 'DOCTOR',
    id: 100,
    doctor: { id: 5, departmentId: 9 },
  });

  assert.equal(departmentFallbackQueries, 0);
  assert.equal(warningQueries, 0);
  assert.deepEqual(result.warningRecords, []);
  assert.deepEqual(result.coursesList, []);
  assert.equal(result.pagination.total, 0);
}

async function doctorWithAssignedSlotsKeepsCourseAccess() {
  let resolvedScope: unknown;
  let warningQueries = 0;

  (prisma.course.findMany as any) = async (args: any) => {
    if (args.select?.id && Object.keys(args.select).length === 1) {
      resolvedScope = args.where;
      return [{ id: 41 }];
    }
    return [];
  };
  (prisma.enrollment.findMany as any) = async () => {
    warningQueries += 1;
    return [];
  };
  (prisma.absenceThresholdPolicy.findMany as any) = async () => [];

  const result = await AttendanceService.getStaffAbsenceWarnings({
    role: 'DOCTOR',
    id: 100,
    doctor: { id: 5, departmentId: 9 },
  });

  assert.deepEqual(resolvedScope, {
    scheduleSlots: { some: { doctorId: 5 } },
  });
  assert.equal(warningQueries, 1);
  assert.equal(result.pagination.total, 0);
}

const failures: unknown[] = [];
try {
  for (const test of [
    doctorWithoutAssignedSlotsFailsClosed,
    doctorWithAssignedSlotsKeepsCourseAccess,
  ]) {
    try {
      await test();
    } catch (error) {
      failures.push(error);
    }
  }
} finally {
  prisma.course.findMany = originals.courseFindMany;
  prisma.doctor.findUnique = originals.doctorFindUnique;
  prisma.scheduleSlot.findMany = originals.scheduleSlotFindMany;
  prisma.enrollment.findMany = originals.enrollmentFindMany;
  prisma.absenceThresholdPolicy.findMany = originals.policyFindMany;
}

if (failures.length > 0) {
  throw new AggregateError(
    failures,
    'Attendance warning doctor scope security checks failed'
  );
}

console.log('Attendance warning doctor scope security checks passed');
