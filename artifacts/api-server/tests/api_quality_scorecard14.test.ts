import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

let yaml: any;
try {
  yaml = require('js-yaml');
} catch {
  yaml = require('../../../node_modules/.pnpm/js-yaml@4.3.2/node_modules/js-yaml');
}

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'api-quality-scorecard-14-secret-2026';

const [{ default: app }, { default: prisma }, { generateAccessToken }] =
  await Promise.all([
    import('../src/app'),
    import('../src/utils/prismaClient'),
    import('../src/utils/jwt.utils'),
  ]);

describe('API Quality (Scorecard #14) - Contract & Error Envelope Suite', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true, tokenVersion: true },
  });
  assert.ok(superAdmin, 'SUPER_ADMIN must exist in database');
  const adminToken = generateAccessToken(superAdmin.id, superAdmin.tokenVersion);

  const collegeAdmin = await prisma.user.findFirst({
    where: { role: 'COLLEGE_ADMIN' },
    select: { id: true, tokenVersion: true, managedCollegeId: true },
  });
  const collegeAdminToken = collegeAdmin ? generateAccessToken(collegeAdmin.id, collegeAdmin.tokenVersion) : null;

  const deptAdmin = await prisma.user.findFirst({
    where: { role: 'DEPARTMENT_ADMIN' },
    select: { id: true, tokenVersion: true, managedDepartmentId: true },
  });
  const deptAdminToken = deptAdmin ? generateAccessToken(deptAdmin.id, deptAdmin.tokenVersion) : null;

  const studentUser = await prisma.user.findFirst({
    where: { role: 'STUDENT', student: { isNot: null } },
    select: { id: true, tokenVersion: true, student: { select: { id: true } } },
  });
  assert.ok(studentUser, 'STUDENT must exist in database');
  const studentToken = generateAccessToken(studentUser.id, studentUser.tokenVersion);

  test('401 unauthenticated request returns standard error envelope with errorId and X-Error-Id header', async () => {
    const res = await fetch(`${baseUrl}/auth/me`);
    assert.equal(res.status, 401, 'Must return HTTP 401');
    const headerErrorId = res.headers.get('x-error-id');
    assert.ok(headerErrorId, 'Must include X-Error-Id response header');

    const body = await res.json() as any;
    assert.equal(body.success, false);
    assert.equal(body.status, 'fail');
    assert.equal(body.message, 'Access denied. No security token provided.');
    assert.ok(body.errorId, 'Response body must include errorId');
    assert.equal(body.errorId, headerErrorId, 'Body errorId must match X-Error-Id header');
  });

  test('403 forbidden role request returns standard error envelope with errorId and X-Error-Id header', async () => {
    // Student attempting to access admin-only registration requests
    const res = await fetch(`${baseUrl}/auth/requests`, {
      headers: {
        authorization: `Bearer ${studentToken}`,
      },
    });
    assert.equal(res.status, 403, 'Must return HTTP 403');
    const headerErrorId = res.headers.get('x-error-id');
    assert.ok(headerErrorId, 'Must include X-Error-Id response header');

    const body = await res.json() as any;
    assert.equal(body.success, false);
    assert.equal(body.status, 'fail');
    assert.match(body.message, /Forbidden: Your role/i);
    assert.ok(body.errorId, 'Response body must include errorId');
    assert.equal(body.errorId, headerErrorId, 'Body errorId must match X-Error-Id header');
  });

  test('422 route validation error returns standard error envelope with errorId and X-Error-Id header', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 422, 'Must return HTTP 422');
    const headerErrorId = res.headers.get('x-error-id');
    assert.ok(headerErrorId, 'Must include X-Error-Id response header');

    const body = await res.json() as any;
    assert.equal(body.success, false);
    assert.equal(body.status, 'fail');
    assert.ok(body.errorId, 'Response body must include errorId');
    assert.ok(Array.isArray(body.errors), 'Response body must include validation errors array');
  });

  test('user list handles empty string role filter (?role=) by returning all active users without empty-set collapse', async () => {
    const resAll = await fetch(`${baseUrl}/users?limit=10`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resAll.status, 200);
    const bodyAll = await resAll.json() as any;

    const resEmpty = await fetch(`${baseUrl}/users?role=&limit=10`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resEmpty.status, 200);
    const bodyEmpty = await resEmpty.json() as any;

    assert.equal(bodyEmpty.pagination.total, bodyAll.pagination.total, '?role= must not collapse to zero users');
  });

  test('departments query param collegeId enforces empty string, invalid, and positive matrix', async () => {
    // 1. Empty string -> 200 (ignored)
    const resEmpty = await fetch(`${baseUrl}/departments?collegeId=`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resEmpty.status, 200);

    // 2. Non-numeric -> 422
    const resInvalid = await fetch(`${baseUrl}/departments?collegeId=abc`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resInvalid.status, 422);

    // 3. Valid positive integer -> 200
    const resValid = await fetch(`${baseUrl}/departments?collegeId=1`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resValid.status, 200);
  });

  test('doctors query params collegeId & departmentId enforce empty string and invalid matrix', async () => {
    // Empty strings -> 200
    const resEmpty = await fetch(`${baseUrl}/doctors?collegeId=&departmentId=`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resEmpty.status, 200);

    // Invalid collegeId -> 422
    const resInvalidCollege = await fetch(`${baseUrl}/doctors?collegeId=abc`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resInvalidCollege.status, 422);

    // Invalid departmentId -> 422
    const resInvalidDept = await fetch(`${baseUrl}/doctors?departmentId=abc`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resInvalidDept.status, 422);
  });

  test('enrollments query params enforce empty string, invalid, and positive matrix', async () => {
    // Empty strings -> 200
    const resEmpty = await fetch(`${baseUrl}/enrollments?studentId=&courseId=&semester=`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resEmpty.status, 200);

    // Invalid studentId -> 422
    const resInvalidStudent = await fetch(`${baseUrl}/enrollments?studentId=abc`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resInvalidStudent.status, 422);

    // Invalid courseId -> 422
    const resInvalidCourse = await fetch(`${baseUrl}/enrollments?courseId=abc`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resInvalidCourse.status, 422);

    // Invalid semester -> 422
    const resInvalidSem = await fetch(`${baseUrl}/enrollments?semester=abc`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resInvalidSem.status, 422);
  });

  test('timetables query params enforce empty string and invalid matrix', async () => {
    // Empty strings -> 200
    const resEmpty = await fetch(`${baseUrl}/timetable?collegeId=&departmentId=&academicYear=&semester=`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resEmpty.status, 200);

    // Invalid collegeId -> 422
    const resInvalid = await fetch(`${baseUrl}/timetable?collegeId=abc`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resInvalid.status, 422);
  });

  test('tasks list query params enforce empty string and invalid matrix', async () => {
    // Empty strings -> 200
    const resEmpty = await fetch(`${baseUrl}/tasks?courseId=&year=`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resEmpty.status, 200);

    // Invalid courseId -> 422
    const resInvalidCourse = await fetch(`${baseUrl}/tasks?courseId=abc`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resInvalidCourse.status, 422);

    // Invalid year -> 422
    const resInvalidYear = await fetch(`${baseUrl}/tasks?year=abc`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resInvalidYear.status, 422);
  });

  test('quizzes query param courseId enforces empty string and invalid matrix', async () => {
    const resEmpty = await fetch(`${baseUrl}/quizzes?courseId=`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resEmpty.status, 200);

    const resInvalid = await fetch(`${baseUrl}/quizzes?courseId=abc`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resInvalid.status, 422);
  });

  test('exams list query param courseId enforces empty string, invalid, and positive matrix', async () => {
    const resEmpty = await fetch(`${baseUrl}/exams?courseId=`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resEmpty.status, 200);

    const resInvalid = await fetch(`${baseUrl}/exams?courseId=abc`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resInvalid.status, 422);

    const resValid = await fetch(`${baseUrl}/exams?courseId=1`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resValid.status, 200);
  });

  test('attendance my-attendance query param courseId enforces empty string and invalid matrix', async () => {
    const resEmpty = await fetch(`${baseUrl}/attendance/my-attendance?courseId=`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    assert.equal(resEmpty.status, 200);

    const resInvalid = await fetch(`${baseUrl}/attendance/my-attendance?courseId=abc`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    assert.equal(resInvalid.status, 422);
  });

  test('attendance student attendance query param courseId enforces empty string and invalid matrix', async () => {
    const student = await prisma.student.findFirst({ select: { id: true } });
    if (!student) return;
    const resEmpty = await fetch(`${baseUrl}/attendance/student/${student.id}?courseId=`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resEmpty.status, 200);

    const resInvalid = await fetch(`${baseUrl}/attendance/student/${student.id}?courseId=abc`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resInvalid.status, 422);
  });

  test('users query param role empty string returns in-scope users and preserves college/dept admin scoping', async () => {
    // 1. Super admin with empty role gets all users (not 0)
    const resSuper = await fetch(`${baseUrl}/users?role=`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resSuper.status, 200);
    const bodySuper = await resSuper.json() as any;
    const usersSuper = bodySuper.data?.users || bodySuper.data || [];
    assert.ok(usersSuper.length > 10, 'Super admin with ?role= must see all users, not 0');

    // 2. College admin with empty role gets only users in managed college (scoped)
    if (collegeAdmin && collegeAdminToken) {
      const resCollege = await fetch(`${baseUrl}/users?role=`, {
        headers: { authorization: `Bearer ${collegeAdminToken}` },
      });
      assert.equal(resCollege.status, 200);
      const bodyCollege = await resCollege.json() as any;
      const usersCollege = bodyCollege.data?.users || bodyCollege.data || [];
      assert.ok(usersCollege.length > 0, 'College admin with ?role= must see college users');
      assert.ok(usersCollege.length < usersSuper.length, 'College admin must not see all platform users');
    }

    // 3. Department admin with empty role gets only users in managed department (scoped)
    if (deptAdmin && deptAdminToken) {
      const resDept = await fetch(`${baseUrl}/users?role=`, {
        headers: { authorization: `Bearer ${deptAdminToken}` },
      });
      assert.equal(resDept.status, 200);
      const bodyDept = await resDept.json() as any;
      const usersDept = bodyDept.data?.users || bodyDept.data || [];
      assert.ok(usersDept.length > 0, 'Department admin with ?role= must see dept users');
      assert.ok(usersDept.length < usersSuper.length, 'Department admin must not see all platform users');
    }
  });

  test('OpenAPI spec documents studentGroups routes returning 422 on invalid IDs', () => {
    const openApiPath = path.join(repoRoot, 'lib/api-spec/openapi.yaml');
    const spec: any = yaml.load(fs.readFileSync(openApiPath, 'utf8'));

    // Check student-groups paths in spec
    assert.ok(spec.paths['/student-groups'], 'Must document /student-groups in openapi.yaml');
    assert.ok(spec.paths['/student-groups/groups/{groupId}'], 'Must document /student-groups/groups/{groupId} in openapi.yaml');

    const deleteGroupResponses = spec.paths['/student-groups/groups/{groupId}'].delete.responses;
    assert.ok(deleteGroupResponses['422'], 'deleteGroup must document 422 ValidationError in openapi.yaml');

    const autoDivideResponses = spec.paths['/student-groups/departments/{departmentId}/groups/auto-divide']?.post?.responses;
    assert.ok(autoDivideResponses?.['422'], 'autoDivideStudents must document 422 ValidationError in openapi.yaml');
  });

  test('OpenAPI spec accurately reflects auth register 202 status code and error envelope shape', () => {
    const openApiPath = path.join(repoRoot, 'lib/api-spec/openapi.yaml');
    const spec: any = yaml.load(fs.readFileSync(openApiPath, 'utf8'));

    const registerResponses = spec.paths['/auth/register'].post.responses;
    assert.ok(registerResponses['202'], 'Register endpoint must document 202 Accepted');
    assert.ok(registerResponses['422'], 'Register endpoint must document 422 ValidationError');

    const apiError = spec.components?.schemas?.ApiErrorResponse;
    assert.ok(apiError.properties?.errorId, 'ApiErrorResponse must document errorId property');
    assert.ok(apiError.properties?.status, 'ApiErrorResponse must document status property');
  });

  test('OpenAPI spec documents 400 Bad Request on priority operations', () => {
    const openApiPath = path.join(repoRoot, 'lib/api-spec/openapi.yaml');
    const spec: any = yaml.load(fs.readFileSync(openApiPath, 'utf8'));

    const registerResponses = spec.paths['/auth/register']?.post?.responses;
    assert.ok(registerResponses?.['400'], 'POST /auth/register must document 400 response in openapi.yaml');

    const autoDivideResponses = spec.paths['/student-groups/departments/{departmentId}/groups/auto-divide']?.post?.responses;
    assert.ok(autoDivideResponses?.['400'], 'POST /student-groups/departments/{departmentId}/groups/auto-divide must document 400 response in openapi.yaml');

    const splitResponses = spec.paths['/student-groups/groups/{groupId}/split']?.post?.responses;
    assert.ok(splitResponses?.['400'], 'POST /student-groups/groups/{groupId}/split must document 400 response in openapi.yaml');
  });

  test('register with non-numeric departmentId returns 400 and body has success=false, message and errorId', async () => {
    const failingValues = ['not-a-number', '12abc', 1.5, '1.5', ''];
    for (const invalidDept of failingValues) {
      const runSuffix = `scorecard14_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const email = `reg400_${runSuffix}@example.com`;
      const studentId = `S400_${runSuffix}`;
      try {
        const res = await fetch(`${baseUrl}/auth/register`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email,
            password: 'Password123!',
            firstName: 'Register',
            lastName: 'Tester',
            role: 'STUDENT',
            studentId,
            year: 1,
            departmentId: invalidDept,
          }),
        });
        assert.equal(res.status, 400, `departmentId ${JSON.stringify(invalidDept)} must return HTTP 400`);
        const body = (await res.json()) as any;
        assert.equal(body.success, false, 'Body must have success=false');
        assert.ok(body.message, 'Body must have message');
        assert.ok(body.errorId, 'Body must have errorId');
      } finally {
        await prisma.registrationRequest.deleteMany({ where: { email } });
        await prisma.user.deleteMany({ where: { email } });
      }
    }
  });

  test('auto-divide with both or neither of numberOfGroups/maxGroupSize returns 400 with success=false', async () => {
    const runSuffix = `scorecard14_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let college: any;
    let department: any;
    try {
      college = await prisma.college.create({
        data: { name: `College_${runSuffix}` },
      });
      department = await prisma.department.create({
        data: { name: `Dept_${runSuffix}`, collegeId: college.id },
      });

      // 1. Both provided -> 400 with success=false
      const resBoth = await fetch(`${baseUrl}/student-groups/departments/${department.id}/groups/auto-divide`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ numberOfGroups: 2, maxGroupSize: 10 }),
      });
      assert.equal(resBoth.status, 400, 'Must return HTTP 400 when both parameters provided');
      const bodyBoth = (await resBoth.json()) as any;
      assert.equal(bodyBoth.success, false, 'Body must have success=false when both parameters provided');
      assert.ok(bodyBoth.message, 'Body must have message');

      // 2. Neither provided -> 400 with success=false
      const resNeither = await fetch(`${baseUrl}/student-groups/departments/${department.id}/groups/auto-divide`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({}),
      });
      assert.equal(resNeither.status, 400, 'Must return HTTP 400 when neither parameter provided');
      const bodyNeither = (await resNeither.json()) as any;
      assert.equal(bodyNeither.success, false, 'Body must have success=false when neither parameter provided');
      assert.ok(bodyNeither.message, 'Body must have message');
    } finally {
      if (department) {
        await prisma.department.deleteMany({ where: { id: department.id } });
      }
      if (college) {
        await prisma.college.deleteMany({ where: { id: college.id } });
      }
    }
  });

  test('split with both or neither of numberOfSubgroups/maxSubgroupSize returns 400 with success=false', async () => {
    const runSuffix = `scorecard14_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let college: any;
    let department: any;
    let group: any;
    try {
      college = await prisma.college.create({
        data: { name: `College_${runSuffix}` },
      });
      department = await prisma.department.create({
        data: { name: `Dept_${runSuffix}`, collegeId: college.id },
      });
      group = await prisma.studentGroup.create({
        data: { name: `Group_${runSuffix}`, departmentId: department.id, year: 1 },
      });

      // 1. Both provided -> 400 with success=false
      const resBoth = await fetch(`${baseUrl}/student-groups/groups/${group.id}/split`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ numberOfSubgroups: 2, maxSubgroupSize: 10 }),
      });
      assert.equal(resBoth.status, 400, 'Must return HTTP 400 when both parameters provided');
      const bodyBoth = (await resBoth.json()) as any;
      assert.equal(bodyBoth.success, false, 'Body must have success=false when both parameters provided');
      assert.ok(bodyBoth.message, 'Body must have message');

      // 2. Neither provided -> 400 with success=false
      const resNeither = await fetch(`${baseUrl}/student-groups/groups/${group.id}/split`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({}),
      });
      assert.equal(resNeither.status, 400, 'Must return HTTP 400 when neither parameter provided');
      const bodyNeither = (await resNeither.json()) as any;
      assert.equal(bodyNeither.success, false, 'Body must have success=false when neither parameter provided');
      assert.ok(bodyNeither.message, 'Body must have message');
    } finally {
      if (group) {
        await prisma.studentGroup.deleteMany({ where: { id: group.id } });
      }
      if (department) {
        await prisma.department.deleteMany({ where: { id: department.id } });
      }
      if (college) {
        await prisma.college.deleteMany({ where: { id: college.id } });
      }
    }
  });

  test.after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
