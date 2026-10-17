import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';
import app from '../src/app';
import { TestCleanupRegistry } from './testCleanup.utils';

test('C1: GET /api/teaching-assistants/suggested enforces strict TA scope (in-dept & already-assigned only; rejects out-of-dept and null-dept)', async () => {
  const SUFFIX = `c1_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
  const cleanup = new TestCleanupRegistry();
  let server: http.Server | null = null;

  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as any;
    const baseUrl = `http://127.0.0.1:${addr.port}/api`;

    // 1. Setup departments & course
    const college = await prisma.college.findFirst({ select: { id: true } });
    assert.ok(college, 'Seeded college must exist');

    const dept1 = await prisma.department.create({
      data: {
        name: `Dept1_${SUFFIX}`,
        collegeId: college.id,
      },
    });
    cleanup.trackDepartment(dept1.id);

    const dept2 = await prisma.department.create({
      data: {
        name: `Dept2_${SUFFIX}`,
        collegeId: college.id,
      },
    });
    cleanup.trackDepartment(dept2.id);

    const course = await prisma.course.create({
      data: {
        name: `Course_${SUFFIX}`,
        courseCode: `C1_${SUFFIX.slice(-5)}`,
        credits: 3,
        year: 1,
        semester: 1,
        departmentId: dept1.id,
      },
    });
    cleanup.trackCourse(course.id);

    // 2. Setup Super Admin
    const adminUser = await prisma.user.create({
      data: {
        email: `admin_${SUFFIX}@unicore.test`,
        password: passwordHash,
        role: 'SUPER_ADMIN',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(adminUser.id);
    const adminToken = generateAccessToken(adminUser.id, 0);

    // 3. Setup 4 TAs:
    // TA 1: In-department (dept1) -> MUST be suggested
    const u1 = await prisma.user.create({
      data: {
        email: `ta1_indept_${SUFFIX}@unicore.test`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(u1.id);

    const taInDept = await prisma.teachingAssistant.create({
      data: {
        userId: u1.id,
        employeeId: `TA1_${SUFFIX}`,
        firstName: 'InDept',
        lastName: 'TA',
        departmentId: dept1.id,
        status: 'ACTIVE',
      },
    });
    cleanup.trackTA(taInDept.id);

    // TA 2: Out-of-department (dept2, unassigned) -> MUST NOT be suggested
    const u2 = await prisma.user.create({
      data: {
        email: `ta2_outdept_${SUFFIX}@unicore.test`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(u2.id);

    const taOutDept = await prisma.teachingAssistant.create({
      data: {
        userId: u2.id,
        employeeId: `TA2_${SUFFIX}`,
        firstName: 'OutDept',
        lastName: 'TA',
        departmentId: dept2.id,
        status: 'ACTIVE',
      },
    });
    cleanup.trackTA(taOutDept.id);

    // TA 3: Null-department (departmentId: null) -> MUST NOT be suggested
    const u3 = await prisma.user.create({
      data: {
        email: `ta3_nulldept_${SUFFIX}@unicore.test`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(u3.id);

    const taNullDept = await prisma.teachingAssistant.create({
      data: {
        userId: u3.id,
        employeeId: `TA3_${SUFFIX}`,
        firstName: 'NullDept',
        lastName: 'TA',
        departmentId: null,
        status: 'ACTIVE',
      },
    });
    cleanup.trackTA(taNullDept.id);

    // TA 4: Out-of-department (dept2), BUT assigned to Course C1 -> MUST be suggested
    const u4 = await prisma.user.create({
      data: {
        email: `ta4_assigned_${SUFFIX}@unicore.test`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(u4.id);

    const taAssigned = await prisma.teachingAssistant.create({
      data: {
        userId: u4.id,
        employeeId: `TA4_${SUFFIX}`,
        firstName: 'Assigned',
        lastName: 'TA',
        departmentId: dept2.id,
        status: 'ACTIVE',
      },
    });
    cleanup.trackTA(taAssigned.id);

    // Create Timetable and slot assigning TA 4 to course
    const tb = await prisma.timetable.create({
      data: {
        title: `Timetable_${SUFFIX}`,
        academicYear: 1,
        semester: 1,
        collegeId: college.id,
        departmentId: dept1.id,
        status: 'PUBLISHED',
      },
    });
    cleanup.trackTimetable(tb.id);

    const slot = await prisma.scheduleSlot.create({
      data: {
        courseId: course.id,
        timetableId: tb.id,
        teachingAssistantId: taAssigned.id,
        dayOfWeek: 'MONDAY',
        startTime: '10:00',
        endTime: '12:00',
        room: 'Lab C1',
        slotType: 'LAB',
        isArchived: false,
      },
    });
    cleanup.trackSlot(slot.id);

    // 4. Call GET /api/teaching-assistants/suggested?courseId=<courseId>
    const res = await fetch(`${baseUrl}/teaching-assistants/suggested?courseId=${course.id}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200, 'GET /suggested must return 200');
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data), 'body.data must be an array');

    const suggestedIds = body.data.map((t: any) => String(t.id));

    // Assertions:
    // 1. in-department TA MUST be suggested
    assert.ok(
      suggestedIds.includes(String(taInDept.id)),
      `In-department TA (id: ${taInDept.id}) MUST be suggested`
    );

    // 2. already-assigned TA MUST be suggested
    assert.ok(
      suggestedIds.includes(String(taAssigned.id)),
      `Already-assigned TA (id: ${taAssigned.id}) MUST be suggested`
    );

    // 3. out-of-department TA MUST NOT be suggested
    assert.ok(
      !suggestedIds.includes(String(taOutDept.id)),
      `Out-of-department TA (id: ${taOutDept.id}) MUST NOT be suggested`
    );

    // 4. null-department TA MUST NOT be suggested
    assert.ok(
      !suggestedIds.includes(String(taNullDept.id)),
      `Null-department TA (id: ${taNullDept.id}) MUST NOT be suggested`
    );
  } finally {
    try {
      await cleanup.teardown(prisma);
    } finally {
      if (server) {
        server.closeAllConnections?.();
        await new Promise<void>((resolve) => server!.close(() => resolve()));
      }
    }
  }
});
