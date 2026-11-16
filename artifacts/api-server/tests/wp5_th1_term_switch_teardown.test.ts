import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import prisma from '../src/utils/prismaClient';
import { teardownTermSwitchFixture } from './termSwitchFixtureTeardown.utils';

interface TrackedFixtureRows {
  enrollmentIds: number[];
  courseIds: number[];
  studentIds: number[];
  userIds: number[];
  departmentIds: number[];
  collegeIds: number[];
  termIds: number[];
  yearIds: number[];
  prevActiveYearId?: number;
  prevActiveTermId?: number;
}

function createTracker(): TrackedFixtureRows {
  return {
    enrollmentIds: [],
    courseIds: [],
    studentIds: [],
    userIds: [],
    departmentIds: [],
    collegeIds: [],
    termIds: [],
    yearIds: [],
  };
}

async function cleanupTrackedRows(tracked: TrackedFixtureRows): Promise<void> {
  const enrollmentOr: Array<Record<string, unknown>> = [];
  if (tracked.enrollmentIds.length > 0) {
    enrollmentOr.push({ id: { in: tracked.enrollmentIds } });
  }
  if (tracked.termIds.length > 0) {
    enrollmentOr.push({ termId: { in: tracked.termIds } });
  }
  if (tracked.studentIds.length > 0) {
    enrollmentOr.push({ studentId: { in: tracked.studentIds } });
  }
  if (tracked.courseIds.length > 0) {
    enrollmentOr.push({ courseId: { in: tracked.courseIds } });
  }

  if (enrollmentOr.length > 0) {
    await prisma.enrollment.deleteMany({ where: { OR: enrollmentOr } }).catch(() => {});
  }
  if (tracked.courseIds.length > 0) {
    await prisma.course.deleteMany({ where: { id: { in: tracked.courseIds } } }).catch(() => {});
  }
  if (tracked.studentIds.length > 0) {
    await prisma.student.deleteMany({ where: { id: { in: tracked.studentIds } } }).catch(() => {});
  }
  if (tracked.userIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: tracked.userIds } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId: { in: tracked.userIds } } }).catch(() => {});
    await prisma.refreshToken.deleteMany({ where: { userId: { in: tracked.userIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: tracked.userIds } } }).catch(() => {});
  }
  if (tracked.departmentIds.length > 0) {
    await prisma.department.deleteMany({ where: { id: { in: tracked.departmentIds } } }).catch(() => {});
  }
  if (tracked.collegeIds.length > 0) {
    await prisma.college.deleteMany({ where: { id: { in: tracked.collegeIds } } }).catch(() => {});
  }
  if (tracked.termIds.length > 0) {
    await prisma.academicTerm
      .updateMany({ where: { id: { in: tracked.termIds } }, data: { isCurrent: false } })
      .catch(() => {});
    for (const termId of [...tracked.termIds].reverse()) {
      await prisma.academicTerm.deleteMany({ where: { id: termId } }).catch(() => {});
    }
  }
  if (tracked.yearIds.length > 0) {
    await prisma.academicYear
      .updateMany({ where: { id: { in: tracked.yearIds } }, data: { isCurrent: false } })
      .catch(() => {});
    await prisma.academicYear.deleteMany({ where: { id: { in: tracked.yearIds } } }).catch(() => {});
  }
  if (tracked.prevActiveYearId !== undefined) {
    await prisma.academicYear
      .update({ where: { id: tracked.prevActiveYearId }, data: { isCurrent: true } })
      .catch(() => {});
  }
  if (tracked.prevActiveTermId !== undefined) {
    await prisma.academicTerm
      .update({ where: { id: tracked.prevActiveTermId }, data: { isCurrent: true } })
      .catch(() => {});
  }
}

async function setupTermSwitchFixtureScenario(tracked: TrackedFixtureRows) {
  const runSuffix = crypto.randomUUID().slice(0, 8);

  const prevActiveYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  const prevActiveTerm = await prisma.academicTerm.findFirst({ where: { isCurrent: true } });
  assert.ok(prevActiveYear, 'Expected a pre-existing current AcademicYear');
  assert.ok(prevActiveTerm, 'Expected a pre-existing current AcademicTerm');

  tracked.prevActiveYearId = prevActiveYear.id;
  tracked.prevActiveTermId = prevActiveTerm.id;

  await prisma.academicTerm.update({ where: { id: prevActiveTerm.id }, data: { isCurrent: false } });
  await prisma.academicYear.update({ where: { id: prevActiveYear.id }, data: { isCurrent: false } });

  const superAdmin = await prisma.user.create({
    data: {
      email: `wp5_th1_sa_${runSuffix}@test.local`,
      password: crypto.randomUUID(),
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
  tracked.userIds.push(superAdmin.id);

  const college1 = await prisma.college.create({
    data: { name: `WP5_TH1_College1_${runSuffix}` },
  });
  tracked.collegeIds.push(college1.id);

  const department1 = await prisma.department.create({
    data: { name: `WP5_TH1_Dept1_${runSuffix}`, collegeId: college1.id },
  });
  tracked.departmentIds.push(department1.id);

  const studentUser1 = await prisma.user.create({
    data: {
      email: `wp5_th1_stu1_${runSuffix}@test.local`,
      password: crypto.randomUUID(),
      role: 'STUDENT',
      isActive: true,
    },
  });
  tracked.userIds.push(studentUser1.id);

  const student1 = await prisma.student.create({
    data: {
      userId: studentUser1.id,
      firstName: 'TermSwitch',
      lastName: 'Primary',
      studentId: `ST1_${runSuffix}`,
      year: 1,
      departmentId: department1.id,
      isActive: true,
    },
  });
  tracked.studentIds.push(student1.id);

  const course1 = await prisma.course.create({
    data: {
      courseCode: `CS1_${runSuffix}`,
      name: `Course1_${runSuffix}`,
      departmentId: department1.id,
      year: 1,
      semester: 2,
      isPublished: true,
    },
  });
  tracked.courseIds.push(course1.id);

  const year = await prisma.academicYear.create({
    data: {
      name: `2091-2092_${runSuffix}`,
      startDate: new Date('2091-09-01T00:00:00.000Z'),
      endDate: new Date('2092-06-30T00:00:00.000Z'),
      isCurrent: true,
    },
  });
  tracked.yearIds.push(year.id);

  const term1 = await prisma.academicTerm.create({
    data: {
      academicYearId: year.id,
      name: `Fall 2091_${runSuffix}`,
      termType: 'FALL',
      semesterNumber: 1,
      startDate: new Date('2091-09-01T00:00:00.000Z'),
      endDate: new Date('2092-01-31T00:00:00.000Z'),
      isCurrent: false,
    },
  });
  tracked.termIds.push(term1.id);

  const term2 = await prisma.academicTerm.create({
    data: {
      academicYearId: year.id,
      name: `Spring 2092_${runSuffix}`,
      termType: 'SPRING',
      semesterNumber: 2,
      startDate: new Date('2092-02-01T00:00:00.000Z'),
      endDate: new Date('2092-06-30T00:00:00.000Z'),
      isCurrent: true,
    },
  });
  tracked.termIds.push(term2.id);

  // Second student & course in a second department (isolated college) with an Enrollment pointing at term2
  const college2 = await prisma.college.create({
    data: { name: `WP5_TH1_College2_${runSuffix}` },
  });
  tracked.collegeIds.push(college2.id);

  const department2 = await prisma.department.create({
    data: { name: `WP5_TH1_Dept2_${runSuffix}`, collegeId: college2.id },
  });
  tracked.departmentIds.push(department2.id);

  const studentUser2 = await prisma.user.create({
    data: {
      email: `wp5_th1_stu2_${runSuffix}@test.local`,
      password: crypto.randomUUID(),
      role: 'STUDENT',
      isActive: true,
    },
  });
  tracked.userIds.push(studentUser2.id);

  const student2 = await prisma.student.create({
    data: {
      userId: studentUser2.id,
      firstName: 'TermSwitch',
      lastName: 'Secondary',
      studentId: `ST2_${runSuffix}`,
      year: 1,
      departmentId: department2.id,
      isActive: true,
    },
  });
  tracked.studentIds.push(student2.id);

  const course2 = await prisma.course.create({
    data: {
      courseCode: `CS2_${runSuffix}`,
      name: `Course2_${runSuffix}`,
      departmentId: department2.id,
      year: 1,
      semester: 2,
      isPublished: true,
    },
  });
  tracked.courseIds.push(course2.id);

  const extraEnrollment = await prisma.enrollment.create({
    data: {
      studentId: student2.id,
      courseId: course2.id,
      semester: 2,
      academicYear: 1,
      termId: term2.id,
    },
  });
  tracked.enrollmentIds.push(extraEnrollment.id);

  const primaryEnrollment = await prisma.enrollment.create({
    data: {
      studentId: student1.id,
      courseId: course1.id,
      semester: 2,
      academicYear: 1,
      termId: term2.id,
    },
  });
  tracked.enrollmentIds.push(primaryEnrollment.id);

  // User-scoped side-effect rows to verify step (8) cleanup before User deletion
  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id,
      action: 'WP5_TH1_FIXTURE_AUDIT',
      entity: 'AcademicTerm',
      entityId: String(term2.id),
    },
  });
  await prisma.notification.create({
    data: {
      userId: studentUser1.id,
      title: `WP5_TH1_Notif_${runSuffix}`,
      message: 'Fixture notification',
    },
  });
  await prisma.refreshToken.create({
    data: {
      token: crypto.randomUUID(),
      familyId: crypto.randomUUID(),
      userId: studentUser1.id,
      expiresAt: new Date('2092-12-31T00:00:00.000Z'),
    },
  });

  return {
    ids: {
      termIds: [term1.id, term2.id],
      yearId: year.id,
      prevActiveYearId: prevActiveYear.id,
      prevActiveTermId: prevActiveTerm.id,
      studentId: student1.id,
      courseId: course1.id,
      studentUserId: studentUser1.id,
      superAdminId: superAdmin.id,
      departmentId: department1.id,
      collegeId: college1.id,
    },
    extraEnrollmentId: extraEnrollment.id,
    term1Id: term1.id,
    term2Id: term2.id,
    yearId: year.id,
    prevActiveYearId: prevActiveYear.id,
    prevActiveTermId: prevActiveTerm.id,
    student1Id: student1.id,
    course1Id: course1.id,
    studentUser1Id: studentUser1.id,
    superAdminId: superAdmin.id,
    department1Id: department1.id,
    college1Id: college1.id,
  };
}

after(async () => {
  await prisma.$disconnect();
});

test('WP5-TH1 T1: cleans fixture, term2 enrollment from second department, and restores current year/term', async () => {
  const tracked = createTracker();
  try {
    const scenario = await setupTermSwitchFixtureScenario(tracked);
    const failures = await teardownTermSwitchFixture(prisma, scenario.ids);

    assert.deepEqual(failures, []);
    assert.equal(await prisma.academicTerm.findUnique({ where: { id: scenario.term1Id } }), null);
    assert.equal(await prisma.academicTerm.findUnique({ where: { id: scenario.term2Id } }), null);
    assert.equal(await prisma.academicYear.findUnique({ where: { id: scenario.yearId } }), null);
    assert.equal(await prisma.enrollment.findUnique({ where: { id: scenario.extraEnrollmentId } }), null);

    const restoredYear = await prisma.academicYear.findUnique({ where: { id: scenario.prevActiveYearId } });
    const restoredTerm = await prisma.academicTerm.findUnique({ where: { id: scenario.prevActiveTermId } });
    assert.equal(restoredYear?.isCurrent, true);
    assert.equal(restoredTerm?.isCurrent, true);

    assert.equal(await prisma.academicYear.count({ where: { isCurrent: true } }), 1);
    assert.equal(await prisma.academicTerm.count({ where: { isCurrent: true } }), 1);
  } finally {
    await cleanupTrackedRows(tracked);
  }
});

test('WP5-TH1 T2: isolates course.deleteMany failure via Proxy, restores current year/term, and cleans remaining rows', async () => {
  const tracked = createTracker();
  try {
    const scenario = await setupTermSwitchFixtureScenario(tracked);

    const proxyDb = new Proxy(prisma, {
      get(target, prop) {
        if (prop === 'course') {
          return new Proxy(target.course, {
            get(courseTarget, courseProp) {
              if (courseProp === 'deleteMany') {
                return async () => {
                  throw new Error('Simulated course.deleteMany failure');
                };
              }
              const value = Reflect.get(courseTarget, courseProp, courseTarget);
              return typeof value === 'function' ? value.bind(courseTarget) : value;
            },
          });
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    const failures = await teardownTermSwitchFixture(proxyDb, scenario.ids);

    assert.ok(
      failures.some((step) => step.toLowerCase().includes('course')),
      `Expected failures to include the course step, got: ${JSON.stringify(failures)}`,
    );

    const restoredYear = await prisma.academicYear.findUnique({ where: { id: scenario.prevActiveYearId } });
    const restoredTerm = await prisma.academicTerm.findUnique({ where: { id: scenario.prevActiveTermId } });
    assert.equal(restoredYear?.isCurrent, true);
    assert.equal(restoredTerm?.isCurrent, true);
    assert.equal(await prisma.academicYear.count({ where: { isCurrent: true } }), 1);
    assert.equal(await prisma.academicTerm.count({ where: { isCurrent: true } }), 1);

    assert.equal(await prisma.student.findUnique({ where: { id: scenario.student1Id } }), null);
    assert.equal(
      await prisma.user.count({ where: { id: { in: [scenario.studentUser1Id, scenario.superAdminId] } } }),
      0,
    );
    assert.equal(await prisma.department.findUnique({ where: { id: scenario.department1Id } }), null);
    assert.equal(await prisma.college.findUnique({ where: { id: scenario.college1Id } }), null);
    assert.equal(await prisma.academicTerm.findUnique({ where: { id: scenario.term1Id } }), null);
    assert.equal(await prisma.academicTerm.findUnique({ where: { id: scenario.term2Id } }), null);
    assert.equal(await prisma.academicYear.findUnique({ where: { id: scenario.yearId } }), null);
  } finally {
    await cleanupTrackedRows(tracked);
  }
});

test('WP5-TH1 T3: returns empty array when all ids are undefined', async () => {
  const failures = await teardownTermSwitchFixture(prisma, {
    termIds: undefined as unknown as number[],
    yearId: undefined,
    prevActiveYearId: undefined,
    prevActiveTermId: undefined,
    studentId: undefined,
    courseId: undefined,
    studentUserId: undefined,
    superAdminId: undefined,
    departmentId: undefined,
    collegeId: undefined,
  });

  assert.deepEqual(failures, []);
});
