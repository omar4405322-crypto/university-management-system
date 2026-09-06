import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { GpsDriver } from '../src/attendance/drivers/GpsDriver';
import attendanceEngine from '../src/attendance/attendance.engine';
import { AttendanceService } from '../src/services/attendance.service';
import { autoResolvePendingAttendance } from '../src/utils/cron';

async function runPendingReviewRegressionSuite() {
  console.log('--- Starting PENDING_REVIEW Regression Suite ---');

  // =========================================================================
  // 1. GpsDriver Coordinate Bounds Validation & Accuracy Acceptance
  // =========================================================================
  console.log('Testing GpsDriver coordinate bounds and accuracy...');
  const gpsDriver = new GpsDriver();

  const mockSession = {
    id: 101,
    isActive: true,
    latitude: 30.0444,
    longitude: 31.2357,
    radius: 100, // 100 meters
    gracePeriodMins: 15,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    scheduleSlot: { id: 50, courseId: 10 },
  };

  const origFindUnique = prisma.attendanceSession.findUnique;
  (prisma.attendanceSession as any).findUnique = async () => mockSession;

  try {
    // 1a. Out of bounds latitude (> 90)
    const latOverResult = await gpsDriver.validate(
      { sessionId: 101, latitude: 95.0, longitude: 31.2357, accuracy: 15.0 },
      { studentId: 1 }
    );
    assert.equal(latOverResult.valid, false);
    assert.equal(latOverResult.errorCode, 'INVALID_COORDINATES');

    // 1b. Out of bounds latitude (< -90)
    const latUnderResult = await gpsDriver.validate(
      { sessionId: 101, latitude: -91.0, longitude: 31.2357 },
      { studentId: 1 }
    );
    assert.equal(latUnderResult.valid, false);
    assert.equal(latUnderResult.errorCode, 'INVALID_COORDINATES');

    // 1c. Out of bounds longitude (> 180)
    const lngOverResult = await gpsDriver.validate(
      { sessionId: 101, latitude: 30.0444, longitude: 181.0 },
      { studentId: 1 }
    );
    assert.equal(lngOverResult.valid, false);
    assert.equal(lngOverResult.errorCode, 'INVALID_COORDINATES');

    // 1d. Out of bounds longitude (< -180)
    const lngUnderResult = await gpsDriver.validate(
      { sessionId: 101, latitude: 30.0444, longitude: -185.0 },
      { studentId: 1 }
    );
    assert.equal(lngUnderResult.valid, false);
    assert.equal(lngUnderResult.errorCode, 'INVALID_COORDINATES');

    // 1e. In-range check-in (within 100m) with accuracy
    // Session is at (30.0444, 31.2357); device at same location
    const inRangeIntent = await gpsDriver.buildIntent(
      { sessionId: 101, latitude: 30.0444, longitude: 31.2357, accuracy: 8.5 },
      { studentId: 1 }
    );
    assert.equal(inRangeIntent.status, 'PRESENT');
    assert.equal(inRangeIntent.locationFlagged, false);
    assert.equal(inRangeIntent.pendingApprovedStatus, null);
    assert.deepEqual(inRangeIntent.locationData, {
      lat: 30.0444,
      lng: 31.2357,
      accuracy: 8.5,
    });

    // 1f. Out-of-range check-in (e.g. ~5km away in Cairo)
    const outOfRangeIntent = await gpsDriver.buildIntent(
      { sessionId: 101, latitude: 30.0800, longitude: 31.2800, accuracy: 12.0 },
      { studentId: 1 }
    );
    assert.equal(outOfRangeIntent.status, 'PENDING_REVIEW');
    assert.equal(outOfRangeIntent.locationFlagged, true);
    assert.equal(outOfRangeIntent.pendingApprovedStatus, 'PRESENT');
    assert.equal(outOfRangeIntent.locationData?.accuracy, 12.0);

    // 1g. High accuracy out-of-range must NEVER be auto-forgiven
    const highAccOutOfRangeIntent = await gpsDriver.buildIntent(
      { sessionId: 101, latitude: 30.0800, longitude: 31.2800, accuracy: 1.5 },
      { studentId: 1 }
    );
    assert.equal(highAccOutOfRangeIntent.status, 'PENDING_REVIEW');
    assert.equal(highAccOutOfRangeIntent.locationFlagged, true);
    assert.equal(highAccOutOfRangeIntent.pendingApprovedStatus, 'PRESENT');

    // 1h. Out-of-range past grace period -> pendingApprovedStatus should be LATE
    const lateSession = {
      ...mockSession,
      createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago, grace period 15 mins
    };
    (prisma.attendanceSession.findUnique as any) = async () => lateSession;
    const outOfRangeLateIntent = await gpsDriver.buildIntent(
      { sessionId: 101, latitude: 30.0800, longitude: 31.2800, accuracy: 5.0 },
      { studentId: 1 }
    );
    assert.equal(outOfRangeLateIntent.status, 'PENDING_REVIEW');
    assert.equal(outOfRangeLateIntent.locationFlagged, true);
    assert.equal(outOfRangeLateIntent.pendingApprovedStatus, 'LATE');

    console.log('✅ GpsDriver bounds, accuracy, and PENDING_REVIEW tests passed.');
  } finally {
    prisma.attendanceSession.findUnique = origFindUnique;
  }

  // =========================================================================
  // 2. AttendanceService.overrideFlaggedRecord (Approve)
  // =========================================================================
  console.log('Testing AttendanceService.overrideFlaggedRecord (Approve)...');
  const origAttendanceFindFirst = prisma.attendance.findFirst;
  const origAttendanceUpdateMany = prisma.attendance.updateMany;
  const origAttendanceFindUnique = prisma.attendance.findUnique;
  const origRecalculate = attendanceEngine.recalculateAbsence;

  let recalculatedStudentId: number | null = null;
  let recalculatedCourseId: number | null = null;
  attendanceEngine.recalculateAbsence = async (sId, cId) => {
    recalculatedStudentId = sId;
    recalculatedCourseId = cId;
  };

  try {
    let updatedData: any = null;
    (prisma.attendance.findFirst as any) = async () => ({
      id: 501,
      studentId: 77,
      courseId: 12,
      status: 'PENDING_REVIEW',
      locationFlagged: true,
      pendingApprovedStatus: 'LATE',
    });
    (prisma.attendance.updateMany as any) = async (args: any) => {
      updatedData = args.data;
      return { count: 1 };
    };
    (prisma.attendance.findUnique as any) = async () => ({
      id: 501,
      studentId: 77,
      courseId: 12,
      status: 'LATE',
      locationFlagged: false,
      pendingApprovedStatus: null,
    });

    const user = { role: 'ADMIN', id: 1, email: 'admin@uni.edu' };
    const approved = await AttendanceService.overrideFlaggedRecord(
      user,
      501,
      'Location verified by doctor'
    );

    assert.equal(updatedData.status, 'LATE');
    assert.equal(updatedData.pendingApprovedStatus, null);
    assert.equal(updatedData.locationFlagged, false);
    assert.equal(updatedData.overriddenBy, 'admin@uni.edu');
    assert.equal(updatedData.overrideNote, 'Location verified by doctor');
    assert.equal(recalculatedStudentId, 77);
    assert.equal(recalculatedCourseId, 12);
    assert.equal(approved?.status, 'LATE');

    console.log('✅ AttendanceService.overrideFlaggedRecord tests passed.');
  } finally {
    prisma.attendance.findFirst = origAttendanceFindFirst;
    prisma.attendance.updateMany = origAttendanceUpdateMany;
    prisma.attendance.findUnique = origAttendanceFindUnique;
    attendanceEngine.recalculateAbsence = origRecalculate;
  }

  // =========================================================================
  // 3. AttendanceService.rejectFlaggedRecord (Reject)
  // =========================================================================
  console.log('Testing AttendanceService.rejectFlaggedRecord (Reject)...');
  try {
    let updatedData: any = null;
    let rejectedStudentId: number | null = null;
    let rejectedCourseId: number | null = null;

    attendanceEngine.recalculateAbsence = async (sId, cId) => {
      rejectedStudentId = sId;
      rejectedCourseId = cId;
    };

    (prisma.attendance.findFirst as any) = async () => ({
      id: 502,
      studentId: 88,
      courseId: 15,
      status: 'PENDING_REVIEW',
      locationFlagged: true,
      pendingApprovedStatus: 'PRESENT',
    });
    (prisma.attendance.updateMany as any) = async (args: any) => {
      updatedData = args.data;
      return { count: 1 };
    };
    (prisma.attendance.findUnique as any) = async () => ({
      id: 502,
      studentId: 88,
      courseId: 15,
      status: 'ABSENT',
      locationFlagged: false,
      pendingApprovedStatus: null,
    });

    const user = { role: 'ADMIN', id: 1, email: 'admin@uni.edu' };
    const rejected = await AttendanceService.rejectFlaggedRecord(
      user,
      502,
      'Student not in classroom'
    );

    assert.equal(updatedData.status, 'ABSENT');
    assert.equal(updatedData.pendingApprovedStatus, null);
    assert.equal(updatedData.locationFlagged, false);
    assert.equal(updatedData.overriddenBy, 'admin@uni.edu');
    assert.equal(updatedData.overrideNote, 'Student not in classroom');
    assert.equal(rejectedStudentId, 88);
    assert.equal(rejectedCourseId, 15);
    assert.equal(rejected?.status, 'ABSENT');

    console.log('✅ AttendanceService.rejectFlaggedRecord tests passed.');
  } finally {
    prisma.attendance.findFirst = origAttendanceFindFirst;
    prisma.attendance.updateMany = origAttendanceUpdateMany;
    prisma.attendance.findUnique = origAttendanceFindUnique;
    attendanceEngine.recalculateAbsence = origRecalculate;
  }

  // =========================================================================
  // 4. Cron Auto-Resolve Job (autoResolvePendingAttendance)
  // =========================================================================
  console.log('Testing autoResolvePendingAttendance (Cron Auto-Resolve)...');
  const origAttendanceFindMany = prisma.attendance.findMany;
  try {
    const expiredList = [
      { id: 601, studentId: 10, courseId: 100 },
      { id: 602, studentId: 10, courseId: 100 }, // same pair
      { id: 603, studentId: 20, courseId: 200 },
    ];
    let capturedWhere: any = null;
    let capturedUpdateData: any = null;
    const recalcCalls: { sId: number; cId: number }[] = [];

    (prisma.attendance.findMany as any) = async (args: any) => {
      capturedWhere = args.where;
      return expiredList;
    };
    (prisma.attendance.updateMany as any) = async (args: any) => {
      capturedUpdateData = args.data;
      return { count: expiredList.length };
    };
    attendanceEngine.recalculateAbsence = async (sId, cId) => {
      recalcCalls.push({ sId, cId });
    };

    const count = await autoResolvePendingAttendance();
    assert.equal(count, 3);
    assert.equal(capturedWhere.status, 'PENDING_REVIEW');
    assert.ok(capturedWhere.createdAt.lte instanceof Date);

    assert.equal(capturedUpdateData.status, 'ABSENT');
    assert.equal(capturedUpdateData.pendingApprovedStatus, null);
    assert.equal(capturedUpdateData.locationFlagged, false);
    assert.ok(capturedUpdateData.overrideNote.includes('5 calendar days'));

    // Should recalculate for unique student:course pairs (10:100 and 20:200)
    assert.equal(recalcCalls.length, 2);
    assert.deepEqual(recalcCalls, [
      { sId: 10, cId: 100 },
      { sId: 20, cId: 200 },
    ]);

    // Test when no records are expired
    (prisma.attendance.findMany as any) = async () => [];
    const countEmpty = await autoResolvePendingAttendance();
    assert.equal(countEmpty, 0);

    console.log('✅ autoResolvePendingAttendance tests passed.');
  } finally {
    prisma.attendance.findMany = origAttendanceFindMany;
    prisma.attendance.updateMany = origAttendanceUpdateMany;
    attendanceEngine.recalculateAbsence = origRecalculate;
  }

  // =========================================================================
  // 5. Absence Percentage Calculation Exclusion (ALL FOUR SITES)
  // =========================================================================
  console.log('Testing absence percentage calculation exclusion across all 4 sites...');

  // -------------------------------------------------------------------------
  // Site 1: attendanceEngine.recalculateAbsence
  // Student has: 1 PRESENT, 1 ABSENT, 1 PENDING_REVIEW.
  // Active total must be 2 (3 - 1 PENDING_REVIEW), NOT 3!
  // Absence count is 1. Absence percent must be (1 / 2) * 100 = 50.0% (NOT 33.3%).
  // -------------------------------------------------------------------------
  const origRecalcEnrollmentFindMany = prisma.enrollment.findMany;
  const origEnrollmentUpdate = prisma.enrollment.update;
  const origCourseFindUnique = prisma.course.findUnique;
  const origPoliciesFindMany = prisma.absenceThresholdPolicy.findMany;
  const origRecalcAttendanceGroupBy = prisma.attendance.groupBy;
  const origNotificationCreate = prisma.notification.create;

  try {
    let customAbsenceThreshold = 25.0;
    (prisma.enrollment.findMany as any) = async () => [{
      id: 99,
      studentId: 44,
      courseId: 22,
      semester: 1,
      academicYear: 2026,
      status: 'ENROLLED',
      customAbsenceThreshold,
      exemptionPeriods: [],
      student: { userId: 440 },
      course: {
        id: 22,
        name: 'Computer Networks',
        departmentId: 1,
      },
    }];

    (prisma.attendance.groupBy as any) = async () => [
      { studentId: 44, courseId: 22, status: 'PRESENT', _count: { _all: 1 } },
      { studentId: 44, courseId: 22, status: 'ABSENT', _count: { _all: 1 } },
      { studentId: 44, courseId: 22, status: 'PENDING_REVIEW', _count: { _all: 1 } },
    ];
    (prisma.absenceThresholdPolicy.findMany as any) = async () => [];
    (prisma.notification.create as any) = async (args: any) => args.data;

    (prisma.course.findUnique as any) = async () => ({
      id: 22,
      name: 'Computer Networks',
      departmentId: 1,
    });

    let enrollmentUpdatedData: any = null;
    (prisma.enrollment.update as any) = async (args: any) => {
      enrollmentUpdatedData = args.data;
      return { id: 99, ...args.data };
    };

    await attendanceEngine.recalculateAbsence(44, 22);

    // Threshold is 25%.
    // With 1 PRESENT and 1 ABSENT (PENDING_REVIEW excluded), absence is 50%, so student is BLOCKED!
    // (If PENDING_REVIEW were treated as PRESENT in denominator, 1/3 = 33.3%, still blocked,
    // but let's test a case where denominator exclusion makes the exact difference):
    assert.equal(enrollmentUpdatedData?.status, 'BLOCKED');

    // Now test with threshold = 40%:
    // If activeTotal = 2 (excluded PENDING_REVIEW), absence = 1/2 = 50% -> BLOCKED (> 40%).
    // If PENDING_REVIEW were counted in denominator as PRESENT: activeTotal = 3, absence = 1/3 = 33.3% -> ENROLLED (<= 40%).
    customAbsenceThreshold = 40.0;

    enrollmentUpdatedData = null;
    await attendanceEngine.recalculateAbsence(44, 22);
    // Because 50% >= 40%, student MUST be blocked!
    assert.equal(
      enrollmentUpdatedData?.status,
      'BLOCKED',
      'Site 1 failed: PENDING_REVIEW was not excluded from denominator in recalculateAbsence!'
    );

    console.log('✅ Site 1 (attendanceEngine.recalculateAbsence) verified: PENDING_REVIEW correctly excluded.');
  } finally {
    prisma.enrollment.findMany = origRecalcEnrollmentFindMany;
    prisma.enrollment.update = origEnrollmentUpdate;
    prisma.course.findUnique = origCourseFindUnique;
    prisma.attendance.findMany = origAttendanceFindMany;
    prisma.attendance.groupBy = origRecalcAttendanceGroupBy;
    prisma.absenceThresholdPolicy.findMany = origPoliciesFindMany;
    prisma.notification.create = origNotificationCreate;
  }

  // -------------------------------------------------------------------------
  // Site 2: attendanceService.getStudentAttendance & getMyAbsenceWarnings
  // -------------------------------------------------------------------------
  const origStudentFindUnique = prisma.student.findUnique;
  const origScheduleSlotFindMany = prisma.scheduleSlot.findMany;
  const origAttendanceSessionFindMany = prisma.attendanceSession.findMany;
  const origAttendanceCount = prisma.attendance.count;
  const origWarningAttendanceGroupBy = prisma.attendance.groupBy;

  try {
    (prisma.student.findUnique as any) = async () => ({
      id: 44,
      userId: 440,
      groupId: 1,
      enrollments: [
        {
          id: 99,
          courseId: 22,
          status: 'ENROLLED',
          customAbsenceThreshold: 25.0,
          course: { id: 22, courseCode: 'CS101', name: 'CS 101', departmentId: 1 },
          exemptionPeriods: [],
        },
      ],
    });

    (prisma.scheduleSlot.findMany as any) = async () => [{ id: 10, courseId: 22 }];
    (prisma.attendanceSession.findMany as any) = async () => [
      { id: 101, scheduleSlotId: 10 },
      { id: 102, scheduleSlotId: 10 },
      { id: 103, scheduleSlotId: 10 },
    ]; // 3 sessions held

    // sessionAttendances: 1 PRESENT, 1 ABSENT, 1 PENDING_REVIEW
    (prisma.attendance.findMany as any) = async (args: any) => {
      if (args?.where?.sessionId) {
        return [
          { status: 'PRESENT' },
          { status: 'ABSENT' },
          { status: 'PENDING_REVIEW' },
        ];
      }
      return [];
    };
    (prisma.attendance.count as any) = async () => 3;
    (prisma.attendance.groupBy as any) = async (args: any) => {
      if (args?.where?.sessionId === null) return [];
      return [
        { sessionId: 101, status: 'PRESENT', _count: { _all: 1 } },
        { sessionId: 102, status: 'ABSENT', _count: { _all: 1 } },
        { sessionId: 103, status: 'PENDING_REVIEW', _count: { _all: 1 } },
      ];
    };

    // Test getStudentAttendance
    const user = { role: 'STUDENT', id: 440 };
    const result = await AttendanceService.getStudentAttendance(user, 44, 22);

    assert.equal(result.stats.total, 3);
    assert.equal(result.stats.PRESENT, 1);
    assert.equal(result.stats.ABSENT, 1);
    assert.equal(result.stats.PENDING_REVIEW, 1);
    // effectiveTotal = 3 - 0 - 1 = 2.
    // percentage (attendance rate) = (1 / 2) * 100 = 50%
    assert.equal(result.stats.percentage, 50);

    // Test getMyAbsenceWarnings (Student View)
    (prisma.absenceThresholdPolicy.findMany as any) = async () => [
      { courseId: 22, maxAbsencePercent: 25 },
    ];
    (prisma.notification.findMany as any) = async () => [];

    const warnings = await AttendanceService.getMyAbsenceWarnings(user);
    const courseWarning = warnings.courses[0];

    // absencePercent must be 50.0% (1 absent / 2 active sessions)
    assert.equal(
      courseWarning.absencePercent,
      50.0,
      'Site 2 failed: PENDING_REVIEW was not excluded from activeTotal in getMyAbsenceWarnings!'
    );
    assert.equal(courseWarning.pendingReview, 1);
    assert.equal(courseWarning.isExceeding, true);

    console.log('✅ Site 2 (getStudentAttendance & getMyAbsenceWarnings) verified: PENDING_REVIEW correctly excluded.');
  } finally {
    prisma.student.findUnique = origStudentFindUnique;
    prisma.scheduleSlot.findMany = origScheduleSlotFindMany;
    prisma.attendanceSession.findMany = origAttendanceSessionFindMany;
    prisma.attendance.findMany = origAttendanceFindMany;
    prisma.attendance.count = origAttendanceCount;
    prisma.attendance.groupBy = origWarningAttendanceGroupBy;
    prisma.absenceThresholdPolicy.findMany = origPoliciesFindMany;
  }

  // -------------------------------------------------------------------------
  // Site 3: attendanceService.getStaffAbsenceWarnings (Staff/Faculty View)
  // -------------------------------------------------------------------------
  const origCourseFindMany = prisma.course.findMany;
  const origEnrollmentFindMany = prisma.enrollment.findMany;
  try {
    const facultyUser = { role: 'ADMIN', id: 1 };

    (prisma.course.findMany as any) = async () => [
      { id: 22 },
    ];

    (prisma.enrollment.findMany as any) = async () => [
      {
        id: 99,
        studentId: 44,
        courseId: 22,
        status: 'ENROLLED',
        customAbsenceThreshold: 25.0,
        student: {
          id: 44,
          studentId: 'STU-44',
          firstName: 'Amr',
          lastName: 'Hassan',
          year: 3,
          user: { email: 'amr@uni.edu' },
          department: { name: 'CS', nameAr: 'حاسبات', college: { name: 'Engineering', nameAr: 'هندسة' } },
        },
        course: { id: 22, courseCode: 'CS101', name: 'CS 101', year: 3, semester: 1 },
        exemptionPeriods: [],
      },
    ];

    (prisma.scheduleSlot.findMany as any) = async () => [
      { id: 10, courseId: 22 },
    ];
    (prisma.attendanceSession.findMany as any) = async () => [
      { id: 101, scheduleSlotId: 10 },
      { id: 102, scheduleSlotId: 10 },
      { id: 103, scheduleSlotId: 10 },
    ]; // 3 sessions held
    (prisma.absenceThresholdPolicy.findMany as any) = async () => [
      { courseId: 22, maxAbsencePercent: 25.0 },
    ];

    // 1 PRESENT, 1 ABSENT, 1 PENDING_REVIEW
    (prisma.attendance.findMany as any) = async () => [
      { studentId: 44, courseId: 22, status: 'PRESENT' },
      { studentId: 44, courseId: 22, status: 'ABSENT' },
      { studentId: 44, courseId: 22, status: 'PENDING_REVIEW' },
    ];

    const staffWarnings = await AttendanceService.getMyAbsenceWarnings(facultyUser);
    const staffRecord = staffWarnings.warningRecords[0];

    assert.equal(staffRecord.present, 1);
    assert.equal(staffRecord.absent, 1);
    assert.equal(staffRecord.pendingReview, 1);
    // activeTotal must be totalHeld (3) - pendingReview (1) = 2.
    // absencePercent must be (1 / 2) * 100 = 50.0%
    assert.equal(
      staffRecord.absencePercent,
      50.0,
      'Site 3 failed: PENDING_REVIEW was not excluded from activeTotal in getStaffAbsenceWarnings!'
    );
    assert.equal(staffRecord.warningStage, 'BLOCKED');

    console.log('✅ Site 3 (getStaffAbsenceWarnings) verified: PENDING_REVIEW correctly excluded.');
  } finally {
    prisma.course.findMany = origCourseFindMany;
    prisma.enrollment.findMany = origEnrollmentFindMany;
    prisma.scheduleSlot.findMany = origScheduleSlotFindMany;
    prisma.attendanceSession.findMany = origAttendanceSessionFindMany;
    prisma.attendance.findMany = origAttendanceFindMany;
    prisma.absenceThresholdPolicy.findMany = origPoliciesFindMany;
  }

  // -------------------------------------------------------------------------
  // Site 4: attendanceService.getAttendanceSummary
  // -------------------------------------------------------------------------
  const origCourseFindFirst = prisma.course.findFirst;
  const origAttendanceGroupBy = prisma.attendance.groupBy;
  try {
    (prisma.course.findFirst as any) = async () => ({ id: 22, name: 'CS 101' });
    (prisma.attendance.groupBy as any) = async () => [
      { status: 'PRESENT', _count: 15 },
      { status: 'ABSENT', _count: 3 },
      { status: 'LATE', _count: 2 },
      { status: 'EXCUSED', _count: 1 },
      { status: 'PENDING_REVIEW', _count: 4 },
    ];

    const adminUser = { role: 'ADMIN', id: 1 };
    const summary = await AttendanceService.getAttendanceSummary(adminUser, 22);

    assert.deepEqual(summary, {
      PRESENT: 15,
      ABSENT: 3,
      LATE: 2,
      EXCUSED: 1,
      PENDING_REVIEW: 4,
    });

    console.log('✅ Site 4 (getAttendanceSummary) verified: PENDING_REVIEW included in summary stats.');
  } finally {
    prisma.course.findFirst = origCourseFindFirst;
    prisma.attendance.groupBy = origAttendanceGroupBy;
  }

  console.log('--- ALL PENDING_REVIEW REGRESSION TESTS PASSED SUCCESSFULLY! ---');
}

runPendingReviewRegressionSuite().catch((err) => {
  console.error('❌ REGRESSION TEST FAILURE:', err);
  process.exit(1);
});
