import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { EnrollmentService } from '../src/services/enrollment.service';
import { getAllStudents } from '../src/controllers/students.controller';
import { AttendanceService } from '../src/services/attendance.service';
import { enrollStudent } from '../src/controllers/enrollment.controller';
import { NotFoundError, ConflictError, AuthorizationError } from '../src/utils/appError';

test('university operational fit: rejects non-existent student with NotFoundError', async () => {
  const currentAcademicYear = new Date().getFullYear();
  // We use a non-existent student ID
  const nonExistentStudentId = 987654321;

  // Find an existing course to use for the attempt
  const existingCourse = await prisma.course.findFirst({ select: { id: true } });
  assert.ok(existingCourse, 'At least one course must exist in database');

  await assert.rejects(
    async () => {
      await EnrollmentService.enrollStudent(
        nonExistentStudentId,
        existingCourse.id,
        1,
        currentAcademicYear
      );
    },
    (err: any) => {
      assert.ok(err instanceof NotFoundError, `Expected NotFoundError, got ${err?.constructor?.name}: ${err?.message}`);
      assert.equal(err.message, 'Student not found');
      return true;
    }
  );
});

test('university operational fit: rejects inactive or deactivated student with ConflictError', async () => {
  const currentAcademicYear = new Date().getFullYear();
  const runSuffix = `opfit_${Date.now()}`;

  // Create temporary inactive student fixture
  const tempUser = await prisma.user.create({
    data: {
      email: `inactive_student_${runSuffix}@university.edu`,
      password: 'HashedPassword123!',
      role: 'STUDENT',
      isActive: false, // User deactivated
    },
  });

  const tempStudent = await prisma.student.create({
    data: {
      userId: tempUser.id,
      firstName: 'Inactive',
      lastName: 'Candidate',
      studentId: `INACT_${runSuffix.slice(-6)}`,
      isActive: false, // Student deactivated
    },
  });

  const existingCourse = await prisma.course.findFirst({ select: { id: true } });
  assert.ok(existingCourse, 'At least one course must exist in database');

  try {
    await assert.rejects(
      async () => {
        await EnrollmentService.enrollStudent(
          tempStudent.id,
          existingCourse.id,
          1,
          currentAcademicYear
        );
      },
      (err: any) => {
        assert.ok(err instanceof ConflictError, `Expected ConflictError, got ${err?.constructor?.name}: ${err?.message}`);
        assert.equal(err.message, 'Cannot enroll an inactive or suspended student');
        return true;
      }
    );
  } finally {
    // Cleanup temporary fixture
    await prisma.enrollment.deleteMany({ where: { studentId: tempStudent.id } });
    await prisma.student.delete({ where: { id: tempStudent.id } });
    await prisma.user.delete({ where: { id: tempUser.id } });
  }
});

test('university operational fit: getStudents returns inactive fixture student on ?status=suspended filter', async () => {
  const runSuffix = `opfit_susp_${Date.now()}`;
  const tempUser = await prisma.user.create({
    data: {
      email: `suspended_student_${runSuffix}@university.edu`,
      password: 'HashedPassword123!',
      role: 'STUDENT',
      isActive: false,
    },
  });

  const tempStudent = await prisma.student.create({
    data: {
      userId: tempUser.id,
      firstName: 'Suspended',
      lastName: 'Candidate',
      studentId: `SUSP_${runSuffix.slice(-6)}`,
      isActive: false,
    },
  });

  try {
    let capturedStatusCode = 200;
    let capturedBody: any = null;
    let capturedError: any = null;

    const mockReq: any = {
      query: {
        status: 'suspended',
        page: '1',
        limit: '50',
      },
      user: {
        role: 'SUPER_ADMIN',
      },
    };

    const mockRes: any = {
      status(code: number) {
        capturedStatusCode = code;
        return this;
      },
      json(body: any) {
        capturedBody = body;
        return this;
      },
    };

    await new Promise<void>((resolve) => {
      mockRes.json = (body: any) => {
        capturedBody = body;
        resolve();
        return mockRes;
      };
      getAllStudents(mockReq, mockRes, (err: any) => {
        capturedError = err;
        resolve();
      });
    });

    assert.equal(capturedError, null, `Expected no error, but received: ${capturedError?.message}`);
    assert.equal(capturedStatusCode, 200);
    assert.ok(capturedBody && capturedBody.success === true, 'Response must have success: true');
    const returnedStudent = capturedBody.data.students.find((s: any) => s.id === tempStudent.id);
    assert.ok(returnedStudent, 'Suspended filter must return effectively inactive / suspended fixture student');
    assert.equal(returnedStudent.status, 'inactive');
  } finally {
    await prisma.student.delete({ where: { id: tempStudent.id } });
    await prisma.user.delete({ where: { id: tempUser.id } });
  }
});

test('university operational fit: AttendanceService.unblockEnrollment records audit log', async () => {
  const runSuffix = `opfit_att_${Date.now()}`;
  // Find or create a temporary student, course, and enrollment with status BLOCKED
  const tempUser = await prisma.user.create({
    data: {
      email: `blocked_student_${runSuffix}@university.edu`,
      password: 'HashedPassword123!',
      role: 'STUDENT',
      isActive: true,
    },
  });

  const tempStudent = await prisma.student.create({
    data: {
      userId: tempUser.id,
      firstName: 'Blocked',
      lastName: 'Student',
      studentId: `BLK_${runSuffix.slice(-6)}`,
      isActive: true,
    },
  });

  const course = await prisma.course.findFirst({ select: { id: true } });
  assert.ok(course, 'Course must exist');

  const enrollment = await prisma.enrollment.create({
    data: {
      studentId: tempStudent.id,
      courseId: course.id,
      semester: 1,
      academicYear: new Date().getFullYear(),
      status: 'BLOCKED',
    },
  });

  const tempAdminUser = await prisma.user.create({
    data: {
      email: `admin_${runSuffix}@university.edu`,
      password: 'HashedPassword123!',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  const adminActor: any = {
    id: tempAdminUser.id,
    role: 'SUPER_ADMIN',
    email: tempAdminUser.email,
  };

  const mockReq: any = {
    user: adminActor,
    ip: '127.0.0.1',
    userAgent: 'IntegrationTest/1.0',
  };

  try {
    const result = await AttendanceService.unblockEnrollment(adminActor, enrollment.id, mockReq);
    assert.equal(result.message, 'Student unblocked successfully');

    // Verify enrollment status updated
    const updated = await prisma.enrollment.findUnique({ where: { id: enrollment.id } });
    assert.equal(updated?.status, 'ENROLLED');

    // Verify audit log created
    const log = await prisma.auditLog.findFirst({
      where: {
        action: 'ADMIN_UNBLOCK_ENROLLMENT',
        entity: 'Enrollment',
        entityId: String(enrollment.id),
      },
      orderBy: { timestamp: 'desc' },
    });

    assert.ok(log, 'ADMIN_UNBLOCK_ENROLLMENT audit log must be recorded');
    assert.equal(log.entityId, String(enrollment.id));
  } finally {
    // Cleanup
    await prisma.auditLog.deleteMany({
      where: {
        action: 'ADMIN_UNBLOCK_ENROLLMENT',
        entity: 'Enrollment',
        entityId: String(enrollment.id),
      },
    });
    await prisma.enrollment.delete({ where: { id: enrollment.id } });
    await prisma.student.delete({ where: { id: tempStudent.id } });
    await prisma.user.delete({ where: { id: tempUser.id } });
    await prisma.user.delete({ where: { id: tempAdminUser.id } });
  }
});

test('university operational fit: cross-scope course enrollment is denied with 403 AuthorizationError', async () => {
  const currentAcademicYear = new Date().getFullYear();
  // Find a course in college X
  const course = await prisma.course.findFirst({
    include: { department: { select: { collegeId: true } } },
  });
  assert.ok(course && course.department?.collegeId, 'Course with collegeId must exist');

  const courseCollegeId = course.department.collegeId;
  const differentCollegeId = courseCollegeId === 1 ? 2 : 1;

  // College Admin for a DIFFERENT college
  const scopedAdminReq: any = {
    user: {
      id: 888,
      role: 'COLLEGE_ADMIN',
      managedCollegeId: differentCollegeId,
    },
    body: {
      studentId: 1,
      courseId: course.id,
      semester: 1,
      academicYear: currentAcademicYear,
    },
  };

  let capturedError: any = null;
  const mockRes: any = {
    status() { return this; },
    json() { return this; },
  };

  await new Promise<void>((resolve) => {
    mockRes.json = () => {
      resolve();
      return mockRes;
    };
    enrollStudent(scopedAdminReq, mockRes, (err: any) => {
      capturedError = err;
      resolve();
    });
  });

  assert.ok(capturedError instanceof AuthorizationError, `Expected AuthorizationError, got ${capturedError?.constructor?.name}`);
  assert.equal(capturedError.statusCode, 403);
  assert.equal(capturedError.message, 'Access denied: You are not authorized for this course.');
});
