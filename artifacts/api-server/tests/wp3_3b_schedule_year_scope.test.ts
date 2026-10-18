import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';
import app from '../src/app';
import { TestCleanupRegistry } from './testCleanup.utils';

test('wp3_3b_schedule_year_scope: STUDENT and TA out-of-scope ?year= returns 403 (OD-41 / M-1)', async (t) => {
  const SUFFIX = `yr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const passwordHash = await bcrypt.hash('TestPass123!Aa', 4);
  const cleanup = new TestCleanupRegistry();
  let server: http.Server | null = null;

  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as any;
    const baseUrl = `http://127.0.0.1:${addr.port}/api`;

    // 1. Setup College and Department
    const college = await prisma.college.create({
      data: { name: `College_${SUFFIX}` },
    });
    cleanup.trackCollege(college.id);

    const department = await prisma.department.create({
      data: { name: `Dept_${SUFFIX}`, collegeId: college.id },
    });
    cleanup.trackDepartment(department.id);

    // 2. Setup Student (Year 1)
    const studentUser = await prisma.user.create({
      data: {
        email: `student_${SUFFIX}@univ.edu`,
        password: passwordHash,
        role: 'STUDENT',
        departmentId: department.id,
      },
    });
    cleanup.trackUser(studentUser.id);
    const studentToken = generateAccessToken(studentUser.id, studentUser.tokenVersion);

    const student = await prisma.student.create({
      data: {
        userId: studentUser.id,
        studentId: `STUID_${SUFFIX}`,
        firstName: 'Student',
        lastName: `Test_${SUFFIX}`,
        year: 1,
        departmentId: department.id,
      },
    });
    cleanup.trackStudent(student.id);

    // 3. Setup TA with a course in Year 2
    const taUser = await prisma.user.create({
      data: {
        email: `ta_${SUFFIX}@univ.edu`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        departmentId: department.id,
      },
    });
    cleanup.trackUser(taUser.id);
    const taToken = generateAccessToken(taUser.id, taUser.tokenVersion);

    const ta = await prisma.teachingAssistant.create({
      data: {
        userId: taUser.id,
        employeeId: `TA_${SUFFIX}`,
        firstName: 'Staff',
        lastName: `TA_${SUFFIX}`,
        departmentId: department.id,
      },
    });
    cleanup.trackTA(ta.id);

    // Setup Course (Year 2)
    const courseYear2 = await prisma.course.create({
      data: {
        name: `Course_Y2_${SUFFIX}`,
        courseCode: `CY2_${SUFFIX.slice(-6)}`,
        credits: 3,
        year: 2,
        semester: 1,
        departmentId: department.id,
        isPublished: true,
      },
    });
    cleanup.trackCourse(courseYear2.id);

    // Published Timetable
    const timetable = await prisma.timetable.create({
      data: {
        collegeId: college.id,
        departmentId: department.id,
        academicYear: 2,
        semester: 1,
        title: `TT_Y2_${SUFFIX}`,
        status: 'PUBLISHED',
      },
    });
    cleanup.trackTimetable(timetable.id);

    // ScheduleSlot assigned to TA
    const slot = await prisma.scheduleSlot.create({
      data: {
        timetableId: timetable.id,
        courseId: courseYear2.id,
        teachingAssistantId: ta.id,
        dayOfWeek: 'MONDAY',
        startTime: '10:00',
        endTime: '12:00',
        slotType: 'LAB',
      },
    });
    cleanup.trackSlot(slot.id);

    // ─────────────────────────────────────────────────────────────────────────
    // Test STUDENT ?year=
    // ─────────────────────────────────────────────────────────────────────────
    await t.test('student querying own year (year=1) succeeds with 200 OK', async () => {
      const res = await fetch(`${baseUrl}/schedules/week?year=1`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
    });

    await t.test('student querying out-of-scope year (year=3) returns 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/schedules/week?year=3`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.message, /academic year/i);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test TEACHING_ASSISTANT ?year=
    // ─────────────────────────────────────────────────────────────────────────
    await t.test('TA querying assigned course year (year=2) succeeds with 200 OK', async () => {
      const res = await fetch(`${baseUrl}/schedules/week?year=2`, {
        headers: { Authorization: `Bearer ${taToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
    });

    await t.test('TA querying out-of-scope year (year=4) returns 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/schedules/week?year=4`, {
        headers: { Authorization: `Bearer ${taToken}` },
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.message, /assigned courses/i);
    });
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await cleanup.teardown(prisma);
  }
});
