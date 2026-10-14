import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import prisma from '../src/utils/prismaClient';
import { getAllColleges } from '../src/services/college.service';
import { generateAccessToken } from '../src/utils/jwt.utils';
import type { AuthActor } from '../src/types/auth.types';

test('T3 MAJOR (a): GET /api/colleges/manage returns active student count per college', async () => {
  const superAdminUser: AuthActor = {
    id: 9999991,
    role: 'SUPER_ADMIN',
  };

  const colleges = await getAllColleges(superAdminUser);
  assert.ok(Array.isArray(colleges), 'getAllColleges must return an array');
  assert.ok(colleges.length > 0, 'Database must contain colleges');

  // Verify each college has active student counts populated
  for (const college of colleges) {
    assert.ok(
      college._count && typeof (college._count as any).students === 'number',
      `College ${college.id} must include _count.students as a number`
    );
    assert.ok(
      typeof (college as any).activeStudentCount === 'number',
      `College ${college.id} must include activeStudentCount as a number`
    );
  }

  // HTTP verification
  const { default: app } = await import('../src/app');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  const admin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', isActive: true },
  });
  assert.ok(admin, 'Active super admin must exist');
  const token = generateAccessToken(admin.id, admin.tokenVersion);

  try {
    const res = await fetch(`${baseUrl}/colleges/manage`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));

    for (const c of body.data) {
      assert.equal(
        typeof c._count?.students,
        'number',
        `HTTP payload college ${c.id} must have _count.students as number`
      );
      assert.equal(
        typeof c.activeStudentCount,
        'number',
        `HTTP payload college ${c.id} must have activeStudentCount as number`
      );
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
