import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { Readable, Writable } from 'node:stream';
import prisma from '../src/utils/prismaClient';
import { AuthorizationError, NotFoundError, AppError } from '../src/utils/appError';
import { downloadCourseMaterial } from '../src/controllers/courses.controller';
import app from '../src/app';

class MockResponseStream extends Writable {
  statusCode: number = 200;
  headers: Record<string, string> = {};
  body: any = null;
  headersSent: boolean = false;
  destroyed: boolean = false;

  status(code: number) {
    this.statusCode = code;
    return this;
  }
  json(body: any) {
    this.body = body;
    this.headersSent = true;
    this.emit('finish');
    return this;
  }
  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
    return this;
  }
  contentType(type: string) {
    this.headers['content-type'] = type;
    return this;
  }
  destroy(error?: Error) {
    this.destroyed = true;
    this.emit('close');
    return this;
  }
  _write(_chunk: any, _encoding: any, callback: () => void) {
    this.headersSent = true;
    callback();
  }
}

async function invokeController(
  controller: any,
  request: Record<string, unknown>,
  response: MockResponseStream = new MockResponseStream()
): Promise<{ error?: unknown; res: MockResponseStream }> {
  return new Promise((resolve) => {
    let finished = false;

    const finish = (error?: unknown) => {
      if (!finished) {
        finished = true;
        resolve({ error, res: response });
      }
    };

    response.on('finish', () => finish());
    response.on('close', () => finish());

    try {
      const p = controller(request, response, (error?: unknown) => {
        finish(error);
      });
      if (p && typeof p.then === 'function') {
        p.catch((err: unknown) => finish(err));
      }
    } catch (err) {
      finish(err);
    }
  });
}

async function runCourseMaterialDownloadSecurityTests() {
  const originalCourseMaterialFindUnique = prisma.courseMaterial.findUnique;
  const originalEnrollmentFindFirst = prisma.enrollment.findFirst;
  const originalScheduleSlotFindFirst = prisma.scheduleSlot.findFirst;
  const originalCourseFindFirst = prisma.course.findFirst;

  // Create disposable test material file
  const testDir = path.resolve(process.cwd(), 'uploads/materials');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  const testFileName = 'sec01_test_file.pdf';
  const testFilePath = path.join(testDir, testFileName);
  fs.writeFileSync(testFilePath, 'SEC-01 TEST CONTENT: CONFIDENTIAL LECTURE NOTES', 'utf8');

  // Start temporary server to test static route behavior
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;

  try {
    // 1. Static mount removal verification: GET /uploads/materials/sec01_test_file.pdf must return 404
    const staticRes = await fetch(`${baseUrl}/uploads/materials/${testFileName}`);
    assert.equal(
      staticRes.status,
      404,
      `Direct static access to /uploads/materials/ must return 404, got: ${staticRes.status}`
    );
    passed++;

    // 2. Static root /uploads/sec01_test_file.pdf must also return 404
    const rootUploadsRes = await fetch(`${baseUrl}/uploads/${testFileName}`);
    assert.equal(
      rootUploadsRes.status,
      404,
      `Direct static access to root /uploads/ must return 404, got: ${rootUploadsRes.status}`
    );
    passed++;

    // 3. Unauthenticated download request rejected without querying DB
    let findUniqueCalled = false;
    (prisma.courseMaterial as any).findUnique = async () => {
      findUniqueCalled = true;
      return null;
    };
    const unauthRes = await invokeController(downloadCourseMaterial, {
      params: { id: '10', materialId: '1' },
      user: undefined,
    });
    assert.ok(unauthRes.error instanceof AuthorizationError, 'Unauthenticated download must return AuthorizationError');
    assert.equal(findUniqueCalled, false, 'DB must not be queried for unauthenticated requests');
    passed++;

    // 4. Cross-course material ID denied (404)
    (prisma.courseMaterial as any).findUnique = async () => ({
      id: 999,
      courseId: 99, // belongs to course 99, requested for course 10
      title: 'Course 99 Material',
      fileName: 'c99.pdf',
      fileUrl: `/uploads/materials/${testFileName}`,
      isPublished: true,
      course: { id: 99, isPublished: true, departmentId: 5, department: { collegeId: 2 } },
    });
    const crossCourseRes = await invokeController(downloadCourseMaterial, {
      params: { id: '10', materialId: '999' },
      user: { id: 100, role: 'STUDENT', student: { id: 50 } },
    });
    assert.ok(crossCourseRes.error instanceof NotFoundError, 'Cross-course material must return NotFoundError');
    passed++;

    // 5. Unpublished material requested by student: fails with NotFoundError (no leak)
    (prisma.courseMaterial as any).findUnique = async () => ({
      id: 2,
      courseId: 10,
      title: 'Draft Exam Notes',
      fileName: 'draft.pdf',
      fileUrl: `/uploads/materials/${testFileName}`,
      isPublished: false,
      course: { id: 10, isPublished: true, departmentId: 5, department: { collegeId: 2 } },
    });
    (prisma.enrollment as any).findFirst = async () => ({
      id: 1,
      studentId: 50,
      courseId: 10,
      status: 'ENROLLED',
    });

    const unpublishedStudentRes = await invokeController(downloadCourseMaterial, {
      params: { id: '10', materialId: '2' },
      user: { id: 100, role: 'STUDENT', student: { id: 50 } },
    });
    assert.ok(
      unpublishedStudentRes.error instanceof NotFoundError,
      'Unpublished material requested by student must return NotFoundError'
    );
    passed++;

    // 6. Unenrolled student requests published material: fails with AuthorizationError
    (prisma.courseMaterial as any).findUnique = async () => ({
      id: 3,
      courseId: 10,
      title: 'Lecture 1 Notes',
      fileName: 'lecture1.pdf',
      fileUrl: `/uploads/materials/${testFileName}`,
      isPublished: true,
      course: { id: 10, isPublished: true, departmentId: 5, department: { collegeId: 2 } },
    });
    (prisma.enrollment as any).findFirst = async () => null; // Not enrolled

    const unenrolledStudentRes = await invokeController(downloadCourseMaterial, {
      params: { id: '10', materialId: '3' },
      user: { id: 100, role: 'STUDENT', student: { id: 50 } },
    });
    assert.ok(
      unenrolledStudentRes.error instanceof AuthorizationError,
      'Unenrolled student must return AuthorizationError'
    );
    passed++;

    // 7. Enrolled student requests published material: succeeds and sets download headers
    (prisma.enrollment as any).findFirst = async () => ({
      id: 1,
      studentId: 50,
      courseId: 10,
      status: 'ENROLLED',
    });

    const enrolledStudentRes = await invokeController(downloadCourseMaterial, {
      params: { id: '10', materialId: '3' },
      user: { id: 100, role: 'STUDENT', student: { id: 50 } },
    });
    assert.equal(enrolledStudentRes.error, undefined);
    assert.equal(enrolledStudentRes.res.headers['x-content-type-options'], 'nosniff');
    assert.ok(
      enrolledStudentRes.res.headers['content-disposition'].includes('attachment; filename='),
      'Must set Content-Disposition attachment header'
    );
    passed++;

    // 8. Authorized Doctor assigned to course can download even unpublished material
    (prisma.courseMaterial as any).findUnique = async () => ({
      id: 4,
      courseId: 10,
      title: 'Secret Exam Key',
      fileName: 'secret_key.pdf',
      fileUrl: `/uploads/materials/${testFileName}`,
      isPublished: false,
      course: { id: 10, isPublished: true, departmentId: 5, department: { collegeId: 2 } },
    });
    (prisma.scheduleSlot as any).findFirst = async () => ({ id: 1 });

    const doctorRes = await invokeController(downloadCourseMaterial, {
      params: { id: '10', materialId: '4' },
      user: { id: 200, role: 'DOCTOR', doctor: { id: 25 } },
    });
    assert.equal(doctorRes.error, undefined);
    assert.ok(doctorRes.res.headers['content-disposition'].includes('secret_key.pdf'));
    passed++;

    // 9. SUPER_ADMIN can download material
    const adminRes = await invokeController(downloadCourseMaterial, {
      params: { id: '10', materialId: '4' },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(adminRes.error, undefined);
    passed++;

    // 10. External URL is NOT proxied, returns 400 with external URL details
    (prisma.courseMaterial as any).findUnique = async () => ({
      id: 5,
      courseId: 10,
      title: 'External Resource',
      fileName: 'cloud_file',
      fileUrl: 'https://drive.google.com/file/d/12345/view',
      isPublished: true,
      course: { id: 10, isPublished: true, departmentId: 5, department: { collegeId: 2 } },
    });

    const externalRes = await invokeController(downloadCourseMaterial, {
      params: { id: '10', materialId: '5' },
      user: { id: 100, role: 'STUDENT', student: { id: 50 } },
    });
    assert.equal(externalRes.error, undefined);
    assert.equal(externalRes.res.statusCode, 400);
    assert.equal(externalRes.res.body?.external, true);
    assert.equal(externalRes.res.body?.fileUrl, undefined, 'fileUrl must not be reflected in 400 response');
    passed++;

    // 11. Directory traversal attempt in fileUrl is rejected with 400 AppError
    (prisma.courseMaterial as any).findUnique = async () => ({
      id: 6,
      courseId: 10,
      title: 'Malicious Traversal',
      fileName: 'traversal.pdf',
      fileUrl: '/uploads/materials/../../../../etc/passwd',
      isPublished: true,
      course: { id: 10, isPublished: true, departmentId: 5, department: { collegeId: 2 } },
    });

    const traversalRes = await invokeController(downloadCourseMaterial, {
      params: { id: '10', materialId: '6' },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.ok(
      traversalRes.error instanceof AuthorizationError ||
      (traversalRes.error instanceof AppError && (traversalRes.error as AppError).statusCode === 400),
      'Path traversal must be rejected with AuthorizationError or 400 AppError'
    );
    passed++;

    // 12. Non-materials path in fileUrl is rejected with 400 AppError
    (prisma.courseMaterial as any).findUnique = async () => ({
      id: 7,
      courseId: 10,
      title: 'Profile Escape',
      fileName: 'avatar.png',
      fileUrl: '/uploads/profiles/avatar.png',
      isPublished: true,
      course: { id: 10, isPublished: true, departmentId: 5, department: { collegeId: 2 } },
    });

    const profilePathRes = await invokeController(downloadCourseMaterial, {
      params: { id: '10', materialId: '7' },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.ok(
      profilePathRes.error instanceof AppError && (profilePathRes.error as AppError).statusCode === 400,
      'Non-material path must return 400 AppError'
    );
    passed++;

    // 13. Missing file on disk returns NotFoundError
    (prisma.courseMaterial as any).findUnique = async () => ({
      id: 8,
      courseId: 10,
      title: 'Missing File',
      fileName: 'missing.pdf',
      fileUrl: '/uploads/materials/nonexistent_file_9999.pdf',
      isPublished: true,
      course: { id: 10, isPublished: true, departmentId: 5, department: { collegeId: 2 } },
    });

    const missingFileRes = await invokeController(downloadCourseMaterial, {
      params: { id: '10', materialId: '8' },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.ok(missingFileRes.error instanceof NotFoundError, 'Missing file on disk must return NotFoundError');
    passed++;

    // 14. Header injection / filename sanitization
    (prisma.courseMaterial as any).findUnique = async () => ({
      id: 9,
      courseId: 10,
      title: 'Header Injection Attack',
      fileName: 'evil"\r\nInjected: Header\r\n\r\n.pdf',
      fileUrl: `/uploads/materials/${testFileName}`,
      isPublished: true,
      course: { id: 10, isPublished: true, departmentId: 5, department: { collegeId: 2 } },
    });

    const injectionRes = await invokeController(downloadCourseMaterial, {
      params: { id: '10', materialId: '9' },
      user: { id: 1, role: 'SUPER_ADMIN' },
    });
    assert.equal(injectionRes.error, undefined);
    const contentDisp = injectionRes.res.headers['content-disposition'];
    assert.ok(!contentDisp.includes('\r'), 'Filename must not contain CR');
    assert.ok(!contentDisp.includes('\n'), 'Filename must not contain LF');
    assert.ok(!contentDisp.includes('"evil"'), 'Filename must sanitize quotes');
    passed++;

    // 15. Stream failure before headers sent responds with 500 error
    (prisma.courseMaterial as any).findUnique = async () => ({
      id: 10,
      courseId: 10,
      title: 'Stream Failure Before Headers',
      fileName: 'stream_err_before.pdf',
      fileUrl: `/uploads/materials/${testFileName}`,
      isPublished: true,
      course: { id: 10, isPublished: true, departmentId: 5, department: { collegeId: 2 } },
    });

    const origCreateReadStream = fs.createReadStream;
    try {
      (fs as any).createReadStream = () => {
        const readable = new Readable({
          read() {},
        });
        process.nextTick(() => {
          readable.emit('error', new Error('Simulated read failure before data'));
        });
        return readable;
      };

      const streamErrBeforeRes = await invokeController(downloadCourseMaterial, {
        params: { id: '10', materialId: '10' },
        user: { id: 1, role: 'SUPER_ADMIN' },
      });
      assert.equal(streamErrBeforeRes.res.statusCode, 500);
      assert.equal(streamErrBeforeRes.res.body?.message, 'Failed to read material file');
      passed++;
    } finally {
      fs.createReadStream = origCreateReadStream;
    }

    // 16. Stream failure after headers sent calls res.destroy()
    try {
      (fs as any).createReadStream = () => {
        const readable = new Readable({
          read() {},
        });
        process.nextTick(() => {
          // Push a chunk to write to res and set headersSent = true
          readable.push(Buffer.from('chunk data'));
          process.nextTick(() => {
            readable.emit('error', new Error('Network disk disconnected mid-transfer'));
          });
        });
        return readable;
      };

      const mockRes = new MockResponseStream();
      let resDestroyCalled = false;
      const origDestroy = mockRes.destroy.bind(mockRes);
      mockRes.destroy = (err?: Error) => {
        resDestroyCalled = true;
        return origDestroy(err);
      };

      const streamErrAfterRes = await invokeController(
        downloadCourseMaterial,
        {
          params: { id: '10', materialId: '10' },
          user: { id: 1, role: 'SUPER_ADMIN' },
        },
        mockRes
      );

      assert.equal(streamErrAfterRes.res.headersSent, true);
      assert.equal(resDestroyCalled, true, 'res.destroy() must be called when stream fails after headers sent');
      passed++;
    } finally {
      fs.createReadStream = origCreateReadStream;
    }

    // 17. Client disconnect (res close event) cleans up file stream
    try {
      let createdStream: any;
      (fs as any).createReadStream = () => {
        createdStream = new Readable({
          read() {},
        });
        return createdStream;
      };

      const mockRes = new MockResponseStream();
      const invokePromise = invokeController(
        downloadCourseMaterial,
        {
          params: { id: '10', materialId: '10' },
          user: { id: 1, role: 'SUPER_ADMIN' },
        },
        mockRes
      );

      // Wait a tick for async controller to reach createReadStream and pipe
      await new Promise((r) => setImmediate(r));
      assert.equal(createdStream.destroyed, false);
      mockRes.emit('close');
      await invokePromise;
      assert.equal(createdStream.destroyed, true, 'fileStream must be destroyed when client disconnects');
      passed++;
    } finally {
      fs.createReadStream = origCreateReadStream;
    }

    console.log(`[PASS] course_material_download_security.test.ts: ${passed}/${passed} tests passed successfully.`);
  } finally {
    // Restore mocks
    prisma.courseMaterial.findUnique = originalCourseMaterialFindUnique;
    prisma.enrollment.findFirst = originalEnrollmentFindFirst;
    prisma.scheduleSlot.findFirst = originalScheduleSlotFindFirst;
    prisma.course.findFirst = originalCourseFindFirst;

    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }

    // Close http server
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runCourseMaterialDownloadSecurityTests().catch((err) => {
  console.error('[FAIL] course_material_download_security.test.ts:', err);
  process.exit(1);
});
