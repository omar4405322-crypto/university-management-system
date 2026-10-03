import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import type { AuthActor } from '../src/types/auth.types';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'ai-conversations-mock-jwt-secret-very-long';
process.env.AI_ASSISTANT_ENABLED = 'true';
process.env.AI_PROVIDER = 'gemini';
process.env.GEMINI_API_KEY = 'mock-key-do-not-log';
process.env.GEMINI_MODEL = 'gemini-3.8-flash';

// Guard: automated provider calls are strictly mocked. Any real fetch outside 127.0.0.1 fails.
const nativeFetch = globalThis.fetch;
let externalRequests = 0;
globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
  const input = args[0];
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    externalRequests++;
    throw new Error('Real provider requests strictly forbidden in tests');
  }
  return nativeFetch(...args);
};

const [
  { generateAiReply },
  { createAiRouter },
  { generateAccessToken },
  { default: prisma },
  { default: errorHandler },
  { default: logger },
  aiConvService,
] = await Promise.all([
  import('../src/services/ai.service'),
  import('../src/routes/ai.routes'),
  import('../src/utils/jwt.utils'),
  import('../src/utils/prismaClient'),
  import('../src/middleware/error.middleware'),
  import('../src/utils/logger'),
  import('../src/services/aiConversation.service'),
]);

// Actors
const studentA = { id: 9101, email: 'studentA@test.edu', role: 'STUDENT', student: { id: 101 }, tokenVersion: 0, isActive: true } as AuthActor;
const studentB = { id: 9102, email: 'studentB@test.edu', role: 'STUDENT', student: { id: 102 }, tokenVersion: 0, isActive: true } as AuthActor;
const superAdmin = { id: 9103, email: 'superadmin@test.edu', role: 'SUPER_ADMIN', tokenVersion: 0, isActive: true } as AuthActor;

// Ensure users exist in test database for FK constraint
await prisma.user.upsert({
  where: { id: studentA.id },
  update: { email: studentA.email, role: 'STUDENT', isActive: true },
  create: { id: studentA.id, email: studentA.email, password: 'hash', role: 'STUDENT', isActive: true },
});
await prisma.user.upsert({
  where: { id: studentB.id },
  update: { email: studentB.email, role: 'STUDENT', isActive: true },
  create: { id: studentB.id, email: studentB.email, password: 'hash', role: 'STUDENT', isActive: true },
});
await prisma.user.upsert({
  where: { id: superAdmin.id },
  update: { email: superAdmin.email, role: 'SUPER_ADMIN', isActive: true },
  create: { id: superAdmin.id, email: superAdmin.email, password: 'hash', role: 'SUPER_ADMIN', isActive: true },
});

// Clean up prior test conversations
await prisma.aIConversation.deleteMany({
  where: { userId: { in: [studentA.id, studentB.id, superAdmin.id] } },
});

// Mock AI Provider client
const providerInvocations: any[] = [];
let mockProviderReply: (params: any) => any = (params) => ({
  status: 'completed',
  output_text: `Assistant response to: ${params.input?.[params.input.length - 1]?.content?.[0]?.text ?? 'prompt'}`,
  steps: [],
});

const mockClient = {
  interactions: {
    create: async (params: any, options: any) => {
      providerInvocations.push(structuredClone({ params, options }));
      return mockProviderReply(params);
    },
  },
} as any;

let toolCalledCount = 0;
const mockRunTool = async (name: string, _args: string, actor: AuthActor) => {
  toolCalledCount++;
  assert.equal(actor.id, studentA.id);
  return { recordCount: 1, sample: 'public student data' };
};

// Express app for testing
const app = express();
app.use(express.json());
app.use(
  '/api/ai',
  createAiRouter(
    (msg, _c, user, runTool, history) => generateAiReply(msg, mockClient, user, runTool, history),
    { client: mockClient, runTool: mockRunTool },
  ),
);
app.use(errorHandler);

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address() as any;
const baseUrl = `http://127.0.0.1:${address.port}/api/ai`;

const tokenA = generateAccessToken(studentA.id, 0);
const tokenB = generateAccessToken(studentB.id, 0);
const tokenAdmin = generateAccessToken(superAdmin.id, 0);

console.log('Running AI persistent conversation and security test suite...');

try {
  // TEST 1: Create conversation without initial message
  const res1 = await fetch(`${baseUrl}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ title: 'My Study Chat' }),
  });
  assert.equal(res1.status, 201);
  const data1 = (await res1.json()) as any;
  assert.equal(data1.success, true);
  assert.equal(data1.data.conversation.title, 'My Study Chat');
  const convA1Id = data1.data.conversation.id;
  assert.ok(convA1Id);

  // TEST 2: List own conversations
  const res2 = await fetch(`${baseUrl}/conversations`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.equal(res2.status, 200);
  const data2 = (await res2.json()) as any;
  assert.equal(data2.data.conversations.length, 1);
  assert.equal(data2.data.conversations[0].id, convA1Id);
  assert.equal(data2.data.conversations[0].title, 'My Study Chat');

  // TEST 3: Retrieve own conversation
  const res3 = await fetch(`${baseUrl}/conversations/${convA1Id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.equal(res3.status, 200);
  const data3 = (await res3.json()) as any;
  assert.equal(data3.data.conversation.id, convA1Id);
  assert.equal(data3.data.conversation.messages.length, 0);

  // TEST 4: Post message to conversation (Turn 1)
  const res4 = await fetch(`${baseUrl}/conversations/${convA1Id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ message: 'What is my GPA?' }),
  });
  assert.equal(res4.status, 201);
  const data4 = (await res4.json()) as any;
  assert.ok(data4.data.reply);
  assert.equal(data4.data.userMessage.content, 'What is my GPA?');
  assert.equal(data4.data.userMessage.sequence, 1);
  assert.equal(data4.data.assistantMessage.role, 'ASSISTANT');
  assert.equal(data4.data.assistantMessage.sequence, 2);

  // TEST 5: Verify messages persisted and ordering is deterministic (Turn 2)
  const res5 = await fetch(`${baseUrl}/conversations/${convA1Id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ message: 'And what about my attendance?' }),
  });
  assert.equal(res5.status, 201);
  const data5 = (await res5.json()) as any;
  assert.equal(data5.data.userMessage.sequence, 3);
  assert.equal(data5.data.assistantMessage.sequence, 4);

  // Check multi-turn context reached provider
  const lastInvocation = providerInvocations[providerInvocations.length - 1];
  const inputSteps = lastInvocation.params.input;
  // Should include previous user turn, previous assistant turn, and current user turn
  assert.ok(inputSteps.length >= 3);
  assert.equal(inputSteps[0].type, 'user_input');
  assert.equal(inputSteps[0].content[0].text, 'What is my GPA?');
  assert.equal(inputSteps[1].type, 'model_output');
  assert.equal(inputSteps[2].type, 'user_input');
  assert.equal(inputSteps[2].content[0].text, 'And what about my attendance?');

  // TEST 6: Bounded pagination
  // Create 3 more conversations for user A
  for (let i = 1; i <= 3; i++) {
    await aiConvService.createConversation(studentA.id, { title: `Chat ${i}` });
  }
  const resPag = await fetch(`${baseUrl}/conversations?page=1&limit=2`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.equal(resPag.status, 200);
  const dataPag = (await resPag.json()) as any;
  assert.equal(dataPag.data.conversations.length, 2);
  assert.equal(dataPag.data.pagination.page, 1);
  assert.equal(dataPag.data.pagination.limit, 2);
  assert.equal(dataPag.data.pagination.total, 4);
  assert.equal(dataPag.data.pagination.totalPages, 2);

  // TEST 7: Search own conversations
  const resSearch = await fetch(`${baseUrl}/conversations?search=GPA`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.equal(resSearch.status, 200);
  const dataSearch = (await resSearch.json()) as any;
  // Matches conversation containing 'GPA' in message text
  assert.equal(dataSearch.data.conversations.length, 1);
  assert.equal(dataSearch.data.conversations[0].id, convA1Id);

  // Search by title
  const resSearchTitle = await fetch(`${baseUrl}/conversations?search=Chat 2`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.equal(resSearchTitle.status, 200);
  const dataSearchTitle = (await resSearchTitle.json()) as any;
  assert.equal(dataSearchTitle.data.conversations.length, 1);
  assert.equal(dataSearchTitle.data.conversations[0].title, 'Chat 2');

  // TEST 8: Rename conversation
  const resRename = await fetch(`${baseUrl}/conversations/${convA1Id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ title: 'Academic Advising 2026' }),
  });
  assert.equal(resRename.status, 200);
  const dataRename = (await resRename.json()) as any;
  assert.equal(dataRename.data.conversation.title, 'Academic Advising 2026');

  // TEST 9: Archive conversation
  const resArchive = await fetch(`${baseUrl}/conversations/${convA1Id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ isArchived: true }),
  });
  assert.equal(resArchive.status, 200);
  const dataArchive = (await resArchive.json()) as any;
  assert.ok(dataArchive.data.conversation.archivedAt);

  // Active list should not include archived conversation
  const resActive = await fetch(`${baseUrl}/conversations`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataActive = (await resActive.json()) as any;
  assert.ok(!dataActive.data.conversations.some((c: any) => c.id === convA1Id));

  // Archived list should include it
  const resArchivedList = await fetch(`${baseUrl}/conversations?archived=true`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataArchivedList = (await resArchivedList.json()) as any;
  assert.ok(dataArchivedList.data.conversations.some((c: any) => c.id === convA1Id));

  // Unarchive
  await fetch(`${baseUrl}/conversations/${convA1Id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ isArchived: false }),
  });

  // TEST 10: OWNERSHIP ISOLATION - User B cannot retrieve User A's conversation
  const resIdorGet = await fetch(`${baseUrl}/conversations/${convA1Id}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.equal(resIdorGet.status, 404); // Fails closed with 404, does not leak existence

  // TEST 11: OWNERSHIP ISOLATION - User B cannot post message to User A's conversation
  const resIdorMsg = await fetch(`${baseUrl}/conversations/${convA1Id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ message: 'Hack attempt' }),
  });
  assert.equal(resIdorMsg.status, 404);

  // TEST 12: OWNERSHIP ISOLATION - User B cannot rename or archive User A's conversation
  const resIdorPatch = await fetch(`${baseUrl}/conversations/${convA1Id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ title: 'Hacked Title' }),
  });
  assert.equal(resIdorPatch.status, 404);

  // TEST 13: OWNERSHIP ISOLATION - User B cannot delete User A's conversation
  const resIdorDel = await fetch(`${baseUrl}/conversations/${convA1Id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.equal(resIdorDel.status, 404);

  // TEST 14: ADMIN CANNOT INSPECT ANOTHER USER'S CONVERSATION
  const resAdminGet = await fetch(`${baseUrl}/conversations/${convA1Id}`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
  });
  assert.equal(resAdminGet.status, 404);

  const resAdminList = await fetch(`${baseUrl}/conversations`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
  });
  const dataAdminList = (await resAdminList.json()) as any;
  assert.equal(dataAdminList.data.conversations.length, 0);

  // TEST 15: Client-supplied userId in body is completely ignored
  const resSpoof = await fetch(`${baseUrl}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ title: 'Spoof Test', userId: studentA.id }),
  });
  assert.equal(resSpoof.status, 201);
  const dataSpoof = (await resSpoof.json()) as any;
  // Conversation belongs to studentB, not studentA
  const checkDb = await prisma.aIConversation.findUnique({
    where: { id: dataSpoof.data.conversation.id },
  });
  assert.equal(checkDb?.userId, studentB.id);

  // TEST 16: Concurrency / Duplicate submit prevention
  const resDup1 = await fetch(`${baseUrl}/conversations/${convA1Id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ message: 'Double click message' }),
  });
  assert.equal(resDup1.status, 201);

  const resDup2 = await fetch(`${baseUrl}/conversations/${convA1Id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ message: 'Double click message' }),
  });
  assert.equal(resDup2.status, 409); // 409 Conflict duplicate rejected

  // TEST 17: Failed provider call does not corrupt history or save fake reply
  mockProviderReply = () => {
    throw new Error('Provider 500 error');
  };
  const resFail = await fetch(`${baseUrl}/conversations/${convA1Id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ message: 'Will this fail gracefully?' }),
  });
  assert.equal(resFail.status, 503);

  // Verify DB state: user message was preserved, but NO fake assistant message was created
  const convAfterFail = await aiConvService.getConversation(studentA.id, convA1Id);
  const lastSaved = convAfterFail.messages[convAfterFail.messages.length - 1];
  assert.equal(lastSaved.role, 'USER');
  assert.equal(lastSaved.content, 'Will this fail gracefully?');

  // Reset provider mock
  mockProviderReply = (params) => ({
    status: 'completed',
    output_text: 'Recovered response',
    steps: [],
  });

  // TEST 18: Delete conversation
  const resDel = await fetch(`${baseUrl}/conversations/${convA1Id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.equal(resDel.status, 200);

  // Verify deletion cascaded to child messages
  const remainingConv = await prisma.aIConversation.findUnique({
    where: { id: convA1Id },
  });
  assert.equal(remainingConv, null);
  const remainingMsgs = await prisma.aIMessage.findMany({
    where: { conversationId: convA1Id },
  });
  assert.equal(remainingMsgs.length, 0);

  // TEST 19: Bounded history logic
  const boundedConv = await aiConvService.createConversation(studentA.id, { title: 'Bounded History Test' });
  // Add 14 messages
  for (let i = 1; i <= 14; i++) {
    await prisma.aIMessage.create({
      data: {
        conversationId: boundedConv.conversation.id,
        role: i % 2 === 1 ? 'USER' : 'ASSISTANT',
        content: `Message ${i}`,
        sequence: i,
      },
    });
  }
  // Now add another message via service, check provider received bounded history (<= 10 messages)
  providerInvocations.length = 0;
  await aiConvService.addMessageToConversation(
    studentA.id,
    boundedConv.conversation.id,
    'Latest question',
    studentA,
    mockClient,
  );
  const boundedInvocation = providerInvocations[0];
  // 10 historical steps + 1 current message = 11 steps
  assert.equal(boundedInvocation.params.input.length, 11);
  assert.equal(boundedInvocation.params.input[0].content[0].text, 'Message 5'); // Oldest kept
  assert.equal(boundedInvocation.params.input[10].content[0].text, 'Latest question'); // Current

  // Cleanup
  await prisma.aIConversation.deleteMany({
    where: { userId: { in: [studentA.id, studentB.id, superAdmin.id] } },
  });

  assert.equal(externalRequests, 0, 'Zero real external provider requests allowed');
  console.log('ALL AI conversation persistence & security tests passed with 100% mocked providers!');
} finally {
  server.close();
}
