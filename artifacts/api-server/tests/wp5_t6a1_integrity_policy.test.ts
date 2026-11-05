import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import prisma from '../src/utils/prismaClient';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/jwt.utils';

let sharedServer: http.Server | null = null;
let sharedBaseUrl: string = '';

async function getTestBaseUrl(): Promise<string> {
  if (sharedServer) return sharedBaseUrl;
  sharedServer = http.createServer(app);
  await new Promise<void>((resolve) => {
    sharedServer!.listen(0, '127.0.0.1', () => {
      const addr = sharedServer!.address() as any;
      sharedBaseUrl = `http://127.0.0.1:${addr.port}/api`;
      resolve();
    });
  });
  sharedServer.unref();
  return sharedBaseUrl;
}

function makeSuffix(name: string): string {
  const rand = Math.floor(Math.random() * 1000000);
  const time = Date.now().toString().slice(-6);
  return `${name}_${time}_${rand}`;
}

const createdUserIds: number[] = [];

async function createTestUser(role: string, suffix: string) {
  const scopeData: any = {};
  if (role === 'ADMIN') scopeData.collegeId = 1;
  else if (role === 'COLLEGE_ADMIN') scopeData.managedCollegeId = 1;
  else if (role === 'DEPARTMENT_ADMIN') scopeData.managedDepartmentId = 1;

  const user = await prisma.user.create({
    data: {
      email: `user_${role.toLowerCase()}_${suffix}@example.test`,
      password: crypto.randomUUID(),
      role: role as any,
      tokenVersion: 0,
      isActive: true,
      ...scopeData,
    },
  });
  createdUserIds.push(user.id);
  const token = generateAccessToken(user.id, user.tokenVersion);
  return { user, token };
}

async function cleanupTestData() {
  // Always delete policy row BEFORE user fixtures
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "SubmissionIntegrityPolicy" WHERE id = 1`);
  } catch {
    // Ignore if table doesn't exist
  }
  if (createdUserIds.length > 0) {
    const ids = [...createdUserIds];
    createdUserIds.length = 0;
    await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });
  }
}

test('P1 each non-SUPER_ADMIN role gets 403 on GET and PUT and nothing is written', async () => {
  const suffix = makeSuffix('p1_rbac');
  const baseUrl = await getTestBaseUrl();
  const policyUrl = `${baseUrl}/submission-integrity/policy`;

  try {
    // Unauthenticated requests should get 401
    const unauthGet = await fetch(policyUrl);
    assert.strictEqual(unauthGet.status, 401, 'Unauthenticated GET must return 401');

    const unauthPut = await fetch(policyUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exactDuplicateBlock: false }),
    });
    assert.strictEqual(unauthPut.status, 401, 'Unauthenticated PUT must return 401');

    const rolesToTest = [
      'ADMIN',
      'COLLEGE_ADMIN',
      'DEPARTMENT_ADMIN',
      'DOCTOR',
      'TEACHING_ASSISTANT',
      'STUDENT',
    ];

    for (const role of rolesToTest) {
      const { token } = await createTestUser(role, suffix);

      const resGet = await fetch(policyUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.strictEqual(
        resGet.status,
        403,
        `GET /policy for role ${role} must return 403, got ${resGet.status}`
      );

      const resPut = await fetch(policyUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ exactDuplicateBlock: false, similarityThreshold: 0.8 }),
      });
      assert.strictEqual(
        resPut.status,
        403,
        `PUT /policy for role ${role} must return 403, got ${resPut.status}`
      );
    }

    // Verify nothing is written to SubmissionIntegrityPolicy
    const count = await (prisma as any).submissionIntegrityPolicy.count();
    assert.strictEqual(count, 0, 'No policy row must be written by unauthorized requests');
  } finally {
    await cleanupTestData();
  }
});

test('P2 no row -> GET shows the defaults with isDefault true', async () => {
  const suffix = makeSuffix('p2_get_default');
  const baseUrl = await getTestBaseUrl();
  const policyUrl = `${baseUrl}/submission-integrity/policy`;

  try {
    const { user: superAdmin, token } = await createTestUser('SUPER_ADMIN', suffix);

    // Ensure table is empty
    await prisma.$executeRawUnsafe(`DELETE FROM "SubmissionIntegrityPolicy" WHERE id = 1`).catch(() => {});

    const res = await fetch(policyUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 200, `GET /policy must return 200, got ${res.status}`);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.deepStrictEqual(json.data, {
      exactDuplicateBlock: true,
      similarityThreshold: null,
      isDefault: true,
    });

    // Verify NO audit log on GET
    const auditCount = await prisma.auditLog.count({
      where: { action: 'UPDATE_SUBMISSION_INTEGRITY_POLICY', userId: superAdmin.id },
    });
    assert.strictEqual(auditCount, 0, 'No audit log must be written on GET /policy');
  } finally {
    await cleanupTestData();
  }
});

test('P3 valid PUT 0.85 -> 200, row id=1, updatedById=actor, AuditLog UPDATE_SUBMISSION_INTEGRITY_POLICY with before/after', async () => {
  const suffix = makeSuffix('p3_valid_put');
  const baseUrl = await getTestBaseUrl();
  const policyUrl = `${baseUrl}/submission-integrity/policy`;

  try {
    const { user: superAdmin, token } = await createTestUser('SUPER_ADMIN', suffix);

    // Initial state: empty table
    await prisma.$executeRawUnsafe(`DELETE FROM "SubmissionIntegrityPolicy" WHERE id = 1`).catch(() => {});

    const res = await fetch(policyUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ similarityThreshold: 0.85 }),
    });
    assert.strictEqual(res.status, 200, `PUT /policy must return 200, got ${res.status}`);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.exactDuplicateBlock, true);
    assert.strictEqual(json.data.similarityThreshold, 0.85);
    assert.strictEqual(json.data.isDefault, false);
    assert.strictEqual(json.data.id, 1);
    assert.strictEqual(json.data.updatedById, superAdmin.id);

    // DB row verification
    const row = await (prisma as any).submissionIntegrityPolicy.findUnique({
      where: { id: 1 },
    });
    assert.ok(row, 'Row id=1 must exist in DB');
    assert.strictEqual(row.id, 1);
    assert.strictEqual(row.exactDuplicateBlock, true);
    assert.strictEqual(row.similarityThreshold, 0.85);
    assert.strictEqual(row.updatedById, superAdmin.id);

    // AuditLog verification
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'UPDATE_SUBMISSION_INTEGRITY_POLICY',
        userId: superAdmin.id,
      },
      orderBy: { id: 'desc' },
    });
    assert.ok(audit, 'AuditLog entry must be recorded');
    assert.strictEqual(audit.entity, 'SubmissionIntegrityPolicy');
    assert.strictEqual(audit.entityId, '1');

    const details = audit.details as any;
    assert.ok(details, 'AuditLog details must exist');
    assert.ok(details.before !== undefined, 'AuditLog details must contain before');
    assert.ok(details.after !== undefined, 'AuditLog details must contain after');
    assert.strictEqual(details.after.similarityThreshold, 0.85);
    assert.strictEqual(details.after.exactDuplicateBlock, true);
    assert.strictEqual(details.updatedById, superAdmin.id);
  } finally {
    await cleanupTestData();
  }
});

test('P4 invalid inputs (0, -0.1, 1.5, "abc", 0.12345, unknown key, empty body, exactDuplicateBlock not boolean) are refused and no row or audit row changes', async () => {
  const suffix = makeSuffix('p4_invalid_inputs');
  const baseUrl = await getTestBaseUrl();
  const policyUrl = `${baseUrl}/submission-integrity/policy`;

  try {
    const { user: superAdmin, token } = await createTestUser('SUPER_ADMIN', suffix);

    // Initial state: empty table
    await prisma.$executeRawUnsafe(`DELETE FROM "SubmissionIntegrityPolicy" WHERE id = 1`).catch(() => {});

    const invalidBodies: unknown[] = [
      { similarityThreshold: 0 },
      { similarityThreshold: -0.1 },
      { similarityThreshold: 1.5 },
      { similarityThreshold: 'abc' },
      { similarityThreshold: 0.12345 },
      { unknownKey: true },
      {},
      { exactDuplicateBlock: 'true' },
      { exactDuplicateBlock: 1 },
      { exactDuplicateBlock: null },
      { similarityThreshold: 'NaN' },
      { similarityThreshold: 'Infinity' },
      { similarityThreshold: [] },
    ];

    for (const body of invalidBodies) {
      const res = await fetch(policyUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      assert.ok(
        res.status === 400 || res.status === 422,
        `Invalid input ${JSON.stringify(body)} must return 400 or 422, got ${res.status}`
      );
    }

    // Verify no row was created or modified
    const count = await (prisma as any).submissionIntegrityPolicy.count();
    assert.strictEqual(count, 0, 'No row must be created from invalid inputs');

    // Verify no audit log was created
    const auditCount = await prisma.auditLog.count({
      where: { action: 'UPDATE_SUBMISSION_INTEGRITY_POLICY', userId: superAdmin.id },
    });
    assert.strictEqual(auditCount, 0, 'No audit log must be written on invalid inputs');
  } finally {
    await cleanupTestData();
  }
});

test('P5 threshold null disables and a second PUT updates the SAME single row (count stays 1)', async () => {
  const suffix = makeSuffix('p5_null_and_upsert');
  const baseUrl = await getTestBaseUrl();
  const policyUrl = `${baseUrl}/submission-integrity/policy`;

  try {
    const { user: superAdmin, token } = await createTestUser('SUPER_ADMIN', suffix);

    // Initial state: empty table
    await prisma.$executeRawUnsafe(`DELETE FROM "SubmissionIntegrityPolicy" WHERE id = 1`).catch(() => {});

    // First PUT: set threshold to 0.75
    const res1 = await fetch(policyUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ exactDuplicateBlock: true, similarityThreshold: 0.75 }),
    });
    assert.strictEqual(res1.status, 200);
    const json1 = await res1.json();
    assert.strictEqual(json1.data.similarityThreshold, 0.75);

    const count1 = await (prisma as any).submissionIntegrityPolicy.count();
    assert.strictEqual(count1, 1, 'Table count must be exactly 1 after first PUT');

    // Second PUT: similarityThreshold: null disables similarity
    const res2 = await fetch(policyUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ similarityThreshold: null }),
    });
    assert.strictEqual(res2.status, 200);
    const json2 = await res2.json();
    assert.strictEqual(json2.data.similarityThreshold, null);
    assert.strictEqual(json2.data.exactDuplicateBlock, true);

    const count2 = await (prisma as any).submissionIntegrityPolicy.count();
    assert.strictEqual(count2, 1, 'Table count must stay 1 after second PUT');

    // Third PUT: change exactDuplicateBlock to false
    const res3 = await fetch(policyUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ exactDuplicateBlock: false }),
    });
    assert.strictEqual(res3.status, 200);
    const json3 = await res3.json();
    assert.strictEqual(json3.data.exactDuplicateBlock, false);
    assert.strictEqual(json3.data.similarityThreshold, null);

    const count3 = await (prisma as any).submissionIntegrityPolicy.count();
    assert.strictEqual(count3, 1, 'Table count must stay 1 after third PUT');

    // Verify GET reflects the latest updated state
    const resGet = await fetch(policyUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(resGet.status, 200);
    const jsonGet = await resGet.json();
    assert.strictEqual(jsonGet.data.exactDuplicateBlock, false);
    assert.strictEqual(jsonGet.data.similarityThreshold, null);
    assert.strictEqual(jsonGet.data.isDefault, false);
  } finally {
    await cleanupTestData();
  }
});

test('P6 DB-level: a direct prisma create with id=2 or threshold 2 is rejected by the constraints', async () => {
  const suffix = makeSuffix('p6_db_constraints');

  try {
    const { user: superAdmin } = await createTestUser('SUPER_ADMIN', suffix);

    // Initial state: empty table
    await prisma.$executeRawUnsafe(`DELETE FROM "SubmissionIntegrityPolicy" WHERE id = 1`).catch(() => {});

    // 1. id = 2 must fail CHECK constraint ("id" = 1)
    await assert.rejects(
      async () => {
        await (prisma as any).submissionIntegrityPolicy.create({
          data: {
            id: 2,
            exactDuplicateBlock: true,
            similarityThreshold: 0.8,
            updatedById: superAdmin.id,
          },
        });
      },
      /check|constraint|SubmissionIntegrityPolicy_single_row_check/i,
      'Direct create with id=2 must be rejected by check constraint'
    );

    // 2. similarityThreshold > 1 must fail CHECK constraint
    await assert.rejects(
      async () => {
        await (prisma as any).submissionIntegrityPolicy.create({
          data: {
            id: 1,
            exactDuplicateBlock: true,
            similarityThreshold: 2.0,
            updatedById: superAdmin.id,
          },
        });
      },
      /check|constraint|similarityThreshold/i,
      'Direct create with similarityThreshold=2.0 must be rejected'
    );

    // 3. similarityThreshold <= 0 must fail CHECK constraint
    await assert.rejects(
      async () => {
        await (prisma as any).submissionIntegrityPolicy.create({
          data: {
            id: 1,
            exactDuplicateBlock: true,
            similarityThreshold: 0.0,
            updatedById: superAdmin.id,
          },
        });
      },
      /check|constraint|similarityThreshold/i,
      'Direct create with similarityThreshold=0.0 must be rejected'
    );

    // 4. similarityThreshold with more than 4 decimals must fail CHECK constraint
    await assert.rejects(
      async () => {
        await (prisma as any).submissionIntegrityPolicy.create({
          data: {
            id: 1,
            exactDuplicateBlock: true,
            similarityThreshold: 0.12345,
            updatedById: superAdmin.id,
          },
        });
      },
      /check|constraint|similarityThreshold/i,
      'Direct create with similarityThreshold=0.12345 (5 decimals) must be rejected'
    );
  } finally {
    await cleanupTestData();
  }
});

test('P7 the TaskSubmission(taskId,fileHash) index exists and CourseMaterial.fileHash is nullable (catalog read)', async () => {
  // 1. TaskSubmission(taskId, fileHash) index exists in PostgreSQL catalog
  const indexes: any[] = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'TaskSubmission'
      AND indexname = 'TaskSubmission_taskId_fileHash_idx'
  `);
  assert.strictEqual(indexes.length, 1, 'Index TaskSubmission_taskId_fileHash_idx must exist in pg_indexes');
  assert.ok(indexes[0].indexdef.includes('taskId'), 'Index definition must include taskId');
  assert.ok(indexes[0].indexdef.includes('fileHash'), 'Index definition must include fileHash');

  // 2. CourseMaterial.fileHash column exists and is nullable
  const columns: any[] = await prisma.$queryRawUnsafe(`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_name = 'CourseMaterial'
      AND column_name = 'fileHash'
  `);
  assert.strictEqual(columns.length, 1, 'Column fileHash must exist on CourseMaterial');
  assert.strictEqual(columns[0].is_nullable, 'YES', 'CourseMaterial.fileHash must be nullable');
});

test('T12: git diff --name-only shows no package.json or pnpm-lock.yaml change', async () => {
  const gitDiff = spawnSync('git', ['diff', '--name-only'], { encoding: 'utf8' });
  assert.strictEqual(gitDiff.status, 0, 'git diff command must exit with 0');
  const changedFiles = gitDiff.stdout.split('\n').map((f) => f.trim()).filter(Boolean);
  assert.ok(!changedFiles.includes('package.json'), 'package.json must not be modified in git diff');
  assert.ok(!changedFiles.includes('pnpm-lock.yaml'), 'pnpm-lock.yaml must not be modified in git diff');
});
