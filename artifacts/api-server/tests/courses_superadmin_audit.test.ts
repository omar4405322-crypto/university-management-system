import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';

test('Courses Super Admin Only Scope & Audit Logging (T7)', async () => {
  const runSuffix = `crs_sa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let superAdminId: number | undefined;
  let collegeAdminId: number | undefined;
  let collegeId: number | undefined;
  let departmentId: number | undefined;
  let createdCourseId: number | undefined;

  try {
    // 1. Create Super Admin
    const superAdmin = await prisma.user.create({
      data: {
        email: `superadmin_${runSuffix}@test.local`,
        password: 'hashed-password-fixture',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
    superAdminId = superAdmin.id;
    const superAdminToken = generateAccessToken(superAdmin.id, superAdmin.tokenVersion || 0);

    // 2. Create College, Department, and College Admin
    const college = await prisma.college.create({
      data: { name: `College_${runSuffix}` },
    });
    collegeId = college.id;

    const department = await prisma.department.create({
      data: { name: `Dept_${runSuffix}`, collegeId: college.id },
    });
    departmentId = department.id;

    const collegeAdmin = await prisma.user.create({
      data: {
        email: `collegeadmin_${runSuffix}@test.local`,
        password: 'hashed-password-fixture',
        role: 'COLLEGE_ADMIN',
        collegeId: college.id,
        managedCollegeId: college.id,
        isActive: true,
      },
    });
    collegeAdminId = collegeAdmin.id;
    const collegeAdminToken = generateAccessToken(collegeAdmin.id, collegeAdmin.tokenVersion || 0);

    // 3. College Admin cannot create course (must return 403)
    const collegeAdminCreateRes = await fetch(`${baseUrl}/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${collegeAdminToken}`,
      },
      body: JSON.stringify({
        courseCode: `CA_CRS_${runSuffix}`,
        name: `Course by CA`,
        departmentId: department.id,
        year: 1,
        credits: 3,
        semester: 1,
      }),
    });
    assert.equal(collegeAdminCreateRes.status, 403, 'College admin must receive 403 on course creation');

    // 4. Super Admin creates course (201) and records audit log
    const superAdminCreateRes = await fetch(`${baseUrl}/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        courseCode: `SA_CRS_${runSuffix}`,
        name: `Course by SA`,
        departmentId: department.id,
        year: 1,
        credits: 3,
        semester: 1,
      }),
    });
    assert.equal(superAdminCreateRes.status, 201, 'Super Admin must receive 201 on course creation');
    const createJson = await superAdminCreateRes.json();
    assert.equal(createJson.success, true);
    createdCourseId = createJson.data.id;

    const createAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'COURSE_CREATED',
        entity: 'Course',
        entityId: String(createdCourseId),
      },
    });
    assert.ok(createAudit, 'Expected AuditLog for COURSE_CREATED');

    // 5. Super Admin deletes course (200) and records audit log
    const superAdminDeleteRes = await fetch(`${baseUrl}/courses/${createdCourseId}`, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });
    assert.equal(superAdminDeleteRes.status, 200, 'Super Admin must receive 200 on course deletion');

    const deleteAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'COURSE_DELETED',
        entity: 'Course',
        entityId: String(createdCourseId),
      },
    });
    assert.ok(deleteAudit, 'Expected AuditLog for COURSE_DELETED');

  } finally {
    try {
      if (createdCourseId) {
        await prisma.course.deleteMany({ where: { id: createdCourseId } });
      }
      if (departmentId) {
        await prisma.department.deleteMany({ where: { id: departmentId } });
      }
      if (collegeId) {
        await prisma.college.deleteMany({ where: { id: collegeId } });
      }
      if (collegeAdminId) {
        await prisma.user.deleteMany({ where: { id: collegeAdminId } });
      }
      if (superAdminId) {
        await prisma.auditLog.deleteMany({ where: { userId: superAdminId } });
        await prisma.user.deleteMany({ where: { id: superAdminId } });
      }
    } catch {
      // ignore teardown errors
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
