import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ValidationError, AppError } from '../src/utils/appError';
import {
  deleteGroup,
  getAllGroups,
  getGroupsByDepartment,
  autoDivideStudents,
} from '../src/controllers/studentGroups.controller';
import { getAllPayments } from '../src/controllers/payments.controller';
import { getSuggestedDoctors } from '../src/controllers/doctors.controller';
import { getAllCourses, deleteCourseMaterial, toggleMaterialPublication, toggleCoursePublication, downloadCourseMaterial } from '../src/controllers/courses.controller';
import { getAllStudents } from '../src/controllers/students.controller';
import { markAsRead, deleteNotification } from '../src/controllers/notification.controller';
import { getExamQuestions } from '../src/controllers/examQuestions.controller';
import { updateSchedule, deleteSchedule, archiveSchedule, restoreSchedule } from '../src/controllers/schedulesMutation.controller';

function createMockReqRes(options: {
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: Record<string, any>;
  user?: Record<string, any>;
}) {
  let statusCode = 200;
  let jsonBody: any = null;
  let onFinish: (() => void) | null = null;

  const req: any = {
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    user: options.user || { role: 'SUPER_ADMIN', id: 1 },
    headers: {},
  };
  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(body: any) {
      jsonBody = body;
      if (onFinish) onFinish();
      return res;
    },
    setHeader() {},
  };
  return {
    req,
    res,
    getStatus: () => statusCode,
    getBody: () => jsonBody,
    setOnFinish: (cb: () => void) => {
      onFinish = cb;
    },
  };
}

function invokeController(controller: any, req: any, resMock: any): Promise<any> {
  return new Promise((resolve) => {
    let settled = false;
    resMock.setOnFinish(() => {
      if (!settled) {
        settled = true;
        resolve({
          directResponse: true,
          status: resMock.getStatus(),
          body: resMock.getBody(),
        });
      }
    });

    controller(req, resMock.res, (err?: any) => {
      if (!settled) {
        settled = true;
        resolve(err);
      }
    });
  });
}

test('studentGroups.controller: deleteGroup rejects invalid groupId with 422 ValidationError', async () => {
  const mock = createMockReqRes({ params: { groupId: 'not-a-number' } });
  const err = await invokeController(deleteGroup, mock.req, mock);
  assert.ok(err instanceof ValidationError, `Expected ValidationError for invalid groupId, got: ${JSON.stringify(err)}`);
  assert.equal((err as any).statusCode, 422);
});

test('studentGroups.controller: getAllGroups rejects non-numeric departmentId and year with 422 ValidationError', async () => {
  const m1 = createMockReqRes({ query: { departmentId: 'abc' } });
  const err1 = await invokeController(getAllGroups, m1.req, m1);
  assert.ok(err1 instanceof ValidationError, 'Expected ValidationError for non-numeric departmentId');
  assert.equal((err1 as any).statusCode, 422);

  const m2 = createMockReqRes({ query: { year: 'xyz' } });
  const err2 = await invokeController(getAllGroups, m2.req, m2);
  assert.ok(err2 instanceof ValidationError, 'Expected ValidationError for non-numeric year');
  assert.equal((err2 as any).statusCode, 422);
});

test('studentGroups.controller: getGroupsByDepartment rejects non-numeric departmentId and year with 422 ValidationError', async () => {
  const m1 = createMockReqRes({ params: { departmentId: 'abc' } });
  const err1 = await invokeController(getGroupsByDepartment, m1.req, m1);
  assert.ok(err1 instanceof ValidationError, 'Expected ValidationError for non-numeric departmentId');
  assert.equal((err1 as any).statusCode, 422);

  const m2 = createMockReqRes({ params: { departmentId: '1' }, query: { year: 'xyz' } });
  const err2 = await invokeController(getGroupsByDepartment, m2.req, m2);
  assert.ok(err2 instanceof ValidationError, 'Expected ValidationError for non-numeric year');
  assert.equal((err2 as any).statusCode, 422);
});

test('studentGroups.controller: autoDivideStudents rejects non-numeric year with 422 ValidationError', async () => {
  const mock = createMockReqRes({
    params: { departmentId: '1' },
    body: { numberOfGroups: 2, year: 'abc' },
  });
  const err = await invokeController(autoDivideStudents, mock.req, mock);
  assert.ok(err instanceof ValidationError, 'Expected ValidationError for non-numeric year');
  assert.equal((err as any).statusCode, 422);
});

test('payments.controller: getAllPayments rejects non-numeric studentId with 422 ValidationError', async () => {
  const mock = createMockReqRes({ query: { studentId: 'abc' } });
  const err = await invokeController(getAllPayments, mock.req, mock);
  assert.ok(err instanceof ValidationError, 'Expected ValidationError for non-numeric studentId');
  assert.equal((err as any).statusCode, 422);
});

test('doctors.controller: getSuggestedDoctors rejects non-numeric courseId with 422 ValidationError', async () => {
  const mock = createMockReqRes({ query: { courseId: 'abc' } });
  const err = await invokeController(getSuggestedDoctors, mock.req, mock);
  assert.ok(err instanceof ValidationError, 'Expected ValidationError for non-numeric courseId');
  assert.equal((err as any).statusCode, 422);
});

test('courses.controller: getAllCourses rejects non-numeric query filters with 422 ValidationError', async () => {
  const m1 = createMockReqRes({ query: { year: 'invalid' } });
  const err1 = await invokeController(getAllCourses, m1.req, m1);
  assert.ok(err1 instanceof ValidationError, 'Expected ValidationError for non-numeric year');
  assert.equal((err1 as any).statusCode, 422);

  const m2 = createMockReqRes({ query: { semester: 'invalid' } });
  const err2 = await invokeController(getAllCourses, m2.req, m2);
  assert.ok(err2 instanceof ValidationError, 'Expected ValidationError for non-numeric semester');
  assert.equal((err2 as any).statusCode, 422);

  const m3 = createMockReqRes({ query: { collegeId: 'invalid' } });
  const err3 = await invokeController(getAllCourses, m3.req, m3);
  assert.ok(err3 instanceof ValidationError, 'Expected ValidationError for non-numeric collegeId');
  assert.equal((err3 as any).statusCode, 422);

  const m4 = createMockReqRes({ query: { departmentId: 'invalid' } });
  const err4 = await invokeController(getAllCourses, m4.req, m4);
  assert.ok(err4 instanceof ValidationError, 'Expected ValidationError for non-numeric departmentId');
  assert.equal((err4 as any).statusCode, 422);
});

test('students.controller: getAllStudents rejects non-numeric query filters with 422 ValidationError', async () => {
  const m1 = createMockReqRes({ query: { year: 'invalid' } });
  const err1 = await invokeController(getAllStudents, m1.req, m1);
  assert.ok(err1 instanceof ValidationError, 'Expected ValidationError for non-numeric year');
  assert.equal((err1 as any).statusCode, 422);

  const m2 = createMockReqRes({ query: { groupId: 'invalid' } });
  const err2 = await invokeController(getAllStudents, m2.req, m2);
  assert.ok(err2 instanceof ValidationError, 'Expected ValidationError for non-numeric groupId');
  assert.equal((err2 as any).statusCode, 422);

  const m3 = createMockReqRes({ query: { collegeId: 'invalid' } });
  const err3 = await invokeController(getAllStudents, m3.req, m3);
  assert.ok(err3 instanceof ValidationError, 'Expected ValidationError for non-numeric collegeId');
  assert.equal((err3 as any).statusCode, 422);

  const m4 = createMockReqRes({ query: { departmentId: 'invalid' } });
  const err4 = await invokeController(getAllStudents, m4.req, m4);
  assert.ok(err4 instanceof ValidationError, 'Expected ValidationError for non-numeric departmentId');
  assert.equal((err4 as any).statusCode, 422);
});

test('notification.controller: markAsRead and deleteNotification reject non-numeric id with 422 ValidationError', async () => {
  const m1 = createMockReqRes({ params: { id: 'invalid' } });
  const err1 = await invokeController(markAsRead, m1.req, m1);
  assert.ok(err1 instanceof ValidationError, 'Expected ValidationError for non-numeric id in markAsRead');
  assert.equal((err1 as any).statusCode, 422);

  const m2 = createMockReqRes({ params: { id: 'invalid' } });
  const err2 = await invokeController(deleteNotification, m2.req, m2);
  assert.ok(err2 instanceof ValidationError, 'Expected ValidationError for non-numeric id in deleteNotification');
  assert.equal((err2 as any).statusCode, 422);
});

test('courses.controller: material and publication endpoints reject invalid IDs with 422 ValidationError', async () => {
  const m1 = createMockReqRes({ params: { id: 'invalid', materialId: '1' } });
  const err1 = await invokeController(deleteCourseMaterial, m1.req, m1);
  assert.ok(err1 instanceof ValidationError, 'Expected ValidationError for invalid course id in deleteCourseMaterial');
  assert.equal((err1 as any).statusCode, 422);

  const m2 = createMockReqRes({ params: { id: '1', materialId: 'invalid' } });
  const err2 = await invokeController(deleteCourseMaterial, m2.req, m2);
  assert.ok(err2 instanceof ValidationError, 'Expected ValidationError for invalid material id in deleteCourseMaterial');
  assert.equal((err2 as any).statusCode, 422);

  const m3 = createMockReqRes({ params: { id: 'invalid', materialId: '1' } });
  const err3 = await invokeController(toggleMaterialPublication, m3.req, m3);
  assert.ok(err3 instanceof ValidationError, 'Expected ValidationError for invalid course id in toggleMaterialPublication');
  assert.equal((err3 as any).statusCode, 422);

  const m4 = createMockReqRes({ params: { id: 'invalid' } });
  const err4 = await invokeController(toggleCoursePublication, m4.req, m4);
  assert.ok(err4 instanceof ValidationError, 'Expected ValidationError for invalid course id in toggleCoursePublication');
  assert.equal((err4 as any).statusCode, 422);

  const m5 = createMockReqRes({ params: { id: 'invalid', materialId: '1' } });
  const err5 = await invokeController(downloadCourseMaterial, m5.req, m5);
  assert.ok(err5 instanceof ValidationError, 'Expected ValidationError for invalid course id in downloadCourseMaterial');
  assert.equal((err5 as any).statusCode, 422);
});

test('examQuestions.controller: getExamQuestions rejects invalid exam id with 422 ValidationError', async () => {
  const mock = createMockReqRes({ params: { id: 'invalid' } });
  const err = await invokeController(getExamQuestions, mock.req, mock);
  assert.ok(err instanceof ValidationError, 'Expected ValidationError for invalid exam id in getExamQuestions');
  assert.equal((err as any).statusCode, 422);
});

test('schedulesMutation.controller: schedule mutation endpoints reject invalid slotId with 422 ValidationError', async () => {
  const m1 = createMockReqRes({ params: { id: 'invalid' } });
  const err1 = await invokeController(updateSchedule, m1.req, m1);
  assert.ok(err1 instanceof ValidationError, 'Expected ValidationError for invalid id in updateSchedule');
  assert.equal((err1 as any).statusCode, 422);

  const m2 = createMockReqRes({ params: { id: 'invalid' } });
  const err2 = await invokeController(deleteSchedule, m2.req, m2);
  assert.ok(err2 instanceof ValidationError, 'Expected ValidationError for invalid id in deleteSchedule');
  assert.equal((err2 as any).statusCode, 422);

  const m3 = createMockReqRes({ params: { id: 'invalid' } });
  const err3 = await invokeController(archiveSchedule, m3.req, m3);
  assert.ok(err3 instanceof ValidationError, 'Expected ValidationError for invalid id in archiveSchedule');
  assert.equal((err3 as any).statusCode, 422);

  const m4 = createMockReqRes({ params: { id: 'invalid' } });
  const err4 = await invokeController(restoreSchedule, m4.req, m4);
  assert.ok(err4 instanceof ValidationError, 'Expected ValidationError for invalid id in restoreSchedule');
  assert.equal((err4 as any).statusCode, 422);
});

test('optional filters: empty string filters are treated as absent without ValidationError', async () => {
  // courses.controller getAllCourses: collegeId, departmentId, year, semester
  const mCourses = createMockReqRes({
    query: { collegeId: '', departmentId: '', year: '', semester: '' },
  });
  const resCourses = await invokeController(getAllCourses, mCourses.req, mCourses);
  assert.ok(!(resCourses instanceof ValidationError), 'Empty string filters in getAllCourses must not produce ValidationError');

  // studentGroups.controller getAllGroups: departmentId, year
  const mGroups = createMockReqRes({
    query: { departmentId: '', year: '' },
  });
  const resGroups = await invokeController(getAllGroups, mGroups.req, mGroups);
  assert.ok(!(resGroups instanceof ValidationError), 'Empty string filters in getAllGroups must not produce ValidationError');

  // studentGroups.controller getGroupsByDepartment: year query
  const mGroupByDept = createMockReqRes({
    params: { departmentId: '1' },
    query: { year: '' },
  });
  const resGroupByDept = await invokeController(getGroupsByDepartment, mGroupByDept.req, mGroupByDept);
  assert.ok(!(resGroupByDept instanceof ValidationError), 'Empty string year in getGroupsByDepartment must not produce ValidationError');

  // studentGroups.controller autoDivideStudents: body year "" and null default to 1
  const mAuto1 = createMockReqRes({
    params: { departmentId: '1' },
    body: { numberOfGroups: 2, year: '' },
  });
  const resAuto1 = await invokeController(autoDivideStudents, mAuto1.req, mAuto1);
  assert.ok(!(resAuto1 instanceof ValidationError), 'Empty string year in autoDivideStudents must not produce ValidationError');

  const mAuto2 = createMockReqRes({
    params: { departmentId: '1' },
    body: { numberOfGroups: 2, year: null },
  });
  const resAuto2 = await invokeController(autoDivideStudents, mAuto2.req, mAuto2);
  assert.ok(!(resAuto2 instanceof ValidationError), 'Null year in autoDivideStudents must not produce ValidationError');

  // payments.controller getAllPayments: studentId
  const mPayments = createMockReqRes({
    query: { studentId: '' },
  });
  const resPayments = await invokeController(getAllPayments, mPayments.req, mPayments);
  assert.ok(!(resPayments instanceof ValidationError), 'Empty string studentId in getAllPayments must not produce ValidationError');
});

