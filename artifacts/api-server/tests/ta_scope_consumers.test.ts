import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';
import app from '../src/app';
import { TestCleanupRegistry } from './testCleanup.utils';

test('C2 MAJOR: TEACHING_ASSISTANT scope beyond tasks across courses, enrollments, attendance, and transcripts', async () => {
  const suffix = `c2_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const passwordHash = await bcrypt.hash(`Secret_${suffix}_${Math.random()}`, 4);
  const cleanup = new TestCleanupRegistry();

  // Capture baseline counts for touched models to verify hermetic cleanup
  const preCounts = {
    user: await prisma.user.count(),
    teachingAssistant: await prisma.teachingAssistant.count(),
    doctor: await prisma.doctor.count(),
    course: await prisma.course.count(),
    student: await prisma.student.count(),
    enrollment: await prisma.enrollment.count(),
    scheduleSlot: await prisma.scheduleSlot.count(),
    attendance: await prisma.attendance.count(),
    auditLog: await prisma.auditLog.count(),
    notification: await prisma.notification.count(),
    refreshToken: await prisma.refreshToken.count(),
  };

  const dept = await prisma.department.findFirst({
    select: { id: true, collegeId: true },
  });
  assert.ok(dept, 'A seeded department must exist');

  let server: http.Server | null = null;

  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    // 1. Create Doctor user and profile
    const docUser = await prisma.user.create({
      data: {
        email: `doc_${suffix}@unicore.edu`,
        password: passwordHash,
        role: 'DOCTOR',
        doctor: {
          create: {
            firstName: 'Doctor',
            lastName: `Test_${suffix}`,
            doctorId: `DOC_${suffix}`,
            departmentId: dept.id,
          },
        },
      },
      include: { doctor: true },
    });
    cleanup.trackUser(docUser.id);
    const doctor = docUser.doctor!;
    cleanup.trackDoctor(doctor.id);

    // 2. Create TA user and profile in department D
    const taUser = await prisma.user.create({
      data: {
        email: `ta_${suffix}@unicore.edu`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        teachingAssistant: {
          create: {
            employeeId: `TA_${suffix}`,
            departmentId: dept.id,
            specialization: 'Computer Science',
          },
        },
      },
      include: { teachingAssistant: true },
    });
    cleanup.trackUser(taUser.id);
    const ta = taUser.teachingAssistant!;
    cleanup.trackTA(ta.id);

    // 3. Create Course A (assigned to TA via slot) and Course B (unassigned to TA, same department)
    const courseA = await prisma.course.create({
      data: {
        courseCode: `CA_${suffix}`,
        name: `Course A ${suffix}`,
        departmentId: dept.id,
        credits: 3,
        year: 1,
        semester: 1,
        isPublished: true,
      },
    });
    cleanup.trackCourse(courseA.id);

    const courseB = await prisma.course.create({
      data: {
        courseCode: `CB_${suffix}`,
        name: `Course B ${suffix}`,
        departmentId: dept.id,
        credits: 3,
        year: 1,
        semester: 1,
        isPublished: true,
      },
    });
    cleanup.trackCourse(courseB.id);

    // 4. Create ScheduleSlot for TA in Course A
    const slotA = await prisma.scheduleSlot.create({
      data: {
        courseId: courseA.id,
        slotType: 'LAB',
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        room: `Lab_${suffix}`,
        teachingAssistantId: ta.id,
      },
    });
    cleanup.trackSlot(slotA.id);

    // Create ScheduleSlot for Doctor in Course B (no TA slot)
    const slotB = await prisma.scheduleSlot.create({
      data: {
        courseId: courseB.id,
        slotType: 'LECTURE',
        dayOfWeek: 'TUESDAY',
        startTime: '10:00',
        endTime: '12:00',
        room: `Hall_${suffix}`,
        doctorId: doctor.id,
      },
    });
    cleanup.trackSlot(slotB.id);

    // 5. Create Student A (enrolled in Course A) and Student B (enrolled in Course B)
    const stuUserA = await prisma.user.create({
      data: {
        email: `stu_a_${suffix}@unicore.edu`,
        password: passwordHash,
        role: 'STUDENT',
        student: {
          create: {
            firstName: 'StudentA',
            lastName: `Test_${suffix}`,
            studentId: `STUA_${suffix}`,
            departmentId: dept.id,
            year: 1,
          },
        },
      },
      include: { student: true },
    });
    cleanup.trackUser(stuUserA.id);
    const studentA = stuUserA.student!;
    cleanup.trackStudent(studentA.id);

    const stuUserB = await prisma.user.create({
      data: {
        email: `stu_b_${suffix}@unicore.edu`,
        password: passwordHash,
        role: 'STUDENT',
        student: {
          create: {
            firstName: 'StudentB',
            lastName: `Test_${suffix}`,
            studentId: `STUB_${suffix}`,
            departmentId: dept.id,
            year: 1,
          },
        },
      },
      include: { student: true },
    });
    cleanup.trackUser(stuUserB.id);
    const studentB = stuUserB.student!;
    cleanup.trackStudent(studentB.id);

    // Enroll Student A in Course A, Student B in Course B
    await prisma.enrollment.create({
      data: {
        studentId: studentA.id,
        courseId: courseA.id,
        semester: 1,
        academicYear: 2026,
        status: 'ENROLLED',
      },
    });
    await prisma.enrollment.create({
      data: {
        studentId: studentB.id,
        courseId: courseB.id,
        semester: 1,
        academicYear: 2026,
        status: 'ENROLLED',
      },
    });

    // 6. Create attendance records
    const attA = await prisma.attendance.create({
      data: {
        studentId: studentA.id,
        courseId: courseA.id,
        status: 'PRESENT',
        date: new Date(),
        method: 'MANUAL',
        recordedById: taUser.id,
      },
    });
    cleanup.trackAttendance(attA.id);

    const attB = await prisma.attendance.create({
      data: {
        studentId: studentB.id,
        courseId: courseB.id,
        status: 'PRESENT',
        date: new Date(),
        method: 'MANUAL',
        recordedById: docUser.id,
      },
    });
    cleanup.trackAttendance(attB.id);

    const taToken = generateAccessToken(taUser.id, taUser.tokenVersion);

    // =========================================================================
    // ENDPOINT 1: GET /api/courses/:id (Course Roster & Details)
    // =========================================================================
    const resCourseA = await fetch(`${baseUrl}/courses/${courseA.id}`, {
      headers: { authorization: `Bearer ${taToken}` },
    });
    assert.equal(resCourseA.status, 200, 'TA must be able to view assigned Course A');
    const bodyCourseA = await resCourseA.json();
    assert.equal(bodyCourseA.data?.id, courseA.id);

    const resCourseB = await fetch(`${baseUrl}/courses/${courseB.id}`, {
      headers: { authorization: `Bearer ${taToken}` },
    });
    assert.ok(
      [403, 404].includes(resCourseB.status),
      `TA must NOT access unassigned Course B in same department (Expected 403 or 404, got ${resCourseB.status})`
    );

    // =========================================================================
    // ENDPOINT 2: GET /api/enrollments (Enrollments)
    // =========================================================================
    const resEnrollA = await fetch(`${baseUrl}/enrollments?courseId=${courseA.id}`, {
      headers: { authorization: `Bearer ${taToken}` },
    });
    assert.equal(resEnrollA.status, 200, 'TA must receive 200 for assigned Course A enrollments');
    const bodyEnrollA = await resEnrollA.json();
    assert.ok(Array.isArray(bodyEnrollA.data));
    assert.ok(bodyEnrollA.data.some((e: any) => e.studentId === studentA.id), 'TA sees enrolled student A');

    const resEnrollB = await fetch(`${baseUrl}/enrollments?courseId=${courseB.id}`, {
      headers: { authorization: `Bearer ${taToken}` },
    });
    const bodyEnrollB = await resEnrollB.json();
    const bEnrollments = bodyEnrollB.data || [];
    assert.ok(
      [403, 404].includes(resEnrollB.status) || bEnrollments.length === 0,
      `TA must NOT read enrollments for unassigned Course B (got status ${resEnrollB.status}, count ${bEnrollments.length})`
    );

    // =========================================================================
    // ENDPOINT 3: GET /api/attendance/course/:courseId (Attendance)
    // =========================================================================
    const resAttA = await fetch(`${baseUrl}/attendance/course/${courseA.id}`, {
      headers: { authorization: `Bearer ${taToken}` },
    });
    assert.equal(resAttA.status, 200, 'TA must receive 200 for assigned Course A attendance');

    const resAttB = await fetch(`${baseUrl}/attendance/course/${courseB.id}`, {
      headers: { authorization: `Bearer ${taToken}` },
    });
    assert.ok(
      [403, 404].includes(resAttB.status),
      `TA must NOT read attendance for unassigned Course B (Expected 403 or 404, got ${resAttB.status})`
    );

    // =========================================================================
    // ENDPOINT 4: GET /api/transcript/:studentId (Transcript)
    // =========================================================================
    const resTransA = await fetch(`${baseUrl}/transcript/${studentA.id}`, {
      headers: { authorization: `Bearer ${taToken}` },
    });
    assert.equal(resTransA.status, 200, 'TA must receive 200 for enrolled student A transcript');

    const resTransB = await fetch(`${baseUrl}/transcript/${studentB.id}`, {
      headers: { authorization: `Bearer ${taToken}` },
    });
    assert.ok(
      [403, 404].includes(resTransB.status),
      `TA must NOT read transcript for unassigned student B in same department (Expected 403 or 404, got ${resTransB.status})`
    );
  } finally {
    // Hermetic cleanup via TestCleanupRegistry
    try {
      if (server) {
        server.closeAllConnections?.();
        await new Promise<void>((resolve) => server!.close(() => resolve()));
      }
    } finally {
      await cleanup.teardown(prisma);
    }

    // Verify row counts of every touched model are strictly restored to pre-test baseline
    const postCounts = {
      user: await prisma.user.count(),
      teachingAssistant: await prisma.teachingAssistant.count(),
      doctor: await prisma.doctor.count(),
      course: await prisma.course.count(),
      student: await prisma.student.count(),
      enrollment: await prisma.enrollment.count(),
      scheduleSlot: await prisma.scheduleSlot.count(),
      attendance: await prisma.attendance.count(),
      auditLog: await prisma.auditLog.count(),
      notification: await prisma.notification.count(),
      refreshToken: await prisma.refreshToken.count(),
    };

    assert.deepEqual(postCounts, preCounts, 'Touched model row counts must be strictly restored to pre-test values');
  }
});
