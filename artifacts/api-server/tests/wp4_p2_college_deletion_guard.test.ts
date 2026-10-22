import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';

function makeSuffix(tag: string) {
  return `wp4_p2_${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

let sharedServer: http.Server | null = null;
let sharedBaseUrl: string = '';

async function getTestBaseUrl(): Promise<string> {
  if (!sharedServer) {
    const { default: app } = await import('../src/app');
    sharedServer = http.createServer(app);
    await new Promise<void>((resolve) => sharedServer!.listen(0, '127.0.0.1', resolve));
    const address = sharedServer.address();
    assert.ok(address && typeof address === 'object');
    sharedBaseUrl = `http://127.0.0.1:${address.port}/api`;
  }
  return sharedBaseUrl;
}

test('WP-4 P2 Guard: DELETE /api/colleges/:id returns 409 Conflict when college has linked departments or records', async () => {
  const suffix = makeSuffix('college_guard');
  const baseUrl = await getTestBaseUrl();
  const passwordHash = await bcrypt.hash('Secret123!', 4);

  const superAdmin = await prisma.user.create({
    data: {
      email: `sa_${suffix}@uni.edu`,
      password: passwordHash,
      role: 'SUPER_ADMIN',
    },
  });
  const token = generateAccessToken(superAdmin.id, superAdmin.tokenVersion);

  const college = await prisma.college.create({
    data: {
      name: `College_${suffix}`,
    },
  });

  const department = await prisma.department.create({
    data: {
      name: `Dept_${suffix}`,
      collegeId: college.id,
    },
  });

  // Create a StudentGroup under department which has non-null departmentId and no cascade
  const studentGroup = await prisma.studentGroup.create({
    data: {
      name: `Group_${suffix}`,
      departmentId: department.id,
      year: 1,
    },
  });

  try {
    const res = await fetch(`${baseUrl}/colleges/${college.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    assert.strictEqual(
      res.status,
      409,
      `DELETE /api/colleges/:id on college with linked records must return 409 Conflict, got ${res.status}`
    );
  } finally {
    await prisma.studentGroup.deleteMany({ where: { id: studentGroup.id } }).catch(() => {});
    await prisma.department.deleteMany({ where: { id: department.id } }).catch(() => {});
    await prisma.college.deleteMany({ where: { id: college.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: superAdmin.id } }).catch(() => {});
  }
});

test('WP-4 P2 Guard: DELETE /api/colleges/:id returns 409 when college has managed admins', async () => {
  const suffix = makeSuffix('college_admin_guard');
  const baseUrl = await getTestBaseUrl();
  const passwordHash = await bcrypt.hash('Secret123!', 4);

  const superAdmin = await prisma.user.create({
    data: {
      email: `sa_${suffix}@uni.edu`,
      password: passwordHash,
      role: 'SUPER_ADMIN',
    },
  });
  const token = generateAccessToken(superAdmin.id, superAdmin.tokenVersion);

  const college = await prisma.college.create({
    data: {
      name: `College_${suffix}`,
    },
  });

  const collegeAdmin = await prisma.user.create({
    data: {
      email: `ca_${suffix}@uni.edu`,
      password: passwordHash,
      role: 'COLLEGE_ADMIN',
      managedCollegeId: college.id,
    },
  });

  try {
    const res = await fetch(`${baseUrl}/colleges/${college.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    assert.strictEqual(res.status, 409, 'College with managed admins must return 409 Conflict');
  } finally {
    await prisma.user.deleteMany({ where: { id: collegeAdmin.id } }).catch(() => {});
    await prisma.college.deleteMany({ where: { id: college.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: superAdmin.id } }).catch(() => {});
  }
});

test('WP-4 P2 Guard: DELETE /api/colleges/:id on empty college returns 200', async () => {
  const suffix = makeSuffix('empty_college');
  const baseUrl = await getTestBaseUrl();
  const passwordHash = await bcrypt.hash('Secret123!', 4);

  const superAdmin = await prisma.user.create({
    data: {
      email: `sa_${suffix}@uni.edu`,
      password: passwordHash,
      role: 'SUPER_ADMIN',
    },
  });
  const token = generateAccessToken(superAdmin.id, superAdmin.tokenVersion);

  const college = await prisma.college.create({
    data: {
      name: `Empty_College_${suffix}`,
    },
  });

  try {
    const res = await fetch(`${baseUrl}/colleges/${college.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    assert.strictEqual(res.status, 200, 'Empty college deletion must return 200');
    const fresh = await prisma.college.findUnique({ where: { id: college.id } });
    assert.strictEqual(fresh, null, 'College must be deleted');
  } finally {
    await prisma.college.deleteMany({ where: { id: college.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: superAdmin.id } }).catch(() => {});
  }
});

test.after(async () => {
  if (sharedServer) {
    await new Promise<void>((resolve) => sharedServer!.close(() => resolve()));
  }
});
