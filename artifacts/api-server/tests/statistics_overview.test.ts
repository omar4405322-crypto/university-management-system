import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';

test('T2 MAJOR: GET /api/statistics/overview security and role-scoping', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  try {
    // 1. Unauthenticated request -> 401
    const unauthRes = await fetch(`${baseUrl}/statistics/overview`);
    assert.equal(unauthRes.status, 401, 'Unauthenticated request must return 401');

    // 2. Unauthorized roles (STUDENT, DOCTOR, TEACHING_ASSISTANT) -> 403
    const studentUser = await prisma.user.findFirst({
      where: { role: 'STUDENT', isActive: true },
    });
    if (studentUser) {
      const studentToken = generateAccessToken(studentUser.id, studentUser.tokenVersion);
      const studentRes = await fetch(`${baseUrl}/statistics/overview`, {
        headers: { authorization: `Bearer ${studentToken}` },
      });
      assert.equal(studentRes.status, 403, 'Student must receive 403');
    }

    const doctorUser = await prisma.user.findFirst({
      where: { role: 'DOCTOR', isActive: true },
    });
    if (doctorUser) {
      const doctorToken = generateAccessToken(doctorUser.id, doctorUser.tokenVersion);
      const doctorRes = await fetch(`${baseUrl}/statistics/overview`, {
        headers: { authorization: `Bearer ${doctorToken}` },
      });
      assert.equal(doctorRes.status, 403, 'Doctor must receive 403');
    }

    const taUser = await prisma.user.findFirst({
      where: { role: 'TEACHING_ASSISTANT', isActive: true },
    });
    if (taUser) {
      const taToken = generateAccessToken(taUser.id, taUser.tokenVersion);
      const taRes = await fetch(`${baseUrl}/statistics/overview`, {
        headers: { authorization: `Bearer ${taToken}` },
      });
      assert.equal(taRes.status, 403, 'TA must receive 403');
    }

    // 3. SUPER_ADMIN -> 200 with full university scope and byCollege
    const superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN', isActive: true },
    });
    assert.ok(superAdmin, 'Super Admin must exist');
    const superToken = generateAccessToken(superAdmin.id, superAdmin.tokenVersion);

    const superRes = await fetch(`${baseUrl}/statistics/overview`, {
      headers: { authorization: `Bearer ${superToken}` },
    });
    assert.equal(superRes.status, 200, 'Super admin must receive 200');
    const superJson = await superRes.json();
    assert.equal(superJson.success, true);
    assert.ok(typeof superJson.data.totalStudents === 'number');
    assert.ok(typeof superJson.data.activeStudents === 'number');
    assert.ok(typeof superJson.data.averageGpa === 'number');
    assert.ok(superJson.data.standingDistribution && typeof superJson.data.standingDistribution === 'object');
    assert.ok(Array.isArray(superJson.data.byAcademicYear));
    assert.ok(Array.isArray(superJson.data.byDepartment));
    assert.ok(Array.isArray(superJson.data.byCollege), 'Super admin overview must include byCollege breakdown');

    // 4. COLLEGE_ADMIN -> 200 with scoped data (no byCollege)
    const collegeAdmin = await prisma.user.findFirst({
      where: { role: 'COLLEGE_ADMIN', isActive: true, managedCollegeId: { not: null } },
    });
    if (collegeAdmin) {
      const collegeToken = generateAccessToken(collegeAdmin.id, collegeAdmin.tokenVersion);
      const collegeRes = await fetch(`${baseUrl}/statistics/overview`, {
        headers: { authorization: `Bearer ${collegeToken}` },
      });
      assert.equal(collegeRes.status, 200, 'College admin must receive 200');
      const collegeJson = await collegeRes.json();
      assert.equal(collegeJson.success, true);
      assert.equal(collegeJson.data.byCollege, undefined, 'College admin overview must NOT include byCollege');
      assert.ok(Array.isArray(collegeJson.data.byDepartment));
      for (const dept of collegeJson.data.byDepartment) {
        assert.equal(dept.collegeId, collegeAdmin.managedCollegeId, 'Departments must belong to managed college');
      }
    }
  } finally {
    server.close();
  }
});
