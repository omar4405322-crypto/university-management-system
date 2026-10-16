import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';
import app from '../src/app';

test('C2: TA department lifecycle (required on create -> 422, scope enforcement -> 403, update null TA -> appears in suggestions)', async () => {
  const SUFFIX = `c2_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let server: http.Server | null = null;

  const createdUserIds: number[] = [];
  const createdTaIds: string[] = [];
  const createdDeptIds: number[] = [];
  let createdCollegeId: number | null = null;
  let courseId: number | null = null;

  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as any;
    const baseUrl = `http://127.0.0.1:${addr.port}/api`;

    // 1. Setup colleges & departments
    const primaryCollege = await prisma.college.findFirst({ select: { id: true } });
    assert.ok(primaryCollege, 'Seeded primary college must exist');

    const secondaryCollege = await prisma.college.create({
      data: {
        name: `College2_${SUFFIX}`,
      },
    });
    createdCollegeId = secondaryCollege.id;

    const deptPrimary = await prisma.department.create({
      data: {
        name: `DeptPrimary_${SUFFIX}`,
        collegeId: primaryCollege.id,
      },
    });
    createdDeptIds.push(deptPrimary.id);

    const deptSecondary = await prisma.department.create({
      data: {
        name: `DeptSecondary_${SUFFIX}`,
        collegeId: secondaryCollege.id,
      },
    });
    createdDeptIds.push(deptSecondary.id);

    // Setup course in deptPrimary
    const course = await prisma.course.create({
      data: {
        name: `Course_${SUFFIX}`,
        courseCode: `C2_${SUFFIX.slice(-5)}`,
        credits: 3,
        year: 1,
        semester: 1,
        departmentId: deptPrimary.id,
      },
    });
    courseId = course.id;

    // 2. Setup Super Admin & College Admin (scoped to primaryCollege)
    const superAdmin = await prisma.user.create({
      data: {
        email: `super_${SUFFIX}@unicore.test`,
        password: 'Password123!',
        role: 'SUPER_ADMIN',
        tokenVersion: 0,
        isActive: true,
      },
    });
    createdUserIds.push(superAdmin.id);
    const superToken = generateAccessToken(superAdmin.id, 0);

    const collegeAdmin = await prisma.user.create({
      data: {
        email: `col_admin_${SUFFIX}@unicore.test`,
        password: 'Password123!',
        role: 'COLLEGE_ADMIN',
        managedCollegeId: primaryCollege.id,
        tokenVersion: 0,
        isActive: true,
      },
    });
    createdUserIds.push(collegeAdmin.id);
    const collegeAdminToken = generateAccessToken(collegeAdmin.id, 0);

    // ── Check 1: create without departmentId -> 422 ───────────────────────────
    const createNoDeptRes = await fetch(`${baseUrl}/teaching-assistants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`,
      },
      body: JSON.stringify({
        firstName: 'NoDept',
        lastName: 'TA',
        employeeId: `TA_NOD_${SUFFIX}`,
        email: `nodept_${SUFFIX}@unicore.test`,
        password: 'Password123!',
      }),
    });
    const createNoDeptJson: any = await createNoDeptRes.json();
    if (createNoDeptJson.data?.id) createdTaIds.push(createNoDeptJson.data.id);
    if (createNoDeptJson.data?.userId) createdUserIds.push(createNoDeptJson.data.userId);
    assert.equal(
      createNoDeptRes.status,
      422,
      `Expected 422 when creating TA without departmentId, got ${createNoDeptRes.status}: ${JSON.stringify(createNoDeptJson)}`
    );

    // ── Check 2: out-of-scope department -> 403 ──────────────────────────────
    // College Admin (primaryCollege) tries to create TA in deptSecondary (secondaryCollege)
    const createOutOfScopeRes = await fetch(`${baseUrl}/teaching-assistants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${collegeAdminToken}`,
      },
      body: JSON.stringify({
        firstName: 'OutOfScope',
        lastName: 'TA',
        employeeId: `TA_OOS_${SUFFIX}`,
        email: `outofscope_${SUFFIX}@unicore.test`,
        password: 'Password123!',
        departmentId: deptSecondary.id,
      }),
    });
    const createOutOfScopeJson: any = await createOutOfScopeRes.json();
    assert.equal(
      createOutOfScopeRes.status,
      403,
      `Expected 403 when creating TA with out-of-scope department, got ${createOutOfScopeRes.status}: ${JSON.stringify(createOutOfScopeJson)}`
    );

    // ── Check 3: updating a null-department TA makes it appear in suggestions ─
    // Create a TA directly with null departmentId
    const nullTaUser = await prisma.user.create({
      data: {
        email: `null_ta_${SUFFIX}@unicore.test`,
        password: 'Password123!',
        role: 'TEACHING_ASSISTANT',
        tokenVersion: 0,
        isActive: true,
      },
    });
    createdUserIds.push(nullTaUser.id);

    const nullTa = await prisma.teachingAssistant.create({
      data: {
        userId: nullTaUser.id,
        employeeId: `TA_NULL_${SUFFIX}`,
        firstName: 'InitiallyNull',
        lastName: 'TA',
        departmentId: null,
        status: 'ACTIVE',
      },
    });
    createdTaIds.push(nullTa.id);

    // Verify null-dept TA is NOT suggested for course in deptPrimary
    const beforeUpdateRes = await fetch(`${baseUrl}/teaching-assistants/suggested?courseId=${course.id}`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    const beforeUpdateJson: any = await beforeUpdateRes.json();
    assert.equal(beforeUpdateRes.status, 200);
    const suggestedBeforeIds = (beforeUpdateJson.data || []).map((t: any) => t.id);
    assert.ok(
      !suggestedBeforeIds.includes(nullTa.id),
      'Null-department TA must NOT appear in suggested list'
    );

    // Super Admin updates TA to in-scope department (deptPrimary)
    const updateRes = await fetch(`${baseUrl}/teaching-assistants/${nullTa.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`,
      },
      body: JSON.stringify({
        departmentId: deptPrimary.id,
      }),
    });
    const updateJson: any = await updateRes.json();
    assert.equal(
      updateRes.status,
      200,
      `Expected 200 when updating TA department, got ${updateRes.status}: ${JSON.stringify(updateJson)}`
    );
    assert.equal(updateJson.data?.departmentId, deptPrimary.id);

    // Verify that after updating to deptPrimary, the TA now APPEARS in suggestions
    const afterUpdateRes = await fetch(`${baseUrl}/teaching-assistants/suggested?courseId=${course.id}`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    const afterUpdateJson: any = await afterUpdateRes.json();
    assert.equal(afterUpdateRes.status, 200);
    const suggestedAfter = (afterUpdateJson.data || []).find((t: any) => t.id === nullTa.id);
    assert.ok(
      suggestedAfter,
      'Updated TA must appear in suggested list for its new home department'
    );
    assert.equal(suggestedAfter.reason, 'Same Department');
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }

    // Clean up course
    if (courseId) {
      await prisma.course.delete({ where: { id: courseId } }).catch(() => {});
    }

    // Clean up TAs
    if (createdTaIds.length > 0) {
      await prisma.teachingAssistant.deleteMany({
        where: { id: { in: createdTaIds } },
      }).catch(() => {});
    }

    // Clean up users
    if (createdUserIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { userId: { in: createdUserIds } },
      }).catch(() => {});
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      }).catch(() => {});
    }

    // Clean up departments
    if (createdDeptIds.length > 0) {
      await prisma.department.deleteMany({
        where: { id: { in: createdDeptIds } },
      }).catch(() => {});
    }

    // Clean up college
    if (createdCollegeId) {
      await prisma.college.delete({ where: { id: createdCollegeId } }).catch(() => {});
    }
  }
});
