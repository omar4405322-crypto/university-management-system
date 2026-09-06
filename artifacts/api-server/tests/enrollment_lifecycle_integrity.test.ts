import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import prisma from '../src/utils/prismaClient';
import { EnrollmentService } from '../src/services/enrollment.service';
import { updateGrade } from '../src/controllers/enrollment.controller';
import { approveRequest, rejectRequest } from '../src/controllers/auth.controller';
import { ConflictError, ValidationError } from '../src/utils/appError';

async function invokeController(controller: any, req: any) {
  return new Promise<any>((resolve, reject) => {
    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: any) {
        resolve({ statusCode: this.statusCode, body });
      },
    };
    controller(req, res, (error?: unknown) => {
      if (error) reject(error);
      else resolve(undefined);
    });
  });
}

async function runEnrollmentLifecycleIntegrityTests() {
  console.log('--- Starting Enrollment Lifecycle Integrity Suite ---');

  const originalTransaction = prisma.$transaction;
  const originalStudentFindUnique = prisma.student.findUnique;
  const originalStudentFindMany = prisma.student.findMany;
  const originalCourseFindMany = prisma.course.findMany;
  const originalCourseFindUnique = prisma.course.findUnique;
  const originalEnrollmentFindMany = prisma.enrollment.findMany;
  const originalEnrollmentFindUnique = prisma.enrollment.findUnique;
  const originalEnrollmentFindFirst = prisma.enrollment.findFirst;
  const originalEnrollmentUpdateMany = prisma.enrollment.updateMany;
  const originalAuditLogCreate = prisma.auditLog.create;
  const originalRequestFindUnique = prisma.registrationRequest.findUnique;
  const originalRequestUpdateMany = prisma.registrationRequest.updateMany;

  try {
    const currentAcademicYear = new Date().getFullYear();

    let transactionCalls = 0;
    (prisma.student as any).findUnique = async () => ({
      id: 10,
      departmentId: 3,
      year: 2,
      isActive: true,
    });
    (prisma.course as any).findMany = async () => [
      { id: 101, semester: 1 },
      { id: 102, semester: 1 },
    ];
    (prisma.enrollment as any).findMany = async (args: any) => {
      assert.equal(args.where.academicYear, currentAcademicYear);
      assert.equal(
        Object.hasOwn(args.where, 'status'),
        false,
        'Automatic enrollment must inspect attempts in every status'
      );
      return [
        { courseId: 101, semester: 1, status: 'COMPLETED' },
        { courseId: 102, semester: 1, status: 'BLOCKED' },
      ];
    };
    (prisma as any).$transaction = async () => {
      transactionCalls += 1;
      throw new Error('Terminal attempts must not reach an enrollment write');
    };

    const automaticResult = await EnrollmentService.autoEnrollStudent(10);
    assert.deepEqual(automaticResult, { enrolledCount: 0 });
    assert.equal(transactionCalls, 0);
    console.log('✓ Student auto-enrollment preserves COMPLETED and BLOCKED attempts');

    (prisma.student as any).findMany = async () => [
      { id: 10, departmentId: 3, year: 2 },
      { id: 11, departmentId: 3, year: 2 },
    ];
    (prisma.course as any).findMany = async () => [
      { id: 101, departmentId: 3, year: 2, semester: 1 },
    ];
    (prisma.enrollment as any).findMany = async (args: any) => {
      assert.equal(args.where.academicYear, currentAcademicYear);
      assert.equal(Object.hasOwn(args.where, 'status'), false);
      return [
        { studentId: 10, courseId: 101, semester: 1, status: 'COMPLETED' },
        { studentId: 11, courseId: 101, semester: 1, status: 'BLOCKED' },
      ];
    };

    const syncResult = await EnrollmentService.syncAllEnrollments();
    assert.deepEqual(syncResult, { totalStudents: 2, totalEnrolled: 0 });
    assert.equal(transactionCalls, 0);
    console.log('✓ Global sync preserves COMPLETED and BLOCKED attempts');

    let enrollmentWrites = 0;
    (prisma.enrollment as any).updateMany = async () => {
      enrollmentWrites += 1;
      return { count: 1 };
    };

    for (const finalGrade of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY]) {
      await assert.rejects(
        invokeController(updateGrade, {
          params: { id: '50' },
          body: { finalGrade },
          user: { role: 'SUPER_ADMIN' },
        }),
        ValidationError
      );
    }
    assert.equal(enrollmentWrites, 0);
    console.log('✓ Missing, null, NaN, and infinite grades are rejected before writes');

    (prisma.enrollment as any).findUnique = async () => ({
      id: 50,
      courseId: 101,
      status: 'BLOCKED',
    });
    (prisma.enrollment as any).findFirst = async () => ({
      id: 50,
      courseId: 101,
      status: 'BLOCKED',
    });
    await assert.rejects(
      invokeController(updateGrade, {
        params: { id: '50' },
        body: { finalGrade: 90 },
        user: { role: 'SUPER_ADMIN' },
      }),
      ConflictError
    );
    assert.equal(enrollmentWrites, 0);
    console.log('✓ BLOCKED enrollment cannot be graded');

    await assert.rejects(
      EnrollmentService.withdrawStudent(50),
      ConflictError
    );
    assert.equal(enrollmentWrites, 0);
    console.log('✓ Terminal enrollment cannot be withdrawn');

    let storedGrade = 0;
    let storedStatus = '';
    (prisma.enrollment as any).findUnique = async () => ({
      id: 50,
      courseId: 101,
      status: storedStatus || 'ENROLLED',
      finalGrade: storedGrade,
    });
    (prisma.enrollment as any).findFirst = async () => ({
      id: 50,
      courseId: 101,
      status: 'ENROLLED',
    });
    (prisma.enrollment as any).updateMany = async (args: any) => {
      assert.deepEqual(args.where, { id: 50, status: 'ENROLLED' });
      storedGrade = args.data.finalGrade;
      storedStatus = args.data.status;
      return { count: 1 };
    };
    (prisma.auditLog as any).create = async () => ({ id: 1 });

    await invokeController(updateGrade, {
      params: { id: '50' },
      body: { finalGrade: 59 },
      user: { role: 'SUPER_ADMIN' },
    });
    assert.equal(storedStatus, 'FAILED');

    storedStatus = '';
    await invokeController(updateGrade, {
      params: { id: '50' },
      body: { finalGrade: 60 },
      user: { role: 'SUPER_ADMIN' },
    });
    assert.equal(storedStatus, 'COMPLETED');
    console.log('✓ Passing threshold remains consistent at finalGrade >= 60');

    for (const status of ['COMPLETED', 'BLOCKED']) {
      let terminalReopenWrites = 0;
      (prisma as any).$transaction = async (operation: any, options: any) => {
        assert.equal(
          options?.isolationLevel,
          Prisma.TransactionIsolationLevel.Serializable
        );
        return operation({
          enrollment: {
            findUnique: async () => ({ id: 80, status }),
            create: async () => {
              terminalReopenWrites += 1;
              return {};
            },
          },
          course: { findUnique: async () => ({ maxStudents: 30 }) },
        });
      };
      await assert.rejects(
        EnrollmentService.enrollStudent(20, 101, 1, currentAcademicYear),
        ConflictError
      );
      assert.equal(terminalReopenWrites, 0);
    }
    console.log('✓ Manual enrollment cannot reopen COMPLETED or BLOCKED attempts');

    let committedSeats = 0;
    const transactionIsolationLevels: unknown[] = [];
    (prisma as any).$transaction = async (operation: any, options: any) => {
      transactionIsolationLevels.push(options?.isolationLevel);
      const snapshot = committedSeats;
      const pendingCreates: any[] = [];
      const tx = {
        enrollment: {
          findUnique: async () => null,
          count: async () => snapshot,
          create: async (args: any) => {
            pendingCreates.push(args.data);
            return { id: args.data.studentId, ...args.data };
          },
        },
        course: {
          findUnique: async () => ({ maxStudents: 1 }),
        },
      };

      const result = await operation(tx);
      if (snapshot !== committedSeats) {
        const error: any = new Error('serialization conflict');
        error.code = 'P2034';
        throw error;
      }
      committedSeats += pendingCreates.length;
      return result;
    };

    const concurrentResults = await Promise.allSettled([
      EnrollmentService.enrollStudent(20, 101, 1, currentAcademicYear),
      EnrollmentService.enrollStudent(21, 101, 1, currentAcademicYear),
    ]);
    assert.equal(
      concurrentResults.filter((result) => result.status === 'fulfilled').length,
      1
    );
    assert.equal(
      concurrentResults.filter((result) => result.status === 'rejected').length,
      1
    );
    assert.equal(committedSeats, 1);
    assert.deepEqual(transactionIsolationLevels, [
      Prisma.TransactionIsolationLevel.Serializable,
      Prisma.TransactionIsolationLevel.Serializable,
    ]);
    console.log('✓ Two concurrent requests for one seat produce one success and one conflict');

    let automaticCreates = 0;
    (prisma.student as any).findUnique = async () => ({
      id: 30,
      departmentId: 3,
      year: 2,
      isActive: true,
    });
    (prisma.course as any).findMany = async () => [{ id: 101, semester: 1 }];
    (prisma.enrollment as any).findMany = async () => [];
    (prisma as any).$transaction = async (operation: any, options: any) => {
      assert.equal(
        options?.isolationLevel,
        Prisma.TransactionIsolationLevel.Serializable
      );
      return operation({
        enrollment: {
          findUnique: async () => null,
          count: async () => 1,
          create: async () => {
            automaticCreates += 1;
            return {};
          },
        },
        course: { findUnique: async () => ({ maxStudents: 1 }) },
      });
    };

    const fullCourseResult = await EnrollmentService.autoEnrollStudent(30);
    assert.deepEqual(fullCourseResult, { enrolledCount: 0 });
    assert.equal(automaticCreates, 0);
    console.log('✓ Student auto-enrollment respects full course capacity');

    (prisma.student as any).findMany = async () => [
      { id: 30, departmentId: 3, year: 2 },
    ];
    (prisma.course as any).findMany = async () => [
      { id: 101, departmentId: 3, year: 2, semester: 1 },
    ];
    (prisma.enrollment as any).findMany = async () => [];
    const fullCourseSyncResult = await EnrollmentService.syncAllEnrollments();
    assert.deepEqual(fullCourseSyncResult, {
      totalStudents: 1,
      totalEnrolled: 0,
    });
    assert.equal(automaticCreates, 0);
    console.log('✓ Global sync respects full course capacity');

    (prisma.course as any).findUnique = async () => ({
      id: 101,
      departmentId: 3,
      year: 2,
      semester: 1,
    });
    (prisma.student as any).findMany = async () => [{ id: 30 }];
    const fullAutoCourseResult = await EnrollmentService.autoEnrollCourse(101);
    assert.deepEqual(fullAutoCourseResult, { enrolledCount: 0 });
    assert.equal(automaticCreates, 0);
    console.log('✓ Course auto-enrollment respects full course capacity');

    const approvedRequest = {
      id: 70,
      email: 'approved@example.test',
      password: 'hash',
      role: 'STUDENT',
      firstName: 'Already',
      lastName: 'Approved',
      studentId: 'S-70',
      year: 1,
      phone: null,
      departmentId: 3,
      department: { collegeId: 1 },
      status: 'APPROVED',
    };
    (prisma.registrationRequest as any).findUnique = async () => approvedRequest;

    let accountCreates = 0;
    let approvalClaimWhere: unknown;
    (prisma as any).$transaction = async (operation: any) =>
      operation({
        registrationRequest: {
          updateMany: async (args: any) => {
            approvalClaimWhere = args.where;
            return { count: 0 };
          },
        },
        user: {
          create: async () => {
            accountCreates += 1;
            return { id: 1 };
          },
        },
      });

    await assert.rejects(
      invokeController(approveRequest, {
        params: { id: '70' },
        user: { role: 'SUPER_ADMIN' },
      }),
      ConflictError
    );
    assert.deepEqual(approvalClaimWhere, { id: 70, status: 'PENDING' });
    assert.equal(accountCreates, 0);
    console.log('✓ Approval atomically rejects an already-resolved request before account creation');

    let rejectionWhere: unknown;
    (prisma.registrationRequest as any).updateMany = async (args: any) => {
      rejectionWhere = args.where;
      return { count: 0 };
    };
    await assert.rejects(
      invokeController(rejectRequest, {
        params: { id: '70' },
        body: { reason: 'late rejection' },
        user: { role: 'SUPER_ADMIN' },
      }),
      ConflictError
    );
    assert.deepEqual(rejectionWhere, { id: 70, status: 'PENDING' });
    assert.equal(approvedRequest.status, 'APPROVED');
    assert.equal(accountCreates, 0);
    console.log('✓ Rejection cannot overwrite APPROVED or orphan its existing account');
  } finally {
    (prisma as any).$transaction = originalTransaction;
    (prisma.student as any).findUnique = originalStudentFindUnique;
    (prisma.student as any).findMany = originalStudentFindMany;
    (prisma.course as any).findMany = originalCourseFindMany;
    (prisma.course as any).findUnique = originalCourseFindUnique;
    (prisma.enrollment as any).findMany = originalEnrollmentFindMany;
    (prisma.enrollment as any).findUnique = originalEnrollmentFindUnique;
    (prisma.enrollment as any).findFirst = originalEnrollmentFindFirst;
    (prisma.enrollment as any).updateMany = originalEnrollmentUpdateMany;
    (prisma.auditLog as any).create = originalAuditLogCreate;
    (prisma.registrationRequest as any).findUnique = originalRequestFindUnique;
    (prisma.registrationRequest as any).updateMany = originalRequestUpdateMany;
  }
}

await runEnrollmentLifecycleIntegrityTests();
console.log('Enrollment lifecycle integrity checks passed');
