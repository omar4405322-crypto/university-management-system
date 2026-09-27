import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import prisma from '../src/utils/prismaClient';
import { EnrollmentService } from '../src/services/enrollment.service';
import { getAllStudents } from '../src/controllers/students.controller';

async function invokeController(controller: any, request: Record<string, unknown>) {
  return new Promise<any>((resolve, reject) => {
    const response: any = {
      status: (code: number) => {
        response.statusCode = code;
        return response;
      },
      json: (body: unknown) => resolve({ statusCode: response.statusCode || 200, body }),
    };
    controller(request, response, (error?: unknown) => reject(error));
  });
}

test('P5-01: Bulk enrollment transaction and query count regression (25 and 100 enrollments)', async (t) => {
  const currentAcademicYear = new Date().getFullYear();

  // Save original prisma methods
  const origStudentFindMany = prisma.student.findMany;
  const origCourseFindMany = prisma.course.findMany;
  const origEnrollmentFindMany = prisma.enrollment.findMany;
  const origTransaction = prisma.$transaction;

  for (const enrollmentCount of [25, 100]) {
    await t.test(`Scale: ${enrollmentCount} new enrollments`, async () => {
      // Setup mock data for enrollmentCount students across 1 course (capacity = enrollmentCount)
      const mockStudents = Array.from({ length: enrollmentCount }, (_, i) => ({
        id: 1000 + i,
        departmentId: 1,
        year: 1,
      }));

      const mockCourses = [
        { id: 500, departmentId: 1, year: 1, semester: 1 },
      ];

      let transactionCount = 0;
      let txDbOperations = 0;

      (prisma.student as any).findMany = async () => mockStudents;
      (prisma.course as any).findMany = async () => mockCourses;
      (prisma.enrollment as any).findMany = async () => []; // no initial enrollments

      (prisma as any).$transaction = async (callback: any, options: any) => {
        transactionCount++;
        assert.equal(
          options?.isolationLevel,
          Prisma.TransactionIsolationLevel.Serializable,
          'Transaction must be Serializable'
        );

        const tx = {
          course: {
            findUnique: async () => {
              txDbOperations++;
              return { maxStudents: enrollmentCount };
            },
          },
          enrollment: {
            count: async () => {
              txDbOperations++;
              return 0; // 0 currently enrolled
            },
            findMany: async () => {
              txDbOperations++;
              return [];
            },
            create: async (args: any) => {
              txDbOperations++;
              return { id: args.data.studentId, ...args.data };
            },
          },
        };

        return callback(tx);
      };

      const result = await EnrollmentService.syncAllEnrollments();

      assert.equal(result.totalStudents, enrollmentCount);
      assert.equal(result.totalEnrolled, enrollmentCount);

      // Verify transaction count: 1 transaction per course offering, NOT 1 per student
      assert.equal(
        transactionCount,
        1,
        `Expected 1 course-level transaction for ${enrollmentCount} enrollments, got ${transactionCount}`
      );

      // Total operations inside tx: 1 course.findUnique + 1 enrollment.count + 1 enrollment.findMany + enrollmentCount enrollment.create
      const expectedTxOps = 3 + enrollmentCount;
      assert.equal(
        txDbOperations,
        expectedTxOps,
        `Expected ${expectedTxOps} DB ops in transaction, got ${txDbOperations}`
      );
    });
  }

  // Restore prisma
  prisma.student.findMany = origStudentFindMany;
  prisma.course.findMany = origCourseFindMany;
  prisma.enrollment.findMany = origEnrollmentFindMany;
  prisma.$transaction = origTransaction;
});

test('P5-01: Correctness invariants (capacity limits, no duplicates, concurrent race handling, retries)', async (t) => {
  const currentAcademicYear = new Date().getFullYear();

  const origStudentFindMany = prisma.student.findMany;
  const origCourseFindMany = prisma.course.findMany;
  const origEnrollmentFindMany = prisma.enrollment.findMany;
  const origTransaction = prisma.$transaction;

  await t.test('1. Capacity is respected exactly (50 capacity, 45 existing, 20 candidates -> enrolls exactly 5)', async () => {
    const mockStudents = Array.from({ length: 20 }, (_, i) => ({
      id: 2000 + i,
      departmentId: 1,
      year: 1,
    }));

    (prisma.student as any).findMany = async () => mockStudents;
    (prisma.course as any).findMany = async () => [
      { id: 600, departmentId: 1, year: 1, semester: 1 },
    ];
    (prisma.enrollment as any).findMany = async () => [];

    let createdCount = 0;
    (prisma as any).$transaction = async (callback: any) => {
      const tx = {
        course: {
          findUnique: async () => ({ maxStudents: 50 }),
        },
        enrollment: {
          count: async () => 45, // 45 seats already taken
          findMany: async () => [],
          create: async () => {
            createdCount++;
            return {};
          },
        },
      };
      return callback(tx);
    };

    const result = await EnrollmentService.syncAllEnrollments();
    assert.equal(result.totalStudents, 20);
    assert.equal(result.totalEnrolled, 5);
    assert.equal(createdCount, 5, 'Must create exactly 5 enrollments to reach maxStudents=50');
  });

  await t.test('2. Students already enrolled inside transaction are not duplicated', async () => {
    const mockStudents = [
      { id: 2001, departmentId: 1, year: 1 },
      { id: 2002, departmentId: 1, year: 1 },
    ];

    (prisma.student as any).findMany = async () => mockStudents;
    (prisma.course as any).findMany = async () => [
      { id: 600, departmentId: 1, year: 1, semester: 1 },
    ];
    (prisma.enrollment as any).findMany = async () => [];

    let createdStudents: number[] = [];
    (prisma as any).$transaction = async (callback: any) => {
      const tx = {
        course: {
          findUnique: async () => ({ maxStudents: 50 }),
        },
        enrollment: {
          count: async () => 10,
          // Simulate 2001 already being committed by a concurrent worker
          findMany: async () => [{ studentId: 2001 }],
          create: async (args: any) => {
            createdStudents.push(args.data.studentId);
            return {};
          },
        },
      };
      return callback(tx);
    };

    const result = await EnrollmentService.syncAllEnrollments();
    assert.equal(result.totalEnrolled, 1);
    assert.deepEqual(createdStudents, [2002], 'Student 2001 must not be duplicated');
  });

  await t.test('3. Bounded retry on P2034 serialization conflict succeeds', async () => {
    const mockStudents = [{ id: 3001, departmentId: 1, year: 1 }];
    (prisma.student as any).findMany = async () => mockStudents;
    (prisma.course as any).findMany = async () => [
      { id: 700, departmentId: 1, year: 1, semester: 1 },
    ];
    (prisma.enrollment as any).findMany = async () => [];

    let attempts = 0;
    (prisma as any).$transaction = async (callback: any) => {
      attempts++;
      if (attempts === 1) {
        const error: any = new Error('serialization conflict');
        error.code = 'P2034';
        throw error;
      }
      const tx = {
        course: {
          findUnique: async () => ({ maxStudents: 10 }),
        },
        enrollment: {
          count: async () => 0,
          findMany: async () => [],
          create: async () => ({}),
        },
      };
      return callback(tx);
    };

    const result = await EnrollmentService.syncAllEnrollments();
    assert.equal(attempts, 2, 'Should retry on P2034 and succeed on attempt 2');
    assert.equal(result.totalEnrolled, 1);
  });

  // Restore prisma
  prisma.student.findMany = origStudentFindMany;
  prisma.course.findMany = origCourseFindMany;
  prisma.enrollment.findMany = origEnrollmentFindMany;
  prisma.$transaction = origTransaction;
});

test('P5-05: Student list query count reduction & contract regression', async (t) => {
  const origStudentFindMany = prisma.student.findMany;
  const origStudentCount = prisma.student.count;
  const origRegistrationRequestCount = prisma.registrationRequest.count;

  await t.test('Normal student list executes exactly 2 queries (1 findMany + 1 count)', async () => {
    let studentFindManyCalls = 0;
    let studentCountCalls = 0;
    let registrationRequestCountCalls = 0;

    (prisma.student as any).findMany = async () => [
      {
        id: 1,
        studentId: 'STU-001',
        firstName: 'Jane',
        lastName: 'Doe',
        user: { isActive: true },
        department: { id: 1, name: 'CS', college: { id: 1, name: 'Engineering' } },
      },
    ];

    (prisma.student as any).count = async () => {
      studentCountCalls++;
      return 1;
    };

    (prisma.registrationRequest as any).count = async () => {
      registrationRequestCountCalls++;
      return 0;
    };

    const res = await invokeController(getAllStudents, {
      query: { page: '1', limit: '10' },
      user: { role: 'SUPER_ADMIN' },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.students.length, 1);
    assert.equal(res.body.data.pagination.total, 1);
    assert.equal(res.body.data.stats, undefined, 'Stats object must not be returned when not requested');

    assert.equal(studentCountCalls, 1, 'Only 1 count query for pagination total');
    assert.equal(registrationRequestCountCalls, 0, 'Zero queries for registration requests');
  });

  await t.test('Explicit includeStats=true executes all 4 stats queries and returns stats object', async () => {
    let studentCountCalls = 0;
    let registrationRequestCountCalls = 0;

    (prisma.student as any).findMany = async () => [];
    (prisma.student as any).count = async (args: any) => {
      studentCountCalls++;
      return 10;
    };
    (prisma.registrationRequest as any).count = async () => {
      registrationRequestCountCalls++;
      return 3;
    };

    const res = await invokeController(getAllStudents, {
      query: { page: '1', limit: '10', includeStats: 'true' },
      user: { role: 'SUPER_ADMIN' },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data.stats, {
      total: 10,
      active: 10,
      pending: 3,
      inactive: 10,
    });

    // 1 for filtered total + 3 student count queries (statsTotal, active, inactive) = 4
    assert.equal(studentCountCalls, 4);
    assert.equal(registrationRequestCountCalls, 1);
  });

  // Restore prisma
  prisma.student.findMany = origStudentFindMany;
  prisma.student.count = origStudentCount;
  prisma.registrationRequest.count = origRegistrationRequestCount;
});
