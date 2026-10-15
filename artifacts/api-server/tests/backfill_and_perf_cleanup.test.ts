import { test } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { runBackfill } from '../../../scripts/backfill_initial_term.mjs';
import { runPerfCleanup } from '../../../scripts/cleanup_perf_courses.mjs';

test('Backfill Initial Term (Zero Hardcoding) & Safe PERF* Cleanup (T8)', async () => {
  const runSuffix = `t8_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  let deptId: number | undefined;
  let collegeId: number | undefined;
  let studentId: number | undefined;
  let userId: number | undefined;
  let courseId: number | undefined;
  let legacyEnrollmentId: number | undefined;
  let unmappedEnrollmentId: number | undefined;
  let perfCourseId: number | undefined;
  let perfCourseWithEnrollmentId: number | undefined;
  let createdYearId: number | undefined;
  let createdTermId: number | undefined;

  try {
    // 1. Setup isolated test College and Dept
    const college = await prisma.college.create({
      data: { name: `Col_${runSuffix}` },
    });
    collegeId = college.id;

    const dept = await prisma.department.create({
      data: { name: `Dept_${runSuffix}`, collegeId: college.id },
    });
    deptId = dept.id;

    const user = await prisma.user.create({
      data: {
        email: `stu_${runSuffix}@test.local`,
        password: 'hashed-password-fixture',
        role: 'STUDENT',
        isActive: true,
      },
    });
    userId = user.id;

    const student = await prisma.student.create({
      data: {
        userId: user.id,
        firstName: 'Test',
        lastName: 'Student',
        studentId: `STU_${runSuffix}`,
        year: 1,
        departmentId: dept.id,
      },
    });
    studentId = student.id;

    const course = await prisma.course.create({
      data: {
        courseCode: `CRS_${runSuffix}`,
        name: `Course ${runSuffix}`,
        credits: 3,
        departmentId: dept.id,
        year: 1,
        semester: 1,
      },
    });
    courseId = course.id;

    // Create legacy enrollment matching target calendar year 2026, semester 1
    const legacyEnrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        semester: 1,
        academicYear: 2026,
        status: 'ENROLLED',
      },
    });
    legacyEnrollmentId = legacyEnrollment.id;
    assert.equal(legacyEnrollment.termId, null, 'Legacy enrollment must initially have termId: null');

    // Create legacy enrollment with semester 2 (unmapped row for semester 1 backfill)
    const unmappedEnrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        semester: 2,
        academicYear: 2026,
        status: 'ENROLLED',
      },
    });
    unmappedEnrollmentId = unmappedEnrollment.id;

    // 2. Create two PERF* courses: one completely orphan, one with an enrollment
    const perfCourseOrphan = await prisma.course.create({
      data: {
        courseCode: `PERF${Math.floor(100000 + Math.random() * 900000)}`,
        name: `Perf Course Orphan`,
        credits: 3,
        departmentId: dept.id,
        year: 1,
        semester: 1,
      },
    });
    perfCourseId = perfCourseOrphan.id;

    const perfCourseWithEnrollment = await prisma.course.create({
      data: {
        courseCode: `PERF${Math.floor(100000 + Math.random() * 900000)}`,
        name: `Perf Course Busy`,
        credits: 3,
        departmentId: dept.id,
        year: 1,
        semester: 1,
      },
    });
    perfCourseWithEnrollmentId = perfCourseWithEnrollment.id;

    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId: perfCourseWithEnrollment.id,
        semester: 1,
        academicYear: 2026,
        status: 'ENROLLED',
      },
    });

    // 3. Test backfill validation: missing options throws error (OD-14)
    await assert.rejects(
      async () => runBackfill({}),
      /Missing required calendar parameters/i,
      'runBackfill without explicit calendar parameters must be rejected'
    );

    // 4. Test backfill dry-run: default mode does not write to DB
    const dryRunReport = await runBackfill({
      yearName: `Year_${runSuffix}`,
      yearStartDate: '2026-09-01T00:00:00.000Z',
      yearEndDate: '2027-06-30T23:59:59.999Z',
      termName: `Term1_${runSuffix}`,
      termStartDate: '2026-09-01T00:00:00.000Z',
      termEndDate: '2027-01-31T23:59:59.999Z',
      semesterNumber: 1,
      apply: false,
    });
    assert.equal(dryRunReport.mode, 'DRY-RUN');
    const dryCheck = await prisma.enrollment.findUnique({ where: { id: legacyEnrollment.id } });
    assert.equal(dryCheck?.termId, null, 'Dry run must not write termId to DB');

    // 5. Test backfill apply mode: updates matching row and reports unmapped row
    const applyReport = await runBackfill({
      yearName: `Year_${runSuffix}`,
      yearStartDate: '2026-09-01T00:00:00.000Z',
      yearEndDate: '2027-06-30T23:59:59.999Z',
      termName: `Term1_${runSuffix}`,
      termStartDate: '2026-09-01T00:00:00.000Z',
      termEndDate: '2027-01-31T23:59:59.999Z',
      semesterNumber: 1,
      apply: true,
    });
    assert.equal(applyReport.mode, 'APPLY');
    assert.ok(applyReport.termId);
    createdTermId = applyReport.termId;
    createdYearId = applyReport.academicYearId;

    // Verify matching legacy enrollment now has termId populated
    const updatedEnrollment = await prisma.enrollment.findUnique({
      where: { id: legacyEnrollment.id },
    });
    assert.equal(updatedEnrollment?.termId, applyReport.termId, 'Matching enrollment must be stamped with active termId');

    // Verify unmapped enrollment remains termId: null
    const unmappedCheck = await prisma.enrollment.findUnique({
      where: { id: unmappedEnrollment.id },
    });
    assert.equal(unmappedCheck?.termId, null, 'Unmapped semester 2 enrollment must remain termId: null');

    // Verify backfill is idempotent
    const backfillRepeat = await runBackfill({
      yearName: `Year_${runSuffix}`,
      yearStartDate: '2026-09-01T00:00:00.000Z',
      yearEndDate: '2027-06-30T23:59:59.999Z',
      termName: `Term1_${runSuffix}`,
      termStartDate: '2026-09-01T00:00:00.000Z',
      termEndDate: '2027-01-31T23:59:59.999Z',
      semesterNumber: 1,
      apply: true,
    });
    assert.equal(backfillRepeat.updatedCounts.enrollments, 0, 'Repeat backfill must update 0 rows');

    // 6. Test PERF* cleanup dry-run
    const perfDryRun = await runPerfCleanup({ apply: false });
    assert.equal(perfDryRun.mode, 'DRY-RUN');
    assert.ok(perfDryRun.eligibleCourses.some((c: any) => c.id === perfCourseOrphan.id));

    // 7. Test PERF* cleanup apply
    const cleanupResult = await runPerfCleanup({ apply: true, backup: false });
    assert.ok(cleanupResult.success, 'Cleanup script must succeed');

    // Orphan PERF course must be purged
    const orphanCheck = await prisma.course.findUnique({
      where: { id: perfCourseId },
    });
    assert.equal(orphanCheck, null, 'Orphan PERF course must be deleted');

    // Busy PERF course must NOT be purged
    const busyCheck = await prisma.course.findUnique({
      where: { id: perfCourseWithEnrollmentId },
    });
    assert.ok(busyCheck, 'Busy PERF course with enrollments must NOT be deleted');

    // AuditLog must record PERF_COURSES_PURGED
    const auditRecord = await prisma.auditLog.findFirst({
      where: { action: 'PERF_COURSES_PURGED' },
    });
    assert.ok(auditRecord, 'Expected AuditLog entry for PERF_COURSES_PURGED');

  } finally {
    try {
      if (studentId) {
        await prisma.enrollment.deleteMany({ where: { studentId } });
        await prisma.student.deleteMany({ where: { id: studentId } });
      }
      if (courseId) {
        await prisma.course.deleteMany({ where: { id: courseId } });
      }
      if (perfCourseId) {
        await prisma.course.deleteMany({ where: { id: perfCourseId } });
      }
      if (perfCourseWithEnrollmentId) {
        await prisma.enrollment.deleteMany({ where: { courseId: perfCourseWithEnrollmentId } });
        await prisma.course.deleteMany({ where: { id: perfCourseWithEnrollmentId } });
      }
      if (deptId) {
        await prisma.department.deleteMany({ where: { id: deptId } });
      }
      if (collegeId) {
        await prisma.college.deleteMany({ where: { id: collegeId } });
      }
      if (userId) {
        await prisma.user.deleteMany({ where: { id: userId } });
      }
      if (createdTermId) {
        await prisma.academicTerm.deleteMany({ where: { id: createdTermId } });
      }
      if (createdYearId) {
        await prisma.academicYear.deleteMany({ where: { id: createdYearId } });
      }
    } catch {
      // ignore teardown errors
    } finally {
      await prisma.$disconnect();
    }
  }
});
