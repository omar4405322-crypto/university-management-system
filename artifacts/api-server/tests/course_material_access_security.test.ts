import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import {
  canUserManageCourseMaterials,
  requireCourseMaterialManager,
  uploadCourseMaterial,
} from '../src/controllers/courses.controller';
import coursesRouter from '../src/routes/courses.routes';
import { AuthorizationError } from '../src/utils/appError';

async function captureMiddlewareError(middleware: any, request: Record<string, unknown>) {
  return new Promise<unknown>((resolve, reject) => {
    middleware(
      request,
      { status: () => ({ json: () => reject(new Error('Expected access denial')) }) },
      (error?: unknown) => resolve(error)
    );
  });
}

async function runCourseMaterialAccessSecurityTests() {
  const originalCourseFindFirst = prisma.course.findFirst;
  const originalCourseFindUnique = prisma.course.findUnique;
  const originalSlotFindFirst = prisma.scheduleSlot.findFirst;
  let capturedWhere: unknown;
  let courseExists = false;
  let slotExists = false;

  try {
    (prisma.course as any).findFirst = async (args: any) => {
      capturedWhere = args.where;
      return courseExists ? { id: 10 } : null;
    };
    (prisma.scheduleSlot as any).findFirst = async (args: any) => {
      capturedWhere = args.where;
      return slotExists ? { id: 20 } : null;
    };
    (prisma.course as any).findUnique = async () => ({ id: 10 });

    assert.equal(await canUserManageCourseMaterials({ role: 'SUPER_ADMIN' }, 10), true);
    assert.equal(await canUserManageCourseMaterials({ role: 'STUDENT' }, 10), false);
    assert.equal(await canUserManageCourseMaterials({ role: 'UNKNOWN' }, 10), false);
    assert.equal(await canUserManageCourseMaterials({ role: 'SUPER_ADMIN' }, Number.NaN), false);

    courseExists = false;
    assert.equal(
      await canUserManageCourseMaterials(
        { role: 'COLLEGE_ADMIN', managedCollegeId: 4 },
        10
      ),
      false
    );
    assert.deepEqual(capturedWhere, {
      AND: [{ id: 10 }, { department: { collegeId: 4 } }],
    });

    courseExists = true;
    assert.equal(
      await canUserManageCourseMaterials(
        { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
        10
      ),
      true
    );
    assert.deepEqual(capturedWhere, { AND: [{ id: 10 }, { departmentId: 7 }] });

    courseExists = false;
    assert.equal(
      await canUserManageCourseMaterials(
        { role: 'COLLEGE_ADMIN', collegeId: 4, managedCollegeId: null },
        10
      ),
      false,
      'An unconfigured college admin must fail closed'
    );

    slotExists = false;
    assert.equal(
      await canUserManageCourseMaterials(
        { role: 'DOCTOR', departmentId: 7, doctor: { id: 12 } },
        10
      ),
      false,
      'Department membership must not substitute for a real doctor assignment'
    );
    assert.deepEqual(capturedWhere, { courseId: 10, doctorId: 12 });

    slotExists = true;
    assert.equal(
      await canUserManageCourseMaterials({ role: 'DOCTOR', doctor: { id: 12 } }, 10),
      true
    );

    slotExists = false;
    assert.equal(
      await canUserManageCourseMaterials(
        { role: 'TEACHING_ASSISTANT', teachingAssistant: { id: 15, departmentId: 7 } },
        10
      ),
      false,
      'TA department membership must not substitute for a real assignment'
    );
    assert.deepEqual(capturedWhere, { courseId: 10, teachingAssistantId: 15 });

    slotExists = true;
    assert.equal(
      await canUserManageCourseMaterials(
        { role: 'TEACHING_ASSISTANT', teachingAssistant: { id: 15 } },
        10
      ),
      true
    );

    slotExists = false;
    const preUploadError = await captureMiddlewareError(requireCourseMaterialManager, {
      params: { id: '10' },
      user: { role: 'DOCTOR', doctor: { id: 12 } },
    });
    assert.ok(preUploadError instanceof AuthorizationError);

    const uploadRoute = (coursesRouter as any).stack.find(
      (layer: any) => layer.route?.path === '/:id/materials' && layer.route?.methods?.post
    );
    const routeHandlers = uploadRoute.route.stack.map((layer: any) => layer.handle);
    assert.equal(
      routeHandlers.indexOf(requireCourseMaterialManager),
      routeHandlers.indexOf(uploadCourseMaterial) - 2,
      'Course authorization must run immediately before the upload parser and controller'
    );
  } finally {
    (prisma.course as any).findFirst = originalCourseFindFirst;
    (prisma.course as any).findUnique = originalCourseFindUnique;
    (prisma.scheduleSlot as any).findFirst = originalSlotFindFirst;
  }
}

await runCourseMaterialAccessSecurityTests();
console.log('Course material access security checks passed');
