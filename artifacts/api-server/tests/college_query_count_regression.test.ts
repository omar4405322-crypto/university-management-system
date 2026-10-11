import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import prisma from '../src/utils/prismaClient';
import { getAllColleges } from '../src/services/college.service';
import { generateAccessToken } from '../src/utils/jwt.utils';
import type { AuthActor } from '../src/types/auth.types';

test('getAllColleges: permanent query-count regression test (N+1 must never return)', async () => {
  // 1. Service-level query count verification
  const originalCollegeFindMany = prisma.college.findMany.bind(prisma.college);
  const originalUserFindMany = prisma.user.findMany.bind(prisma.user);
  const originalUserFindFirst = prisma.user.findFirst.bind(prisma.user);
  const originalDoctorFindUnique = (prisma as any).doctor?.findUnique?.bind((prisma as any).doctor);

  let collegeFindManyCount = 0;
  let userFindManyCount = 0;
  let perCollegeItemQueries = 0;

  (prisma.college as any).findMany = async (...args: any[]) => {
    collegeFindManyCount++;
    return originalCollegeFindMany(...args);
  };

  (prisma.user as any).findMany = async (...args: any[]) => {
    userFindManyCount++;
    return originalUserFindMany(...args);
  };

  (prisma.user as any).findFirst = async (...args: any[]) => {
    perCollegeItemQueries++;
    return originalUserFindFirst(...args);
  };

  if ((prisma as any).doctor?.findUnique) {
    (prisma as any).doctor.findUnique = async (...args: any[]) => {
      perCollegeItemQueries++;
      return originalDoctorFindUnique(...args);
    };
  }

  const superAdminUser: AuthActor = {
    id: 9999991,
    role: 'SUPER_ADMIN',
  };

  try {
    const result = await getAllColleges(superAdminUser);
    assert.ok(Array.isArray(result), 'getAllColleges must return an array');
    assert.ok(result.length > 0, 'Database must contain colleges for test verification');

    // Invariant: exactly 1 college.findMany and at most 1 user.findMany (batch lookup)
    assert.equal(collegeFindManyCount, 1, 'Must execute exactly 1 college.findMany query');
    assert.ok(userFindManyCount <= 1, 'Must execute at most 1 user.findMany query (batched)');
    assert.equal(
      perCollegeItemQueries,
      0,
      `N+1 regression detected! Found ${perCollegeItemQueries} per-college queries during getAllColleges execution`,
    );

    const totalQueries = collegeFindManyCount + userFindManyCount + perCollegeItemQueries;
    assert.ok(
      totalQueries <= 2,
      `Total queries for getAllColleges (${totalQueries}) must never exceed 2 regardless of college count`,
    );
  } finally {
    // Restore spied functions
    (prisma.college as any).findMany = originalCollegeFindMany;
    (prisma.user as any).findMany = originalUserFindMany;
    (prisma.user as any).findFirst = originalUserFindFirst;
    if (originalDoctorFindUnique) {
      (prisma as any).doctor.findUnique = originalDoctorFindUnique;
    }
  }

  // 2. HTTP-level verification against live app
  const { default: app } = await import('../src/app');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  const admin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', isActive: true },
  });
  assert.ok(admin, 'Active super admin must exist in database');
  const token = generateAccessToken(admin.id, admin.tokenVersion);

  try {
    const res = await fetch(`${baseUrl}/colleges/manage`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(res.status, 200, `GET /api/colleges must succeed with 200, got ${res.status}`);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data), 'Payload data must be array of colleges');
    assert.ok(json.data.length >= 1, 'Must return seeded colleges');

    // Verify assignedAdmin is populated on each college without individual item fetches
    for (const college of json.data) {
      assert.ok('id' in college, 'College must have id');
      assert.ok('name' in college, 'College must have name');
      assert.ok('assignedAdmin' in college, 'College must include assignedAdmin property');
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
