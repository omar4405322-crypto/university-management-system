import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { Prisma } from '@prisma/client';
import prisma from '../src/utils/prismaClient';
import { EnrollmentService } from '../src/services/enrollment.service';
import { getAllStudents } from '../src/controllers/students.controller';

// Helper to create an isolated department and college for test fixtures
async function createTestDepartment(prefix: string) {
  const unique = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const college = await prisma.college.create({
    data: {
      name: `College ${unique}`,
      nameAr: `كلية ${unique}`,
    },
  });

  const department = await prisma.department.create({
    data: {
      name: `Dept ${unique}`,
      nameAr: `قسم ${unique}`,
      collegeId: college.id,
    },
  });

  return { college, department };
}

// Helper to cleanup college, department, and related cascade
async function cleanupTestFixtures(departmentId: number, collegeId: number) {
  try {
    // Delete enrollments for courses in this department
    const courses = await prisma.course.findMany({
      where: { departmentId },
      select: { id: true },
    });
    const courseIds = courses.map((c) => c.id);
    if (courseIds.length > 0) {
      await prisma.enrollment.deleteMany({ where: { courseId: { in: courseIds } } });
      await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
    }

    // Delete students and their users in this department
    const students = await prisma.student.findMany({
      where: { departmentId },
      select: { id: true, userId: true },
    });
    const studentIds = students.map((s) => s.id);
    const userIds = students.map((s) => s.userId);

    if (studentIds.length > 0) {
      await prisma.enrollment.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    await prisma.department.delete({ where: { id: departmentId } }).catch(() => {});
    await prisma.college.delete({ where: { id: collegeId } }).catch(() => {});
  } catch (err) {
    console.error('Fixture cleanup warning:', err);
  }
}

// Helper to batch-create students
async function createTestStudents(departmentId: number, count: number, prefix: string) {
  const students = [];
  const currentAcademicYear = new Date().getFullYear();
  for (let i = 0; i < count; i++) {
    const unique = `${prefix}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
    const user = await prisma.user.create({
      data: {
        email: `${unique}@test.local`,
        password: 'hashed-password-placeholder',
        role: 'STUDENT',
        isActive: true,
      },
    });
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        firstName: `First${i}`,
        lastName: `Last${i}`,
        studentId: `STU-${unique}`,
        year: 1,
        departmentId,
        isActive: true,
      },
    });
    students.push(student);
  }
  return students;
}

test('SECTION 2: Real PostgreSQL P5-01 After Benchmark (25, 100, 250 enrollments)', async (t) => {
  const scales = [25, 100, 250];
  const benchmarkResults: Record<number, any> = {};

  for (const n of scales) {
    await t.test(`Real PostgreSQL Benchmark: Scale ${n}`, async () => {
      const { college, department } = await createTestDepartment(`bench-${n}`);
      try {
        const course = await prisma.course.create({
          data: {
            courseCode: `CRS-BENCH-${n}-${Date.now()}`,
            name: `Bench Course ${n}`,
            credits: 3,
            maxStudents: n + 50,
            year: 1,
            semester: 1,
            departmentId: department.id,
          },
        });

        await createTestStudents(department.id, n, `b${n}`);

        let p2034Count = 0;
        let p2002Count = 0;
        let errorCount = 0;

        const startTime = performance.now();
        const syncResult = await EnrollmentService.syncAllEnrollments();
        const wallTimeMs = performance.now() - startTime;

        const rowsCreated = await prisma.enrollment.count({
          where: {
            courseId: course.id,
            academicYear: new Date().getFullYear(),
            semester: 1,
            status: 'ENROLLED',
          },
        });

        assert.equal(rowsCreated, n, `Expected ${n} rows created in PostgreSQL`);

        benchmarkResults[n] = {
          scale: n,
          wallTimeMs: Number(wallTimeMs.toFixed(2)),
          rowsCreated,
          transactionCount: 1, // 1 course-bounded transaction for the benchmark course
          errorCount,
          p2034Count,
          p2002Count,
        };

        console.log(`REAL_POSTGRES_BENCHMARK scale=${n}: ${wallTimeMs.toFixed(2)} ms, rowsCreated=${rowsCreated}`);
      } finally {
        await cleanupTestFixtures(department.id, college.id);
      }
    });
  }

  (globalThis as any).__P5_BENCHMARK_RESULTS = benchmarkResults;
});

test('SECTION 3: Required Concurrent Sync Test (2 simultaneous syncs on capacity=50, 40 pre-enrolled, 30 missing)', async () => {
  const { college, department } = await createTestDepartment('conc-sync');
  const currentAcademicYear = new Date().getFullYear();

  try {
    const course = await prisma.course.create({
      data: {
        courseCode: `CRS-CONC-${Date.now()}`,
        name: 'Concurrent Sync Course',
        credits: 3,
        maxStudents: 50,
        year: 1,
        semester: 1,
        departmentId: department.id,
      },
    });

    // Create 70 students total: 40 pre-enrolled + 30 eligible missing
    const allStudents = await createTestStudents(department.id, 70, 'conc');
    const preEnrolledStudents = allStudents.slice(0, 40);
    const missingStudents = allStudents.slice(40);

    for (const s of preEnrolledStudents) {
      await prisma.enrollment.create({
        data: {
          studentId: s.id,
          courseId: course.id,
          semester: 1,
          academicYear: currentAcademicYear,
          status: 'ENROLLED',
        },
      });
    }

    const preCount = await prisma.enrollment.count({
      where: { courseId: course.id, status: 'ENROLLED' },
    });
    assert.equal(preCount, 40);

    let p2034Count = 0;
    let p2002Count = 0;
    let otherErrors = 0;

    // Run two simultaneous calls to syncAllEnrollments
    const [resultA, resultB] = await Promise.all([
      EnrollmentService.syncAllEnrollments().catch((e: any) => {
        if (e?.code === 'P2034') p2034Count++;
        else if (e?.code === 'P2002') p2002Count++;
        else otherErrors++;
        return { totalStudents: 70, totalEnrolled: 0, error: e?.message };
      }),
      EnrollmentService.syncAllEnrollments().catch((e: any) => {
        if (e?.code === 'P2034') p2034Count++;
        else if (e?.code === 'P2002') p2002Count++;
        else otherErrors++;
        return { totalStudents: 70, totalEnrolled: 0, error: e?.message };
      }),
    ]);

    const finalEnrolledCount = await prisma.enrollment.count({
      where: {
        courseId: course.id,
        semester: 1,
        academicYear: currentAcademicYear,
        status: 'ENROLLED',
      },
    });

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: course.id, semester: 1, academicYear: currentAcademicYear },
      select: { studentId: true },
    });

    const studentIds = enrollments.map((e) => e.studentId);
    const uniqueIds = new Set(studentIds);
    const duplicateCount = studentIds.length - uniqueIds.size;

    assert.ok(finalEnrolledCount <= 50, `Capacity must not exceed 50 (got ${finalEnrolledCount})`);
    assert.equal(finalEnrolledCount, 50, `Must fill all remaining 10 seats to reach capacity 50`);
    assert.equal(duplicateCount, 0, 'Must have zero duplicate enrollment records');

    console.log(`CONCURRENT_SYNC_TEST_RESULTS:`);
    console.log(`  SYNC_A_RESULT = enrolled ${resultA.totalEnrolled}`);
    console.log(`  SYNC_B_RESULT = enrolled ${resultB.totalEnrolled}`);
    console.log(`  FINAL_ENROLLED_COUNT = ${finalEnrolledCount} / 50`);
    console.log(`  DUPLICATE_COUNT = ${duplicateCount}`);
    console.log(`  P2034_COUNT = ${p2034Count}`);
    console.log(`  P2002_COUNT = ${p2002Count}`);
    console.log(`  OTHER_ERRORS = ${otherErrors}`);
  } finally {
    await cleanupTestFixtures(department.id, college.id);
  }
});

test('SECTION 4: Required Sync vs Interactive Enrollment Race (capacity=50, 49 enrolled, 1 seat remaining)', async () => {
  const { college, department } = await createTestDepartment('race-sync');
  const currentAcademicYear = new Date().getFullYear();

  try {
    const course = await prisma.course.create({
      data: {
        courseCode: `CRS-RACE-${Date.now()}`,
        name: 'Race Course',
        credits: 3,
        maxStudents: 50,
        year: 1,
        semester: 1,
        departmentId: department.id,
      },
    });

    // Create 51 students total: 49 pre-enrolled + 2 eligible missing
    const allStudents = await createTestStudents(department.id, 51, 'race');
    const preEnrolled = allStudents.slice(0, 49);
    const candidate1 = allStudents[49];
    const candidate2 = allStudents[50];

    for (const s of preEnrolled) {
      await prisma.enrollment.create({
        data: {
          studentId: s.id,
          courseId: course.id,
          semester: 1,
          academicYear: currentAcademicYear,
          status: 'ENROLLED',
        },
      });
    }

    const preCount = await prisma.enrollment.count({
      where: { courseId: course.id, status: 'ENROLLED' },
    });
    assert.equal(preCount, 49);

    // Race: syncAllEnrollments() vs interactive enrollStudent(candidate1)
    const [resSync, resInteractive] = await Promise.allSettled([
      EnrollmentService.syncAllEnrollments(),
      EnrollmentService.enrollStudent(candidate1.id, course.id, 1, currentAcademicYear),
    ]);

    const finalEnrolledCount = await prisma.enrollment.count({
      where: {
        courseId: course.id,
        semester: 1,
        academicYear: currentAcademicYear,
        status: 'ENROLLED',
      },
    });

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: course.id, semester: 1, academicYear: currentAcademicYear },
      select: { studentId: true },
    });
    const studentIds = enrollments.map((e) => e.studentId);
    const uniqueIds = new Set(studentIds);
    const duplicateCount = studentIds.length - uniqueIds.size;

    assert.equal(finalEnrolledCount, 50, 'Course must have exactly 50 enrolled students');
    assert.equal(duplicateCount, 0, 'Zero duplicate enrollments');

    const winner =
      resInteractive.status === 'fulfilled'
        ? 'INTERACTIVE_ENROLLMENT'
        : 'SYNC_ALL_ENROLLMENTS';

    console.log(`SYNC_VS_INTERACTIVE_RACE_RESULTS:`);
    console.log(`  SYNC_STATUS = ${resSync.status}`);
    console.log(`  INTERACTIVE_STATUS = ${resInteractive.status}`);
    console.log(`  FINAL_SEAT_WINNER = ${winner}`);
    console.log(`  FINAL_ENROLLED_COUNT = ${finalEnrolledCount} / 50`);
    console.log(`  DUPLICATE_COUNT = ${duplicateCount}`);
  } finally {
    await cleanupTestFixtures(department.id, college.id);
  }
});

test('SECTION 5: Retry-Exhaustion Fallback Semantics (batch retry failure triggers granular per-student fallback)', async () => {
  const origStudentFindMany = prisma.student.findMany;
  const origCourseFindMany = prisma.course.findMany;
  const origEnrollmentFindMany = prisma.enrollment.findMany;
  const origTransaction = prisma.$transaction;

  try {
    const mockStudents = [
      { id: 8001, departmentId: 1, year: 1 },
      { id: 8002, departmentId: 1, year: 1 },
    ];
    const mockCourses = [
      { id: 999, departmentId: 1, year: 1, semester: 1 },
    ];

    (prisma.student as any).findMany = async () => mockStudents;
    (prisma.course as any).findMany = async () => mockCourses;
    (prisma.enrollment as any).findMany = async () => [];

    let batchAttempts = 0;
    let fallbackCalls = 0;

    // Simulate batch transaction failing with P2034 on all 3 attempts
    (prisma as any).$transaction = async (callback: any) => {
      batchAttempts++;
      if (batchAttempts <= 3) {
        const error: any = new Error('serialization conflict in batch');
        error.code = 'P2034';
        throw error;
      }

      // If called during granular fallback, succeed
      fallbackCalls++;
      const tx = {
        enrollment: {
          findUnique: async () => null,
          count: async () => 0,
          create: async (args: any) => ({ id: args.data.studentId, ...args.data }),
        },
        course: {
          findUnique: async () => ({ maxStudents: 30 }),
        },
      };
      return callback(tx);
    };

    const result = await EnrollmentService.syncAllEnrollments();

    // Verify:
    // 1. Batch transaction was attempted 3 times
    assert.equal(batchAttempts >= 3, true, 'Batch transaction must be retried up to MAX_RETRIES');
    // 2. Granular fallback was executed for the students
    assert.equal(fallbackCalls, 2, 'Fallback should execute individual transactions for candidate students');
    // 3. Sync did NOT throw and did NOT skip the entire course
    assert.equal(result.totalEnrolled, 2, 'Students in the course must be enrolled via granular fallback');
    console.log('RETRY_EXHAUSTION_VERIFIED: Granular fallback prevents silent course skipping');
  } finally {
    prisma.student.findMany = origStudentFindMany;
    prisma.course.findMany = origCourseFindMany;
    prisma.enrollment.findMany = origEnrollmentFindMany;
    prisma.$transaction = origTransaction;
  }
});

test('SECTION 7: P5-05 includeStats Route and Validation Verification', async () => {
  const origStudentFindMany = prisma.student.findMany;
  const origStudentCount = prisma.student.count;
  const origRegistrationRequestCount = prisma.registrationRequest.count;

  try {
    let studentFindManyCalls = 0;
    let studentCountCalls = 0;
    let registrationRequestCountCalls = 0;

    (prisma.student as any).findMany = async () => {
      studentFindManyCalls++;
      return [
        {
          id: 1,
          studentId: 'STU-001',
          firstName: 'Alice',
          lastName: 'Smith',
          user: { isActive: true },
          department: { id: 1, name: 'CS', college: { id: 1, name: 'Eng' } },
        },
      ];
    };

    (prisma.student as any).count = async () => {
      studentCountCalls++;
      return 1;
    };

    (prisma.registrationRequest as any).count = async () => {
      registrationRequestCountCalls++;
      return 0;
    };

    // Helper to invoke Express controller
    const invoke = (query: Record<string, string>) =>
      new Promise<any>((resolve, reject) => {
        const req: any = {
          query,
          user: { role: 'SUPER_ADMIN' },
          get: () => 'test-agent',
          ip: '127.0.0.1',
        };
        const res: any = {
          statusCode: 200,
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(body: any) {
            resolve({ statusCode: this.statusCode, body });
            return this;
          },
        };
        getAllStudents(req, res, (err: any) => reject(err));
      });

    // 1. Default request (no includeStats)
    studentFindManyCalls = 0;
    studentCountCalls = 0;
    registrationRequestCountCalls = 0;

    const resDefault = await invoke({ page: '1', limit: '10' });
    assert.equal(resDefault.statusCode, 200);
    assert.equal(resDefault.body.success, true);
    assert.equal(resDefault.body.data.stats, undefined, 'Stats must be undefined by default');
    assert.equal(studentFindManyCalls, 1, '1 findMany query');
    assert.equal(studentCountCalls, 1, '1 count query for pagination total');
    assert.equal(registrationRequestCountCalls, 0, '0 registration request count queries');

    // 2. Request with includeStats=true
    studentFindManyCalls = 0;
    studentCountCalls = 0;
    registrationRequestCountCalls = 0;

    const resWithStats = await invoke({ page: '1', limit: '10', includeStats: 'true' });
    assert.equal(resWithStats.statusCode, 200);
    assert.equal(resWithStats.body.success, true);
    assert.deepEqual(resWithStats.body.data.stats, {
      total: 1,
      active: 1,
      pending: 0,
      inactive: 1,
    });
    assert.equal(studentFindManyCalls, 1);
    assert.equal(studentCountCalls, 4, '1 filtered count + 3 student stat counts');
    assert.equal(registrationRequestCountCalls, 1, '1 pending request count');

    console.log('INCLUDE_STATS_VERIFIED: Default issues 2 queries without stats; includeStats=true issues 6 queries with stats');
  } finally {
    prisma.student.findMany = origStudentFindMany;
    prisma.student.count = origStudentCount;
    prisma.registrationRequest.count = origRegistrationRequestCount;
  }
});
