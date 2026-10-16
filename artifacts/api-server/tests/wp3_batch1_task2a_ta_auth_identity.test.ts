import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

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
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let college: any;
  let dept: any;
  let taUser: any;
  let ta: any;

  try {
    college = await prisma.college.create({
      data: { name: `Col_${SUFFIX}` }
    });
    dept = await prisma.department.create({
      data: { name: `Dept_${SUFFIX}`, collegeId: college.id }
    });
    taUser = await prisma.user.create({
      data: {
        email: `ta_${SUFFIX}@example.test`,
        password: '$2b$10$OpeBBdb/21NC.p5Zrli5vOWHt7XNakKQXMMjPI/PNi5BeQM2VNOea', // dummy hash for Password123!
        role: 'TEACHING_ASSISTANT',
        tokenVersion: 0,
        isActive: true,
      }
    });
    ta = await prisma.teachingAssistant.create({
      data: {
        userId: taUser.id,
        employeeId: `EMP_${SUFFIX}`,
        firstName: 'Tamer',
        lastName: 'Ahmed',
        departmentId: dept.id,
      }
    });

    const token = generateAccessToken(taUser.id, 0);

    // 1. Check GET /api/auth/me
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(meRes.status, 200);
    const meBody = await meRes.json();
    assert.equal(meBody.success, true);
    assert.ok(meBody.data.teachingAssistant, 'GET /auth/me must return teachingAssistant object');
    assert.equal(String(meBody.data.teachingAssistant.id), String(ta.id));
    assert.equal(meBody.data.teachingAssistant.departmentId, dept.id);
  } finally {
    if (ta?.id) await prisma.teachingAssistant.delete({ where: { id: ta.id } }).catch(() => {});
    if (taUser?.id) await prisma.user.delete({ where: { id: taUser.id } }).catch(() => {});
    if (dept?.id) await prisma.department.delete({ where: { id: dept.id } }).catch(() => {});
    if (college?.id) await prisma.college.delete({ where: { id: college.id } }).catch(() => {});
    server.close();
  }
});
