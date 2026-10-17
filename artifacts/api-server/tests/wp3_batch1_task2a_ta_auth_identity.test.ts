import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { TestCleanupRegistry } from './testCleanup.utils';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'wp3-batch1-ta-identity-test-2026';

const [
  { default: app },
  { default: prisma },
  { generateAccessToken },
] = await Promise.all([
  import('../src/app'),
  import('../src/utils/prismaClient'),
  import('../src/utils/jwt.utils'),
]);

test('A5: /auth/me and login expose minimal teachingAssistant { id, departmentId }', async () => {
  const SUFFIX = 'ta_id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
  const cleanup = new TestCleanupRegistry();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let ta: any;
  let dept: any;

  try {
    const college = await prisma.college.create({
      data: { name: `Col_${SUFFIX}` },
    });
    cleanup.trackCollege(college.id);

    dept = await prisma.department.create({
      data: { name: `Dept_${SUFFIX}`, collegeId: college.id },
    });
    cleanup.trackDepartment(dept.id);

    const taUser = await prisma.user.create({
      data: {
        email: `ta_${SUFFIX}@example.test`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(taUser.id);

    ta = await prisma.teachingAssistant.create({
      data: {
        userId: taUser.id,
        employeeId: `EMP_${SUFFIX}`,
        firstName: 'Tamer',
        lastName: 'Ahmed',
        departmentId: dept.id,
      },
    });
    cleanup.trackTA(ta.id);

    const token = generateAccessToken(taUser.id, 0);

    // 1. Check GET /api/auth/me
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(meRes.status, 200);
    const meBody = await meRes.json();
    assert.equal(meBody.success, true);
    assert.ok(meBody.data.teachingAssistant, 'GET /auth/me must return teachingAssistant object');
    assert.equal(String(meBody.data.teachingAssistant.id), String(ta.id));
    assert.equal(meBody.data.teachingAssistant.departmentId, dept.id);
  } finally {
    try {
      await cleanup.teardown(prisma);
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
});
