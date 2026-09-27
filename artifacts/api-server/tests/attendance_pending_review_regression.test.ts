import assert from "node:assert/strict";
import prisma from "../src/utils/prismaClient";
import attendanceEngine from "../src/attendance/attendance.engine";
import { calculateAttendanceAttempts } from "../src/attendance/attendance.calculation";
import { GpsDriver } from "../src/attendance/drivers/GpsDriver";
import { QrDriver } from "../src/attendance/drivers/QrDriver";
import { AttendanceService } from "../src/services/attendance.service";
import { autoResolvePendingAttendance } from "../src/utils/cron";

async function testLocationFlagPolicy() {
  const originalSessionFind = prisma.attendanceSession.findUnique;
  const session = {
    id: 1,
    createdAt: new Date(Date.now() - 60_000),
    isActive: true,
    expiresAt: new Date(Date.now() + 60_000),
    latitude: 30,
    longitude: 31,
    radius: 10,
    gracePeriodMins: 15,
    scheduleSlot: { id: 2, courseId: 3, course: { id: 3 } },
  };
  try {
    (prisma.attendanceSession.findUnique as any) = async () => session;
    const gps = new GpsDriver();
    const missingDevice = await gps.validate(
      { sessionId: 1, latitude: 30, longitude: 31 },
      { studentId: 4 },
    );
    assert.equal(missingDevice.valid, false);
    assert.equal(missingDevice.errorCode, "DEVICE_REQUIRED");

    for (const payload of [
      {
        sessionId: 1,
        deviceId: "test-device-gps",
        latitude: 90.1,
        longitude: 31,
      },
      {
        sessionId: 1,
        deviceId: "test-device-gps",
        latitude: -90.1,
        longitude: 31,
      },
      {
        sessionId: 1,
        deviceId: "test-device-gps",
        latitude: 30,
        longitude: 180.1,
      },
      {
        sessionId: 1,
        deviceId: "test-device-gps",
        latitude: 30,
        longitude: -180.1,
      },
    ]) {
      const validation = await gps.validate(payload, { studentId: 4 });
      assert.equal(validation.valid, false);
      assert.equal(validation.errorCode, "INVALID_COORDINATES");
    }

    const inRange = await gps.buildIntent(
      {
        sessionId: 1,
        deviceId: "test-device-gps",
        latitude: 30,
        longitude: 31,
        accuracy: 8.5,
      },
      { studentId: 4 },
    );
    assert.equal(inRange.status, "PRESENT");
    assert.equal(inRange.pendingApprovedStatus, null);
    assert.equal(inRange.locationFlagged, false);
    assert.deepEqual(inRange.locationData, { lat: 30, lng: 31, accuracy: 8.5 });

    const gpsOutOfRange = await gps.buildIntent(
      {
        sessionId: 1,
        deviceId: "test-device-gps",
        latitude: 31,
        longitude: 32,
        accuracy: 5,
      },
      { studentId: 4 },
    );
    assert.equal(gpsOutOfRange.status, "PENDING_REVIEW");
    assert.equal(gpsOutOfRange.pendingApprovedStatus, "PRESENT");
    assert.equal(gpsOutOfRange.locationFlagged, true);

    const qr = new QrDriver();
    (qr as any).validate = async () => ({
      valid: true,
      metadata: {
        session,
        deviceId: "test-device-qr",
        latitude: 31,
        longitude: 32,
        accuracy: 5,
      },
    });
    const qrOutOfRange = await qr.buildIntent(
      { latitude: 31, longitude: 32 },
      { studentId: 4 },
    );
    assert.equal(qrOutOfRange.status, "PENDING_REVIEW");
    assert.equal(qrOutOfRange.pendingApprovedStatus, "PRESENT");
    assert.equal(qrOutOfRange.locationFlagged, true);

    console.log(
      "Finding 13: GPS validation and QR/GPS location-flag convergence",
    );
  } finally {
    prisma.attendanceSession.findUnique = originalSessionFind;
  }
}

async function testSharedAttemptCalculation() {
  const originals = {
    groups: prisma.studentGroup.findMany,
    slots: prisma.scheduleSlot.findMany,
    sessions: prisma.attendanceSession.findMany,
    attendance: prisma.attendance.findMany,
    student: prisma.student.findUnique,
    enrollments: prisma.enrollment.findMany,
    policies: prisma.absenceThresholdPolicy.findMany,
    enrollmentUpdate: prisma.enrollment.updateMany,
    notifications: prisma.notification.findMany,
    notificationCreate: prisma.notification.create,
    transaction: prisma.$transaction,
  };
  const enrollment = {
    id: 99,
    studentId: 44,
    courseId: 22,
    semester: 1,
    academicYear: 2026,
    status: "ENROLLED",
    enrolledAt: new Date("2026-01-01T00:00:00.000Z"),
    customAbsenceThreshold: 40,
    exemptionPeriods: [
      {
        id: 1,
        startDate: new Date("2026-02-03T00:00:00.000Z"),
        endDate: new Date("2026-02-03T23:59:59.999Z"),
        reason: "medical",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
    student: {
      id: 44,
      userId: 440,
      groupId: 9,
      studentId: "S44",
      firstName: "Ada",
      lastName: "Lovelace",
      year: 2,
      user: { email: "ada@example.edu" },
      department: null,
    },
    course: {
      id: 22,
      courseCode: "CS22",
      name: "Networks",
      credits: 3,
      year: 2,
      semester: 1,
      departmentId: 4,
    },
  };
  let targetStatus: string | undefined;

  try {
    (prisma.studentGroup.findMany as any) = async () => [
      { id: 9, parentGroupId: 8 },
      { id: 8, parentGroupId: null },
      { id: 7, parentGroupId: null },
    ];
    (prisma.scheduleSlot.findMany as any) = async () => [
      {
        id: 10,
        courseId: 22,
        groupId: 8,
        timetable: { semester: 1 },
        course: { semester: 1 },
      },
      {
        id: 11,
        courseId: 22,
        groupId: 7,
        timetable: { semester: 1 },
        course: { semester: 1 },
      },
    ];
    (prisma.attendanceSession.findMany as any) = async () => [
      {
        id: 101,
        scheduleSlotId: 10,
        createdAt: new Date("2026-02-01T10:00:00.000Z"),
      },
      {
        id: 102,
        scheduleSlotId: 10,
        createdAt: new Date("2026-02-02T10:00:00.000Z"),
      },
      {
        id: 103,
        scheduleSlotId: 10,
        createdAt: new Date("2026-02-03T10:00:00.000Z"),
      },
      {
        id: 104,
        scheduleSlotId: 11,
        createdAt: new Date("2026-02-04T10:00:00.000Z"),
      },
    ];
    (prisma.attendance.findMany as any) = async () => [
      {
        id: 1,
        studentId: 44,
        courseId: 22,
        semester: 1,
        academicYear: 2026,
        sessionId: 101,
        status: "PRESENT",
        remarks: null,
        date: new Date("2026-02-01T00:00:00.000Z"),
      },
    ];
    (prisma.absenceThresholdPolicy.findMany as any) = async () => [];
    (prisma.notification.findMany as any) = async () => [];
    (prisma.notification.create as any) = async (args: any) => args.data;
    (prisma.enrollment.updateMany as any) = async (args: any) => {
      targetStatus = args.data.status;
      assert.deepEqual(args.where, { id: 99, status: "ENROLLED" });
      return { count: 1 };
    };
    (prisma as any).$transaction = async (callback: any) =>
      callback({
        enrollment: { updateMany: prisma.enrollment.updateMany },
        auditLog: { create: async () => ({ id: 1 }) },
      });
    (prisma.enrollment.findMany as any) = async () => [enrollment];
    (prisma.student.findUnique as any) = async () => ({
      id: 44,
      userId: 440,
      groupId: 9,
      enrollments: [enrollment],
    });

    const calculations = await calculateAttendanceAttempts([
      {
        id: 99,
        studentId: 44,
        courseId: 22,
        semester: 1,
        academicYear: 2026,
        groupId: 9,
        enrolledAt: enrollment.enrolledAt,
        exemptionPeriods: enrollment.exemptionPeriods,
      },
    ]);
    const calculation = calculations.get(99)!;
    assert.equal(calculation.total, 2);
    assert.equal(calculation.present, 1);
    assert.equal(calculation.absent, 1);
    assert.equal(calculation.absencePercent, 50);

    await attendanceEngine.recalculateAbsence(44, 22, 1, 2026);
    assert.equal(targetStatus, "BLOCKED");

    const warnings = await AttendanceService.getMyAbsenceWarnings({
      id: 440,
      role: "STUDENT",
    });
    assert.equal(warnings.courses[0].totalSessions, 2);
    assert.equal(warnings.courses[0].absent, 1);
    assert.equal(warnings.courses[0].absencePercent, 50);
    console.log(
      "Findings 10/11/14: enforcement and reporting share attempt, ancestry, exemption, and missing-row math",
    );
  } finally {
    prisma.studentGroup.findMany = originals.groups;
    prisma.scheduleSlot.findMany = originals.slots;
    prisma.attendanceSession.findMany = originals.sessions;
    prisma.attendance.findMany = originals.attendance;
    prisma.student.findUnique = originals.student;
    prisma.enrollment.findMany = originals.enrollments;
    prisma.absenceThresholdPolicy.findMany = originals.policies;
    prisma.enrollment.updateMany = originals.enrollmentUpdate;
    prisma.notification.findMany = originals.notifications;
    prisma.notification.create = originals.notificationCreate;
    prisma.$transaction = originals.transaction;
  }
}

async function testPendingReviewExcludedAtEveryConsumptionPoint() {
  const originals = {
    slots: prisma.scheduleSlot.findMany,
    attendanceFind: prisma.attendance.findMany,
    attendanceCount: prisma.attendance.count,
    attendanceGroupBy: prisma.attendance.groupBy,
    studentFindUnique: prisma.student.findUnique,
    studentFindFirst: prisma.student.findFirst,
    enrollmentFind: prisma.enrollment.findMany,
    enrollmentUpdate: prisma.enrollment.updateMany,
    courseFind: prisma.course.findMany,
    courseFindFirst: prisma.course.findFirst,
    policies: prisma.absenceThresholdPolicy.findMany,
    notificationsFind: prisma.notification.findMany,
    notificationsCreate: prisma.notification.create,
    transaction: prisma.$transaction,
  };
  const rows = [
    {
      id: 1,
      studentId: 44,
      courseId: 22,
      semester: 1,
      academicYear: 2026,
      sessionId: null,
      status: "PRESENT",
      remarks: null,
      date: new Date("2026-02-01T00:00:00.000Z"),
    },
    {
      id: 2,
      studentId: 44,
      courseId: 22,
      semester: 1,
      academicYear: 2026,
      sessionId: null,
      status: "ABSENT",
      remarks: null,
      date: new Date("2026-02-02T00:00:00.000Z"),
    },
    {
      id: 3,
      studentId: 44,
      courseId: 22,
      semester: 1,
      academicYear: 2026,
      sessionId: null,
      status: "PENDING_REVIEW",
      remarks: null,
      date: new Date("2026-02-03T00:00:00.000Z"),
    },
  ];
  const enrollment = {
    id: 99,
    studentId: 44,
    courseId: 22,
    semester: 1,
    academicYear: 2026,
    status: "ENROLLED",
    enrolledAt: new Date("2026-01-01T00:00:00.000Z"),
    customAbsenceThreshold: 40,
    exemptionPeriods: [],
    student: {
      id: 44,
      userId: 440,
      groupId: null,
      studentId: "S44",
      firstName: "Ada",
      lastName: "Lovelace",
      year: 2,
      user: { email: "ada@example.edu" },
      department: null,
    },
    course: {
      id: 22,
      courseCode: "CS22",
      name: "Networks",
      credits: 3,
      year: 2,
      semester: 1,
      departmentId: 4,
    },
  };
  let engineTargetStatus: string | undefined;

  try {
    (prisma.scheduleSlot.findMany as any) = async () => [];
    (prisma.attendance.findMany as any) = async () => rows;
    (prisma.attendance.count as any) = async () => rows.length;
    (prisma.absenceThresholdPolicy.findMany as any) = async () => [];
    (prisma.notification.findMany as any) = async () => [];
    (prisma.notification.create as any) = async (args: any) => args.data;
    (prisma.enrollment.updateMany as any) = async (args: any) => {
      engineTargetStatus = args.data.status;
      return { count: 1 };
    };
    (prisma as any).$transaction = async (callback: any) =>
      callback({
        enrollment: { updateMany: prisma.enrollment.updateMany },
        auditLog: { create: async () => ({ id: 1 }) },
      });
    (prisma.enrollment.findMany as any) = async (args: any) =>
      args.where?.id?.in ? [enrollment] : [enrollment];
    (prisma.student.findUnique as any) = async (args: any) =>
      args.where?.userId === 440
        ? { id: 44, userId: 440, groupId: null, enrollments: [enrollment] }
        : { id: 44, groupId: null, enrollments: [enrollment] };
    (prisma.student.findFirst as any) = async () => ({ id: 44 });
    (prisma.course.findMany as any) = async (args: any) =>
      args.select?.id && Object.keys(args.select).length === 1
        ? [{ id: 22 }]
        : [enrollment.course];
    (prisma.course.findFirst as any) = async () => enrollment.course;

    await attendanceEngine.recalculateAbsence(44, 22, 1, 2026);
    assert.equal(engineTargetStatus, "BLOCKED");

    const history = await AttendanceService.getStudentAttendance(
      { id: 1, role: "SUPER_ADMIN" },
      44,
      22,
    );
    assert.deepEqual(history.stats, {
      total: 3,
      PRESENT: 1,
      ABSENT: 1,
      LATE: 0,
      EXCUSED: 0,
      PENDING_REVIEW: 1,
      percentage: 50,
    });

    const studentWarnings = await AttendanceService.getMyAbsenceWarnings({
      id: 440,
      role: "STUDENT",
    });
    assert.equal(studentWarnings.courses[0].totalSessions, 3);
    assert.equal(studentWarnings.courses[0].pendingReview, 1);
    assert.equal(studentWarnings.courses[0].absencePercent, 50);

    const staffWarnings = await AttendanceService.getStaffAbsenceWarnings({
      id: 1,
      role: "SUPER_ADMIN",
    });
    assert.equal(staffWarnings.warningRecords[0].totalSessions, 3);
    assert.equal(staffWarnings.warningRecords[0].pendingReview, 1);
    assert.equal(staffWarnings.warningRecords[0].absencePercent, 50);

    (prisma.attendance.groupBy as any) = async () => [
      { status: "PRESENT", _count: 1 },
      { status: "ABSENT", _count: 1 },
      { status: "PENDING_REVIEW", _count: 1 },
    ];
    const summary = await AttendanceService.getAttendanceSummary(
      { id: 1, role: "SUPER_ADMIN" },
      22,
    );
    assert.deepEqual(summary, {
      PRESENT: 1,
      ABSENT: 1,
      LATE: 0,
      EXCUSED: 0,
      PENDING_REVIEW: 1,
    });
    console.log(
      "Pending-review denominator: engine, student history/warnings, staff warnings, and summary covered",
    );
  } finally {
    prisma.scheduleSlot.findMany = originals.slots;
    prisma.attendance.findMany = originals.attendanceFind;
    prisma.attendance.count = originals.attendanceCount;
    prisma.attendance.groupBy = originals.attendanceGroupBy;
    prisma.student.findUnique = originals.studentFindUnique;
    prisma.student.findFirst = originals.studentFindFirst;
    prisma.enrollment.findMany = originals.enrollmentFind;
    prisma.enrollment.updateMany = originals.enrollmentUpdate;
    prisma.course.findMany = originals.courseFind;
    prisma.course.findFirst = originals.courseFindFirst;
    prisma.absenceThresholdPolicy.findMany = originals.policies;
    prisma.notification.findMany = originals.notificationsFind;
    prisma.notification.create = originals.notificationsCreate;
    prisma.$transaction = originals.transaction;
  }
}

async function testExactlyOnceResolution() {
  const originals = {
    sessionFind: prisma.attendanceSession.findUnique,
    findFirst: prisma.attendance.findFirst,
    findUnique: prisma.attendance.findUnique,
    findMany: prisma.attendance.findMany,
    updateMany: prisma.attendance.updateMany,
    recalculate: attendanceEngine.recalculateAbsence,
    transaction: prisma.$transaction,
  };
  try {
    const lateSession = {
      id: 41,
      createdAt: new Date(Date.now() - 30 * 60_000),
      isActive: true,
      expiresAt: new Date(Date.now() + 60_000),
      latitude: 30,
      longitude: 31,
      radius: 10,
      gracePeriodMins: 15,
      scheduleSlot: { id: 2, courseId: 12, course: { id: 12 } },
    };
    (prisma.attendanceSession.findUnique as any) = async () => lateSession;
    const lateIntent = await new GpsDriver().buildIntent(
      {
        sessionId: 41,
        deviceId: "test-device-gps",
        latitude: 31,
        longitude: 32,
        accuracy: 5,
      },
      { studentId: 77 },
    );
    assert.equal(lateIntent.status, "PENDING_REVIEW");
    assert.equal(lateIntent.pendingApprovedStatus, "LATE");

    const record = {
      id: 501,
      studentId: 77,
      courseId: 12,
      semester: 1,
      academicYear: 2026,
      status: "PENDING_REVIEW",
      locationFlagged: true,
      pendingApprovedStatus: lateIntent.pendingApprovedStatus,
    };
    const recalculations: any[][] = [];
    const updateCalls: any[] = [];
    (prisma.attendance.findFirst as any) = async () => record;
    attendanceEngine.recalculateAbsence = async (...args: any[]) => {
      recalculations.push(args);
    };

    (prisma.attendance.updateMany as any) = async (args: any) => {
      updateCalls.push(args);
      return { count: 1 };
    };
    (prisma.attendance.findUnique as any) = async () => ({
      ...record,
      status: "LATE",
      pendingApprovedStatus: null,
      locationFlagged: false,
      overriddenBy: "admin@example.edu",
      overrideNote: "Location verified",
    });
    const approved = await AttendanceService.overrideFlaggedRecord(
      { role: "SUPER_ADMIN", id: 1, email: "admin@example.edu" },
      501,
      "Location verified",
    );
    assert.equal(updateCalls[0].data.status, "LATE");
    assert.equal(updateCalls[0].data.pendingApprovedStatus, null);
    assert.equal(updateCalls[0].data.locationFlagged, false);
    assert.equal(updateCalls[0].data.overriddenBy, "admin@example.edu");
    assert.equal(updateCalls[0].data.overrideNote, "Location verified");
    assert.deepEqual(recalculations[0], [77, 12, 1, 2026]);
    assert.equal(approved?.status, "LATE");

    updateCalls.length = 0;
    recalculations.length = 0;
    (prisma.attendance.findUnique as any) = async () => ({
      ...record,
      status: "ABSENT",
      pendingApprovedStatus: null,
      locationFlagged: false,
      overriddenBy: "admin@example.edu",
      overrideNote: "Outside permitted area",
    });
    const rejected = await AttendanceService.rejectFlaggedRecord(
      { role: "SUPER_ADMIN", id: 1, email: "admin@example.edu" },
      501,
      "Outside permitted area",
    );
    assert.equal(updateCalls[0].data.status, "ABSENT");
    assert.equal(updateCalls[0].data.pendingApprovedStatus, null);
    assert.equal(updateCalls[0].data.locationFlagged, false);
    assert.equal(updateCalls[0].data.overriddenBy, "admin@example.edu");
    assert.equal(updateCalls[0].data.overrideNote, "Outside permitted area");
    assert.deepEqual(recalculations[0], [77, 12, 1, 2026]);
    assert.equal(rejected?.status, "ABSENT");

    (prisma.attendance.updateMany as any) = async () => ({ count: 0 });
    await assert.rejects(
      AttendanceService.overrideFlaggedRecord(
        { role: "SUPER_ADMIN", id: 1, email: "admin@example.edu" },
        501,
      ),
      (error: any) => error?.statusCode === 409,
    );

    (prisma.attendance.findMany as any) = async () => [record];
    (prisma.attendance.updateMany as any) = async (args: any) => {
      assert.equal(args.where.status, "PENDING_REVIEW");
      assert.equal(args.where.locationFlagged, true);
      return { count: 0 };
    };
    assert.equal(await autoResolvePendingAttendance(), 0);
    console.log(
      "Reviewer approval/rejection success, late preservation, and conflict paths covered",
    );
  } finally {
    prisma.attendanceSession.findUnique = originals.sessionFind;
    prisma.attendance.findFirst = originals.findFirst;
    prisma.attendance.findUnique = originals.findUnique;
    prisma.attendance.findMany = originals.findMany;
    prisma.attendance.updateMany = originals.updateMany;
    attendanceEngine.recalculateAbsence = originals.recalculate;
  }
}

async function testCronExpirySuccessAndEmptyList() {
  const originals = {
    findMany: prisma.attendance.findMany,
    updateMany: prisma.attendance.updateMany,
    recalculate: attendanceEngine.recalculateAbsence,
    transaction: prisma.$transaction,
  };
  const cutoff = new Date("2026-03-10T00:00:00.000Z");
  const expiredRecords = [
    { id: 601, studentId: 77, courseId: 12, semester: 1, academicYear: 2026 },
    { id: 602, studentId: 77, courseId: 12, semester: 1, academicYear: 2026 },
    { id: 603, studentId: 88, courseId: 13, semester: 2, academicYear: 2026 },
  ];
  const updates: any[] = [];
  const recalculations: any[][] = [];
  try {
    (prisma.attendance.findMany as any) = async (args: any) => {
      assert.equal(args.where.status, "PENDING_REVIEW");
      assert.deepEqual(args.where.createdAt, { lte: cutoff });
      assert.equal("method" in args.where, false);
      return expiredRecords;
    };
    (prisma.attendance.updateMany as any) = async (args: any) => {
      updates.push(args);
      return { count: 1 };
    };
    (prisma as any).$transaction = async (callback: any) =>
      callback({
        attendance: { updateMany: prisma.attendance.updateMany },
        auditLog: { create: async () => ({ id: 1 }) },
      });
    attendanceEngine.recalculateAbsence = async (...args: any[]) => {
      recalculations.push(args);
    };

    assert.equal(await autoResolvePendingAttendance(cutoff), 3);
    assert.deepEqual(
      updates.map((call) => call.where.id),
      [601, 602, 603],
    );
    for (const call of updates) {
      assert.equal(call.where.status, "PENDING_REVIEW");
      assert.equal(call.where.locationFlagged, true);
      assert.deepEqual(call.where.createdAt, { lte: cutoff });
      assert.deepEqual(call.data, {
        status: "ABSENT",
        pendingApprovedStatus: null,
        locationFlagged: false,
        overrideNote:
          "Auto-resolved to ABSENT after 5 calendar days review window",
      });
    }
    assert.deepEqual(recalculations, [
      [77, 12, 1, 2026],
      [88, 13, 2, 2026],
    ]);

    updates.length = 0;
    recalculations.length = 0;
    (prisma.attendance.findMany as any) = async () => [];
    assert.equal(await autoResolvePendingAttendance(cutoff), 0);
    assert.deepEqual(updates, []);
    assert.deepEqual(recalculations, []);
    console.log(
      "Cron expiry: multi-record success, attempt-pair deduplication, and empty list covered",
    );
  } finally {
    prisma.attendance.findMany = originals.findMany;
    prisma.attendance.updateMany = originals.updateMany;
    attendanceEngine.recalculateAbsence = originals.recalculate;
    prisma.$transaction = originals.transaction;
  }
}

await testLocationFlagPolicy();
await testSharedAttemptCalculation();
await testPendingReviewExcludedAtEveryConsumptionPoint();
await testExactlyOnceResolution();
await testCronExpirySuccessAndEmptyList();
console.log(
  "Attendance pending-review and shared-calculation regression checks passed",
);
