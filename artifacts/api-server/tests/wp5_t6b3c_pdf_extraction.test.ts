import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Buffer } from 'node:buffer';

import prisma from '../src/utils/prismaClient';
import {
  extractText,
  getActiveWorkerCount,
  type ExtractTextResult,
} from '../src/services/similarity/textExtraction.runner';
import { processSubmissionSimilarity } from '../src/services/similarity/submissionSimilarityPipeline';
import { SIMILARITY_ENABLED_EXTENSIONS } from '../src/services/similarity/similarityPipeline.constants';

const RUN_ID = crypto.randomUUID().slice(0, 8);
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
const trackedUserIds: number[] = [];
const trackedDeptIds: number[] = [];
const trackedCollegeIds: number[] = [];

// Per-run storage directory in os.tmpdir() - never in uploads/
const runTempDir = fs.mkdtempSync(path.join(os.tmpdir(), `sim-pdf-test-${RUN_ID}-`));

async function cleanupAllTracked() {
  try {
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
  } finally {
    try {
      if (fs.existsSync(runTempDir)) {
        fs.rmSync(runTempDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

const CLOSED_FAILURE_REASONS = new Set([
  'TIMEOUT',
  'OUT_OF_MEMORY',
  'WORKER_CRASH',
  'ARCHIVE_TOO_LARGE',
  'CORRUPT',
  'EMPTY',
]);

function assertClosedEnumResult(res: ExtractTextResult): void {
  assert.ok(
    res.status === 'OK' || res.status === 'UNSUPPORTED' || res.status === 'FAILED',
    `Expected status in {OK, UNSUPPORTED, FAILED}, got ${String((res as any)?.status)}`
  );
  if (res.status === 'FAILED') {
    assert.ok(
      CLOSED_FAILURE_REASONS.has(res.reason),
      `Expected FAILED reason in closed enum, got ${String(res.reason)}`
    );
  }
}

function buildPdfFromObjects(objects: Array<{ num: number; body: string | Buffer }>): Buffer {
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
  let currentOffset = parts[0].length;
  const maxObjNum = Math.max(...objects.map((o) => o.num));
  const offsets = new Array(maxObjNum + 1).fill(0);

  for (const obj of objects) {
    offsets[obj.num] = currentOffset;
    const header = Buffer.from(`${obj.num} 0 obj\n`, 'ascii');
    const body = Buffer.isBuffer(obj.body) ? obj.body : Buffer.from(obj.body, 'ascii');
    const footer = Buffer.from('\nendobj\n', 'ascii');
    parts.push(header, body, footer);
    currentOffset += header.length + body.length + footer.length;
  }

  const xrefOffset = currentOffset;
  let xref = `xref\n0 ${maxObjNum + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= maxObjNum; i++) {
    if (offsets[i] > 0) {
      xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    } else {
      xref += `0000000000 65535 f \n`;
    }
  }
  xref += `trailer\n<< /Size ${maxObjNum + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(Buffer.from(xref, 'ascii'));
  return Buffer.concat(parts);
}

function buildSmallValidPdf(text: string): Buffer {
  const streamContent = `BT\n/F1 12 Tf\n72 712 Td\n(${text}) Tj\nET`;
  const streamBytes = Buffer.from(streamContent, 'utf8');
  return buildPdfFromObjects([
    { num: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { num: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    { num: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>' },
    { num: 4, body: `<< /Length ${streamBytes.length} >>\nstream\n${streamContent}\nendstream` },
    { num: 5, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' },
  ]);
}

function buildEncryptedPdf(): Buffer {
  const streamContent = 'BT /F1 12 Tf (encrypted secret) Tj ET';
  const base = buildPdfFromObjects([
    { num: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { num: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    { num: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>' },
    { num: 4, body: `<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream` },
    { num: 5, body: '<< /Filter /Standard /V 2 /R 3 /Length 128 /P -4 /O <0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20> /U <2122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40> >>' },
  ]);
  const baseStr = base.toString('binary').replace(
    '<< /Size 6 /Root 1 0 R >>',
    '<< /Size 6 /Root 1 0 R /Encrypt 5 0 R /ID [<0123456789abcdef0123456789abcdef> <0123456789abcdef0123456789abcdef>] >>'
  );
  return Buffer.from(baseStr, 'binary');
}

test('WP5-T6b3c: PDF extraction & SIMILARITY_ENABLED_EXTENSIONS decision (OD-134)', async (t) => {
  try {
    await t.test('P1 [DECISION PIN]: SIMILARITY_ENABLED_EXTENSIONS keeps pdf disabled (["docx", "txt"])', () => {
      assert.deepEqual([...SIMILARITY_ENABLED_EXTENSIONS], ['docx', 'txt']);
      assert.equal((SIMILARITY_ENABLED_EXTENSIONS as readonly string[]).includes('pdf'), false);
    });

    await t.test('P2 [PIPELINE]: small .pdf submission returns FINGERPRINT_UNSUPPORTED at pipeline level without calling extractText or readFile', async () => {
      const college = await prisma.college.create({ data: { name: `College ${makeSuffix('col')}` } });
      trackedCollegeIds.push(college.id);

      const dept = await prisma.department.create({
        data: { name: `Dept ${makeSuffix('dept')}`, collegeId: college.id },
      });
      trackedDeptIds.push(dept.id);

      const course = await prisma.course.create({
        data: { courseCode: `CRS_${makeSuffix('c')}`, name: 'Course PDF Test', departmentId: dept.id },
      });
      trackedCourseIds.push(course.id);

      const docUser = await prisma.user.create({
        data: {
          email: `pdf_doc_${makeSuffix('u')}@example.test`,
          password: crypto.randomUUID(),
          role: 'DOCTOR',
          tokenVersion: 0,
          isActive: true,
          departmentId: dept.id,
        },
      });
      trackedUserIds.push(docUser.id);

      const doctor = await prisma.doctor.create({
        data: {
          userId: docUser.id,
          firstName: 'Doctor',
          lastName: makeSuffix('Doc'),
          departmentId: dept.id,
        },
      });
      trackedDoctorIds.push(doctor.id);

      const stuUser = await prisma.user.create({
        data: {
          email: `pdf_stu_${makeSuffix('u')}@example.test`,
          password: crypto.randomUUID(),
          role: 'STUDENT',
          tokenVersion: 0,
          isActive: true,
          departmentId: dept.id,
        },
      });
      trackedUserIds.push(stuUser.id);

      const student = await prisma.student.create({
        data: {
          userId: stuUser.id,
          studentId: `STU_${makeSuffix('id')}`,
          firstName: 'Student',
          lastName: makeSuffix('Stu'),
          departmentId: dept.id,
          year: 1,
        },
      });
      trackedStudentIds.push(student.id);

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

      const task = await prisma.task.create({
        data: {
          title: `Task ${makeSuffix('t')}`,
          description: 'PDF pipeline gate verification',
          courseId: course.id,
          academicYear: 1,
          semester: 1,
          doctorId: doctor.id,
          dueDate: new Date(Date.now() + 86400000),
        },
      });
      trackedTaskIds.push(task.id);

      const pdfBytes = buildSmallValidPdf('Academic integrity verification paragraph with sufficient words to test PDF submission.');
      const pdfFileName = `submission_${makeSuffix('f')}.pdf`;
      const pdfPath = path.join(runTempDir, pdfFileName);
      fs.writeFileSync(pdfPath, pdfBytes);
      const fileHash = crypto.createHash('sha256').update(pdfBytes).digest('hex');

      const sub = await prisma.taskSubmission.create({
        data: {
          taskId: task.id,
          studentId: student.id,
          enrollmentId: enrollment.id,
          fileName: pdfFileName,
          fileHash,
          storageKey: pdfFileName,
        },
      });
      trackedSubmissionIds.push(sub.id);

      let extractTextCalls = 0;
      let readFileCalls = 0;

      const pipelineResult = await processSubmissionSimilarity(sub.id, {
        storageDir: runTempDir,
        readFile: async (p) => {
          readFileCalls++;
          return fs.promises.readFile(p);
        },
        extractText: async () => {
          extractTextCalls++;
          return { status: 'OK', text: 'Should not be called', truncated: false };
        },
      });

      assert.equal(pipelineResult.outcome, 'FINGERPRINT_UNSUPPORTED');
      assert.equal(extractTextCalls, 0, 'Extractor must not be called when pdf is disabled');
      assert.equal(readFileCalls, 0, 'File must not be read when extension is disabled');

      const fp = await prisma.taskSubmissionFingerprint.findUnique({
        where: { submissionId: sub.id },
      });
      assert.ok(fp);
      trackedFingerprintIds.push(fp.id);
      assert.equal(fp.status, 'UNSUPPORTED');
      assert.equal(fp.signature, null);
      assert.equal(fp.shingleCount, 0);
    });

    await t.test('P3 [RUNNER]: corrupt and encrypted PDFs through the real runner return statuses inside the closed enum and leave 0 active workers', async () => {
      // 1. Small valid PDF through the direct runner still works (proving runner/worker functionality)
      const validPdf = buildSmallValidPdf('UniCore direct runner PDF extraction test');
      const validRes = await extractText({ buffer: validPdf, extension: 'pdf' });
      assertClosedEnumResult(validRes);
      assert.equal(validRes.status, 'OK');
      if (validRes.status === 'OK') {
        assert.ok(validRes.text.includes('UniCore direct runner PDF extraction test'));
        assert.equal(validRes.truncated, false);
      }

      // 2. Corrupt: truncated header-only PDF
      const truncatedPdf = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog', 'ascii');
      const truncatedRes = await extractText({ buffer: truncatedPdf, extension: 'pdf' });
      assertClosedEnumResult(truncatedRes);
      assert.equal(truncatedRes.status, 'FAILED');
      if (truncatedRes.status === 'FAILED') {
        assert.equal(truncatedRes.reason, 'CORRUPT');
      }

      // 3. Corrupt: deterministic non-PDF bytes with %PDF- magic header
      const randomWithMagic = Buffer.alloc(2048);
      Buffer.from('%PDF-1.5\n', 'ascii').copy(randomWithMagic, 0);
      for (let i = 9; i < randomWithMagic.length; i++) {
        randomWithMagic[i] = (i * 73 + 41) & 0xff;
      }
      const randomRes = await extractText({ buffer: randomWithMagic, extension: 'pdf' });
      assertClosedEnumResult(randomRes);
      assert.equal(randomRes.status, 'FAILED');
      if (randomRes.status === 'FAILED') {
        assert.equal(randomRes.reason, 'CORRUPT');
      }

      // 4. Encrypted PDF (with /Encrypt dictionary, no password)
      const encryptedPdf = buildEncryptedPdf();
      const encryptedRes = await extractText({ buffer: encryptedPdf, extension: 'pdf' });
      assertClosedEnumResult(encryptedRes);
      assert.equal(encryptedRes.status, 'FAILED');
      if (encryptedRes.status === 'FAILED') {
        assert.equal(encryptedRes.reason, 'CORRUPT');
      }

      assert.equal(getActiveWorkerCount(), 0, 'No worker thread may remain active');
    });
  } finally {
    await cleanupAllTracked();
  }
});
