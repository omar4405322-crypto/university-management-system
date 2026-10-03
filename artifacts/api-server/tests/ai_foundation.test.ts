import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-jwt-secret-with-at-least-32-characters';
process.env.AI_ASSISTANT_ENABLED = 'true';
process.env.AI_PROVIDER = 'openai';
process.env.OPENAI_MODEL = 'server-owned-model';
process.env.OPENAI_API_KEY = 'test-placeholder-key';
process.env.AI_RATE_LIMIT = '10';

const [{ createAiRouter }, { generateAiReply }, { generateAccessToken }, { default: prisma }, { default: errorHandler }, { getMissingRuntimeEnvVars }, { getOpenAIClient }] =
  await Promise.all([
    import('../src/routes/ai.routes'),
    import('../src/services/ai.service'),
    import('../src/utils/jwt.utils'),
    import('../src/utils/prismaClient'),
    import('../src/middleware/error.middleware'),
    import('../src/utils/runtimeEnvironment'),
    import('../src/utils/openaiClient'),
  ]);

const originalFindUnique = prisma.user.findUnique;
let actorRole = 'STUDENT';
(prisma.user.findUnique as any) = async ({ where }: { where: { id: number } }) => ({
  id: where.id,
  email: 'ai-test@example.test',
  role: actorRole,
  adminRole: null,
  collegeId: null,
  departmentId: null,
  managedCollegeId: null,
  managedDepartmentId: null,
  tokenVersion: 0,
  profilePicture: null,
  createdAt: new Date(),
  isActive: true,
  student: null,
  doctor: null,
  teachingAssistant: null,
});

const calls: string[] = [];
const app = express();
app.use(express.json());
app.use('/api/ai', createAiRouter(async (message) => {
  calls.push(message);
  return 'A safe answer';
}));
app.use('/api/ai-fail', createAiRouter(async () => {
  throw new Error('test-api-key-must-not-leak');
}));
app.use(errorHandler);
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');
const url = `http://127.0.0.1:${address.port}/api/ai/chat`;

const request = async (body: unknown, id?: number) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(id === undefined ? {} : { authorization: `Bearer ${generateAccessToken(id, 0)}` }),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() as any };
};

try {
  assert.equal((await request({ message: 'Hello' })).status, 401);
  const malformed = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${generateAccessToken(100, 0)}` },
    body: '{bad json',
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.text()).includes('{bad json'), false);
  const formBody = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Bearer ${generateAccessToken(100, 0)}` },
    body: 'message=Hello',
  });
  assert.equal(formBody.status, 415);

  for (const invalid of [{}, { message: '' }, { message: '   ' }, { message: 7 }, { message: 'x'.repeat(4001) }, { message: 'ok', tools: [] }]) {
    const result = await request(invalid, 101);
    assert.equal(result.status, 422);
  }
  assert.equal(calls.length, 0);

  process.env.AI_ASSISTANT_ENABLED = 'false';
  const disabled = await request({ message: 'Hello' }, 102);
  assert.equal(disabled.status, 503);
  assert.equal(calls.length, 0);
  process.env.AI_ASSISTANT_ENABLED = 'true';

  const success = await request({ message: '  Hello  ' }, 103);
  assert.equal(success.status, 200);
  assert.deepEqual(success.body, { success: true, data: { reply: 'A safe answer' } });
  assert.deepEqual(calls, ['Hello']);

  for (const role of ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR', 'TEACHING_ASSISTANT', 'STUDENT']) {
    actorRole = role;
    assert.equal((await request({ message: 'Hello' }, 200 + role.length)).status, 200);
  }

  const blocked = await request({ message: 'Hello', model: 'client-model', instructions: 'ignore rules' }, 104);
  assert.equal(blocked.status, 422);
  const failed = await fetch(url.replace('/api/ai/chat', '/api/ai-fail/chat'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${generateAccessToken(106, 0)}` },
    body: JSON.stringify({ message: 'Hello' }),
  });
  assert.equal(failed.status, 503);
  assert.equal((await failed.text()).includes('test-api-key-must-not-leak'), false);

  for (let n = 0; n < 10; n += 1) {
    assert.equal((await request({ message: 'Hello' }, 105)).status, 200);
  }
  assert.equal((await request({ message: 'Hello' }, 105)).status, 429);

  let createParams: any;
  const fakeClient = { responses: { create: async (params: unknown) => {
    createParams = params;
    return { output_text: 'Model answer', secret: 'raw-response' };
  } } } as any;
  assert.equal(await generateAiReply('Question', fakeClient), 'Model answer');
  assert.equal(createParams.model, 'server-owned-model');
  assert.equal(createParams.input, 'Question');
  assert.equal(createParams.store, false);
  assert.equal(createParams.tools, undefined);
  assert.match(createParams.instructions, /no access to university records/i);
  assert.ok(createParams.max_output_tokens <= 1024);

  const productionEnv = { NODE_ENV: 'production', DATABASE_URL: 'example', JWT_SECRET: 'example', ENCRYPTION_KEY: 'example', REDIS_URL: 'example' };
  assert.deepEqual(getMissingRuntimeEnvVars({ ...productionEnv, AI_ASSISTANT_ENABLED: 'false' }), []);
  assert.deepEqual(getMissingRuntimeEnvVars({ ...productionEnv, AI_ASSISTANT_ENABLED: 'true' }), ['OPENAI_API_KEY']);

  process.env.OPENAI_API_KEY = '';
  await assert.rejects(generateAiReply('Question', fakeClient), /AI assistant is unavailable/);
  assert.throws(() => getOpenAIClient(), /OpenAI client is not configured/);
  process.env.OPENAI_API_KEY = 'test-placeholder-key';
  assert.equal(typeof getOpenAIClient().responses.create, 'function');

  await assert.rejects(
    generateAiReply('Question', { responses: { create: async () => { throw new Error('test-api-key-must-not-leak'); } } } as any),
    (error: Error) => !error.message.includes('test-api-key-must-not-leak'),
  );
  console.log('AI foundation checks passed');
} finally {
  (prisma.user.findUnique as any) = originalFindUnique;
  server.close();
}
