import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import {
  getEnrollments,
  enrollStudent,
  withdrawStudent,
  updateGrade,
} from '../src/controllers/enrollment.controller';
import { EnrollmentService } from '../src/services/enrollment.service';
import enrollmentRouter from '../src/routes/enrollment.routes';
import { AuthorizationError } from '../src/utils/appError';

// Helper to invoke an Express controller with mock req/res
async function invokeController(
  controller: (req: any, res: any, next?: any) => Promise<any>,
  req: { user?: any; query?: any; body?: any; params?: any }
) {
  let responseBody: any;
  let statusCode = 200;

  await new Promise<void>((resolve, reject) => {
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (body: any) => {
        responseBody = body;
        resolve();
      },
    };

    controller(
      req as any,
      res,
      (error?: unknown) => (error ? reject(error) : resolve())
    );
  });

  return { statusCode, data: responseBody };
}

async function runEnrollmentSecurityTests() {
  console.log('--- Starting Enrollment Security Verification Suite (SEC-06) ---');

  // Preserve original prisma functions
  const originalAuditLogCreate = prisma.auditLog.create.bind(prisma.auditLog);
  const originalFindMany = prisma.enrollment.findMany.bind(prisma.enrollment);
  const originalFindUnique = prisma.enrollment.findUnique.bind(prisma.enrollment);
  const originalFindFirst = prisma.enrollment.findFirst.bind(prisma.enrollment);
  const originalUpdateMany = prisma.enrollment.updateMany.bind(prisma.enrollment);
  const originalCourseFindFirst = prisma.course.findFirst.bind(prisma.course);
  const originalEnrollStudent = EnrollmentService.enrollStudent.bind(EnrollmentService);
  const originalWithdrawStudent = EnrollmentService.withdrawStudent.bind(EnrollmentService);

  (prisma.auditLog.create as any) = async () => ({ id: 1 });

  try {
    // =========================================================================
    // 1. GET /api/enrollments: Scope merging and per-role restrictions
    // =========================================================================
    console.log('\n[Suite 1] Testing GET /api/enrollments scoping...');
    const capturedFindMany: any[] = [];
    (prisma.enrollment.findMany as any) = async (args: any) => {
      capturedFindMany.push(args);
      return [];
    };

    // 1a. DEPARTMENT_ADMIN without query params
    const deptAdminUser = {
      id: 10,
      role: 'DEPARTMENT_ADMIN',
      managedDepartmentId: 3,
    };
    await invokeController(getEnrollments, { user: deptAdminUser, query: {} });
    assert.equal(capturedFindMany.length, 1);
    assert.deepEqual(capturedFindMany[0].where, {
      AND: [
        {},
        { course: { departmentId: 3 } },
      ],
    });

    // 1b. DEPARTMENT_ADMIN with studentId query filter
    await invokeController(getEnrollments, {
      user: deptAdminUser,
      query: { studentId: '99' },
    });
    assert.equal(capturedFindMany.length, 2);
    assert.deepEqual(capturedFindMany[1].where, {
      AND: [
        { studentId: 99 },
        { course: { departmentId: 3 } },
      ],
    });

    // 1c. STUDENT sees only their own enrollments { studentId: user.student.id }
    const studentUser = {
      id: 50,
      role: 'STUDENT',
      student: { id: 77, departmentId: 3, year: 2 },
    };
    await invokeController(getEnrollments, { user: studentUser, query: {} });
    assert.equal(capturedFindMany.length, 3);
    assert.deepEqual(capturedFindMany[2].where, {
      AND: [
        {},
        { studentId: 77 },
      ],
    });

    // 1d. SUPER_ADMIN gets unrestricted where clause
    const superAdminUser = { id: 1, role: 'SUPER_ADMIN' };
    await invokeController(getEnrollments, { user: superAdminUser, query: { semester: '1' } });
    assert.equal(capturedFindMany.length, 4);
    assert.deepEqual(capturedFindMany[3].where, {
      AND: [
        { semester: 1 },
        {},
      ],
    });
    console.log('✓ GET /api/enrollments scoping verified for DEPARTMENT_ADMIN, STUDENT, and SUPER_ADMIN');

    // =========================================================================
    // 2. POST /api/enrollments (enrollStudent): Interim course-only scope policy
    // =========================================================================
    console.log('\n[Suite 2] Testing POST /api/enrollments course scoping & cross-dept electives...');
    let enrollCalledWith: any = null;
    (EnrollmentService.enrollStudent as any) = async (...args: any[]) => {
      enrollCalledWith = args;
      return { id: 1, status: 'ENROLLED' };
    };

    (prisma.course.findFirst as any) = async (args: any) => {
      // Course 101 belongs to Dept 3 (in scope)
      // Course 201 belongs to Dept 4 (out of scope for Dept 3 admin)
      const courseId = args?.where?.AND?.[0]?.id;
      const deptScope = args?.where?.AND?.[1]?.departmentId;
      if (courseId === 101 && deptScope === 3) {
        return { id: 101, departmentId: 3 };
      }
      return null;
    };

    // 2a. Enrolling into a course outside admin's department must throw AuthorizationError
    await assert.rejects(
      async () => {
        await invokeController(enrollStudent, {
          user: deptAdminUser,
          body: {
            studentId: 99,
            courseId: 201, // outside dept 3
            semester: 1,
            academicYear: new Date().getFullYear(),
          },
        });
      },
      (err: any) => {
        assert.ok(err instanceof AuthorizationError);
        assert.match(err.message, /not authorized for this course/i);
        return true;
      },
      'Should reject enrollment into out-of-scope course'
    );

    // 2b. Interim policy: cross-department student into in-scope course must SUCCEED
    const crossDeptStudentId = 888; // Student from another department
    const enrollResult = await invokeController(enrollStudent, {
      user: deptAdminUser,
      body: {
        studentId: crossDeptStudentId,
        courseId: 101, // in dept 3
        semester: 1,
        academicYear: new Date().getFullYear(),
      },
    });
    assert.equal(enrollResult.statusCode, 201);
    assert.deepEqual(enrollCalledWith, [crossDeptStudentId, 101, 1, new Date().getFullYear()]);
    console.log('✓ POST /api/enrollments course-only interim policy verified (cross-dept student allowed, out-of-scope course rejected)');

    // =========================================================================
    // 3. DELETE /api/enrollments/:id (withdrawStudent)
    // =========================================================================
    console.log('\n[Suite 3] Testing DELETE /api/enrollments/:id withdrawal scoping...');
    let withdrawCalled = false;
    (EnrollmentService.withdrawStudent as any) = async (id: number) => {
      withdrawCalled = true;
      return { id, status: 'WITHDRAWN' };
    };

    (prisma.enrollment.findUnique as any) = async ({ where }: any) => {
      if (where.id === 1001 || where.id === 2001) {
        return { id: where.id, courseId: where.id === 1001 ? 101 : 201 };
      }
      return null;
    };

    (prisma.enrollment.findFirst as any) = async ({ where }: any) => {
      const id = where?.AND?.[0]?.id;
      const deptId = where?.AND?.[1]?.course?.departmentId;
      // Enrollment 1001 is in Dept 3, Enrollment 2001 is in Dept 4
      if (id === 1001 && deptId === 3) {
        return { id: 1001, courseId: 101 };
      }
      return null;
    };

    // 3a. Withdrawing out-of-scope enrollment (2001) must fail
    await assert.rejects(
      async () => {
        await invokeController(withdrawStudent, {
          user: deptAdminUser,
          params: { id: '2001' },
        });
      },
      (err: any) => {
        assert.ok(err instanceof AuthorizationError);
        assert.match(err.message, /not authorized for this enrollment/i);
        return true;
      },
      'Should reject withdrawal of out-of-scope enrollment'
    );

    // 3b. Withdrawing in-scope enrollment (1001) must succeed
    withdrawCalled = false;
    const withdrawResult = await invokeController(withdrawStudent, {
      user: deptAdminUser,
      params: { id: '1001' },
    });
    assert.equal(withdrawCalled, true);
    assert.equal(withdrawResult.data.data.status, 'WITHDRAWN');
    console.log('✓ DELETE /api/enrollments/:id withdrawal scoping verified');

    // =========================================================================
    // 4. PATCH /api/enrollments/:id/grade (updateGrade)
    // =========================================================================
    console.log('\n[Suite 4] Testing PATCH /api/enrollments/:id/grade doctor and admin scoping...');
    let updatedGradeData: any = null;
    (prisma.enrollment.updateMany as any) = async (args: any) => {
      updatedGradeData = args;
      return { count: 1 };
    };
    (prisma.enrollment.findUnique as any) = async ({ where }: any) => ({
      id: where.id,
      courseId: where.id === 1001 ? 101 : 201,
      status: updatedGradeData?.data.status || 'ENROLLED',
      finalGrade: updatedGradeData?.data.finalGrade ?? null,
    });

    const doctorUser = {
      id: 20,
      role: 'DOCTOR',
      doctor: { id: 5, departmentId: 3 },
    };

    // Setup findFirst for doctor scheduleSlot check
    (prisma.enrollment.findFirst as any) = async ({ where }: any) => {
      const id = where?.AND?.[0]?.id;
      const doctorScopeId = where?.AND?.[1]?.course?.scheduleSlots?.some?.doctorId;
      const deptScopeId = where?.AND?.[1]?.course?.departmentId;

      // Enrollment 1001: Doctor 5 teaches it; in Dept 3
      if (id === 1001 && doctorScopeId === 5) {
        return { id: 1001, courseId: 101, status: 'ENROLLED' };
      }
      // Enrollment 1001: In Dept 3
      if (id === 1001 && deptScopeId === 3) {
        return { id: 1001, courseId: 101, status: 'ENROLLED' };
      }
      return null;
    };

    // 4a. Doctor grading enrollment 2001 (not taught by Doctor 5) must fail
    await assert.rejects(
      async () => {
        await invokeController(updateGrade, {
          user: doctorUser,
          params: { id: '2001' },
          body: { finalGrade: 85 },
        });
      },
      (err: any) => {
        assert.ok(err instanceof AuthorizationError);
        assert.match(err.message, /not authorized for this enrollment/i);
        return true;
      },
      'Doctor should be rejected from grading courses they do not teach'
    );

    // 4b. Doctor grading enrollment 1001 (taught by Doctor 5) must succeed
    updatedGradeData = null;
    const gradeResult = await invokeController(updateGrade, {
      user: doctorUser,
      params: { id: '1001' },
      body: { finalGrade: 85 },
    });
    assert.equal(gradeResult.data.data.finalGrade, 85);
    assert.equal(gradeResult.data.data.status, 'COMPLETED');
    assert.equal(updatedGradeData.data.finalGrade, 85);

    // 4c. Department Admin grading enrollment 2001 (outside Dept 3) must fail
    await assert.rejects(
      async () => {
        await invokeController(updateGrade, {
          user: deptAdminUser,
          params: { id: '2001' },
          body: { finalGrade: 90 },
        });
      },
      (err: any) => {
        assert.ok(err instanceof AuthorizationError);
        return true;
      },
      'Department admin should be rejected from grading courses outside their department'
    );
    console.log('✓ PATCH /api/enrollments/:id/grade scoping verified for DOCTOR and DEPARTMENT_ADMIN');

    // =========================================================================
    // 5. POST /api/enrollments/sync-all: Middleware restriction
    // =========================================================================
    console.log('\n[Suite 5] Testing POST /api/enrollments/sync-all middleware restrictions...');
    
    // Find the '/sync-all' route in enrollmentRouter stack
    const syncAllRoute = (enrollmentRouter as any).stack.find(
      (layer: any) => layer.route && layer.route.path === '/sync-all' && layer.route.methods.post
    );
    assert.ok(syncAllRoute, 'POST /sync-all route must exist on enrollment router');

    // The route stack contains [protect, authorize('SUPER_ADMIN'), syncAllEnrollments]
    const routeHandlers = syncAllRoute.route.stack.map((s: any) => s.handle);
    assert.ok(routeHandlers.length >= 2, 'Route must have middleware stack');

    // The second middleware in the route stack is the authorize middleware
    const authorizeMiddleware = routeHandlers[1];

    // Helper for testing express middleware
    const runMiddleware = (middleware: any, user: any): Promise<{ status?: number; nextCalled: boolean }> => {
      return new Promise((resolve) => {
        let status: number | undefined;
        const req: any = { user };
        const res: any = {
          status: (code: number) => {
            status = code;
            return res;
          },
          json: () => {
            resolve({ status, nextCalled: false });
          },
        };
        const next = () => {
          resolve({ status: undefined, nextCalled: true });
        };
        middleware(req, res, next);
      });
    };

    // 5a. COLLEGE_ADMIN must be rejected with 403
    const collegeAdminResult = await runMiddleware(authorizeMiddleware, { role: 'COLLEGE_ADMIN' });
    assert.equal(collegeAdminResult.status, 403, 'COLLEGE_ADMIN must receive 403 on /sync-all');
    assert.equal(collegeAdminResult.nextCalled, false);

    // 5b. DEPARTMENT_ADMIN must be rejected with 403
    const deptAdminSyncResult = await runMiddleware(authorizeMiddleware, { role: 'DEPARTMENT_ADMIN' });
    assert.equal(deptAdminSyncResult.status, 403, 'DEPARTMENT_ADMIN must receive 403 on /sync-all');
    assert.equal(deptAdminSyncResult.nextCalled, false);

    // 5c. SUPER_ADMIN must proceed (next called)
    const superAdminSyncResult = await runMiddleware(authorizeMiddleware, { role: 'SUPER_ADMIN' });
    assert.equal(superAdminSyncResult.nextCalled, true, 'SUPER_ADMIN must pass authorize middleware');

    console.log('✓ POST /api/enrollments/sync-all restricted to SUPER_ADMIN only');

    console.log('\n--- All 5 Enrollment Security Suites Passed Successfully ---');
  } finally {
    // Restore mocks
    prisma.enrollment.findMany = originalFindMany;
    prisma.enrollment.findUnique = originalFindUnique;
    prisma.enrollment.findFirst = originalFindFirst;
    prisma.enrollment.updateMany = originalUpdateMany;
    prisma.course.findFirst = originalCourseFindFirst;
    prisma.auditLog.create = originalAuditLogCreate;
    EnrollmentService.enrollStudent = originalEnrollStudent;
    EnrollmentService.withdrawStudent = originalWithdrawStudent;
    await prisma.$disconnect();
  }
}

runEnrollmentSecurityTests().catch((error) => {
  console.error('Enrollment Security Test Failed:', error);
  process.exitCode = 1;
});
