import assert from 'node:assert/strict';
import {
  parseTimeToMinutes,
  doTimesOverlap,
  queryStudentPriorityOverview,
  queryStudentWeeklyOverview,
  queryDoctorTeachingInsights,
  queryTaSectionInsights,
  queryAdminOperationalInsights,
  compareScopedDepartments,
} from '../src/services/aiCrossDomainAnalytics.service';
import type { AuthActor } from '../src/types/auth.types';
import prisma from '../src/utils/prismaClient';

console.log('--- STARTING DETERMINISTIC CROSS-DOMAIN ANALYTICS TESTS ---');

// ============================================================================
// 1. TIME OVERLAP & MINUTE MATH TESTS
// ============================================================================
console.log('1. Time overlap & collision tests');

// Parse tests
assert.equal(parseTimeToMinutes('00:00'), 0);
assert.equal(parseTimeToMinutes('09:30'), 570);
assert.equal(parseTimeToMinutes('14:45'), 885);
assert.equal(parseTimeToMinutes('23:59'), 1439);
assert.equal(parseTimeToMinutes('invalid'), null);
assert.equal(parseTimeToMinutes(''), null);
assert.equal(parseTimeToMinutes('12'), null);

// Collision: strict overlap max(s1, s2) < min(e1, e2)
// True overlap: 09:00-11:00 and 10:00-12:00
assert.equal(doTimesOverlap('09:00', '11:00', '10:00', '12:00'), true);
// Contained: 09:00-12:00 and 10:00-11:00
assert.equal(doTimesOverlap('09:00', '12:00', '10:00', '11:00'), true);
// Identical: 09:00-11:00 and 09:00-11:00
assert.equal(doTimesOverlap('09:00', '11:00', '09:00', '11:00'), true);

// Adjacent / Back-to-back: NOT an overlap
// 09:00-11:00 and 11:00-13:00 -> min(11:00, 11:00) = 11:00, max(09:00, 11:00) = 11:00 -> max < min is FALSE
assert.equal(doTimesOverlap('09:00', '11:00', '11:00', '13:00'), false, 'Adjacent slots must never be called a conflict');
assert.equal(doTimesOverlap('11:00', '13:00', '09:00', '11:00'), false, 'Adjacent slots must never be called a conflict');

// Completely separate: 09:00-10:00 and 14:00-16:00
assert.equal(doTimesOverlap('09:00', '10:00', '14:00', '16:00'), false);

// Invalid timestamps
assert.equal(doTimesOverlap('invalid', '11:00', '10:00', '12:00'), false);
assert.equal(doTimesOverlap('09:00', '11:00', '10:00', 'bad'), false);

// ============================================================================
// 2. ACTOR SCOPE & ERROR HANDLING
// ============================================================================
console.log('2. Actor scope & error handling');

const emptyActor = { id: 999, role: 'STUDENT', student: null } as unknown as AuthActor;
const unauthDoc = { id: 998, role: 'DOCTOR', doctor: null } as unknown as AuthActor;
const unauthTa = { id: 997, role: 'TEACHING_ASSISTANT', teachingAssistant: null } as unknown as AuthActor;
const unscopedAdmin = { id: 996, role: 'COLLEGE_ADMIN', managedCollegeId: null, collegeId: null } as unknown as AuthActor;

const resStudent = await queryStudentPriorityOverview(emptyActor);
assert.equal(resStudent.status, 'EMPTY');
assert.equal(resStudent.hasData, false);

const resWeekly = await queryStudentWeeklyOverview(emptyActor);
assert.equal(resWeekly.status, 'EMPTY');
assert.equal(resWeekly.hasData, false);

const resDoc = await queryDoctorTeachingInsights(unauthDoc);
assert.equal(resDoc.status, 'EMPTY');
assert.equal(resDoc.hasData, false);

const resTa = await queryTaSectionInsights(unauthTa);
assert.equal(resTa.status, 'EMPTY');
assert.equal(resTa.hasData, false);

const resAdmin = await queryAdminOperationalInsights(unscopedAdmin);
assert.equal(resAdmin.status, 'UNAUTHORIZED_SCOPE');
assert.equal(resAdmin.hasData, false);

const resComp = await compareScopedDepartments(unscopedAdmin);
assert.equal(resComp.status, 'UNAUTHORIZED_SCOPE');
assert.equal(resComp.hasData, false);

// ============================================================================
// 3. STUDENT PRIORITY & DATA QUALITY CALCULATIONS (FIXTURES-ONLY)
// ============================================================================
console.log('3. Student Priority calculations');

const runId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

let createdDeptId: number | null = null;
let createdStudentUserId: number | null = null;
let createdStudentCourseId: number | null = null;
let createdStudentId: number | null = null;
let createdEnrollmentId: number | null = null;
let createdStudentSlotId: number | null = null;

let createdDoctorUserId: number | null = null;
let createdDoctorId: number | null = null;
let createdDoctorCourseId: number | null = null;
let createdDoctorSlotId: number | null = null;

try {
  const parentCollege = await prisma.college.findFirst();
  if (!parentCollege) {
    throw new Error('No College found in database to attach Department fixture');
  }

  const dept = await prisma.department.create({
    data: {
      name: `Analytics Dept ${runId}`,
      nameAr: `Analytics Dept Ar ${runId}`,
      collegeId: parentCollege.id,
    },
  });
  createdDeptId = dept.id;

  const testUser = await prisma.user.create({
    data: {
      email: `student_fixture_${runId}@university.test`,
      password: 'TestPassword123!',
      role: 'STUDENT',
      isActive: true,
    },
  });
  createdStudentUserId = testUser.id;

  const testCourseCode = `ST_${runId}`;
  const testCourse = await prisma.course.create({
    data: {
      courseCode: testCourseCode,
      name: `Analytics Fixture Course ${runId}`,
      credits: 3,
      year: 1,
      semester: 1,
      isPublished: true,
      departmentId: dept.id,
    },
  });
  createdStudentCourseId = testCourse.id;

  const createdStudent = await prisma.student.create({
    data: {
      userId: testUser.id,
      departmentId: dept.id,
      year: 1,
      studentId: `ST-${runId}`,
      firstName: 'Fixture',
      lastName: 'Student',
    },
  });
  createdStudentId = createdStudent.id;

  const enrollment = await prisma.enrollment.create({
    data: {
      studentId: createdStudent.id,
      courseId: testCourse.id,
      status: 'ENROLLED',
      semester: 1,
      academicYear: 2026,
    },
  });
  createdEnrollmentId = enrollment.id;

  const slot = await prisma.scheduleSlot.create({
    data: {
      courseId: testCourse.id,
      dayOfWeek: 'MONDAY',
      startTime: '10:00',
      endTime: '12:00',
      slotType: 'LECTURE',
      isArchived: false,
    },
  });
  createdStudentSlotId = slot.id;

  const actor: AuthActor = {
    id: createdStudent.userId,
    role: 'STUDENT',
    student: { id: createdStudent.id },
  };

  const overview = await queryStudentPriorityOverview(actor);
  assert.equal(overview.status, 'SUCCESS');
  assert.equal(overview.hasData, true);
  assert(['HIGH_ATTENTION', 'MEDIUM_ATTENTION', 'NORMAL'].includes(overview.priorityState));
  assert.ok(overview.summary.length > 0);
  assert.ok(overview.summaryAr.length > 0);
  assert.equal(overview.timeWindow.cairoTimezone, 'Africa/Cairo');
  assert.ok(typeof overview.overallStanding.gpa === 'number');

  // Provenance assertion: overview courses must contain our fixture course
  const foundFixtureCourse = overview.courses.find((c) => c.courseCode === testCourseCode);
  assert.ok(foundFixtureCourse, 'Overview must include the student fixture course code');

  // Verify explainability: if any course is HIGH_ATTENTION or MEDIUM_ATTENTION, it MUST have factors
  for (const course of overview.courses) {
    if (course.priorityState !== 'NORMAL') {
      assert.ok(course.factors.length > 0, `Course ${course.courseCode} in ${course.priorityState} must have explainable factors`);
      assert.ok(course.factorsAr.length > 0, `Course ${course.courseCode} in ${course.priorityState} must have Arabic factors`);
    }
    // Attendance data quality check
    if (course.totalSessions === 0) {
      assert.equal(course.attendanceQuality, 'NO_DATA');
      assert.equal(course.attendanceRate, null);
    } else {
      assert.equal(course.attendanceQuality, 'AVAILABLE');
      assert.ok(typeof course.attendanceRate === 'number');
    }
  }

  // Weekly Overview
  const weekly = await queryStudentWeeklyOverview(actor);
  assert.equal(weekly.status, 'SUCCESS');
  assert.equal(weekly.hasData, true);
  assert.equal(weekly.timeWindow.cairoTimezone, 'Africa/Cairo');
  assert.ok(weekly.timeWindow.weekStart <= weekly.timeWindow.weekEnd);
  assert.ok(typeof weekly.summary === 'string');
  assert.ok(typeof weekly.summaryAr === 'string');
  assert.ok(Array.isArray(weekly.events));
  assert.ok(Array.isArray(weekly.directConflicts));

  // Provenance assertion: events must contain our fixture slot
  const foundFixtureSlot = weekly.events.find((e) => e.courseCode === testCourseCode);
  assert.ok(foundFixtureSlot, 'Weekly events must include the student fixture slot');

  // ============================================================================
  // 4. DOCTOR TEACHING INSIGHTS (FIXTURES-ONLY)
  // ============================================================================
  console.log('4. Doctor Teaching Insights');

  const docUser = await prisma.user.create({
    data: {
      email: `doctor_fixture_${runId}@university.test`,
      password: 'DoctorPassword123!',
      role: 'DOCTOR',
      isActive: true,
    },
  });
  createdDoctorUserId = docUser.id;

  const createdDoctor = await prisma.doctor.create({
    data: {
      userId: docUser.id,
      departmentId: dept.id,
      doctorId: `DOC-${runId}`,
      firstName: 'Fixture',
      lastName: 'Doctor',
    },
  });
  createdDoctorId = createdDoctor.id;

  const docCourseCode = `DC_${runId}`;
  const docCourse = await prisma.course.create({
    data: {
      courseCode: docCourseCode,
      name: `Doctor Fixture Course ${runId}`,
      credits: 3,
      year: 1,
      semester: 1,
      isPublished: true,
      departmentId: dept.id,
    },
  });
  createdDoctorCourseId = docCourse.id;

  const docSlot = await prisma.scheduleSlot.create({
    data: {
      courseId: docCourse.id,
      doctorId: createdDoctor.id,
      dayOfWeek: 'SUNDAY',
      startTime: '09:00',
      endTime: '11:00',
      slotType: 'LECTURE',
      isArchived: false,
    },
  });
  createdDoctorSlotId = docSlot.id;

  const doctorActor: AuthActor = {
    id: createdDoctor.userId,
    role: 'DOCTOR',
    doctor: { id: createdDoctor.id },
  };

  const insights = await queryDoctorTeachingInsights(doctorActor);
  assert.equal(insights.status, 'SUCCESS');
  assert.equal(insights.hasData, true);
  assert.ok(typeof insights.totalCoursesCount === 'number');
  assert.ok(Array.isArray(insights.courses));
  assert.equal(insights.timeWindow.cairoTimezone, 'Africa/Cairo');

  // Provenance assertion: doctor courses must contain our fixture course
  const foundDocCourse = insights.courses.find((c) => c.courseCode === docCourseCode);
  assert.ok(foundDocCourse, 'Doctor insights courses must include fixture course');

  // Check course attention factors
  for (const crs of insights.coursesNeedingAttention) {
    assert.ok(crs.attentionFactors.length > 0, 'Every flagged doctor course must explain why');
    assert.ok(crs.attentionFactorsAr.length > 0, 'Every flagged doctor course must have Arabic factors');
  }

  // Workload summary checks
  assert.ok(typeof insights.totalWeeklyLecturesCount === 'number');
  assert.ok(typeof insights.totalPendingGradingCount === 'number');
} finally {
  const cleanupErrors: unknown[] = [];
  if (createdDoctorSlotId) {
    try {
      await prisma.scheduleSlot.delete({ where: { id: createdDoctorSlotId } });
    } catch (err) {
      cleanupErrors.push(err);
    }
  }
  if (createdStudentSlotId) {
    try {
      await prisma.scheduleSlot.delete({ where: { id: createdStudentSlotId } });
    } catch (err) {
      cleanupErrors.push(err);
    }
  }
  if (createdEnrollmentId) {
    try {
      await prisma.enrollment.delete({ where: { id: createdEnrollmentId } });
    } catch (err) {
      cleanupErrors.push(err);
    }
  }
  if (createdDoctorCourseId) {
    try {
      await prisma.course.delete({ where: { id: createdDoctorCourseId } });
    } catch (err) {
      cleanupErrors.push(err);
    }
  }
  if (createdStudentCourseId) {
    try {
      await prisma.course.delete({ where: { id: createdStudentCourseId } });
    } catch (err) {
      cleanupErrors.push(err);
    }
  }
  if (createdDoctorId) {
    try {
      await prisma.doctor.delete({ where: { id: createdDoctorId } });
    } catch (err) {
      cleanupErrors.push(err);
    }
  }
  if (createdStudentId) {
    try {
      await prisma.student.delete({ where: { id: createdStudentId } });
    } catch (err) {
      cleanupErrors.push(err);
    }
  }
  if (createdDoctorUserId) {
    try {
      await prisma.user.delete({ where: { id: createdDoctorUserId } });
    } catch (err) {
      cleanupErrors.push(err);
    }
  }
  if (createdStudentUserId) {
    try {
      await prisma.user.delete({ where: { id: createdStudentUserId } });
    } catch (err) {
      cleanupErrors.push(err);
    }
  }
  if (createdDeptId) {
    try {
      await prisma.department.delete({ where: { id: createdDeptId } });
    } catch (err) {
      cleanupErrors.push(err);
    }
  }

  if (cleanupErrors.length > 0) {
    console.error('Fixture cleanup encountered errors:', cleanupErrors);
    throw new Error(
      `Fixture cleanup failed with ${cleanupErrors.length} errors: ${cleanupErrors
        .map((e) => (e instanceof Error ? e.message : String(e)))
        .join('; ')}`
    );
  }
}

// ============================================================================
// 5. TA SECTION INSIGHTS
// ============================================================================
console.log('5. TA Section Insights');

const sampleTa = await prisma.teachingAssistant.findFirst({
  include: { user: true },
});

if (sampleTa) {
  const taActor: AuthActor = {
    id: sampleTa.userId,
    role: 'TEACHING_ASSISTANT',
    teachingAssistant: { id: sampleTa.id },
  };

  const taInsights = await queryTaSectionInsights(taActor);
  assert.equal(taInsights.status, 'SUCCESS');
  assert.equal(taInsights.timeWindow.cairoTimezone, 'Africa/Cairo');
  assert.ok(Array.isArray(taInsights.sections));
  assert.ok(Array.isArray(taInsights.directConflicts));
}

// ============================================================================
// 6. ADMIN OPERATIONAL INSIGHTS & DEPARTMENT COMPARISON
// ============================================================================
console.log('6. Admin Operational Insights & Department Comparison');

// Super Admin
const superAdminActor: AuthActor = { id: 1, role: 'SUPER_ADMIN' };
const superInsights = await queryAdminOperationalInsights(superAdminActor);
assert.equal(superInsights.status, 'SUCCESS');
assert.equal(superInsights.hasData, true);
assert.equal(superInsights.scopeLevel, 'GLOBAL');
assert.equal(superInsights.timeWindow.cairoTimezone, 'Africa/Cairo');

// Coinciding phrasing test: admin indicators must use "يتزامن مع" or explainable factors
for (const area of superInsights.coincidingAttentionAreas) {
  assert.ok(area.factors.length > 0, 'Every attention area must list factors');
  assert.ok(area.factorsAr.length > 0, 'Every attention area must list Arabic factors');
  assert.ok(
    area.phrasingNote.includes('يتزامن مع'),
    'Arabic findings must emphasize coincidence ("يتزامن مع") rather than unproven causality',
  );
}

// College Admin Scoping
const sampleCollege = await prisma.college.findFirst({
  where: { departments: { some: {} } },
  include: { departments: true },
});

if (sampleCollege) {
  const collegeAdminActor: AuthActor = {
    id: 2,
    role: 'COLLEGE_ADMIN',
    managedCollegeId: sampleCollege.id,
  };

  const colInsights = await queryAdminOperationalInsights(collegeAdminActor);
  assert.equal(colInsights.status, 'SUCCESS');
  assert.equal(colInsights.scopeLevel, 'COLLEGE');

  // Department comparison within scope
  const deptIds = sampleCollege.departments.slice(0, 2).map((d) => d.id);
  const compResult = await compareScopedDepartments(collegeAdminActor, deptIds);
  assert.equal(compResult.status, 'SUCCESS');
  assert.equal(compResult.hasData, true);
  assert.equal(compResult.timeWindow.cairoTimezone, 'Africa/Cairo');
  // Historical data unavailability must be explicitly reported without fabricated trends
  assert.equal(compResult.historicalComparison.available, false);
  assert.ok(compResult.historicalComparison.reason.length > 0);
  assert.ok(compResult.historicalComparison.reasonAr.length > 0);

  // Security test: Department Admin attempting to compare foreign department
  const managedDept = sampleCollege.departments[0];
  if (managedDept) {
    const deptAdminActor: AuthActor = {
      id: 3,
      role: 'DEPARTMENT_ADMIN',
      managedDepartmentId: managedDept.id,
    };

    // Find a department NOT managed by this dept admin
    const foreignDept = await prisma.department.findFirst({
      where: { id: { not: managedDept.id } },
    });

    if (foreignDept) {
      const foreignComp = await compareScopedDepartments(deptAdminActor, [managedDept.id, foreignDept.id]);
      assert.equal(
        foreignComp.status,
        'UNAUTHORIZED_SCOPE',
        'Comparing foreign departments outside managed scope must return UNAUTHORIZED_SCOPE',
      );
    }
  }
}

console.log('--- ALL DETERMINISTIC CROSS-DOMAIN ANALYTICS TESTS PASSED ---');
