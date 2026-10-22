import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../src/utils/prismaClient';
import { auditLog, SYSTEM_AUDIT_ACTORS } from '../src/utils/audit.utils';
import { updateRoomCoordinates } from '../src/controllers/room.controller';
import { TaskService } from '../src/services/task.service';
import { updateGrade as updateEnrollmentGrade } from '../src/controllers/enrollment.controller';
import { publishGradebook } from '../src/services/gradebookPublish.service';
import { correctGradebook } from '../src/services/gradebookCorrection.service';

function invoke(handler: any, req: any): Promise<{ body?: any; error?: any }> {
  return new Promise((resolve) => {
    handler(
      req,
      { json: (body: any) => resolve({ body }) },
      (error: any) => resolve({ error })
    );
  });
}

async function helperIsDurableAndRedactsSecrets() {
  const originalCreate = prisma.auditLog.create;
  const writes: any[] = [];
  try {
    (prisma.auditLog.create as any) = async ({ data }: any) => {
      writes.push(data);
      return { id: 1 };
    };
    await auditLog(
      'ENABLE_2FA',
      'User',
      7,
      { user: { id: 7, email: 'actor@example.com', role: 'STUDENT' } },
      { password: 'never-log-me', twoFactorSecret: 'never-log-me', changed: true }
    );
    assert.equal(writes.length, 1);
    assert.equal(writes[0].details.password, '[REDACTED]');
    assert.equal(writes[0].details.twoFactorSecret, '[REDACTED]');

    (prisma.auditLog.create as any) = async () => {
      throw new Error('simulated audit persistence failure');
    };
    await auditLog('UPDATE_PROFILE', 'User', 7, { user: { id: 7 } });

    const transactionalClient = {
      auditLog: {
        create: async () => {
          throw new Error('simulated transactional audit persistence failure');
        },
      },
    };
    await assert.rejects(
      auditLog(
        'UPDATE_PROFILE',
        'User',
        7,
        { user: { id: 7 } },
        undefined,
        transactionalClient
      ),
      /simulated transactional audit persistence failure/
    );
  } finally {
    prisma.auditLog.create = originalCreate;
  }
}

async function auditFailureRollsBackTransactionalMutation() {
  const originalFindFirst = prisma.room.findFirst;
  const originalTransaction = prisma.$transaction;
  const stored = { latitude: 30, longitude: 31 };
  try {
    (prisma.room.findFirst as any) = async () => ({ id: 4, ...stored });
    (prisma as any).$transaction = async (callback: any) => {
      const staged = { ...stored };
      try {
        const result = await callback({
          room: {
            updateMany: async ({ data }: any) => {
              Object.assign(staged, data);
              return { count: 1 };
            },
            findUnique: async () => ({ id: 4, ...staged }),
          },
          auditLog: {
            create: async () => {
              throw new Error('audit unavailable');
            },
          },
        });
        Object.assign(stored, staged);
        return result;
      } catch (error) {
        throw error;
      }
    };

    const result = await invoke(updateRoomCoordinates, {
      params: { id: '4' },
      body: { latitude: 32, longitude: 33 },
      user: { id: 1, email: 'admin@example.com', role: 'SUPER_ADMIN' },
    });
    assert.match(result.error?.message, /audit unavailable/);
    assert.deepEqual(stored, { latitude: 30, longitude: 31 });
  } finally {
    prisma.room.findFirst = originalFindFirst;
    prisma.$transaction = originalTransaction;
  }
}

async function taskGradeWritesOneAccurateAuditEvent() {
  const originalTransaction = prisma.$transaction;
  const writes: any[] = [];
  try {
    (prisma as any).$transaction = async (callback: any) => callback({
      taskSubmission: {
        findUnique: async ({ where }: any) => where.id === 70
          ? {
              id: 70,
              taskId: 60,
              studentId: 80,
              submittedAt: new Date('2026-09-08T09:00:00.000Z'),
              score: 40,
              feedback: null,
              task: {
                id: 60,
                doctorId: 90,
                isDeleted: false,
                maxScore: 100,
                course: { departmentId: 2, department: { collegeId: 1 } },
              },
            }
          : null,
        updateMany: async () => ({ count: 1 }),
      },
      auditLog: {
        create: async ({ data }: any) => {
          writes.push(data);
          return { id: 1 };
        },
      },
    });
    await TaskService.gradeSubmission(
      { id: 1, email: 'admin@example.com', role: 'SUPER_ADMIN' },
      60,
      70,
      75,
      undefined,
      '2026-09-08T09:00:00.000Z'
    );
    assert.equal(writes.length, 1);
    assert.equal(writes[0].action, 'UPDATE_GRADE');
    assert.deepEqual(writes[0].details.score, { from: 40, to: 75 });
  } finally {
    prisma.$transaction = originalTransaction;
  }
}

async function enrollmentGradeRecordsActualPreviousValue() {
  const result = await invoke(updateEnrollmentGrade, {
    params: { id: '50' },
    body: { finalGrade: 75 },
    user: { id: 1, email: 'admin@example.com', role: 'SUPER_ADMIN' },
  });
  // S7 Single writer: updateGrade is discontinued and returns 409 Conflict pointing to gradebook
  assert.equal(result.error?.statusCode, 409);
  assert.match(result.error?.message, /gradebook publish service/i);

  const originalCourseFindUnique = prisma.course.findUnique;
  const originalAcademicTermFindUnique = prisma.academicTerm.findUnique;
  const originalScheduleSlotFindFirst = prisma.scheduleSlot.findFirst;
  const originalTransaction = prisma.$transaction;

  const writes: any[] = [];
  const futureEndDate = new Date(Date.now() + 86400000 * 30);

  try {
    (prisma.course.findUnique as any) = async () => ({ id: 101 });
    (prisma.academicTerm.findUnique as any) = async () => ({
      id: 5,
      name: 'Fall 2026',
      isCurrent: true,
      endDate: futureEndDate,
      isActive: true,
    });
    (prisma.scheduleSlot.findFirst as any) = async () => ({ id: 1 });

    (prisma as any).$transaction = async (callback: any) =>
      callback({
        courseGradeStructure: {
          findUnique: async () => ({
            id: 20,
            courseId: 101,
            termId: 5,
            passMark: 60,
            components: [
              { id: 301, name: 'Midterm', maxPoints: 40, source: 'MANUAL', displayOrder: 1 },
              { id: 302, name: 'Final', maxPoints: 60, source: 'MANUAL', displayOrder: 2 },
            ],
          }),
        },
        enrollment: {
          findMany: async () => [
            {
              id: 50,
              studentId: 80,
              courseId: 101,
              termId: 5,
              status: 'FAILED',
              finalPointsEarned: 45,
              finalPointsMax: 100,
              finalGrade: 45,
              gradeEntries: [
                { id: 1001, enrollmentId: 50, componentId: 301, score: 30, isAbsent: false, status: 'DRAFT', version: 1 },
                { id: 1002, enrollmentId: 50, componentId: 302, score: 55, isAbsent: false, status: 'DRAFT', version: 1 },
              ],
            },
          ],
          findFirst: async () => ({ id: 50, status: 'COMPLETED' }),
          findUnique: async () => ({
            id: 50,
            studentId: 80,
            courseId: 101,
            termId: 5,
            status: 'COMPLETED',
            finalPointsEarned: 85,
            finalPointsMax: 100,
            finalGrade: 85,
            gradeEntries: [
              { id: 1001, enrollmentId: 50, componentId: 301, score: 20, isAbsent: false, status: 'PUBLISHED', version: 3 },
              { id: 1002, enrollmentId: 50, componentId: 302, score: 55, isAbsent: false, status: 'PUBLISHED', version: 2 },
            ],
          }),
          update: async ({ data }: any) => ({ id: 50, ...data }),
        },
        courseGradeEntry: {
          findUnique: async () => ({
            id: 1001,
            enrollmentId: 50,
            componentId: 301,
            score: 30,
            isAbsent: false,
            status: 'PUBLISHED',
            version: 2,
          }),
          update: async ({ where, data }: any) => ({
            id: where.id,
            enrollmentId: 50,
            componentId: 301,
            score: data.score ?? 30,
            isAbsent: data.isAbsent ?? false,
            status: data.status ?? 'PUBLISHED',
            version: 3,
          }),
        },
        auditLog: {
          create: async ({ data }: any) => {
            writes.push(data);
            return { id: writes.length };
          },
        },
      });

    const doctorActor = { id: 9, email: 'doc@example.com', role: 'DOCTOR', doctor: { id: 90 } };
    const reqAudit = { user: doctorActor };

    await publishGradebook(101, 5, doctorActor, reqAudit, {});
    assert.equal(writes.length, 1);
    const pubAudit = writes[0];
    assert.equal(pubAudit.action, 'GRADE_PUBLISHED');
    assert.equal(pubAudit.userId, 9);
    assert.equal(pubAudit.actorEmail, 'doc@example.com');
    assert.equal(pubAudit.userRole, 'DOCTOR');
    assert.ok(Array.isArray(pubAudit.details.enrollments), 'GRADE_PUBLISHED must include changed enrollments list');
    assert.equal(pubAudit.details.enrollments.length, 1);
    assert.deepEqual(pubAudit.details.enrollments[0], {
      enrollmentId: 50,
      studentId: 80,
      flippedEntryIds: [1001, 1002],
      before: {
        finalPointsEarned: 45,
        finalPointsMax: 100,
        finalGrade: 45,
        status: 'FAILED',
      },
      after: {
        finalPointsEarned: 85,
        finalPointsMax: 100,
        finalGrade: 85,
        status: 'COMPLETED',
      },
    });

    await correctGradebook(101, 5, doctorActor, reqAudit, {
      corrections: [
        {
          enrollmentId: 50,
          componentId: 301,
          score: 20,
          isAbsent: false,
          version: 2,
          reason: 'Re-evaluated midterm exam paper',
        },
      ],
    });
    assert.equal(writes.length, 2);
    const corrAudit = writes[1];
    assert.equal(corrAudit.action, 'GRADE_CORRECTED');
    assert.equal(corrAudit.userId, 9);
    assert.equal(corrAudit.actorEmail, 'doc@example.com');
    assert.equal(corrAudit.userRole, 'DOCTOR');
    assert.equal(corrAudit.details.entries.length, 1);
    assert.deepEqual(corrAudit.details.entries[0].before, { score: 30, isAbsent: false, version: 2 });
    assert.deepEqual(corrAudit.details.entries[0].after, { score: 20, isAbsent: false, version: 3 });
    assert.equal(corrAudit.details.entries[0].reason, 'Re-evaluated midterm exam paper');
    assert.equal(corrAudit.details.enrollmentTotals.length, 1);
    assert.deepEqual(corrAudit.details.enrollmentTotals[0].before, {
      finalPointsEarned: 85,
      finalPointsMax: 100,
      finalGrade: 85,
      status: 'COMPLETED',
    });
    assert.deepEqual(corrAudit.details.enrollmentTotals[0].after, {
      finalPointsEarned: 75,
      finalPointsMax: 100,
      finalGrade: 75,
      status: 'COMPLETED',
    });
  } finally {
    prisma.course.findUnique = originalCourseFindUnique;
    prisma.academicTerm.findUnique = originalAcademicTermFindUnique;
    prisma.scheduleSlot.findFirst = originalScheduleSlotFindFirst;
    prisma.$transaction = originalTransaction;
  }
}

async function systemActorsAreExplicit() {
  const originalCreate = prisma.auditLog.create;
  let write: any;
  try {
    (prisma.auditLog.create as any) = async ({ data }: any) => {
      write = data;
      return { id: 1 };
    };
    await auditLog(
      'AUTO_RESOLVE_ATTENDANCE',
      'Attendance',
      10,
      { ...SYSTEM_AUDIT_ACTORS.ATTENDANCE_CRON }
    );
    assert.equal(write.actorEmail, 'system:attendance-cron');
    assert.equal(write.userRole, 'SYSTEM');
    assert.equal(write.userId, null);
  } finally {
    prisma.auditLog.create = originalCreate;
  }
}

function everyFinding30LocationHasAnAuditAction() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
  const expected: Record<string, string[]> = {
    'controllers/students.controller.ts': ['CREATE_STUDENT'],
    'controllers/doctors.controller.ts': ['CREATE_DOCTOR', 'UPDATE_DOCTOR'],
    'controllers/teachingAssistants.controller.ts': ['CREATE_TEACHING_ASSISTANT', 'UPDATE_TEACHING_ASSISTANT'],
    'controllers/auth.controller.ts': ['APPROVE_REGISTRATION_REQUEST', 'REJECT_REGISTRATION_REQUEST', 'DELETE_REGISTRATION_REQUEST'],
    'controllers/payments.controller.ts': ['CREATE_PAYMENT', 'DELETE_PAYMENT'],
    'controllers/exams.controller.ts': ['CREATE_EXAM', 'UPDATE_EXAM'],
    'controllers/examQuestions.controller.ts': ['CREATE_EXAM_QUESTION', 'UPDATE_EXAM_QUESTION', 'DELETE_EXAM_QUESTION'],
    'controllers/college.controller.ts': ['CREATE_COLLEGE', 'UPDATE_COLLEGE'],
    'controllers/department.controller.ts': ['CREATE_DEPARTMENT', 'UPDATE_DEPARTMENT', 'DELETE_DEPARTMENT'],
    'controllers/timetable.controller.ts': ['CREATE_TIMETABLE', 'UPDATE_TIMETABLE'],
    'controllers/studentGroups.controller.ts': ['GENERATE_STUDENT_GROUPS', 'SPLIT_STUDENT_GROUP', 'DELETE_STUDENT_GROUP', 'REASSIGN_STUDENT_GROUP'],
    'controllers/room.controller.ts': ['UPDATE_ROOM_COORDINATES'],
    'controllers/user.controller.ts': ['UPDATE_PROFILE', 'UPDATE_PASSWORD', 'ENABLE_2FA'],
    'services/task/taskGrading.service.ts': ['SUBMIT_TASK', 'RESUBMIT_TASK'],
    'utils/cron.ts': ['AUTO_RESOLVE_ATTENDANCE'],
    'attendance/attendance.engine.ts': ['AUTO_BLOCK_ENROLLMENT', 'AUTO_RESTORE_ENROLLMENT'],
  };
  for (const [relativeFile, actions] of Object.entries(expected)) {
    const source = fs.readFileSync(path.join(root, relativeFile), 'utf8');
    for (const action of actions) assert.match(source, new RegExp(`['\"]${action}['\"]`));
  }
}

await helperIsDurableAndRedactsSecrets();
await auditFailureRollsBackTransactionalMutation();
await taskGradeWritesOneAccurateAuditEvent();
await enrollmentGradeRecordsActualPreviousValue();
await systemActorsAreExplicit();
everyFinding30LocationHasAnAuditAction();
console.log('Audit coverage and durability security checks passed');
