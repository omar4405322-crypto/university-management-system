import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { cleanupTestEntities, CleanupEntities } from './testCleanup.utils';

test('Hermetic Cleanup Helper: purges all created rows even when test body throws', async () => {
  const SUFFIX = 'cln_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

  const getCounts = async () => {
    return {
      college: await prisma.college.count(),
      department: await prisma.department.count(),
      course: await prisma.course.count(),
      studentGroup: await prisma.studentGroup.count(),
      timetable: await prisma.timetable.count(),
      scheduleSlot: await prisma.scheduleSlot.count(),
      attendanceSession: await prisma.attendanceSession.count(),
      attendance: await prisma.attendance.count(),
      scheduleChangeRequest: await prisma.scheduleChangeRequest.count(),
      scheduleOverride: await prisma.scheduleOverride.count(),
      enrollment: await prisma.enrollment.count(),
      student: await prisma.student.count(),
      doctor: await prisma.doctor.count(),
      teachingAssistant: await prisma.teachingAssistant.count(),
      auditLog: await prisma.auditLog.count(),
      notification: await prisma.notification.count(),
      refreshToken: await prisma.refreshToken.count(),
      user: await prisma.user.count(),
    };
  };

  const beforeCounts = await getCounts();

  const entities: CleanupEntities = {
    attendanceIds: [],
    sessionIds: [],
    overrideIds: [],
    changeRequestIds: [],
    slotIds: [],
    enrollmentIds: [],
    timetableIds: [],
    studentIds: [],
    doctorIds: [],
    taIds: [],
    courseIds: [],
    groupIds: [],
    userIds: [],
    departmentIds: [],
    collegeIds: [],
  };

  let simulatedErrorThrown = false;

  try {
    // 1. College & Department
    const college = await prisma.college.create({
      data: { name: `Col_${SUFFIX}` },
    });
    entities.collegeIds!.push(college.id);

    const dept = await prisma.department.create({
      data: { name: `Dept_${SUFFIX}`, collegeId: college.id },
    });
    entities.departmentIds!.push(dept.id);

    // 2. StudentGroup & Course
    const group = await prisma.studentGroup.create({
      data: { name: `Group_${SUFFIX}`, departmentId: dept.id, year: 1 },
    });
    entities.groupIds!.push(group.id);

    const course = await prisma.course.create({
      data: {
        name: `Course_${SUFFIX}`,
        courseCode: `C_${SUFFIX.slice(-5)}`,
        departmentId: dept.id,
        year: 1,
        semester: 1,
        credits: 3,
        isPublished: true,
      },
    });
    entities.courseIds!.push(course.id);

    // 3. Users & Profiles
    const adminUser = await prisma.user.create({
      data: {
        email: `adm_${SUFFIX}@example.test`,
        password: 'hash',
        role: 'SUPER_ADMIN',
        tokenVersion: 0,
        isActive: true,
      },
    });
    entities.userIds!.push(adminUser.id);

    const docUser = await prisma.user.create({
      data: {
        email: `doc_${SUFFIX}@example.test`,
        password: 'hash',
        role: 'DOCTOR',
        tokenVersion: 0,
        isActive: true,
      },
    });
    entities.userIds!.push(docUser.id);
    const doctor = await prisma.doctor.create({
      data: {
        userId: docUser.id,
        doctorId: `DOC_${SUFFIX.slice(-4)}`,
        firstName: 'Doc',
        lastName: SUFFIX,
        departmentId: dept.id,
      },
    });
    entities.doctorIds!.push(doctor.id);

    const taUser = await prisma.user.create({
      data: {
        email: `ta_${SUFFIX}@example.test`,
        password: 'hash',
        role: 'TEACHING_ASSISTANT',
        tokenVersion: 0,
        isActive: true,
      },
    });
    entities.userIds!.push(taUser.id);
    const ta = await prisma.teachingAssistant.create({
      data: {
        userId: taUser.id,
        employeeId: `TA_${SUFFIX.slice(-4)}`,
        firstName: 'TA',
        lastName: SUFFIX,
        departmentId: dept.id,
      },
    });
    entities.taIds!.push(ta.id);

    const stuUser = await prisma.user.create({
      data: {
        email: `stu_${SUFFIX}@example.test`,
        password: 'hash',
        role: 'STUDENT',
        tokenVersion: 0,
        isActive: true,
      },
    });
    entities.userIds!.push(stuUser.id);
    const student = await prisma.student.create({
      data: {
        userId: stuUser.id,
        studentId: `STU_${SUFFIX.slice(-4)}`,
        firstName: 'Stu',
        lastName: SUFFIX,
        departmentId: dept.id,
        groupId: group.id,
        year: 1,
      },
    });
    entities.studentIds!.push(student.id);

    // 4. Timetable & ScheduleSlot
    const timetable = await prisma.timetable.create({
      data: {
        title: `TT_${SUFFIX}`,
        collegeId: college.id,
        departmentId: dept.id,
        academicYear: 1,
        semester: 1,
        status: 'PUBLISHED',
      },
    });
    entities.timetableIds!.push(timetable.id);

    const slot = await prisma.scheduleSlot.create({
      data: {
        courseId: course.id,
        timetableId: timetable.id,
        doctorId: doctor.id,
        teachingAssistantId: ta.id,
        groupId: group.id,
        slotType: 'LAB',
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        room: 'Lab 1',
      },
    });
    entities.slotIds!.push(slot.id);

    // 5. AttendanceSession & Attendance
    const session = await prisma.attendanceSession.create({
      data: {
        scheduleSlotId: slot.id,
        secretKey: `secret_${SUFFIX}`,
        expiresAt: new Date(Date.now() + 7200000),
      },
    });
    entities.sessionIds!.push(session.id);

    const att = await prisma.attendance.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        sessionId: session.id,
        status: 'PRESENT',
      },
    });
    entities.attendanceIds!.push(att.id);

    // 6. ScheduleChangeRequest & ScheduleOverride & Enrollment
    const cr = await prisma.scheduleChangeRequest.create({
      data: {
        scheduleSlotId: slot.id,
        courseId: course.id,
        requesterId: docUser.id,
        type: 'UPDATE_SLOT',
        reason: 'Maintenance',
        proposedData: { room: 'Lab 2' },
        status: 'PENDING',
      },
    });
    entities.changeRequestIds!.push(cr.id);

    const ov = await prisma.scheduleOverride.create({
      data: {
        scheduleSlotId: slot.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        room: 'Lab 2',
        createdBy: docUser.id,
      },
    });
    entities.overrideIds!.push(ov.id);

    const enr = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        semester: 1,
        academicYear: 1,
        status: 'ENROLLED',
      },
    });
    entities.enrollmentIds!.push(enr.id);

    // 7. AuditLog, Notification, RefreshToken on fixture users
    await prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: 'TEST_ACTION',
        entity: 'TestEntity',
      },
    });
    await prisma.notification.create({
      data: {
        userId: stuUser.id,
        title: 'Test Notification',
        message: 'Cleanup test',
      },
    });
    await prisma.refreshToken.create({
      data: {
        userId: docUser.id,
        token: `mock_refresh_${SUFFIX}`,
        familyId: `fam_${SUFFIX}`,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // 8. SIMULATE UNEXPECTED EXCEPTION IN TEST BODY
    simulatedErrorThrown = true;
    throw new Error('Simulated failure inside test body');
  } catch (err: any) {
    if (err.message !== 'Simulated failure inside test body') {
      throw err;
    }
  } finally {
    // Teardown MUST run even on failure and MUST successfully purge every created row
    await cleanupTestEntities(prisma, entities);
  }

  assert.equal(simulatedErrorThrown, true, 'Test must have thrown simulated error');

  const afterCounts = await getCounts();

  // RELATIVE COUNTS: every touched model count after cleanup must exactly equal count before setup
  assert.deepEqual(afterCounts, beforeCounts, 'All relative counts must be restored to baseline after teardown');
});
