import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express, { Request, Response, NextFunction } from 'express';
import prisma from '../src/utils/prismaClient';
import { checkScheduleConflict } from '../src/controllers/schedulesConflict.controller';
import { authorize } from '../src/middleware/auth.middleware';
import { AuthorizationError } from '../src/utils/appError';
import { TimetableService } from '../src/services/timetable.service';

interface InvocationResult {
  statusCode: number;
  body?: any;
  error?: any;
}

async function invokeConflict(req: {
  user?: any;
  body?: Record<string, unknown>;
}): Promise<InvocationResult> {
  return new Promise<InvocationResult>((resolve, reject) => {
    const result: InvocationResult = { statusCode: 200 };
    const response: any = {
      status(code: number) {
        result.statusCode = code;
        return response;
      },
      json(payload: unknown) {
        result.body = payload;
        resolve(result);
        return response;
      },
    };
    const request = {
      body: req.body || {},
      user: req.user,
    };
    Promise.resolve(
      checkScheduleConflict(request as any, response, (error?: unknown) => {
        result.error = error;
        resolve(result);
      })
    ).catch(reject);
  });
}

describe('SEC-001 Schedule Conflict Scope Regression Suite', () => {
  const originalDepartmentFindFirst = prisma.department.findFirst;
  const originalCourseFindFirst = prisma.course.findFirst;
  const originalCourseFindUnique = prisma.course.findUnique;
  const originalDoctorFindFirst = prisma.doctor.findFirst;
  const originalTaFindFirst = prisma.teachingAssistant.findFirst;
  const originalFindConflicts = TimetableService.findConflicts;

  beforeEach(() => {
    TimetableService.findConflicts = async () => [];
  });

  afterEach(() => {
    (prisma.department as any).findFirst = originalDepartmentFindFirst;
    (prisma.course as any).findFirst = originalCourseFindFirst;
    (prisma.course as any).findUnique = originalCourseFindUnique;
    (prisma.doctor as any).findFirst = originalDoctorFindFirst;
    (prisma.teachingAssistant as any).findFirst = originalTaFindFirst;
    TimetableService.findConflicts = originalFindConflicts;
  });

  it('1. STUDENT calling POST /check-conflict is rejected with 403 at route and controller layers', async () => {
    // 1a. Route-level authorization rejection
    const app = express();
    app.use(express.json());
    app.post(
      '/test-check-conflict',
      (req: any, _res: any, next: any) => {
        req.user = { id: 50, role: 'STUDENT' };
        next();
      },
      authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR', 'TEACHING_ASSISTANT'),
      checkScheduleConflict
    );

    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/test-check-conflict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '10:00',
          departmentId: 1,
        }),
      });

      assert.equal(res.status, 403, 'Route authorize middleware must reject STUDENT with 403');
      const body = await res.json();
      assert.equal(body.success, false);
      assert.match(body.message, /Forbidden.*STUDENT/i);
    } finally {
      server.close();
    }

    // 1b. Controller-level defense-in-depth rejection for STUDENT
    const controllerStudentRes = await invokeConflict({
      user: { id: 50, role: 'STUDENT' },
      body: { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00' },
    });
    assert.ok(
      controllerStudentRes.error instanceof AuthorizationError,
      'Controller must reject STUDENT with AuthorizationError'
    );
    assert.equal(controllerStudentRes.error.statusCode, 403);
    assert.match(controllerStudentRes.error.message, /Students are not authorized/i);

    // 1c. Controller-level rejection for unauthenticated / null user
    const controllerNullUserRes = await invokeConflict({
      user: null,
      body: { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00' },
    });
    assert.ok(controllerNullUserRes.error instanceof AuthorizationError);
    assert.equal(controllerNullUserRes.error.statusCode, 403);
  });

  it('2. DOCTOR/TEACHING_ASSISTANT/DEPARTMENT_ADMIN supplying department, course, doctor, or TA outside own department is rejected with 403', async () => {
    // Mock prisma queries to return null when outside department 10
    (prisma.course as any).findFirst = async (args: any) => {
      if (args?.where?.departmentId === 10 && args?.where?.id === 101) {
        return { id: 101, departmentId: 10 };
      }
      return null;
    };
    (prisma.doctor as any).findFirst = async (args: any) => {
      if (args?.where?.departmentId === 10 && args?.where?.id === 101) {
        return { id: 101, departmentId: 10 };
      }
      return null;
    };
    (prisma.teachingAssistant as any).findFirst = async (args: any) => {
      if (args?.where?.departmentId === 10 && args?.where?.id === 'ta-101') {
        return { id: 'ta-101', departmentId: 10 };
      }
      return null;
    };

    // 2a. DOCTOR checks
    const doctorUser = {
      id: 1,
      role: 'DOCTOR',
      doctor: { id: 101, departmentId: 10 },
      departmentId: 10,
    };

    // Department mismatch
    const docDeptMismatch = await invokeConflict({
      user: doctorUser,
      body: { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', departmentId: 99 },
    });
    assert.ok(docDeptMismatch.error instanceof AuthorizationError);
    assert.equal(docDeptMismatch.error.statusCode, 403);
    assert.match(docDeptMismatch.error.message, /assigned department/i);

    // Course outside department
    const docCourseMismatch = await invokeConflict({
      user: doctorUser,
      body: { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', courseId: 999 },
    });
    assert.ok(docCourseMismatch.error instanceof AuthorizationError);
    assert.equal(docCourseMismatch.error.statusCode, 403);
    assert.match(docCourseMismatch.error.message, /Course is outside your assigned department/i);

    // Doctor outside department
    const docStaffMismatch = await invokeConflict({
      user: doctorUser,
      body: { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', doctorId: 999 },
    });
    assert.ok(docStaffMismatch.error instanceof AuthorizationError);
    assert.equal(docStaffMismatch.error.statusCode, 403);
    assert.match(docStaffMismatch.error.message, /Doctor is outside your assigned department/i);

    // TA outside department
    const docTaMismatch = await invokeConflict({
      user: doctorUser,
      body: { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', teachingAssistantId: 'ta-999' },
    });
    assert.ok(docTaMismatch.error instanceof AuthorizationError);
    assert.equal(docTaMismatch.error.statusCode, 403);
    assert.match(docTaMismatch.error.message, /Teaching assistant is outside your assigned department/i);

    // 2b. TEACHING_ASSISTANT checks
    const taUser = {
      id: 2,
      role: 'TEACHING_ASSISTANT',
      teachingAssistant: { id: 'ta-101', departmentId: 10 },
      departmentId: 10,
    };

    const taDeptMismatch = await invokeConflict({
      user: taUser,
      body: { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', departmentId: 99 },
    });
    assert.ok(taDeptMismatch.error instanceof AuthorizationError);
    assert.equal(taDeptMismatch.error.statusCode, 403);

    const taCourseMismatch = await invokeConflict({
      user: taUser,
      body: { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', courseId: 999 },
    });
    assert.ok(taCourseMismatch.error instanceof AuthorizationError);
    assert.equal(taCourseMismatch.error.statusCode, 403);

    // 2c. DEPARTMENT_ADMIN checks
    const deptAdminUser = {
      id: 3,
      role: 'DEPARTMENT_ADMIN',
      managedDepartmentId: 10,
      departmentId: 10,
    };

    const deptAdminDeptMismatch = await invokeConflict({
      user: deptAdminUser,
      body: { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', departmentId: 99 },
    });
    assert.ok(deptAdminDeptMismatch.error instanceof AuthorizationError);
    assert.equal(deptAdminDeptMismatch.error.statusCode, 403);

    const deptAdminCourseMismatch = await invokeConflict({
      user: deptAdminUser,
      body: { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', courseId: 999 },
    });
    assert.ok(deptAdminCourseMismatch.error instanceof AuthorizationError);
    assert.equal(deptAdminCourseMismatch.error.statusCode, 403);
  });

  it('3. DOCTOR/TEACHING_ASSISTANT/DEPARTMENT_ADMIN checking conflicts within own department succeeds normally', async () => {
    (prisma.course as any).findFirst = async (args: any) => {
      if (args?.where?.departmentId === 10 && args?.where?.id === 101) {
        return { id: 101, departmentId: 10 };
      }
      return null;
    };
    (prisma.doctor as any).findFirst = async (args: any) => {
      if (args?.where?.departmentId === 10 && args?.where?.id === 101) {
        return { id: 101, departmentId: 10 };
      }
      return null;
    };
    (prisma.teachingAssistant as any).findFirst = async (args: any) => {
      if (args?.where?.departmentId === 10 && args?.where?.id === 'ta-101') {
        return { id: 'ta-101', departmentId: 10 };
      }
      return null;
    };

    // 3a. DOCTOR checking within own department
    const docRes = await invokeConflict({
      user: {
        id: 1,
        role: 'DOCTOR',
        doctor: { id: 101, departmentId: 10 },
        departmentId: 10,
      },
      body: {
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '10:00',
        departmentId: 10,
        courseId: 101,
        doctorId: 101,
      },
    });
    assert.equal(docRes.error, undefined);
    assert.equal(docRes.statusCode, 200);
    assert.equal(docRes.body?.success, true);
    assert.equal(docRes.body?.hasConflict, false);

    // 3b. TEACHING_ASSISTANT checking within own department
    const taRes = await invokeConflict({
      user: {
        id: 2,
        role: 'TEACHING_ASSISTANT',
        teachingAssistant: { id: 'ta-101', departmentId: 10 },
        departmentId: 10,
      },
      body: {
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '10:00',
        departmentId: 10,
        courseId: 101,
        teachingAssistantId: 'ta-101',
      },
    });
    assert.equal(taRes.error, undefined);
    assert.equal(taRes.statusCode, 200);
    assert.equal(taRes.body?.success, true);

    // 3c. DEPARTMENT_ADMIN checking within own department
    const deptAdminRes = await invokeConflict({
      user: {
        id: 3,
        role: 'DEPARTMENT_ADMIN',
        managedDepartmentId: 10,
        departmentId: 10,
      },
      body: {
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '10:00',
        departmentId: 10,
        courseId: 101,
      },
    });
    assert.equal(deptAdminRes.error, undefined);
    assert.equal(deptAdminRes.statusCode, 200);
    assert.equal(deptAdminRes.body?.success, true);
  });

  it('4. COLLEGE_ADMIN supplying department outside managed college is rejected with 403; one inside college works', async () => {
    const collegeAdmin = {
      id: 4,
      role: 'COLLEGE_ADMIN',
      managedCollegeId: 7,
      collegeId: 7,
    };

    (prisma.department as any).findFirst = async (args: any) => {
      if (args?.where?.collegeId === 7 && args?.where?.id === 70) {
        return { id: 70, collegeId: 7 };
      }
      return null;
    };
    (prisma.course as any).findFirst = async (args: any) => {
      if (args?.where?.department?.collegeId === 7 && args?.where?.id === 701) {
        return { id: 701, departmentId: 70 };
      }
      return null;
    };
    (prisma.doctor as any).findFirst = async (args: any) => {
      if (args?.where?.department?.collegeId === 7 && args?.where?.id === 701) {
        return { id: 701, departmentId: 70 };
      }
      return null;
    };

    // 4a. Outside managed college department
    const outDeptRes = await invokeConflict({
      user: collegeAdmin,
      body: { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', departmentId: 99 },
    });
    assert.ok(outDeptRes.error instanceof AuthorizationError);
    assert.equal(outDeptRes.error.statusCode, 403);
    assert.match(outDeptRes.error.message, /Department is outside your managed scope/i);

    // 4b. Outside managed college course
    const outCourseRes = await invokeConflict({
      user: collegeAdmin,
      body: { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', courseId: 999 },
    });
    assert.ok(outCourseRes.error instanceof AuthorizationError);
    assert.equal(outCourseRes.error.statusCode, 403);
    assert.match(outCourseRes.error.message, /Course is outside your managed scope/i);

    // 4c. Outside managed college doctor
    const outDoctorRes = await invokeConflict({
      user: collegeAdmin,
      body: { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', doctorId: 999 },
    });
    assert.ok(outDoctorRes.error instanceof AuthorizationError);
    assert.equal(outDoctorRes.error.statusCode, 403);
    assert.match(outDoctorRes.error.message, /Doctor is outside your managed scope/i);

    // 4d. Inside managed college works normally
    const inCollegeRes = await invokeConflict({
      user: collegeAdmin,
      body: {
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '10:00',
        departmentId: 70,
        courseId: 701,
        doctorId: 701,
      },
    });
    assert.equal(inCollegeRes.error, undefined);
    assert.equal(inCollegeRes.statusCode, 200);
    assert.equal(inCollegeRes.body?.success, true);
    assert.equal(inCollegeRes.body?.hasConflict, false);
  });

  it('5. SUPER_ADMIN can check conflicts across any department (unrestricted, as intended)', async () => {
    const superAdmin = {
      id: 999,
      role: 'SUPER_ADMIN',
    };

    (prisma.course as any).findUnique = async (args: any) => {
      return { id: args?.where?.id, departmentId: 99 };
    };

    const res = await invokeConflict({
      user: superAdmin,
      body: {
        dayOfWeek: 'TUESDAY',
        startTime: '10:00',
        endTime: '12:00',
        departmentId: 99,
        courseId: 999,
      },
    });

    assert.equal(res.error, undefined, 'SUPER_ADMIN must never be blocked by scope');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.success, true);
    assert.equal(res.body?.hasConflict, false);
  });
});
