import { performance } from 'node:perf_hooks';
import prisma from '../src/utils/prismaClient';
import { EnrollmentService } from '../src/services/enrollment.service';

async function runBenchmark() {
  console.log('=== P5-01 BENCHMARK RE-MEASUREMENT ===\n');

  const origStudentFindMany = prisma.student.findMany;
  const origCourseFindMany = prisma.course.findMany;
  const origEnrollmentFindMany = prisma.enrollment.findMany;
  const origTransaction = prisma.$transaction;

  const testScales = [25, 100, 250];

  for (const n of testScales) {
    const mockStudents = Array.from({ length: n }, (_, i) => ({
      id: 5000 + i,
      departmentId: 1,
      year: 1,
    }));
    const mockCourses = [
      { id: 900, departmentId: 1, year: 1, semester: 1 },
    ];

    let txCount = 0;
    let dbOps = 0;

    (prisma.student as any).findMany = async () => {
      dbOps++;
      return mockStudents;
    };
    (prisma.course as any).findMany = async () => {
      dbOps++;
      return mockCourses;
    };
    (prisma.enrollment as any).findMany = async () => {
      dbOps++;
      return [];
    };

    (prisma as any).$transaction = async (callback: any) => {
      txCount++;
      const tx = {
        course: {
          findUnique: async () => {
            dbOps++;
            return { maxStudents: n + 10 };
          },
        },
        enrollment: {
          count: async () => {
            dbOps++;
            return 0;
          },
          findMany: async () => {
            dbOps++;
            return [];
          },
          create: async () => {
            dbOps++;
            return {};
          },
        },
      };
      return callback(tx);
    };

    // Warmup
    await EnrollmentService.syncAllEnrollments();

    // Reset counters for measured run
    txCount = 0;
    dbOps = 0;

    const start = performance.now();
    const result = await EnrollmentService.syncAllEnrollments();
    const duration = performance.now() - start;

    console.log(`Scale ${n} enrollments:`);
    console.log(`  Enrolled: ${result.totalEnrolled} / ${result.totalStudents}`);
    console.log(`  Wall time: ${duration.toFixed(2)} ms`);
    console.log(`  Transaction count: ${txCount}`);
    console.log(`  DB operations: ${dbOps} (3 initial read + 3 course metadata + ${n} creates)`);
    console.log('');
  }

  prisma.student.findMany = origStudentFindMany;
  prisma.course.findMany = origCourseFindMany;
  prisma.enrollment.findMany = origEnrollmentFindMany;
  prisma.$transaction = origTransaction;
}

runBenchmark().catch(console.error);
