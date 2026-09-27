import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../src/utils/prismaClient';
import { auditLog, SYSTEM_AUDIT_ACTORS } from '../src/utils/audit.utils';
import { updateRoomCoordinates } from '../src/controllers/room.controller';
import { TaskService } from '../src/services/task.service';
import { updateGrade as updateEnrollmentGrade } from '../src/controllers/enrollment.controller';

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
  const originals = {
    findUnique: prisma.enrollment.findUnique,
    findFirst: prisma.enrollment.findFirst,
    transaction: prisma.$transaction,
  };
  let write: any;
  try {
    (prisma.enrollment.findUnique as any) = async () => ({
      id: 50,
      status: 'ENROLLED',
      finalGrade: 55,
    });
    (prisma.enrollment.findFirst as any) = async () => ({
      id: 50,
      status: 'ENROLLED',
      finalGrade: 55,
    });
    (prisma as any).$transaction = async (callback: any) => callback({
      enrollment: {
        updateMany: async () => ({ count: 1 }),
        findUnique: async () => ({ id: 50, status: 'COMPLETED', finalGrade: 75 }),
      },
      auditLog: {
        create: async ({ data }: any) => {
          write = data;
          return { id: 1 };
        },
      },
    });
    const result = await invoke(updateEnrollmentGrade, {
      params: { id: '50' },
      body: { finalGrade: 75 },
      user: { id: 1, email: 'admin@example.com', role: 'SUPER_ADMIN' },
    });
    assert.equal(result.body?.success, true);
    assert.deepEqual(write.details.finalGrade, { from: 55, to: 75 });
  } finally {
    prisma.enrollment.findUnique = originals.findUnique;
    prisma.enrollment.findFirst = originals.findFirst;
    prisma.$transaction = originals.transaction;
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
