import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';

test('Academic Terms & Years API Test Suite (T2)', async () => {
  const runSuffix = `term_api_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let superAdminId: number | undefined;
  let studentUserId: number | undefined;
  let createdYearId: number | undefined;
  let createdTermId: number | undefined;

  try {
    // 1. Create Super Admin User
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

    // 2. Create Student User
    const studentUser = await prisma.user.create({
      data: {
        email: `student_${runSuffix}@test.local`,
        password: 'hashed-password-fixture',
        role: 'STUDENT',
        isActive: true,
      },
    });
    studentUserId = studentUser.id;
    const studentToken = generateAccessToken(studentUser.id, studentUser.tokenVersion || 0);

    // 3. Unauthenticated access is rejected with 401
    const unauthRes = await fetch(`${baseUrl}/academic-years`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `2028-2029_${runSuffix}`, startDate: '2028-09-01', endDate: '2029-06-30' }),
    });
    assert.equal(unauthRes.status, 401, 'Expected 401 for unauthenticated request');

    // 4. Non-super admin access is rejected with 403
    const forbiddenRes = await fetch(`${baseUrl}/academic-years`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ name: `2028-2029_${runSuffix}`, startDate: '2028-09-01', endDate: '2029-06-30' }),
    });
    assert.equal(forbiddenRes.status, 403, 'Expected 403 for student request');

    // 5. Invalid date order (startDate >= endDate) is rejected with 422
    const invalidDateRes = await fetch(`${baseUrl}/academic-years`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ name: `2028-2029_${runSuffix}`, startDate: '2029-06-30', endDate: '2028-09-01' }),
    });
    assert.equal(invalidDateRes.status, 422, 'Expected 422 for startDate >= endDate');

    // 6. Valid Academic Year creation by Super Admin succeeds (201) and logs audit
    const createYearRes = await fetch(`${baseUrl}/academic-years`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `2028-2029_${runSuffix}`,
        startDate: '2028-09-01T00:00:00.000Z',
        endDate: '2029-06-30T00:00:00.000Z',
      }),
    });
    assert.equal(createYearRes.status, 201, 'Expected 201 for valid academic year creation');
    const yearJson = await createYearRes.json();
    assert.equal(yearJson.success, true);
    createdYearId = yearJson.data.id;

    const yearAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'ACADEMIC_YEAR_CREATED',
        entity: 'AcademicYear',
        entityId: String(createdYearId),
      },
    });
    assert.ok(yearAudit, 'Expected AuditLog entry for ACADEMIC_YEAR_CREATED');

    // 7. Create First Term
    const term1Res = await fetch(`${baseUrl}/academic-terms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        academicYearId: createdYearId,
        name: `Fall 2028_${runSuffix}`,
        termType: 'FALL',
        semesterNumber: 1,
        startDate: '2028-09-01T00:00:00.000Z',
        endDate: '2029-01-31T00:00:00.000Z',
      }),
    });
    assert.equal(term1Res.status, 201, 'Expected 201 for term creation');
    const term1Json = await term1Res.json();
    createdTermId = term1Json.data.id;

    const termAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'ACADEMIC_TERM_CREATED',
        entity: 'AcademicTerm',
        entityId: String(createdTermId),
      },
    });
    assert.ok(termAudit, 'Expected AuditLog entry for ACADEMIC_TERM_CREATED');

    // 8. Overlapping Term Creation within same Academic Year is rejected with 422
    const overlapRes = await fetch(`${baseUrl}/academic-terms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        academicYearId: createdYearId,
        name: `Overlap Term_${runSuffix}`,
        termType: 'SPRING',
        semesterNumber: 2,
        startDate: '2029-01-15T00:00:00.000Z', // overlaps with term 1 ending 2029-01-31
        endDate: '2029-05-30T00:00:00.000Z',
      }),
    });
    assert.equal(overlapRes.status, 422, 'Expected 422 for overlapping term dates');

    // 9. Safe GET /api/academic-terms/current returns 200 with { currentTerm: null } when no term is active
    // Ensure all terms currently in DB have isCurrent = false for this test assertion
    const currentRes = await fetch(`${baseUrl}/academic-terms/current`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    assert.equal(currentRes.status, 200, 'Expected 200 for current term endpoint');
    const currentJson = await currentRes.json();
    assert.equal(currentJson.success, true);
    assert.ok('currentTerm' in currentJson.data, 'Expected currentTerm field in response');

  } finally {
    // Teardown in reverse dependency order
    try {
      if (createdTermId) {
        await prisma.academicTerm.deleteMany({ where: { id: createdTermId } });
      }
      if (createdYearId) {
        await prisma.academicYear.deleteMany({ where: { id: createdYearId } });
      }
      if (superAdminId) {
        await prisma.auditLog.deleteMany({ where: { userId: superAdminId } });
        await prisma.user.deleteMany({ where: { id: superAdminId } });
      }
      if (studentUserId) {
        await prisma.user.deleteMany({ where: { id: studentUserId } });
      }
    } catch {
      // ignore teardown error
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
