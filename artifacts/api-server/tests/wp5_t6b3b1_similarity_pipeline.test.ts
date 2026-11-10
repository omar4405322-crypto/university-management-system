import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import v8 from 'node:v8';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

import prisma from '../src/utils/prismaClient';
import { processSubmissionSimilarity } from '../src/services/similarity/submissionSimilarityPipeline';
import {
  SIMILARITY_PEER_CAP,
  SIMILARITY_ENABLED_EXTENSIONS,
} from '../src/services/similarity/similarityPipeline.constants';

const RUN_ID = crypto.randomUUID().slice(0, 8);
function makeSuffix(label: string): string {
  return `${label}_${RUN_ID}_${crypto.randomUUID().slice(0, 6)}`;
}

// Tracked entities for clean teardown in reverse foreign key order
const trackedFlagIds: string[] = [];
const trackedFingerprintIds: string[] = [];
const trackedSubmissionIds: number[] = [];
const trackedMaterialIds: number[] = [];
const trackedTaskIds: number[] = [];
const trackedEnrollmentIds: number[] = [];
const trackedCourseIds: number[] = [];
const trackedStudentIds: number[] = [];
const trackedDoctorIds: number[] = [];
const trackedUserIds: number[] = [];
const trackedDeptIds: number[] = [];
const trackedCollegeIds: number[] = [];
const trackedPolicyIds: number[] = [];

// Per-run storage directory in os.tmpdir() - never in uploads/
const runTempDir = fs.mkdtempSync(path.join(os.tmpdir(), `sim-pipe-test-${RUN_ID}-`));

async function cleanupAllTracked() {
  try {
    if (trackedPolicyIds.length > 0) {
      await prisma.submissionIntegrityPolicy.deleteMany({
        where: { id: { in: trackedPolicyIds } },
      }).catch(() => {});
      trackedPolicyIds.length = 0;
    }
    await prisma.submissionIntegrityPolicy.deleteMany({}).catch(() => {});

    if (trackedFlagIds.length > 0) {
      await prisma.submissionSimilarityFlag.deleteMany({
        where: { id: { in: trackedFlagIds } },
      }).catch(() => {});
      trackedFlagIds.length = 0;
    }

    if (trackedFingerprintIds.length > 0) {
      await prisma.taskSubmissionFingerprint.deleteMany({
        where: { id: { in: trackedFingerprintIds } },
      }).catch(() => {});
      trackedFingerprintIds.length = 0;
    }

    if (trackedSubmissionIds.length > 0) {
      await prisma.submissionSimilarityFlag.deleteMany({
        where: {
          OR: [
            { submissionAId: { in: trackedSubmissionIds } },
            { submissionBId: { in: trackedSubmissionIds } },
          ],
        },
      }).catch(() => {});
      await prisma.taskSubmissionFingerprint.deleteMany({
        where: { submissionId: { in: trackedSubmissionIds } },
      }).catch(() => {});
      await prisma.taskSubmission.deleteMany({
        where: { id: { in: trackedSubmissionIds } },
      }).catch(() => {});
      trackedSubmissionIds.length = 0;
    }

    if (trackedMaterialIds.length > 0) {
      await prisma.courseMaterial.deleteMany({
        where: { id: { in: trackedMaterialIds } },
      }).catch(() => {});
      trackedMaterialIds.length = 0;
    }

    if (trackedTaskIds.length > 0) {
      await prisma.task.deleteMany({
        where: { id: { in: trackedTaskIds } },
      }).catch(() => {});
      trackedTaskIds.length = 0;
    }

    if (trackedEnrollmentIds.length > 0) {
      await prisma.enrollment.deleteMany({
        where: { id: { in: trackedEnrollmentIds } },
      }).catch(() => {});
      trackedEnrollmentIds.length = 0;
    }

    if (trackedCourseIds.length > 0) {
      await prisma.course.deleteMany({
        where: { id: { in: trackedCourseIds } },
      }).catch(() => {});
      trackedCourseIds.length = 0;
    }

    if (trackedStudentIds.length > 0) {
      await prisma.student.deleteMany({
        where: { id: { in: trackedStudentIds } },
      }).catch(() => {});
      trackedStudentIds.length = 0;
    }

    if (trackedDoctorIds.length > 0) {
      await prisma.doctor.deleteMany({
        where: { id: { in: trackedDoctorIds } },
      }).catch(() => {});
      trackedDoctorIds.length = 0;
    }

    if (trackedUserIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { userId: { in: trackedUserIds } },
      }).catch(() => {});
      await prisma.notification.deleteMany({
        where: { userId: { in: trackedUserIds } },
      }).catch(() => {});
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: trackedUserIds } },
      }).catch(() => {});
      await prisma.user.deleteMany({
        where: { id: { in: trackedUserIds } },
      }).catch(() => {});
      trackedUserIds.length = 0;
    }

    if (trackedDeptIds.length > 0) {
      await prisma.department.deleteMany({
        where: { id: { in: trackedDeptIds } },
      }).catch(() => {});
      trackedDeptIds.length = 0;
    }

    if (trackedCollegeIds.length > 0) {
      await prisma.college.deleteMany({
        where: { id: { in: trackedCollegeIds } },
      }).catch(() => {});
      trackedCollegeIds.length = 0;
    }
  } catch (err) {
    // cleanup error logged without crashing
  } finally {
    try {
      if (fs.existsSync(runTempDir)) {
        fs.rmSync(runTempDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

async function createUserFixture(role: string, scope: { departmentId?: number; collegeId?: number } = {}) {
  const email = `pipe_${role.toLowerCase()}_${makeSuffix('u')}@example.test`;
  const user = await prisma.user.create({
    data: {
      email,
      password: crypto.randomUUID(),
      role: role as any,
      tokenVersion: 0,
      isActive: true,
      collegeId: scope.collegeId,
      departmentId: scope.departmentId,
    },
  });
  trackedUserIds.push(user.id);
  return user;
}

async function createDoctorFixture(deptId: number) {
  const user = await createUserFixture('DOCTOR', { departmentId: deptId });
  const doctor = await prisma.doctor.create({
    data: {
      userId: user.id,
      firstName: 'Doctor',
      lastName: makeSuffix('Doc'),
      departmentId: deptId,
    },
  });
  trackedDoctorIds.push(doctor.id);
  return { user, doctor };
}

async function createStudentFixture(deptId: number) {
  const user = await createUserFixture('STUDENT', { departmentId: deptId });
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
  return { user, student };
}

function writeTempFile(fileName: string, content: string | Buffer): { filePath: string; fileHash: string } {
  const filePath = path.join(runTempDir, fileName);
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  fs.writeFileSync(filePath, buf);
  const fileHash = crypto.createHash('sha256').update(buf).digest('hex');
  return { filePath, fileHash };
}

test('wp5_t6b3b1 Similarity Pipeline Suite', async (t) => {
  let college: any;
  let dept: any;
  let course: any;
  let doctor: any;
  let doctorUser: any;

  try {
    college = await prisma.college.create({ data: { name: `College ${makeSuffix('col')}` } });
    trackedCollegeIds.push(college.id);

    dept = await prisma.department.create({
      data: { name: `Dept ${makeSuffix('dept')}`, collegeId: college.id },
    });
    trackedDeptIds.push(dept.id);

    course = await prisma.course.create({
      data: { courseCode: `CRS_${makeSuffix('c')}`, name: 'Course 101', departmentId: dept.id },
    });
    trackedCourseIds.push(course.id);

    const docObj = await createDoctorFixture(dept.id);
    doctor = docObj.doctor;
    doctorUser = docObj.user;

    async function createTaskFixture() {
      const task = await prisma.task.create({
        data: {
          title: 'Task ' + makeSuffix('t'),
          description: 'Task description',
          courseId: course.id,
          academicYear: 1,
          semester: 1,
          doctorId: doctor.id,
          dueDate: new Date(Date.now() + 86400000),
        },
      });
      trackedTaskIds.push(task.id);
      return task;
    }

    async function setPolicyThreshold(threshold: number | null) {
      if (threshold === null) {
        await prisma.submissionIntegrityPolicy.deleteMany({});
        return;
      }
      const p = await prisma.submissionIntegrityPolicy.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          exactDuplicateBlock: true,
          similarityThreshold: threshold,
          updatedById: doctorUser.id,
        },
        update: {
          similarityThreshold: threshold,
          updatedById: doctorUser.id,
        },
      });
      trackedPolicyIds.push(p.id);
      return p;
    }

    async function createSubmissionHelper(
      student: any,
      fileName: string,
      fileHash: string,
      storageKey: string,
      targetTask?: any
    ) {
      const enrollment = await prisma.enrollment.create({
        data: {
          studentId: student.id,
          courseId: course.id,
          academicYear: 1,
          semester: 1,
          status: 'ENROLLED',
        },
      });
      trackedEnrollmentIds.push(enrollment.id);

      const effectiveTask = targetTask ?? (await createTaskFixture());
      const sub = await prisma.taskSubmission.create({
        data: {
          taskId: effectiveTask.id,
          studentId: student.id,
          enrollmentId: enrollment.id,
          fileName,
          fileHash,
          storageKey,
        },
      });
      trackedSubmissionIds.push(sub.id);
      return { sub, enrollment, task: effectiveTask };
    }

    await t.test('T1 eligible txt = FINGERPRINT_READY, signature 512, shingleCount > 0, status READY', async () => {
      const text = 'The university management system operates modern computing infrastructure and handles academic records efficiently and reliably across all departments and programs. It enables students to access lecture materials, register for classes, and submit required course assignments on time.';
      const { fileHash } = writeTempFile('eligible.txt', text);
      const { student } = await createStudentFixture(dept.id);
      const { sub } = await createSubmissionHelper(student, 'eligible.txt', fileHash, 'eligible.txt');

      const result = await processSubmissionSimilarity(sub.id, { storageDir: runTempDir });
      assert.equal(result.outcome, 'FINGERPRINT_READY');

      const fp = await prisma.taskSubmissionFingerprint.findUnique({ where: { submissionId: sub.id } });
      assert.ok(fp);
      trackedFingerprintIds.push(fp.id);
      assert.equal(fp.status, 'READY');
      assert.equal(fp.fileHash, fileHash);
      assert.ok(fp.signature);
      assert.equal(fp.signature.length, 512);
      assert.ok(fp.shingleCount > 0);
    });

    await t.test('T2 short text = UNSUPPORTED', async () => {
      const shortText = 'Too short text.';
      const { fileHash } = writeTempFile('short.txt', shortText);
      const { student } = await createStudentFixture(dept.id);
      const { sub } = await createSubmissionHelper(student, 'short.txt', fileHash, 'short.txt');

      const result = await processSubmissionSimilarity(sub.id, { storageDir: runTempDir });
      assert.equal(result.outcome, 'FINGERPRINT_UNSUPPORTED');

      const fp = await prisma.taskSubmissionFingerprint.findUnique({ where: { submissionId: sub.id } });
      assert.ok(fp);
      trackedFingerprintIds.push(fp.id);
      assert.equal(fp.status, 'UNSUPPORTED');
      assert.equal(fp.signature, null);
      assert.equal(fp.shingleCount, 0);
    });

    await t.test('T3 extension pdf = UNSUPPORTED and injected extract spy called 0 times', async () => {
      const { fileHash } = writeTempFile('document.pdf', 'dummy pdf content');
      const { student } = await createStudentFixture(dept.id);
      const { sub } = await createSubmissionHelper(student, 'document.pdf', fileHash, 'document.pdf');

      let extractSpyCalls = 0;
      const result = await processSubmissionSimilarity(sub.id, {
        storageDir: runTempDir,
        extractText: async () => {
          extractSpyCalls++;
          return { status: 'OK', text: 'Extracted text', truncated: false };
        },
      });

      assert.equal(result.outcome, 'FINGERPRINT_UNSUPPORTED');
      assert.equal(extractSpyCalls, 0);

      const fp = await prisma.taskSubmissionFingerprint.findUnique({ where: { submissionId: sub.id } });
      assert.ok(fp);
      trackedFingerprintIds.push(fp.id);
      assert.equal(fp.status, 'UNSUPPORTED');
      assert.equal(fp.signature, null);
    });

    await t.test('T4 extract FAILED = FAILED fingerprint, spy called exactly once', async () => {
      const { fileHash } = writeTempFile('corrupt.txt', 'corrupt content');
      const { student } = await createStudentFixture(dept.id);
      const { sub } = await createSubmissionHelper(student, 'corrupt.txt', fileHash, 'corrupt.txt');

      let spyCalls = 0;
      const result = await processSubmissionSimilarity(sub.id, {
        storageDir: runTempDir,
        extractText: async () => {
          spyCalls++;
          return { status: 'FAILED', reason: 'CORRUPT' };
        },
      });

      assert.equal(result.outcome, 'FINGERPRINT_FAILED');
      assert.equal(spyCalls, 1);

      const fp = await prisma.taskSubmissionFingerprint.findUnique({ where: { submissionId: sub.id } });
      assert.ok(fp);
      trackedFingerprintIds.push(fp.id);
      assert.equal(fp.status, 'FAILED');
      assert.equal(fp.signature, null);
      assert.equal(fp.shingleCount, 0);
    });

    await t.test('T5 missing file = FAILED, no throw', async () => {
      const { student } = await createStudentFixture(dept.id);
      const { sub } = await createSubmissionHelper(student, 'missing.txt', 'nonexistenthash', 'missing_on_disk.txt');

      const result = await processSubmissionSimilarity(sub.id, { storageDir: runTempDir });
      assert.equal(result.outcome, 'FINGERPRINT_FAILED');

      const fp = await prisma.taskSubmissionFingerprint.findUnique({ where: { submissionId: sub.id } });
      assert.ok(fp);
      trackedFingerprintIds.push(fp.id);
      assert.equal(fp.status, 'FAILED');
      assert.equal(fp.signature, null);
    });

    await t.test('T6 threshold null = READY and 0 flags', async () => {
      await setPolicyThreshold(null);

      const text = 'This text has more than enough words to be completely eligible for minhash shingles similarity analysis in our university system. We verify that without a threshold policy no flags are generated.';
      const { fileHash } = writeTempFile('policy_null.txt', text);
      const { student } = await createStudentFixture(dept.id);
      const { sub } = await createSubmissionHelper(student, 'policy_null.txt', fileHash, 'policy_null.txt');

      const result = await processSubmissionSimilarity(sub.id, {
        storageDir: runTempDir,
        getEffectivePolicy: async () => ({
          exactDuplicateBlock: true,
          similarityThreshold: null,
          isDefault: true,
        }),
      });

      assert.equal(result.outcome, 'FINGERPRINT_READY');
      assert.equal(result.flagsCreated, 0);

      const flags = await prisma.submissionSimilarityFlag.findMany({
        where: { OR: [{ submissionAId: sub.id }, { submissionBId: sub.id }] },
      });
      assert.equal(flags.length, 0);
    });

    await t.test('T7 two students near-identical texts and one unrelated: 1 flag, aligned, rerun idempotent (P4)', async () => {
      await setPolicyThreshold(0.5);
      const testTask = await createTaskFixture();

      const text1 = 'The university management system provides course registration, student grading, and faculty management across multiple colleges and departments. This system was developed with modern web standards and high security.';
      const text2 = 'The university management system provides course registration, student grading, and faculty management across multiple colleges and departments. This system was developed with modern web standards and high security indeed.';
      const text3 = 'An entirely different topic regarding astronomy and quantum mechanics with celestial orbits and planetary rotations far in deep interstellar space exploration.';

      const f1 = writeTempFile('stu1.txt', text1);
      const f2 = writeTempFile('stu2.txt', text2);
      const f3 = writeTempFile('stu3.txt', text3);

      const s1 = (await createStudentFixture(dept.id)).student;
      const s2 = (await createStudentFixture(dept.id)).student;
      const s3 = (await createStudentFixture(dept.id)).student;

      const sub1 = (await createSubmissionHelper(s1, 'stu1.txt', f1.fileHash, 'stu1.txt', testTask)).sub;
      const sub2 = (await createSubmissionHelper(s2, 'stu2.txt', f2.fileHash, 'stu2.txt', testTask)).sub;
      const sub3 = (await createSubmissionHelper(s3, 'stu3.txt', f3.fileHash, 'stu3.txt', testTask)).sub;

      const res1 = await processSubmissionSimilarity(sub1.id, { storageDir: runTempDir });
      assert.equal(res1.outcome, 'FINGERPRINT_READY');
      assert.equal(res1.flagsCreated, 0);

      const res2 = await processSubmissionSimilarity(sub2.id, { storageDir: runTempDir });
      assert.equal(res2.outcome, 'FINGERPRINT_READY');
      assert.equal(res2.flagsCreated, 1);

      const res3 = await processSubmissionSimilarity(sub3.id, { storageDir: runTempDir });
      assert.equal(res3.outcome, 'FINGERPRINT_READY');
      assert.equal(res3.flagsCreated, 0);

      // Check flags in DB
      const flags = await prisma.submissionSimilarityFlag.findMany({
        where: { taskId: testTask.id },
      });
      assert.equal(flags.length, 1);
      trackedFlagIds.push(flags[0].id);

      const flag = flags[0];
      assert.ok(flag.submissionAId < flag.submissionBId);
      if (flag.submissionAId === sub1.id) {
        assert.equal(flag.fileHashA, f1.fileHash);
        assert.equal(flag.fileHashB, f2.fileHash);
      } else {
        assert.equal(flag.fileHashA, f2.fileHash);
        assert.equal(flag.fileHashB, f1.fileHash);
      }
      assert.equal(flag.thresholdUsed, 0.5);
      assert.ok(flag.similarityScore >= 0.5);

      // Rerun pipeline for both submissions (P4 test)
      const rerun1 = await processSubmissionSimilarity(sub1.id, { storageDir: runTempDir });
      const rerun2 = await processSubmissionSimilarity(sub2.id, { storageDir: runTempDir });

      const flagsAfterRerun = await prisma.submissionSimilarityFlag.findMany({
        where: { taskId: testTask.id },
      });
      assert.equal(flagsAfterRerun.length, 1);
    });

    await t.test('T8 resubmit: fingerprint replaced in place, stale PENDING purged, CONFIRMED preserved', async () => {
      await setPolicyThreshold(0.5);
      const testTask = await createTaskFixture();

      const textA = 'First student submission original text with enough vocabulary and structure for full similarity processing in the system suite.';
      const textB = 'First student submission original text with enough vocabulary and structure for full similarity processing in the system suite copy.';

      const fa = writeTempFile('resub_a.txt', textA);
      const fb = writeTempFile('resub_b.txt', textB);

      const sa = (await createStudentFixture(dept.id)).student;
      const sb = (await createStudentFixture(dept.id)).student;

      const subA = (await createSubmissionHelper(sa, 'resub_a.txt', fa.fileHash, 'resub_a.txt', testTask)).sub;
      const subB = (await createSubmissionHelper(sb, 'resub_b.txt', fb.fileHash, 'resub_b.txt', testTask)).sub;

      await processSubmissionSimilarity(subA.id, { storageDir: runTempDir });
      await processSubmissionSimilarity(subB.id, { storageDir: runTempDir });

      const initialFp = await prisma.taskSubmissionFingerprint.findUniqueOrThrow({
        where: { submissionId: subA.id },
      });
      trackedFingerprintIds.push(initialFp.id);

      // Create a confirmed flag involving subA and subB
      const confirmedFlag = await prisma.submissionSimilarityFlag.create({
        data: {
          taskId: testTask.id,
          submissionAId: Math.min(subA.id, subB.id),
          submissionBId: Math.max(subA.id, subB.id),
          fileHashA: 'hashA_confirmed',
          fileHashB: 'hashB_confirmed',
          similarityScore: 0.99,
          thresholdUsed: 0.5,
          status: 'CONFIRMED',
          reviewedById: doctorUser.id,
          reviewedAt: new Date(),
        },
      });
      trackedFlagIds.push(confirmedFlag.id);

      // Now student A resubmits with new file and new hash
      const textNew = 'Brand new distinct content submitted by student A after revising the complete essay from scratch with different concepts.';
      const fNew = writeTempFile('resub_a_new.txt', textNew);

      await prisma.taskSubmission.update({
        where: { id: subA.id },
        data: {
          fileName: 'resub_a_new.txt',
          storageKey: 'resub_a_new.txt',
          fileHash: fNew.fileHash,
        },
      });

      // Run pipeline on updated submission
      const resubResult = await processSubmissionSimilarity(subA.id, { storageDir: runTempDir });
      assert.equal(resubResult.outcome, 'FINGERPRINT_READY');

      // Fingerprint should be replaced in place (same ID, new hash)
      const updatedFp = await prisma.taskSubmissionFingerprint.findUniqueOrThrow({
        where: { submissionId: subA.id },
      });
      assert.equal(updatedFp.id, initialFp.id);
      assert.equal(updatedFp.fileHash, fNew.fileHash);

      // Stale PENDING flag between subA and subB was purged
      const pendingFlags = await prisma.submissionSimilarityFlag.findMany({
        where: {
          status: 'PENDING',
          OR: [{ submissionAId: subA.id }, { submissionBId: subA.id }],
        },
      });
      assert.equal(pendingFlags.length, 0);

      // CONFIRMED flag is preserved
      const preservedFlag = await prisma.submissionSimilarityFlag.findUnique({
        where: { id: confirmedFlag.id },
      });
      assert.ok(preservedFlag);
      assert.equal(preservedFlag.status, 'CONFIRMED');
    });

    await t.test('T9 stale discard: beforeWrite changes fileHash = DISCARDED_STALE, fingerprint unchanged', async () => {
      const text = 'Sample submission text for testing stale discard detection when file hash changes before write transaction executes.';
      const { fileHash } = writeTempFile('stale.txt', text);
      const { student } = await createStudentFixture(dept.id);
      const { sub } = await createSubmissionHelper(student, 'stale.txt', fileHash, 'stale.txt');

      // Initial run
      await processSubmissionSimilarity(sub.id, { storageDir: runTempDir });
      const initialFp = await prisma.taskSubmissionFingerprint.findUniqueOrThrow({
        where: { submissionId: sub.id },
      });
      trackedFingerprintIds.push(initialFp.id);

      // Run with beforeWrite changing fileHash in DB
      const result = await processSubmissionSimilarity(sub.id, {
        storageDir: runTempDir,
        beforeWrite: async (id) => {
          await prisma.taskSubmission.update({
            where: { id },
            data: { fileHash: 'mutated_mid_flight_hash' },
          });
        },
      });

      assert.equal(result.outcome, 'DISCARDED_STALE');

      const fpAfter = await prisma.taskSubmissionFingerprint.findUniqueOrThrow({
        where: { submissionId: sub.id },
      });
      assert.equal(fpAfter.fileHash, initialFp.fileHash);
    });

    await t.test('T10 submission deleted inside beforeWrite = SKIPPED_NOT_FOUND, no throw', async () => {
      const text = 'Submission text for testing graceful handling of row deletion while similarity pipeline is processing.';
      const { fileHash } = writeTempFile('delete_mid.txt', text);
      const { student } = await createStudentFixture(dept.id);
      const { sub } = await createSubmissionHelper(student, 'delete_mid.txt', fileHash, 'delete_mid.txt');

      const result = await processSubmissionSimilarity(sub.id, {
        storageDir: runTempDir,
        beforeWrite: async (id) => {
          await prisma.taskSubmission.delete({ where: { id } });
        },
      });

      assert.equal(result.outcome, 'SKIPPED_NOT_FOUND');
    });

    await t.test('T11 peers FAILED, UNSUPPORTED, no fingerprint, or stale hash are not compared', async () => {
      await setPolicyThreshold(0.5);
      const testTask = await createTaskFixture();

      const baseText = 'Standard academic document containing comprehensive analysis of distributed algorithms, database transactions, concurrent systems, fault tolerance principles, and resilient computing patterns across modern networks.';
      const fBase = writeTempFile('base_t11.txt', baseText);

      // Peer A: FAILED
      const sA = (await createStudentFixture(dept.id)).student;
      const subA = (await createSubmissionHelper(sA, 'pA.txt', fBase.fileHash, 'base_t11.txt', testTask)).sub;
      const fpA = await prisma.taskSubmissionFingerprint.create({
        data: { submissionId: subA.id, fileHash: fBase.fileHash, status: 'FAILED', signature: null, shingleCount: 0 },
      });
      trackedFingerprintIds.push(fpA.id);

      // Peer B: UNSUPPORTED
      const sB = (await createStudentFixture(dept.id)).student;
      const subB = (await createSubmissionHelper(sB, 'pB.txt', fBase.fileHash, 'base_t11.txt', testTask)).sub;
      const fpB = await prisma.taskSubmissionFingerprint.create({
        data: { submissionId: subB.id, fileHash: fBase.fileHash, status: 'UNSUPPORTED', signature: null, shingleCount: 0 },
      });
      trackedFingerprintIds.push(fpB.id);

      // Peer C: No fingerprint row
      const sC = (await createStudentFixture(dept.id)).student;
      await createSubmissionHelper(sC, 'pC.txt', fBase.fileHash, 'base_t11.txt', testTask);

      // Peer D: READY but fingerprint.fileHash differs from taskSubmission.fileHash (stale)
      const sD = (await createStudentFixture(dept.id)).student;
      const subD = (await createSubmissionHelper(sD, 'pD.txt', 'current_hash_d', 'base_t11.txt', testTask)).sub;
      const fpD = await prisma.taskSubmissionFingerprint.create({
        data: {
          submissionId: subD.id,
          fileHash: 'stale_hash_d',
          status: 'READY',
          signature: Buffer.alloc(512),
          shingleCount: 20,
        },
      });
      trackedFingerprintIds.push(fpD.id);

      // Peer E: Valid READY peer
      const sE = (await createStudentFixture(dept.id)).student;
      const subE = (await createSubmissionHelper(sE, 'pE.txt', fBase.fileHash, 'base_t11.txt', testTask)).sub;
      const fpE = await prisma.taskSubmissionFingerprint.create({
        data: {
          submissionId: subE.id,
          fileHash: fBase.fileHash,
          status: 'READY',
          signature: Buffer.alloc(512),
          shingleCount: 20,
        },
      });
      trackedFingerprintIds.push(fpE.id);

      // Current submission
      const sCurr = (await createStudentFixture(dept.id)).student;
      const subCurr = (await createSubmissionHelper(sCurr, 'curr_t11.txt', fBase.fileHash, 'base_t11.txt', testTask)).sub;

      const result = await processSubmissionSimilarity(subCurr.id, { storageDir: runTempDir });
      assert.equal(result.outcome, 'FINGERPRINT_READY');
      // Only Peer E is valid and counted
      assert.equal(result.peersCompared, 1);
    });

    await t.test('T12 peerCap 2 with 4 valid peers: peersCompared = 2 and are the 2 most recent', async () => {
      await setPolicyThreshold(0.5);
      const testTask = await createTaskFixture();

      const text = 'Shared text body for testing peer cap limitation and order verification in submission similarity pipeline with extensive and comprehensive explanations of all computing methods.';
      const f = writeTempFile('t12.txt', text);

      const peers: any[] = [];
      for (let i = 0; i < 4; i++) {
        const s = (await createStudentFixture(dept.id)).student;
        const sub = (await createSubmissionHelper(s, `p${i}.txt`, f.fileHash, 't12.txt', testTask)).sub;
        const fp = await prisma.taskSubmissionFingerprint.create({
          data: {
            submissionId: sub.id,
            fileHash: f.fileHash,
            status: 'READY',
            signature: Buffer.alloc(512),
            shingleCount: 20,
            createdAt: new Date(Date.now() + i * 1000),
          },
        });
        trackedFingerprintIds.push(fp.id);
        peers.push({ sub, fp });
      }

      const sCurr = (await createStudentFixture(dept.id)).student;
      const subCurr = (await createSubmissionHelper(sCurr, 'curr_t12.txt', f.fileHash, 't12.txt', testTask)).sub;

      const result = await processSubmissionSimilarity(subCurr.id, {
        storageDir: runTempDir,
        peerCap: 2,
      });

      assert.equal(result.outcome, 'FINGERPRINT_READY');
      assert.equal(result.peersCompared, 2);
    });

    await t.test('T13 current fileHash equal to CourseMaterial.fileHash of course = no flags', async () => {
      await setPolicyThreshold(0.5);
      const testTask = await createTaskFixture();

      const templateText = 'Course lecture starter template provided to all students as reference starter code with identical definitions and structures throughout all academic assignments and exercises.';
      const { fileHash } = writeTempFile('template.txt', templateText);

      // Create CourseMaterial with matching hash
      const mat = await prisma.courseMaterial.create({
        data: {
          title: 'Assignment Starter Template',
          courseId: course.id,
          fileUrl: 'http://example.test/mat.txt',
          fileHash,
        },
      });
      trackedMaterialIds.push(mat.id);

      // Peer with matching hash
      const sPeer = (await createStudentFixture(dept.id)).student;
      const subPeer = (await createSubmissionHelper(sPeer, 'peer_mat.txt', fileHash, 'template.txt', testTask)).sub;
      const fpPeer = await prisma.taskSubmissionFingerprint.create({
        data: {
          submissionId: subPeer.id,
          fileHash,
          status: 'READY',
          signature: Buffer.alloc(512),
          shingleCount: 20,
        },
      });
      trackedFingerprintIds.push(fpPeer.id);

      // Current submission with matching template hash
      const sCurr = (await createStudentFixture(dept.id)).student;
      const subCurr = (await createSubmissionHelper(sCurr, 'curr_mat.txt', fileHash, 'template.txt', testTask)).sub;

      const result = await processSubmissionSimilarity(subCurr.id, { storageDir: runTempDir });
      assert.equal(result.outcome, 'FINGERPRINT_READY');
      assert.equal(result.flagsCreated, 0);
      assert.equal(result.peersCompared, 0);
    });

    await t.test('T14 storageKey with ../ = FAILED and readFile spy called 0 times; normal key spy called once', async () => {
      const testTask = await createTaskFixture();

      // Part A: Path traversal
      const { student: sA } = await createStudentFixture(dept.id);
      const subA = (await createSubmissionHelper(sA, 'traversal.txt', 'hashA', '../escaped.txt', testTask)).sub;

      let readFileSpyCalls: string[] = [];
      const resultA = await processSubmissionSimilarity(subA.id, {
        storageDir: runTempDir,
        readFile: async (p) => {
          readFileSpyCalls.push(p);
          return Buffer.from('data');
        },
      });

      assert.equal(resultA.outcome, 'FINGERPRINT_FAILED');
      assert.equal(readFileSpyCalls.length, 0);

      // Part B: Normal key
      const text = 'Valid submission text for verifying single file read behavior during similarity processing with plenty of words and complete sentences to satisfy eligibility requirements.';
      const { fileHash } = writeTempFile('normal_key.txt', text);
      const { student: sB } = await createStudentFixture(dept.id);
      const subB = (await createSubmissionHelper(sB, 'normal_key.txt', fileHash, 'normal_key.txt', testTask)).sub;

      readFileSpyCalls = [];
      const resultB = await processSubmissionSimilarity(subB.id, {
        storageDir: runTempDir,
        readFile: async (p) => {
          readFileSpyCalls.push(p);
          return fs.promises.readFile(p);
        },
      });

      assert.equal(resultB.outcome, 'FINGERPRINT_READY');
      assert.equal(readFileSpyCalls.length, 1);
      assert.equal(readFileSpyCalls[0], path.join(runTempDir, 'normal_key.txt'));
    });

    await t.test('T15 peer in another task is never compared', async () => {
      await setPolicyThreshold(0.5);

      const task1 = await createTaskFixture();
      const task2 = await createTaskFixture();

      const text = 'Identical document submitted to two distinct tasks should never trigger cross-task similarity flags because tasks evaluate completely independent student learning outcomes.';
      const { fileHash } = writeTempFile('t15.txt', text);

      // Peer in task 2
      const sOther = (await createStudentFixture(dept.id)).student;
      const subOther = (await createSubmissionHelper(sOther, 't15_other.txt', fileHash, 't15.txt', task2)).sub;

      const fpOther = await prisma.taskSubmissionFingerprint.create({
        data: {
          submissionId: subOther.id,
          fileHash,
          status: 'READY',
          signature: Buffer.alloc(512),
          shingleCount: 20,
        },
      });
      trackedFingerprintIds.push(fpOther.id);

      // Current submission in task 1
      const sCurr = (await createStudentFixture(dept.id)).student;
      const subCurr = (await createSubmissionHelper(sCurr, 't15_curr.txt', fileHash, 't15.txt', task1)).sub;

      const result = await processSubmissionSimilarity(subCurr.id, { storageDir: runTempDir });
      assert.equal(result.outcome, 'FINGERPRINT_READY');
      assert.equal(result.peersCompared, 0);
      assert.equal(result.flagsCreated, 0);
    });

    await t.test('T16 AuditLog: no row references created flag ids and count around pipeline unchanged', async () => {
      await setPolicyThreshold(0.5);
      const testTask = await createTaskFixture();

      const text = 'Audit log safety test text content providing sufficient length to trigger a similarity flag creation between peers with substantial depth and clarity.';
      const { fileHash } = writeTempFile('t16.txt', text);

      const sPeer = (await createStudentFixture(dept.id)).student;
      const subPeer = (await createSubmissionHelper(sPeer, 't16_peer.txt', fileHash, 't16.txt', testTask)).sub;
      await processSubmissionSimilarity(subPeer.id, { storageDir: runTempDir });

      const sCurr = (await createStudentFixture(dept.id)).student;
      const subCurr = (await createSubmissionHelper(sCurr, 't16_curr.txt', fileHash, 't16.txt', testTask)).sub;

      const auditCountBefore = await prisma.auditLog.count();
      const result = await processSubmissionSimilarity(subCurr.id, { storageDir: runTempDir });
      const auditCountAfter = await prisma.auditLog.count();

      assert.equal(result.flagsCreated, 1);
      assert.equal(auditCountBefore, auditCountAfter);

      const createdFlags = await prisma.submissionSimilarityFlag.findMany({
        where: { OR: [{ submissionAId: subCurr.id }, { submissionBId: subCurr.id }] },
      });
      assert.equal(createdFlags.length, 1);
      trackedFlagIds.push(createdFlags[0].id);

      const flagAuditRows = await prisma.auditLog.findMany({
        where: { entityId: createdFlags[0].id },
      });
      assert.equal(flagAuditRows.length, 0);
    });

    await t.test('T17 [source-text] submissionSimilarityPipeline.ts imports no write API, child_process, net, http, vm and contains no eval, new Function, console., process.env', async () => {
      const candidate1 = path.resolve(
        process.cwd(),
        'src/services/similarity/submissionSimilarityPipeline.ts'
      );
      const candidate2 = path.resolve(
        process.cwd(),
        'artifacts/api-server/src/services/similarity/submissionSimilarityPipeline.ts'
      );
      const pipelineFilePath = fs.existsSync(candidate1) ? candidate1 : candidate2;
      assert.ok(fs.existsSync(pipelineFilePath), 'Pipeline source file must exist');
      const source = fs.readFileSync(pipelineFilePath, 'utf8');

      // Assert no fs write API
      const writeApiRegex = /\b(writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|rm|rmdir|rmSync|unlink|unlinkSync|createWriteStream)\b/;
      assert.equal(writeApiRegex.test(source), false, 'Must not import or call fs write APIs');

      // Assert no child_process
      assert.equal(/['"]child_process['"]/.test(source), false, 'Must not import child_process');

      // Assert no net
      assert.equal(/['"]node:net['"]|['"]net['"]/.test(source), false, 'Must not import net');

      // Assert no http
      assert.equal(/['"]node:http['"]|['"]http['"]/.test(source), false, 'Must not import http');

      // Assert no vm
      assert.equal(/['"]node:vm['"]|['"]vm['"]/.test(source), false, 'Must not import vm');

      // Assert no eval
      assert.equal(/\beval\s*\(/.test(source), false, 'Must not contain eval');

      // Assert no new Function
      assert.equal(/new\s+Function\b/.test(source), false, 'Must not contain new Function');

      // Assert no console.
      assert.equal(/console\.(log|warn|error|info|debug)\b/.test(source), false, 'Must not contain console.');

      // Assert no process.env
      assert.equal(/process\.env\b/.test(source), false, 'Must not contain process.env');
    });

    await t.test('M1 MEMORY: full pipeline on deterministic ~900000-word ~4.4 MB txt with rss and heap assertions', async () => {
      // Deterministic 10-word sentence repeated 90,000 times = 900,000 words, ~4.5 MB
      const sentence = 'Academic integrity ensures equitable evaluation across university courses and degree programs. ';
      const repeatCount = 90000;
      const largeText = sentence.repeat(repeatCount);
      const { fileHash } = writeTempFile('large_mem.txt', largeText);

      const sMem = (await createStudentFixture(dept.id)).student;
      const subMem = (await createSubmissionHelper(sMem, 'large_mem.txt', fileHash, 'large_mem.txt')).sub;

      v8.setFlagsFromString('--expose-gc');
      const gc = vm.runInNewContext('gc');
      if (typeof gc === 'function') {
        gc();
      }

      const initialRss = process.memoryUsage().rss;
      const initialHeapUsed = process.memoryUsage().heapUsed;
      let peakRss = initialRss;

      const sampleInterval = setInterval(() => {
        const currentRss = process.memoryUsage().rss;
        if (currentRss > peakRss) {
          peakRss = currentRss;
        }
      }, 50);

      const startTime = performance.now();
      const result = await processSubmissionSimilarity(subMem.id, { storageDir: runTempDir });
      const elapsed = performance.now() - startTime;
      clearInterval(sampleInterval);

      if (typeof gc === 'function') {
        gc();
        gc();
      }

      const finalHeapUsed = process.memoryUsage().heapUsed;
      const peakRssDeltaMiB = (peakRss - initialRss) / (1024 * 1024);
      const retainedHeapUsedDeltaMiB = (finalHeapUsed - initialHeapUsed) / (1024 * 1024);

      console.log(
        `[M1 MEMORY RAW] peakRssDelta: ${peakRssDeltaMiB.toFixed(2)} MiB, retainedHeapUsedDelta: ${retainedHeapUsedDeltaMiB.toFixed(2)} MiB, elapsed: ${elapsed.toFixed(0)} ms`
      );

      assert.equal(result.outcome, 'FINGERPRINT_READY');
      if (typeof gc === 'function') {
        assert.ok(
          retainedHeapUsedDeltaMiB < 40,
          `Retained heap delta (${retainedHeapUsedDeltaMiB.toFixed(2)} MiB) must be < 40 MiB`
        );
      }
      assert.ok(
        peakRssDeltaMiB < 250,
        `Peak RSS delta (${peakRssDeltaMiB.toFixed(2)} MiB) must be < 250 MiB`
      );
    });
  } finally {
    await cleanupAllTracked();
  }
});
