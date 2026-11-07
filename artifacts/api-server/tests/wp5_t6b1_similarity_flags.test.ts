import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
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

const RUN_ID = crypto.randomUUID().slice(0, 8);
const SUFFIX = RUN_ID;
function makeSuffix(label: string): string {
  return `${label}_${RUN_ID}_${crypto.randomUUID().slice(0, 6)}`;
}

// Tracked entities for clean teardown in reverse foreign key order
const trackedFlagIds: string[] = [];
const trackedFingerprintIds: string[] = [];
const trackedSubmissionIds: number[] = [];
const trackedTaskIds: number[] = [];
const trackedEnrollmentIds: number[] = [];
const trackedCourseIds: number[] = [];
const trackedStudentIds: number[] = [];
const trackedDoctorIds: number[] = [];
const trackedTAIds: string[] = [];
const trackedUserIds: number[] = [];
const trackedDeptIds: number[] = [];
const trackedCollegeIds: number[] = [];
const trackedAuditLogIds: number[] = [];

async function cleanupAllTracked() {
  try {
    if (trackedAuditLogIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { id: { in: trackedAuditLogIds } } }).catch(() => {});
      trackedAuditLogIds.length = 0;
    }
    if (trackedFlagIds.length > 0) {
      await (prisma as any).submissionSimilarityFlag?.deleteMany({ where: { id: { in: trackedFlagIds } } }).catch(() => {});
      trackedFlagIds.length = 0;
    }
    if (trackedFingerprintIds.length > 0) {
      await (prisma as any).taskSubmissionFingerprint?.deleteMany({ where: { id: { in: trackedFingerprintIds } } }).catch(() => {});
      trackedFingerprintIds.length = 0;
    }
    if (trackedSubmissionIds.length > 0) {
      // Also delete any flags/fingerprints pointing to these submissions
      await (prisma as any).submissionSimilarityFlag?.deleteMany({
        where: { OR: [{ submissionAId: { in: trackedSubmissionIds } }, { submissionBId: { in: trackedSubmissionIds } }] }
      }).catch(() => {});
      await (prisma as any).taskSubmissionFingerprint?.deleteMany({
        where: { submissionId: { in: trackedSubmissionIds } }
      }).catch(() => {});
      await prisma.taskSubmission.deleteMany({ where: { id: { in: trackedSubmissionIds } } }).catch(() => {});
      trackedSubmissionIds.length = 0;
    }
    if (trackedTaskIds.length > 0) {
      await prisma.task.deleteMany({ where: { id: { in: trackedTaskIds } } }).catch(() => {});
      trackedTaskIds.length = 0;
    }
    if (trackedEnrollmentIds.length > 0) {
      await prisma.enrollment.deleteMany({ where: { id: { in: trackedEnrollmentIds } } }).catch(() => {});
      trackedEnrollmentIds.length = 0;
    }
    if (trackedCourseIds.length > 0) {
      await prisma.course.deleteMany({ where: { id: { in: trackedCourseIds } } }).catch(() => {});
      trackedCourseIds.length = 0;
    }
    if (trackedStudentIds.length > 0) {
      await prisma.student.deleteMany({ where: { id: { in: trackedStudentIds } } }).catch(() => {});
      trackedStudentIds.length = 0;
    }
    if (trackedDoctorIds.length > 0) {
      await prisma.doctor.deleteMany({ where: { id: { in: trackedDoctorIds } } }).catch(() => {});
      trackedDoctorIds.length = 0;
    }
    if (trackedTAIds.length > 0) {
      await prisma.teachingAssistant.deleteMany({ where: { id: { in: trackedTAIds } } }).catch(() => {});
      trackedTAIds.length = 0;
    }
    if (trackedUserIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: trackedUserIds } } }).catch(() => {});
      await prisma.notification.deleteMany({ where: { userId: { in: trackedUserIds } } }).catch(() => {});
      await prisma.refreshToken.deleteMany({ where: { userId: { in: trackedUserIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: trackedUserIds } } }).catch(() => {});
      trackedUserIds.length = 0;
    }
    if (trackedDeptIds.length > 0) {
      await prisma.department.deleteMany({ where: { id: { in: trackedDeptIds } } }).catch(() => {});
      trackedDeptIds.length = 0;
    }
    if (trackedCollegeIds.length > 0) {
      await prisma.college.deleteMany({ where: { id: { in: trackedCollegeIds } } }).catch(() => {});
      trackedCollegeIds.length = 0;
    }
  } catch (err) {
    console.error('Error during test cleanup:', err);
  }
}

async function createUserFixture(role: string, scope: { collegeId?: number; departmentId?: number; managedCollegeId?: number; managedDepartmentId?: number } = {}) {
  const email = `user_${role.toLowerCase()}_${makeSuffix('u')}@example.test`;
  const user = await prisma.user.create({
    data: {
      email,
      password: crypto.randomUUID(),
      role: role as any,
      tokenVersion: 0,
      isActive: true,
      collegeId: scope.collegeId,
      departmentId: scope.departmentId,
      managedCollegeId: scope.managedCollegeId,
      managedDepartmentId: scope.managedDepartmentId,
    },
  });
  trackedUserIds.push(user.id);
  const token = generateAccessToken(user.id, user.tokenVersion);
  return { user, token };
}

async function createDoctorFixture(deptId: number) {
  const { user, token } = await createUserFixture('DOCTOR', { departmentId: deptId });
  const doctor = await prisma.doctor.create({
    data: {
      userId: user.id,
      firstName: 'Doctor',
      lastName: makeSuffix('Doc'),
      departmentId: deptId,
    },
  });
  trackedDoctorIds.push(doctor.id);
  return { user, doctor, token };
}

async function createStudentFixture(deptId: number) {
  const { user, token } = await createUserFixture('STUDENT', { departmentId: deptId });
  const student = await prisma.student.create({
    data: {
      userId: user.id,
      studentId: `STU_${makeSuffix('id')}`,
      firstName: 'Student',
      lastName: makeSuffix('Last'),
      departmentId: deptId,
      year: 1,
    },
  });
  trackedStudentIds.push(student.id);
  return { user, student, token };
}

test('wp5_t6b1 Similarity Flags End-to-End Suite', async (t) => {
  const baseUrl = await getTestBaseUrl();

  try {
    // Create baseline structure
    const college1 = await prisma.college.create({ data: { name: `College 1 ${SUFFIX}` } });
  trackedCollegeIds.push(college1.id);
  const college2 = await prisma.college.create({ data: { name: `College 2 ${SUFFIX}` } });
  trackedCollegeIds.push(college2.id);

  const dept1 = await prisma.department.create({ data: { name: `Dept 1 ${SUFFIX}`, collegeId: college1.id } });
  trackedDeptIds.push(dept1.id);
  const dept2 = await prisma.department.create({ data: { name: `Dept 2 ${SUFFIX}`, collegeId: college2.id } });
  trackedDeptIds.push(dept2.id);

  const course1 = await prisma.course.create({ data: { courseCode: `CS1_${SUFFIX}`, name: 'Course 1', departmentId: dept1.id } });
  trackedCourseIds.push(course1.id);
  const course2 = await prisma.course.create({ data: { courseCode: `CS2_${SUFFIX}`, name: 'Course 2', departmentId: dept2.id } });
  trackedCourseIds.push(course2.id);

  const doc1 = await createDoctorFixture(dept1.id);
  const doc2 = await createDoctorFixture(dept2.id);

  const student1 = await createStudentFixture(dept1.id);
  const student2 = await createStudentFixture(dept1.id);
  const student3 = await createStudentFixture(dept2.id);

  const taUser = await createUserFixture('TEACHING_ASSISTANT', { departmentId: dept1.id });
  const ta = await prisma.teachingAssistant.create({
    data: {
      userId: taUser.user.id,
      employeeId: `TA_${SUFFIX}`,
      departmentId: dept1.id,
    },
  });
  trackedTAIds.push(ta.id);

  const superAdmin = await createUserFixture('SUPER_ADMIN');
  const adminInScope = await createUserFixture('ADMIN', { managedCollegeId: college1.id });
  const adminOutOfScope = await createUserFixture('ADMIN', { managedCollegeId: college2.id });
  const collegeAdminInScope = await createUserFixture('COLLEGE_ADMIN', { managedCollegeId: college1.id });
  const collegeAdminOutOfScope = await createUserFixture('COLLEGE_ADMIN', { managedCollegeId: college2.id });
  const deptAdminInScope = await createUserFixture('DEPARTMENT_ADMIN', { managedDepartmentId: dept1.id });
  const deptAdminOutOfScope = await createUserFixture('DEPARTMENT_ADMIN', { managedDepartmentId: dept2.id });

  // Enrollments
  const enroll1 = await prisma.enrollment.create({
    data: { studentId: student1.student.id, courseId: course1.id, semester: 1, academicYear: 2026 },
  });
  trackedEnrollmentIds.push(enroll1.id);
  const enroll2 = await prisma.enrollment.create({
    data: { studentId: student2.student.id, courseId: course1.id, semester: 1, academicYear: 2026 },
  });
  trackedEnrollmentIds.push(enroll2.id);

  // Tasks
  const task1 = await prisma.task.create({
    data: {
      title: `Task 1 ${SUFFIX}`,
      description: 'Test Task 1',
      courseId: course1.id,
      doctorId: doc1.doctor.id,
      academicYear: 2026,
      semester: 1,
      dueDate: new Date(Date.now() + 86400000),
    },
  });
  trackedTaskIds.push(task1.id);

  const task2 = await prisma.task.create({
    data: {
      title: `Task 2 ${SUFFIX}`,
      description: 'Test Task 2',
      courseId: course2.id,
      doctorId: doc2.doctor.id,
      academicYear: 2026,
      semester: 1,
      dueDate: new Date(Date.now() + 86400000),
    },
  });
  trackedTaskIds.push(task2.id);

  // Submissions for task1
  const sub1 = await prisma.taskSubmission.create({
    data: {
      taskId: task1.id,
      studentId: student1.student.id,
      enrollmentId: enroll1.id,
      fileName: 'sol_alice.pdf',
      fileHash: `hash_alice_${SUFFIX}`,
    },
  });
  trackedSubmissionIds.push(sub1.id);

  const sub2 = await prisma.taskSubmission.create({
    data: {
      taskId: task1.id,
      studentId: student2.student.id,
      enrollmentId: enroll2.id,
      fileName: 'sol_bob.pdf',
      fileHash: `hash_bob_${SUFFIX}`,
    },
  });
  trackedSubmissionIds.push(sub2.id);

  // Ensure pair order subA < subB
  const [subAId, subBId] = sub1.id < sub2.id ? [sub1.id, sub2.id] : [sub2.id, sub1.id];
  const fileHashA = sub1.id < sub2.id ? sub1.fileHash! : sub2.fileHash!;
  const fileHashB = sub1.id < sub2.id ? sub2.fileHash! : sub1.fileHash!;

  // Create Flag 1 on Task 1
  const flag1 = await (prisma as any).submissionSimilarityFlag.create({
    data: {
      taskId: task1.id,
      submissionAId: subAId,
      submissionBId: subBId,
      fileHashA,
      fileHashB,
      similarityScore: 0.88,
      thresholdUsed: 0.80,
      status: 'PENDING',
    },
  });
  trackedFlagIds.push(flag1.id);

  await t.test('R1: Role matrix on list and decide', async () => {
      const listUrl = `${baseUrl}/tasks/${task1.id}/similarity-flags`;
      const decideUrl = `${baseUrl}/tasks/${task1.id}/similarity-flags/${flag1.id}`;

      // Student 1 (owner of submission): 403
      const s1List = await fetch(listUrl, { headers: { Authorization: `Bearer ${student1.token}` } });
      assert.strictEqual(s1List.status, 403, 'Student list must be 403');
      const s1Patch = await fetch(decideUrl, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${student1.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'CONFIRMED' }),
      });
      assert.strictEqual(s1Patch.status, 403, 'Student patch must be 403');

      // TA: 403
      const taList = await fetch(listUrl, { headers: { Authorization: `Bearer ${taUser.token}` } });
      assert.strictEqual(taList.status, 403, 'TA list must be 403');
      const taPatch = await fetch(decideUrl, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${taUser.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'CONFIRMED' }),
      });
      assert.strictEqual(taPatch.status, 403, 'TA patch must be 403');

      // Out-of-scope doctor: 403
      const doc2List = await fetch(listUrl, { headers: { Authorization: `Bearer ${doc2.token}` } });
      assert.strictEqual(doc2List.status, 403, 'Out-of-scope doctor list must be 403');
      const doc2Patch = await fetch(decideUrl, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doc2.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'CONFIRMED' }),
      });
      assert.strictEqual(doc2Patch.status, 403, 'Out-of-scope doctor patch must be 403');

      // Out-of-scope Admin: 403
      const aOutList = await fetch(listUrl, { headers: { Authorization: `Bearer ${adminOutOfScope.token}` } });
      assert.strictEqual(aOutList.status, 403, 'Out-of-scope admin list must be 403');

      // Out-of-scope College Admin: 403
      const caOutList = await fetch(listUrl, { headers: { Authorization: `Bearer ${collegeAdminOutOfScope.token}` } });
      assert.strictEqual(caOutList.status, 403, 'Out-of-scope college admin list must be 403');

      // Out-of-scope Department Admin: 403
      const daOutList = await fetch(listUrl, { headers: { Authorization: `Bearer ${deptAdminOutOfScope.token}` } });
      assert.strictEqual(daOutList.status, 403, 'Out-of-scope dept admin list must be 403');

      // In-scope roles on GET list:
      // Doctor 1 (course doctor): 200
      const doc1List = await fetch(listUrl, { headers: { Authorization: `Bearer ${doc1.token}` } });
      assert.strictEqual(doc1List.status, 200, 'In-scope doctor list must be 200');

      // Super Admin: 200
      const saList = await fetch(listUrl, { headers: { Authorization: `Bearer ${superAdmin.token}` } });
      assert.strictEqual(saList.status, 200, 'Super admin list must be 200');

      // Admin in-scope: 200
      const aInList = await fetch(listUrl, { headers: { Authorization: `Bearer ${adminInScope.token}` } });
      assert.strictEqual(aInList.status, 200, 'In-scope admin list must be 200');

      // College Admin in-scope: 200
      const caInList = await fetch(listUrl, { headers: { Authorization: `Bearer ${collegeAdminInScope.token}` } });
      assert.strictEqual(caInList.status, 200, 'In-scope college admin list must be 200');

      // Department Admin in-scope: 200
      const daInList = await fetch(listUrl, { headers: { Authorization: `Bearer ${deptAdminInScope.token}` } });
      assert.strictEqual(daInList.status, 200, 'In-scope dept admin list must be 200');
    });

    await t.test('R2: IDOR flag of another task returns 404', async () => {
      // Flag 1 belongs to task 1. Calling via task 2 must return 404.
      const url = `${baseUrl}/tasks/${task2.id}/similarity-flags/${flag1.id}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doc2.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'CONFIRMED' }),
      });
      assert.strictEqual(res.status, 404, 'Accessing flag of different task must be 404');
    });

    await t.test('R3: Mass assignment rejected with 422 and nothing written', async () => {
      const url = `${baseUrl}/tasks/${task1.id}/similarity-flags/${flag1.id}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doc1.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'CONFIRMED',
          status: 'DISMISSED',
          reviewedById: 9999,
          similarityScore: 0.1,
          taskId: 9999,
        }),
      });
      assert.strictEqual(res.status, 422, 'Mass assignment body must return 422');

      // Verify flag unchanged
      const raw = await (prisma as any).submissionSimilarityFlag.findUnique({ where: { id: flag1.id } });
      assert.strictEqual(raw.status, 'PENDING');
      assert.strictEqual(raw.reviewedById, null);
    });

    await t.test('R4: Audit row exists with exactly three payload keys and no hash/file name', async () => {
      // Create a fresh flag to decide cleanly
      const flagForAudit = await (prisma as any).submissionSimilarityFlag.create({
        data: {
          taskId: task1.id,
          submissionAId: subAId,
          submissionBId: subBId,
          fileHashA: `hash_audit_A_${SUFFIX}`,
          fileHashB: `hash_audit_B_${SUFFIX}`,
          similarityScore: 0.90,
          thresholdUsed: 0.80,
          status: 'PENDING',
        },
      });
      trackedFlagIds.push(flagForAudit.id);

      const url = `${baseUrl}/tasks/${task1.id}/similarity-flags/${flagForAudit.id}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doc1.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'CONFIRMED', note: 'Clear match' }),
      });
      assert.strictEqual(res.status, 200, 'Decide flag must return 200');

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'REVIEW_SUBMISSION_SIMILARITY_FLAG',
          entityId: flagForAudit.id,
        },
      });
      assert.ok(audit, 'Audit log entry must be created');
      trackedAuditLogIds.push(audit.id);

      const details = audit.details as Record<string, any>;
      const keys = Object.keys(details).sort();
      assert.deepStrictEqual(keys, ['decision', 'flagId', 'taskId'], 'Audit details must contain exactly flagId, taskId, decision');
      assert.strictEqual(details.flagId, flagForAudit.id);
      assert.strictEqual(details.taskId, task1.id);
      assert.strictEqual(details.decision, 'CONFIRMED');

      const serialized = JSON.stringify(details);
      assert.ok(!serialized.includes('hash'), 'Audit details must not contain fileHash');
      assert.ok(!serialized.includes('.pdf'), 'Audit details must not contain file names');
    });

    await t.test('R5: Two parallel HTTP decisions = one 200 + one 409; re-deciding = 409', async () => {
      const flagRace = await (prisma as any).submissionSimilarityFlag.create({
        data: {
          taskId: task1.id,
          submissionAId: subAId,
          submissionBId: subBId,
          fileHashA: `hash_race_A_${SUFFIX}`,
          fileHashB: `hash_race_B_${SUFFIX}`,
          similarityScore: 0.85,
          thresholdUsed: 0.80,
          status: 'PENDING',
        },
      });
      trackedFlagIds.push(flagRace.id);

      const url = `${baseUrl}/tasks/${task1.id}/similarity-flags/${flagRace.id}`;
      const [r1, r2] = await Promise.all([
        fetch(url, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${doc1.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: 'CONFIRMED' }),
        }),
        fetch(url, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${doc1.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: 'DISMISSED' }),
        }),
      ]);

      const statuses = [r1.status, r2.status].sort();
      assert.deepStrictEqual(statuses, [200, 409], 'Parallel decisions must yield exactly one 200 and one 409');

      // Calling again on decided flag must yield 409
      const r3 = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doc1.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'CONFIRMED' }),
      });
      assert.strictEqual(r3.status, 409, 'Re-deciding already decided flag must be 409');
    });

    await t.test('R6: DB constraints rejected by raw SQL inside a sentinel-rollback transaction', async () => {
      let rolledBack = false;
      try {
        await prisma.$transaction(async (tx) => {
          // 1. Pair order constraint check (submissionAId >= submissionBId must fail)
          await tx.$executeRawUnsafe('SAVEPOINT sp_order');
          let pairOrderFailed = false;
          try {
            await tx.$executeRawUnsafe(`
              INSERT INTO "SubmissionSimilarityFlag" ("id", "taskId", "submissionAId", "submissionBId", "fileHashA", "fileHashB", "similarityScore", "thresholdUsed", "status", "createdAt")
              VALUES ('cuid_bad_order', ${task1.id}, ${subBId}, ${subAId}, 'h1', 'h2', 0.8, 0.8, 'PENDING', NOW())
            `);
          } catch (e: any) {
            pairOrderFailed = true;
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sp_order');
          }
          assert.ok(pairOrderFailed, 'Pair order constraint violation (submissionAId >= submissionBId) must be rejected');

          // 2. Score range checks: > 0 and <= 1, finite
          await tx.$executeRawUnsafe('SAVEPOINT sp_score');
          let scoreRangeFailed = false;
          try {
            await tx.$executeRawUnsafe(`
              INSERT INTO "SubmissionSimilarityFlag" ("id", "taskId", "submissionAId", "submissionBId", "fileHashA", "fileHashB", "similarityScore", "thresholdUsed", "status", "createdAt")
              VALUES ('cuid_bad_score', ${task1.id}, ${subAId}, ${subBId}, 'h1', 'h2', 1.5, 0.8, 'PENDING', NOW())
            `);
          } catch (e: any) {
            scoreRangeFailed = true;
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sp_score');
          }
          assert.ok(scoreRangeFailed, 'Similarity score > 1 must be rejected');

          // 3. Review integrity check: PENDING iff reviewedById and reviewedAt are NULL
          await tx.$executeRawUnsafe('SAVEPOINT sp_rev_pend');
          let reviewIntegrityPendingFailed = false;
          try {
            await tx.$executeRawUnsafe(`
              INSERT INTO "SubmissionSimilarityFlag" ("id", "taskId", "submissionAId", "submissionBId", "fileHashA", "fileHashB", "similarityScore", "thresholdUsed", "status", "reviewedById", "createdAt")
              VALUES ('cuid_bad_review_pending', ${task1.id}, ${subAId}, ${subBId}, 'h1', 'h2', 0.8, 0.8, 'PENDING', ${doc1.user.id}, NOW())
            `);
          } catch (e: any) {
            reviewIntegrityPendingFailed = true;
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sp_rev_pend');
          }
          assert.ok(reviewIntegrityPendingFailed, 'PENDING status with non-null reviewedById must be rejected');

          await tx.$executeRawUnsafe('SAVEPOINT sp_rev_conf');
          let reviewIntegrityConfirmedFailed = false;
          try {
            await tx.$executeRawUnsafe(`
              INSERT INTO "SubmissionSimilarityFlag" ("id", "taskId", "submissionAId", "submissionBId", "fileHashA", "fileHashB", "similarityScore", "thresholdUsed", "status", "reviewedById", "reviewedAt", "createdAt")
              VALUES ('cuid_bad_review_confirmed', ${task1.id}, ${subAId}, ${subBId}, 'h1', 'h2', 0.8, 0.8, 'CONFIRMED', NULL, NULL, NOW())
            `);
          } catch (e: any) {
            reviewIntegrityConfirmedFailed = true;
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sp_rev_conf');
          }
          assert.ok(reviewIntegrityConfirmedFailed, 'CONFIRMED status with null reviewedById/reviewedAt must be rejected');

          // 4. Unique with hashes constraint check
          await tx.$executeRawUnsafe(`
            INSERT INTO "SubmissionSimilarityFlag" ("id", "taskId", "submissionAId", "submissionBId", "fileHashA", "fileHashB", "similarityScore", "thresholdUsed", "status", "createdAt")
            VALUES ('cuid_unique_1', ${task1.id}, ${subAId}, ${subBId}, 'snapHashA', 'snapHashB', 0.8, 0.8, 'PENDING', NOW())
          `);
          await tx.$executeRawUnsafe('SAVEPOINT sp_uniq');
          let duplicateFailed = false;
          try {
            await tx.$executeRawUnsafe(`
              INSERT INTO "SubmissionSimilarityFlag" ("id", "taskId", "submissionAId", "submissionBId", "fileHashA", "fileHashB", "similarityScore", "thresholdUsed", "status", "createdAt")
              VALUES ('cuid_unique_2', ${task1.id}, ${subAId}, ${subBId}, 'snapHashA', 'snapHashB', 0.8, 0.8, 'PENDING', NOW())
            `);
          } catch (e: any) {
            duplicateFailed = true;
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sp_uniq');
          }
          assert.ok(duplicateFailed, 'Duplicate (submissionAId, submissionBId, fileHashA, fileHashB) must be rejected');

          // 5. Fingerprint signature check (NOT NULL iff READY)
          await tx.$executeRawUnsafe('SAVEPOINT sp_fp_not_ready');
          let fpSignatureNotReadyFailed = false;
          try {
            await tx.$executeRawUnsafe(`
              INSERT INTO "TaskSubmissionFingerprint" ("id", "submissionId", "fileHash", "status", "signature", "shingleCount", "createdAt", "updatedAt")
              VALUES ('fp_bad_sig', ${sub1.id}, 'h', 'UNSUPPORTED', '\\x010203'::bytea, 0, NOW(), NOW())
            `);
          } catch (e: any) {
            fpSignatureNotReadyFailed = true;
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sp_fp_not_ready');
          }
          assert.ok(fpSignatureNotReadyFailed, 'Fingerprint signature on non-READY status must be rejected');

          await tx.$executeRawUnsafe('SAVEPOINT sp_fp_null_ready');
          let fpSignatureNullReadyFailed = false;
          try {
            await tx.$executeRawUnsafe(`
              INSERT INTO "TaskSubmissionFingerprint" ("id", "submissionId", "fileHash", "status", "signature", "shingleCount", "createdAt", "updatedAt")
              VALUES ('fp_bad_sig_null', ${sub1.id}, 'h', 'READY', NULL, 5, NOW(), NOW())
            `);
          } catch (e: any) {
            fpSignatureNullReadyFailed = true;
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sp_fp_null_ready');
          }
          assert.ok(fpSignatureNullReadyFailed, 'Fingerprint signature NULL on READY status must be rejected');

          throw new Error('SENTINEL_ROLLBACK');
        });
      } catch (err: any) {
        if (err.message === 'SENTINEL_ROLLBACK') {
          rolledBack = true;
        } else {
          throw err;
        }
      }
      assert.strictEqual(rolledBack, true, 'Sentinel rollback must roll back successfully');
    });

    await t.test('R7: No raw-text column on tables and no fileHash/storageKey in any response', async () => {
      // Check information_schema for no text column for content
      const cols = await prisma.$queryRaw<Array<{ table_name: string; column_name: string; data_type: string }>>`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_name IN ('TaskSubmissionFingerprint', 'SubmissionSimilarityFlag')
      `;
      for (const col of cols) {
        assert.notStrictEqual(col.column_name, 'rawText');
        assert.notStrictEqual(col.column_name, 'text');
        assert.notStrictEqual(col.column_name, 'extractedText');
        assert.notStrictEqual(col.column_name, 'content');
      }

      // Check GET list response
      const listRes = await fetch(`${baseUrl}/tasks/${task1.id}/similarity-flags`, {
        headers: { Authorization: `Bearer ${doc1.token}` },
      });
      assert.strictEqual(listRes.status, 200);
      const json = await listRes.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data), 'data must be an array of flag items');
      assert.ok(json.data.length > 0);

      const pendingItem = json.data.find((f: any) => f.id === flag1.id);
      assert.ok(pendingItem, 'Pending flag must be in list');
      assert.strictEqual(pendingItem.status, 'PENDING');
      assert.strictEqual(pendingItem.reviewedById, null);
      assert.strictEqual(pendingItem.reviewedAt, null);
      assert.strictEqual(pendingItem.reviewNote, null);
      assert.ok(pendingItem.similarityScore);
      assert.ok(pendingItem.thresholdUsed);
      assert.ok(pendingItem.createdAt);

      assert.ok(pendingItem.submissionA);
      assert.ok(pendingItem.submissionA.submissionId);
      assert.ok(pendingItem.submissionA.studentId);
      assert.ok(pendingItem.submissionA.studentName);
      assert.ok(pendingItem.submissionA.fileName);
      assert.ok(pendingItem.submissionA.submittedAt);

      assert.ok(pendingItem.submissionB);
      assert.ok(pendingItem.submissionB.submissionId);
      assert.ok(pendingItem.submissionB.studentId);
      assert.ok(pendingItem.submissionB.studentName);
      assert.ok(pendingItem.submissionB.fileName);
      assert.ok(pendingItem.submissionB.submittedAt);

      for (const item of json.data) {
        assert.ok(item.id);
        assert.ok(item.status);
        assert.ok(item.similarityScore);
        assert.ok(item.thresholdUsed);
        assert.ok(item.createdAt);
        assert.ok(item.submissionA);
        assert.ok(item.submissionB);
      }

      const serialized = JSON.stringify(json);
      assert.ok(!serialized.includes('fileHash'), 'Response must never contain fileHash');
      assert.ok(!serialized.includes('fileHashA'), 'Response must never contain fileHashA');
      assert.ok(!serialized.includes('fileHashB'), 'Response must never contain fileHashB');
      assert.ok(!serialized.includes('storageKey'), 'Response must never contain storageKey');
      assert.ok(!serialized.includes('fileUrl'), 'Response must never contain fileUrl');
    });

    await t.test('R8: Deleting a Task and a Student carrying fingerprint + flag rows still works', async () => {
      // Create temporary task, student, submission, fingerprint, and flag
      const tempTask = await prisma.task.create({
        data: {
          title: `TempTask_${SUFFIX}`,
          description: 'To be deleted',
          courseId: course1.id,
          doctorId: doc1.doctor.id,
          academicYear: 2026,
          semester: 1,
          dueDate: new Date(Date.now() + 86400000),
        },
      });

      const tempStudent = await createStudentFixture(dept1.id);
      const tempEnroll = await prisma.enrollment.create({
        data: { studentId: tempStudent.student.id, courseId: course1.id, semester: 1, academicYear: 2026 },
      });
      trackedEnrollmentIds.push(tempEnroll.id);

      const tempSub1 = await prisma.taskSubmission.create({
        data: {
          taskId: tempTask.id,
          studentId: tempStudent.student.id,
          enrollmentId: tempEnroll.id,
          fileName: 'temp1.pdf',
          fileHash: `hash_temp1_${SUFFIX}`,
        },
      });

      const tempSub2 = await prisma.taskSubmission.create({
        data: {
          taskId: tempTask.id,
          studentId: student2.student.id,
          enrollmentId: enroll2.id,
          fileName: 'temp2.pdf',
          fileHash: `hash_temp2_${SUFFIX}`,
        },
      });

      const [tempA, tempB] = tempSub1.id < tempSub2.id ? [tempSub1.id, tempSub2.id] : [tempSub2.id, tempSub1.id];

      const tempFp = await (prisma as any).taskSubmissionFingerprint.create({
        data: {
          submissionId: tempSub1.id,
          fileHash: `hash_temp1_${SUFFIX}`,
          status: 'READY',
          signature: Buffer.from([1, 2, 3]),
          shingleCount: 10,
        },
      });

      const tempFlag = await (prisma as any).submissionSimilarityFlag.create({
        data: {
          taskId: tempTask.id,
          submissionAId: tempA,
          submissionBId: tempB,
          fileHashA: 'hashA',
          fileHashB: 'hashB',
          similarityScore: 0.95,
          thresholdUsed: 0.80,
          status: 'PENDING',
        },
      });

      // Deleting Task cascades to flags and submissions and fingerprints
      await prisma.task.delete({ where: { id: tempTask.id } });
      const verifyFlag = await (prisma as any).submissionSimilarityFlag.findUnique({ where: { id: tempFlag.id } });
      assert.strictEqual(verifyFlag, null, 'Task deletion must cascade and remove similarity flags');

      // Now create another student and submission on task1 to test student deletion
      const tempStudent2 = await createStudentFixture(dept1.id);
      const tempEnroll2 = await prisma.enrollment.create({
        data: { studentId: tempStudent2.student.id, courseId: course1.id, semester: 1, academicYear: 2026 },
      });
      trackedEnrollmentIds.push(tempEnroll2.id);

      const tempSub3 = await prisma.taskSubmission.create({
        data: {
          taskId: task1.id,
          studentId: tempStudent2.student.id,
          enrollmentId: tempEnroll2.id,
          fileName: 'temp3.pdf',
          fileHash: `hash_temp3_${SUFFIX}`,
        },
      });
      trackedSubmissionIds.push(tempSub3.id);

      const [sA, sB] = sub1.id < tempSub3.id ? [sub1.id, tempSub3.id] : [tempSub3.id, sub1.id];
      const tempFlag2 = await (prisma as any).submissionSimilarityFlag.create({
        data: {
          taskId: task1.id,
          submissionAId: sA,
          submissionBId: sB,
          fileHashA: 'hashA2',
          fileHashB: 'hashB2',
          similarityScore: 0.92,
          thresholdUsed: 0.80,
          status: 'PENDING',
        },
      });

      // Deleting student cascades to taskSubmission, which cascades to flag and fingerprint
      await prisma.student.delete({ where: { id: tempStudent2.student.id } });
      const verifyFlag2 = await (prisma as any).submissionSimilarityFlag.findUnique({ where: { id: tempFlag2.id } });
      assert.strictEqual(verifyFlag2, null, 'Student deletion must cascade and remove similarity flags');
    });

    await t.test('R9: Two flags for same pair with different hash snapshots can coexist', async () => {
      const snapFlag1 = await (prisma as any).submissionSimilarityFlag.create({
        data: {
          taskId: task1.id,
          submissionAId: subAId,
          submissionBId: subBId,
          fileHashA: `hash_snap_v1_A_${SUFFIX}`,
          fileHashB: `hash_snap_v1_B_${SUFFIX}`,
          similarityScore: 0.82,
          thresholdUsed: 0.80,
          status: 'PENDING',
        },
      });
      trackedFlagIds.push(snapFlag1.id);

      // Student A re-submits so fileHashA is updated snapshot:
      const snapFlag2 = await (prisma as any).submissionSimilarityFlag.create({
        data: {
          taskId: task1.id,
          submissionAId: subAId,
          submissionBId: subBId,
          fileHashA: `hash_snap_v2_A_${SUFFIX}`,
          fileHashB: `hash_snap_v1_B_${SUFFIX}`,
          similarityScore: 0.85,
          thresholdUsed: 0.80,
          status: 'PENDING',
        },
      });
      trackedFlagIds.push(snapFlag2.id);

      assert.ok(snapFlag1.id);
      assert.ok(snapFlag2.id);
      assert.notStrictEqual(snapFlag1.id, snapFlag2.id);
    });
  } finally {
    await cleanupAllTracked();
  }
});
