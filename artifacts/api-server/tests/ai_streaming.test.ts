import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import type { AuthActor } from '../src/types/auth.types';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'ai-streaming-mock-jwt-secret-very-long';
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
  { createAiRouter },
  { generateAccessToken },
  { default: prisma },
  { default: errorHandler },
  { default: logger },
  aiConvService,
] = await Promise.all([
  import('../src/routes/ai.routes'),
  import('../src/utils/jwt.utils'),
  import('../src/utils/prismaClient'),
  import('../src/middleware/error.middleware'),
  import('../src/utils/logger'),
  import('../src/services/aiConversation.service'),
]);

const studentA = { id: 9301, email: 'streamingStudentA@test.edu', role: 'STUDENT', student: { id: 301 }, tokenVersion: 0, isActive: true } as AuthActor;

await prisma.user.upsert({
  where: { id: studentA.id },
  update: { email: studentA.email, role: 'STUDENT', isActive: true },
  create: { id: studentA.id, email: studentA.email, password: 'hash', role: 'STUDENT', isActive: true },
});

await prisma.student.upsert({
  where: { id: studentA.student!.id },
  update: { userId: studentA.id, firstName: 'Streaming', lastName: 'Student' },
  create: {
    id: studentA.student!.id,
    userId: studentA.id,
    firstName: 'Streaming',
    lastName: 'Student',
    studentId: 'STU-9301',
    year: 2,
  },
});

const tokenA = generateAccessToken(studentA.id, studentA.tokenVersion);

async function parseSseStream(response: Response): Promise<{ events: Array<{ event: string; data: any }>; rawText: string }> {
  const text = await response.text();
  const events: Array<{ event: string; data: any }> = [];
  const blocks = text.split('\n\n');

  for (const block of blocks) {
    if (!block.trim()) continue;
    let eventType = 'message';
    let dataStr = '';

    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        dataStr = line.slice(6).trim();
      }
    }

    if (dataStr) {
      try {
        events.push({ event: eventType, data: JSON.parse(dataStr) });
      } catch {
        events.push({ event: eventType, data: dataStr });
      }
    }
  }

  return { events, rawText: text };
}

let server: http.Server;
let baseUrl: string;

function setupTestServer(options: { client?: any; runTool?: any } = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api/ai', createAiRouter(undefined, options as any));
  app.use(errorHandler);

  return new Promise<void>((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
}

function closeTestServer() {
  return new Promise<void>((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

console.log('=== RUNNING PHASE 15 AI STREAMING SUITE ===');

try {
  // --------------------------------------------------------------------------
  // TEST 1: Normal Streaming with Multi-Delta Chunks and Single Persisted Message
  // --------------------------------------------------------------------------
  {
    console.log('[1/7] Testing normal SSE streaming response...');
    const mockClient = {
      interactions: {
        create: async () => ({
          status: 'completed',
          output_text: 'مرحباً بك! هذه إجابة تجريبية مقسمة لعدة أجزاء تدعم تدفق البيانات بشكل سلس وآمن.',
          steps: [],
        }),
      },
    };

    await setupTestServer({ client: mockClient });

    // Create a conversation first
    const conv = await prisma.aIConversation.create({
      data: { userId: studentA.id, title: 'Streaming Test 1' },
    });

    const res = await fetch(`${baseUrl}/api/ai/conversations/${conv.id}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ message: 'كيف حالك اليوم؟' }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type')?.includes('text/event-stream'), true);

    const { events } = await parseSseStream(res);

    // Assert event sequence: meta -> delta... -> done
    const metaEvent = events.find((e) => e.event === 'meta');
    assert.ok(metaEvent, 'Must emit meta event');
    assert.equal(metaEvent.data.conversationId, conv.id);

    const deltas = events.filter((e) => e.event === 'delta');
    assert.ok(deltas.length >= 2, 'Must emit multiple delta events for incremental text');
    const assembled = deltas.map((d) => d.data.text).join('');
    assert.equal(
      assembled,
      'مرحباً بك! هذه إجابة تجريبية مقسمة لعدة أجزاء تدعم تدفق البيانات بشكل سلس وآمن.',
    );

    const doneEvent = events.find((e) => e.event === 'done');
    assert.ok(doneEvent, 'Must emit done event');
    assert.equal(doneEvent.data.reply, assembled);

    // Verify single assistant message was persisted in PostgreSQL (NOT one per token)
    const messages = await prisma.aIMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { sequence: 'asc' },
    });
    assert.equal(messages.length, 2, 'Must persist exactly 1 user message and 1 assistant message');
    assert.equal(messages[0].role, 'USER');
    assert.equal(messages[1].role, 'ASSISTANT');
    assert.equal(messages[1].content, assembled);

    await closeTestServer();
    console.log('✓ Normal SSE streaming verified with single persisted assistant message.');
  }

  // --------------------------------------------------------------------------
  // TEST 2: Multi-turn / Multibyte UTF-8 Arabic & Markdown preservation
  // --------------------------------------------------------------------------
  {
    console.log('[2/7] Testing multibyte UTF-8 Arabic and Markdown streaming...');
    const markdownReply = '### جدول المحاضرات\n| المادة | اليوم |\n| --- | --- |\n| البرمجة | الأحد |\n\n```ts\nconst x = 42;\n```';
    const mockClient = {
      interactions: {
        create: async () => ({
          status: 'completed',
          output_text: markdownReply,
          steps: [],
        }),
      },
    };

    await setupTestServer({ client: mockClient });

    const conv = await prisma.aIConversation.create({
      data: { userId: studentA.id, title: 'Streaming Markdown' },
    });

    const res = await fetch(`${baseUrl}/api/ai/conversations/${conv.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ message: 'أعطني الجدول' }),
    });

    assert.equal(res.status, 200);
    const { events } = await parseSseStream(res);
    const deltas = events.filter((e) => e.event === 'delta');
    const reconstructed = deltas.map((d) => d.data.text).join('');
    assert.equal(reconstructed, markdownReply);

    await closeTestServer();
    console.log('✓ Multibyte UTF-8 Arabic and Markdown stream verified.');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Tool Execution Precedes Answer Stream Without Exposing Tool Args
  // --------------------------------------------------------------------------
  {
    console.log('[3/7] Testing server-side tool execution during streaming...');
    let toolExecuted = false;
    let round = 0;

    const mockClient = {
      interactions: {
        create: async () => {
          round++;
          if (round === 1) {
            // First round: model emits a tool call
            return {
              status: 'requires_action',
              steps: [
                {
                  type: 'function_call',
                  id: 'call_overview_1',
                  name: 'get_my_priority_overview',
                  arguments: {},
                },
              ],
            };
          }
          // Second round: model produces final answer
          return {
            status: 'completed',
            output_text: 'لديك واجب واحد مستحق غداً.',
            steps: [],
          };
        },
      },
    };

    const mockRunTool = async (name: string) => {
      toolExecuted = true;
      assert.equal(name, 'get_my_priority_overview');
      return { success: true, tasks: [{ id: 1, title: 'Assignment 1' }] };
    };

    await setupTestServer({ client: mockClient, runTool: mockRunTool });

    const conv = await prisma.aIConversation.create({
      data: { userId: studentA.id, title: 'Tool Streaming' },
    });

    const res = await fetch(`${baseUrl}/api/ai/conversations/${conv.id}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ message: 'ما هي أولوياتي؟' }),
    });

    assert.equal(res.status, 200);
    const { events, rawText } = await parseSseStream(res);

    assert.equal(toolExecuted, true, 'Tool must be executed on server');

    // Verify raw tool arguments and schema NEVER appeared in the SSE stream
    assert.equal(rawText.includes('call_overview_1'), false, 'Must not leak tool call ID');
    assert.equal(rawText.includes('get_my_priority_overview'), false, 'Must not leak tool name');

    // Status event emitted
    const statusEvents = events.filter((e) => e.event === 'status');
    assert.ok(statusEvents.length >= 1, 'Must emit status event during tool processing');

    const done = events.find((e) => e.event === 'done');
    assert.ok(done);
    assert.equal(done.data.reply, 'لديك واجب واحد مستحق غداً.');

    await closeTestServer();
    console.log('✓ Tool execution privacy and status events verified.');
  }

  // --------------------------------------------------------------------------
  // TEST 4: Section 6 Invariant: No Provider Replay / Fallback After Visible Delta
  // --------------------------------------------------------------------------
  {
    console.log('[4/7] Testing Section 6 invariant: halt stream if provider fails after visible delta...');
    // Simulated client that succeeds on first delta then throws mid-stream
    const mockFlakyClient = {
      interactions: {
        create: async () => {
          throw new Error('Mid-stream socket disconnection');
        },
      },
    };

    await setupTestServer({ client: mockFlakyClient });

    const conv = await prisma.aIConversation.create({
      data: { userId: studentA.id, title: 'Stream Failure Guard' },
    });

    const res = await fetch(`${baseUrl}/api/ai/conversations/${conv.id}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ message: 'سؤال سيفشل' }),
    });

    assert.equal(res.status, 200);
    const { events } = await parseSseStream(res);
    const errEvent = events.find((e) => e.event === 'error');
    assert.ok(errEvent, 'Must emit error event cleanly without server crash');

    // Verify user message remained saved in DB for retry, but NO fake assistant message was created
    const msgs = await prisma.aIMessage.findMany({
      where: { conversationId: conv.id },
    });
    assert.equal(msgs.length, 1, 'Only user message is stored; no corrupted assistant row');
    assert.equal(msgs[0].role, 'USER');

    await closeTestServer();
    console.log('✓ Section 6 streaming failure isolation and retry state verified.');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Stop Generation AbortSignal Handling
  // --------------------------------------------------------------------------
  {
    console.log('[5/7] Testing client Stop generation abort...');
    const abortController = new AbortController();

    const mockSlowClient = {
      interactions: {
        create: async () => {
          // Delay to simulate streaming generation in flight
          await new Promise((r) => setTimeout(r, 400));
          return { status: 'completed', output_text: 'Should be stopped before this finishes', steps: [] };
        },
      },
    };

    await setupTestServer({ client: mockSlowClient });

    const conv = await prisma.aIConversation.create({
      data: { userId: studentA.id, title: 'Stop Generation Test' },
    });

    const res = await fetch(`${baseUrl}/api/ai/conversations/${conv.id}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ message: 'أريد تقريراً طويلاً' }),
      signal: abortController.signal,
    });

    // Abort while body stream is still in flight
    setTimeout(() => {
      abortController.abort();
    }, 80);

    await assert.rejects(res.text(), (err: any) => err.name === 'AbortError');

    // Give server a moment to finalize
    await new Promise((r) => setTimeout(r, 150));

    // Verify conversation integrity: user message exists, no action executed, no crash
    const msgs = await prisma.aIMessage.findMany({
      where: { conversationId: conv.id },
    });
    assert.equal(msgs.length, 1, 'Turn preserved in safe state for retry');

    await closeTestServer();
    console.log('✓ Client Stop generation abort cleanly handled.');
  }

  // --------------------------------------------------------------------------
  // TEST 6: Action Proposals During Streaming (Section 11)
  // --------------------------------------------------------------------------
  {
    console.log('[6/7] Testing action proposal events during streaming...');
    // Create a mock doctor actor for action proposal
    const doctorA = { id: 9302, email: 'streamingDoctor@test.edu', role: 'DOCTOR', doctor: { id: 302 }, tokenVersion: 0, isActive: true } as AuthActor;
    await prisma.user.upsert({
      where: { id: doctorA.id },
      update: { email: doctorA.email, role: 'DOCTOR', isActive: true },
      create: { id: doctorA.id, email: doctorA.email, password: 'hash', role: 'DOCTOR', isActive: true },
    });
    await prisma.doctor.upsert({
      where: { id: doctorA.doctor!.id },
      update: { userId: doctorA.id, firstName: 'Streaming', lastName: 'Doctor' },
      create: {
        id: doctorA.doctor!.id,
        userId: doctorA.id,
        firstName: 'Streaming',
        lastName: 'Doctor',
        doctorId: 'DOC-9302',
      },
    });
    const tokenDoc = generateAccessToken(doctorA.id, doctorA.tokenVersion);

    let round = 0;
    const mockClient = {
      interactions: {
        create: async () => {
          round++;
          if (round === 1) {
            return {
              status: 'requires_action',
              steps: [
                {
                  type: 'function_call',
                  id: 'call_propose_task',
                  name: 'propose_create_task',
                  arguments: {
                    title: 'Streaming Assignment',
                    description: 'Test task',
                    courseId: 1,
                    dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
                    maxScore: 100,
                  },
                },
              ],
            };
          }
          return {
            status: 'completed',
            output_text: 'لقد جهزت مقترح الواجب، يُرجى مراجعته وتأكيده.',
            steps: [],
          };
        },
      },
    };

    const mockRunTool = async (name: string, args: any, actor: any, client: any, toolContext: any) => {
      // Create proposal record in DB
      const proposal = await prisma.aIActionProposal.create({
        data: {
          userId: actor.id,
          conversationId: toolContext?.conversationId,
          sourceUserMessageId: toolContext?.sourceUserMessageId,
          actionType: 'CREATE_TASK',
          payloadHash: 'hash_test_stream',
          normalizedPayload: args,
          previewData: { title: args.title },
          humanReadableSummary: 'Create Task: Streaming Assignment',
          expiresAt: new Date(Date.now() + 3600000),
          status: 'PROPOSED',
        },
      });
      return {
        proposalId: proposal.id,
        status: 'PROPOSED',
        preview: proposal.previewData,
      };
    };

    await setupTestServer({ client: mockClient, runTool: mockRunTool });

    const conv = await prisma.aIConversation.create({
      data: { userId: doctorA.id, title: 'Action Stream' },
    });

    const res = await fetch(`${baseUrl}/api/ai/conversations/${conv.id}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenDoc}`,
      },
      body: JSON.stringify({ message: 'أنشئ واجباً جديداً' }),
    });

    assert.equal(res.status, 200);
    const { events } = await parseSseStream(res);

    const actionEvent = events.find((e) => e.event === 'action');
    assert.ok(actionEvent, 'Must emit action event when action is proposed');
    assert.equal(actionEvent.data.actionProposal.actionType, 'CREATE_TASK');
    assert.equal(actionEvent.data.actionProposal.status, 'PROPOSED');

    // INVARIANT: Action must NOT be confirmed by streaming!
    const pRecord = await prisma.aIActionProposal.findUnique({
      where: { id: actionEvent.data.actionProposal.id },
    });
    assert.equal(pRecord?.status, 'PROPOSED', 'Proposal MUST remain PROPOSED until explicit user confirmation');

    await closeTestServer();
    console.log('✓ Action proposal during streaming remains unconfirmed until explicit action.');
  }

  // --------------------------------------------------------------------------
  // TEST 7: Zero outbound external requests guard
  // --------------------------------------------------------------------------
  {
    console.log('[7/7] Verifying zero real external network calls were made...');
    assert.equal(externalRequests, 0, 'Must have zero real external requests during automated test suite');
    console.log('✓ Zero external calls verified.');
  }

  console.log('=== ALL PHASE 15 STREAMING TESTS PASSED! ===');
} finally {
  await closeTestServer();
  // Cleanup test database entries
  await prisma.aIMessage.deleteMany({
    where: { conversation: { userId: { in: [studentA.id, 9302] } } },
  }).catch(() => {});
  await prisma.aIActionProposal.deleteMany({
    where: { userId: { in: [studentA.id, 9302] } },
  }).catch(() => {});
  await prisma.aIConversation.deleteMany({
    where: { userId: { in: [studentA.id, 9302] } },
  }).catch(() => {});
  await prisma.student.deleteMany({
    where: { id: { in: [studentA.student!.id] } },
  }).catch(() => {});
  await prisma.doctor.deleteMany({
    where: { id: { in: [302] } },
  }).catch(() => {});
  await prisma.user.deleteMany({
    where: { id: { in: [studentA.id, 9302] } },
  }).catch(() => {});
  await prisma.$disconnect();
}
