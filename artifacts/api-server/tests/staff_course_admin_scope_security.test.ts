import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { assignDoctorCourse, unassignDoctorCourse } from '../src/controllers/doctors.controller';
import {
  assignTACourse,
  unassignTACourse,
} from '../src/controllers/teachingAssistants.controller';
import { AuthorizationError } from '../src/utils/appError';
import { getAdminMutationTargetWhere } from '../src/utils/adminMutationScope.utils';

const DENY_ALL = {
  AND: [{ id: { equals: 0 } }, { id: { not: 0 } }],
};

async function captureControllerError(controller: any, request: Record<string, unknown>) {
  return new Promise<unknown>((resolve, reject) => {
    const response = {
      status: () => response,
      json: () => reject(new Error('Expected the mutation to be rejected')),
    };
    controller(request, response, (error?: unknown) => resolve(error));
  });
}

async function runStaffCourseAdminScopeSecurityTests() {
  assert.deepEqual(
    getAdminMutationTargetWhere(
      { role: 'COLLEGE_ADMIN', managedCollegeId: 4 },
      'doctor',
      12
    ),
    { AND: [{ id: 12 }, { department: { collegeId: 4 } }] }
  );
  assert.deepEqual(
    getAdminMutationTargetWhere(
      { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
      'teachingAssistant',
      'ta-12'
    ),
    { AND: [{ id: 'ta-12' }, { departmentId: 7 }] }
  );
  assert.deepEqual(
    getAdminMutationTargetWhere(
      { role: 'COLLEGE_ADMIN', collegeId: 4, managedCollegeId: null },
      'doctor',
      12
    ),
    { AND: [{ id: 12 }, DENY_ALL] },
    'Profile membership must not substitute for managed admin scope'
  );

  const originalDoctorFindFirst = prisma.doctor.findFirst;
  const originalTeachingAssistantFindFirst = prisma.teachingAssistant.findFirst;
  const originalCourseFindFirst = prisma.course.findFirst;
  const originalScheduleFindFirst = prisma.scheduleSlot.findFirst;
  const originalScheduleUpdate = prisma.scheduleSlot.update;
  const originalScheduleCreate = prisma.scheduleSlot.create;
  const originalScheduleDeleteMany = prisma.scheduleSlot.deleteMany;
  let doctorWhere: unknown;
  let teachingAssistantWhere: unknown;
  let courseWhere: unknown;
  let deleteWhere: unknown;
  let mutationCalled = false;

  try {
    (prisma.doctor as any).findFirst = async (args: any) => {
      doctorWhere = args.where;
      return null;
    };
    (prisma.course as any).findFirst = async (args: any) => {
      courseWhere = args.where;
      return { id: 41 };
    };
    (prisma.scheduleSlot as any).findFirst = async () => null;
    (prisma.scheduleSlot as any).update = async () => {
      mutationCalled = true;
    };
    (prisma.scheduleSlot as any).create = async () => {
      mutationCalled = true;
    };

    const doctorError = await captureControllerError(assignDoctorCourse, {
      params: { id: '12' },
      user: { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
      body: { courseId: 41 },
    });
    assert.ok(doctorError instanceof AuthorizationError);
    assert.deepEqual(doctorWhere, { AND: [{ id: 12 }, { departmentId: 7 }] });
    assert.equal(courseWhere, undefined, 'An out-of-scope staff member must stop the flow');
    assert.equal(mutationCalled, false);

    (prisma.teachingAssistant as any).findFirst = async (args: any) => {
      teachingAssistantWhere = args.where;
      return { id: 'ta-12', firstName: 'Test', lastName: 'TA' };
    };
    (prisma.course as any).findFirst = async (args: any) => {
      courseWhere = args.where;
      return null;
    };

    const taError = await captureControllerError(assignTACourse, {
      params: { id: 'ta-12' },
      user: { role: 'COLLEGE_ADMIN', managedCollegeId: 4 },
      body: { courseId: 41 },
    });
    assert.ok(taError instanceof AuthorizationError);
    assert.deepEqual(teachingAssistantWhere, {
      AND: [{ id: 'ta-12' }, { department: { collegeId: 4 } }],
    });
    assert.deepEqual(courseWhere, {
      AND: [{ id: 41 }, { department: { collegeId: 4 } }],
    });
    assert.equal(mutationCalled, false);

    (prisma.course as any).findFirst = async (args: any) => {
      courseWhere = args.where;
      return { id: 41 };
    };
    (prisma.scheduleSlot as any).deleteMany = async (args: any) => {
      mutationCalled = true;
      deleteWhere = args.where;
      throw new Error('stop-before-audit');
    };

    mutationCalled = false;
    const taMutationError = await captureControllerError(unassignTACourse, {
      params: { id: 'ta-12', courseId: '41' },
      user: { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
      body: {},
    });
    assert.match(String(taMutationError), /stop-before-audit/);
    assert.equal(mutationCalled, true);
    assert.deepEqual(teachingAssistantWhere, {
      AND: [{ id: 'ta-12' }, { departmentId: 7 }],
    });
    assert.deepEqual(courseWhere, { AND: [{ id: 41 }, { departmentId: 7 }] });
    assert.deepEqual(deleteWhere, {
      teachingAssistantId: 'ta-12',
      courseId: 41,
      teachingAssistant: { is: { departmentId: 7 } },
      course: { is: { departmentId: 7 } },
    });

    mutationCalled = false;
    (prisma.doctor as any).findFirst = async (args: any) => {
      doctorWhere = args.where;
      return null;
    };
    const doctorUnassignError = await captureControllerError(unassignDoctorCourse, {
      params: { id: '12', courseId: '41' },
      user: { role: 'COLLEGE_ADMIN', managedCollegeId: 4 },
      body: {},
    });
    assert.ok(doctorUnassignError instanceof AuthorizationError);
    assert.equal(mutationCalled, false);
  } finally {
    (prisma.doctor as any).findFirst = originalDoctorFindFirst;
    (prisma.teachingAssistant as any).findFirst = originalTeachingAssistantFindFirst;
    (prisma.course as any).findFirst = originalCourseFindFirst;
    (prisma.scheduleSlot as any).findFirst = originalScheduleFindFirst;
    (prisma.scheduleSlot as any).update = originalScheduleUpdate;
    (prisma.scheduleSlot as any).create = originalScheduleCreate;
    (prisma.scheduleSlot as any).deleteMany = originalScheduleDeleteMany;
  }
}

await runStaffCourseAdminScopeSecurityTests();
console.log('Staff-course admin scope security checks passed');
