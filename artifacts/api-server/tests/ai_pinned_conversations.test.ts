import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import type { AuthActor } from '../src/types/auth.types';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'ai-pinned-mock-jwt-secret-very-long';
process.env.AI_ASSISTANT_ENABLED = 'true';
process.env.AI_PROVIDER = 'gemini';
process.env.GEMINI_API_KEY = 'mock-key-do-not-log';
process.env.GEMINI_MODEL = 'gemini-3.8-flash';

const [
  { generateAiReply },
  { createAiRouter },
  { generateAccessToken },
  { default: prisma },
  { default: errorHandler },
  aiConvService,
] = await Promise.all([
  import('../src/services/ai.service'),
  import('../src/routes/ai.routes'),
  import('../src/utils/jwt.utils'),
  import('../src/utils/prismaClient'),
  import('../src/middleware/error.middleware'),
  import('../src/services/aiConversation.service'),
]);

const userA = { id: 9301, email: 'userA@test.edu', role: 'STUDENT', student: { id: 301 }, tokenVersion: 0, isActive: true } as AuthActor;
const userB = { id: 9302, email: 'userB@test.edu', role: 'STUDENT', student: { id: 302 }, tokenVersion: 0, isActive: true } as AuthActor;

await prisma.user.upsert({
  where: { id: userA.id },
  update: { email: userA.email, role: 'STUDENT', isActive: true },
  create: { id: userA.id, email: userA.email, password: 'hash', role: 'STUDENT', isActive: true },
});
await prisma.user.upsert({
  where: { id: userB.id },
  update: { email: userB.email, role: 'STUDENT', isActive: true },
  create: { id: userB.id, email: userB.email, password: 'hash', role: 'STUDENT', isActive: true },
});

await prisma.aIConversation.deleteMany({
  where: { userId: { in: [userA.id, userB.id] } },
});

const app = express();
app.use(express.json());
app.use('/api/ai', createAiRouter(generateAiReply));
app.use(errorHandler);

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
const address = server.address() as any;
const baseUrl = `http://127.0.0.1:${address.port}/api/ai`;

const tokenA = generateAccessToken(userA.id, 0);
const tokenB = generateAccessToken(userB.id, 0);

try {
  console.log('--- RUNNING PINNED CONVERSATIONS BACKEND TESTS ---');

  // 1. User A creates conversation
  const conv1 = await aiConvService.createConversation(userA.id, { title: 'First Conv User A' });
  const conv2 = await aiConvService.createConversation(userA.id, { title: 'Second Conv User A' });
  const convB = await aiConvService.createConversation(userB.id, { title: 'User B Conv' });

  assert.equal(conv1.conversation.isPinned, false);
  assert.equal(conv1.conversation.pinnedAt, null);

  // 2. User A pins own conversation via PATCH
  const resPin = await fetch(`${baseUrl}/conversations/${conv1.conversation.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ isPinned: true }),
  });
  assert.equal(resPin.status, 200);
  const dataPin = await resPin.json();
  assert.equal(dataPin.success, true);
  assert.equal(dataPin.data.conversation.isPinned, true);
  assert.ok(dataPin.data.conversation.pinnedAt !== null);
  console.log('✓ User A pinned own conversation successfully');

  // 3. Pinned state persists in DB and in getConversation
  const fetchedConv1 = await aiConvService.getConversation(userA.id, conv1.conversation.id);
  assert.equal(fetchedConv1.isPinned, true);
  assert.ok(fetchedConv1.pinnedAt !== null);
  console.log('✓ Pinned state persisted in database');

  // 4. IDOR check: User B cannot pin User A's conversation (fail-closed 404)
  const resCrossPin = await fetch(`${baseUrl}/conversations/${conv1.conversation.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ isPinned: true }),
  });
  assert.equal(resCrossPin.status, 404, 'Cross-user pin must fail closed with 404');
  console.log('✓ Cross-user pin rejected with 404');

  // 5. IDOR check: User B cannot unpin User A's conversation (fail-closed 404)
  const resCrossUnpin = await fetch(`${baseUrl}/conversations/${conv1.conversation.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ isPinned: false }),
  });
  assert.equal(resCrossUnpin.status, 404, 'Cross-user unpin must fail closed with 404');
  console.log('✓ Cross-user unpin rejected with 404');

  // 6. Deterministic ordering: User A pins conv2 after conv1 -> conv2 has higher pinnedAt
  await new Promise((r) => setTimeout(r, 50));
  const resPin2 = await fetch(`${baseUrl}/conversations/${conv2.conversation.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ isPinned: true }),
  });
  assert.equal(resPin2.status, 200);

  const listRes = await fetch(`${baseUrl}/conversations`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const listData = await listRes.json();
  const convs = listData.data.conversations;
  assert.equal(convs.length, 2);
  assert.equal(convs[0].id, conv2.conversation.id, 'Most recently pinned conversation must appear first');
  assert.equal(convs[1].id, conv1.conversation.id);
  assert.equal(convs[0].isPinned, true);
  assert.equal(convs[1].isPinned, true);
  console.log('✓ Pinned list ordering is deterministic (pinnedAt DESC)');

  // 7. Search filtering applies to pinned conversations
  const searchRes = await fetch(`${baseUrl}/conversations?search=Second`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const searchData = await searchRes.json();
  assert.equal(searchData.data.conversations.length, 1);
  assert.equal(searchData.data.conversations[0].id, conv2.conversation.id);
  console.log('✓ Search filter applies properly to pinned conversations');

  // 8. Invariant: Archiving automatically unpins conversation (pinnedAt = null)
  const resArchive = await fetch(`${baseUrl}/conversations/${conv2.conversation.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ isArchived: true }),
  });
  assert.equal(resArchive.status, 200);
  const dataArchive = await resArchive.json();
  assert.equal(dataArchive.data.conversation.isPinned, false);
  assert.equal(dataArchive.data.conversation.pinnedAt, null);
  assert.ok(dataArchive.data.conversation.archivedAt !== null);

  const checkArchived = await aiConvService.getConversation(userA.id, conv2.conversation.id);
  assert.equal(checkArchived.isPinned, false);
  assert.equal(checkArchived.pinnedAt, null);
  console.log('✓ Archiving conversation atomically unpins it (pinnedAt = null)');

  // 9. Unarchiving does NOT restore pin
  const resUnarchive = await fetch(`${baseUrl}/conversations/${conv2.conversation.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ isArchived: false }),
  });
  assert.equal(resUnarchive.status, 200);
  const dataUnarchive = await resUnarchive.json();
  assert.equal(dataUnarchive.data.conversation.isPinned, false);
  assert.equal(dataUnarchive.data.conversation.pinnedAt, null);
  assert.equal(dataUnarchive.data.conversation.archivedAt, null);
  console.log('✓ Unarchiving does not restore previous pinned state');

  // 10. User unpins own conversation
  const resUnpin = await fetch(`${baseUrl}/conversations/${conv1.conversation.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ isPinned: false }),
  });
  assert.equal(resUnpin.status, 200);
  const dataUnpin = await resUnpin.json();
  assert.equal(dataUnpin.data.conversation.isPinned, false);
  assert.equal(dataUnpin.data.conversation.pinnedAt, null);
  console.log('✓ User unpins conversation successfully');

  console.log('\n--- ALL PINNED CONVERSATIONS BACKEND TESTS PASSED ---');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
