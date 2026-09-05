import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import prisma from '../src/utils/prismaClient';
import auditLog, { sanitizeAuditValue } from '../src/middleware/audit.middleware';

assert.deepEqual(
  sanitizeAuditValue({
    password: 'password-value',
    nested: {
      refresh_token: 'refresh-value',
      tokenVersion: 7,
      safe: 'visible',
    },
    questions: [{ correct: 'A', optionA: 'answer text' }],
    records: [{ secretKey: 'secret-value', status: 'PRESENT' }],
  }),
  {
    password: '[REDACTED]',
    nested: {
      refresh_token: '[REDACTED]',
      tokenVersion: 7,
      safe: 'visible',
    },
    questions: '[REDACTED]',
    records: [{ secretKey: '[REDACTED]', status: 'PRESENT' }],
  }
);

const originalAuditCreate = prisma.auditLog.create;

try {
  let resolveAudit!: (value: unknown) => void;
  let capturedCreate: any;
  let responseBody: any;
  let nextCalled = false;
  (prisma.auditLog as any).create = (args: any) => {
    capturedCreate = args;
    return new Promise((resolve) => {
      resolveAudit = resolve;
    });
  };

  const request: any = {
    method: 'POST',
    baseUrl: '/api/quizzes',
    path: '/41/submit',
    originalUrl: '/api/quizzes/41/submit?token=query-secret',
    body: {
      courseId: 12,
      answers: [{ questionId: 1, answer: 'A' }],
      currentPassword: 'body-secret',
    },
    params: { id: '41' },
    query: { token: 'query-secret' },
    user: { id: 7, email: 'actor@example.test', role: 'STUDENT' },
    ip: '127.0.0.1',
    get: (header: string) => (header === 'User-Agent' ? 'security-test' : undefined),
  };
  const response: any = {
    statusCode: 201,
    json(data: any) {
      responseBody = data;
      return this;
    },
  };

  await (auditLog('QUIZ_MUTATION', 'Quiz') as any)(request, response, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);

  const successPayload = {
    success: true,
    data: { id: 91, score: 100, answers: { 1: 'A' } },
  };
  response.json(successPayload);
  assert.equal(
    responseBody,
    undefined,
    'Successful mutation responses must wait until the database accepts the audit event'
  );

  assert.equal(capturedCreate.data.action, 'QUIZ_MUTATION');
  assert.equal(capturedCreate.data.entity, 'Quiz');
  assert.equal(capturedCreate.data.entityId, '41');
  assert.equal(capturedCreate.data.userId, 7);
  assert.equal(capturedCreate.data.details.path, '/api/quizzes/41/submit');
  assert.equal(capturedCreate.data.details.body.currentPassword, '[REDACTED]');
  assert.equal(capturedCreate.data.details.body.answers, '[REDACTED]');
  assert.equal(capturedCreate.data.details.query.token, '[REDACTED]');
  assert.deepEqual(capturedCreate.data.details.outcome, {
    success: true,
    resourceId: '91',
  });
  const serializedAudit = JSON.stringify(capturedCreate);
  assert.doesNotMatch(serializedAudit, /body-secret|query-secret|"answer":"A"/);
  assert.doesNotMatch(serializedAudit, /originalUrl/);

  resolveAudit({ id: 1 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(responseBody, successPayload);

  let auditCalls = 0;
  (prisma.auditLog as any).create = async () => {
    auditCalls += 1;
    return { id: 2 };
  };

  for (const [method, statusCode] of [
    ['GET', 200],
    ['POST', 403],
    ['PATCH', 500],
  ] as const) {
    let sent = false;
    const noAuditRequest: any = {
      ...request,
      method,
    };
    const noAuditResponse: any = {
      statusCode,
      json() {
        sent = true;
        return this;
      },
    };
    await (auditLog('COURSE_MUTATION', 'Course') as any)(
      noAuditRequest,
      noAuditResponse,
      () => undefined
    );
    noAuditResponse.json({ success: false });
    assert.equal(sent, true);
  }
  assert.equal(auditCalls, 0, 'GET and failed mutation responses must not create audit events');
} finally {
  (prisma.auditLog as any).create = originalAuditCreate;
}

const appSource = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
for (const [route, action, entity] of [
  ['/api/courses', 'COURSE_MUTATION', 'Course'],
  ['/api/enrollments', 'ENROLLMENT_MUTATION', 'Enrollment'],
  ['/api/quizzes', 'QUIZ_MUTATION', 'Quiz'],
  ['/api/attendance', 'ATTENDANCE_MUTATION', 'Attendance'],
  ['/api/schedules', 'SCHEDULE_MUTATION', 'ScheduleSlot'],
]) {
  assert.ok(
    appSource.includes(`app.use('${route}', auditLog('${action}', '${entity}'));`),
    `${route} must be covered by the centralized audit middleware`
  );
}

console.log('Redacting durable mutation audit middleware security checks passed');
