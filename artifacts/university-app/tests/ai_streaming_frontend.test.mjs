import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPackageJson = path.resolve(__dirname, '../../../package.json');
const req = createRequire(rootPackageJson);
const ts = req('typescript');

async function loadProductionAiService() {
  const servicePath = path.resolve(__dirname, '../src/services/ai.service.ts');
  let source = fs.readFileSync(servicePath, 'utf8');

  // Stub imports that reference browser-only or complex axios instances
  source = source.replace(/import api, \{ getAccessToken, getDynamicBaseUrl \} from '\.\/api';/, `
    const api = {};
    export const getAccessToken = () => 'mock-jwt-token';
    export const getDynamicBaseUrl = () => 'http://localhost:3000/api';
  `);
  source = source.replace(/import \{ requestAiReply \} from '\.\/aiAssistant\.utils';/, `
    const requestAiReply = async () => 'mock';
  `);

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const dataUri = 'data:text/javascript;base64,' + Buffer.from(transpiled).toString('base64');
  return await import(dataUri);
}

// Helper to create a readable stream of Uint8Array chunks from an array of SSE strings
function createMockSseStream(chunks) {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

test('PHASE 15 — Frontend Streaming (SSE Transport & Event Processing)', async (t) => {
  const { streamConversationMessage, createAndStreamConversation } = await loadProductionAiService();
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test('1. Normal SSE stream delivers meta, status, deltas, citation, action and done in order', async () => {
    const ssePayloadChunks = [
      'event: meta\ndata: {"conversationId":"conv-99","userMessageId":"msg-1","sequence":1}\n\n',
      'event: status\ndata: {"phase":"thinking"}\n\n',
      'event: status\ndata: {"phase":"tools","message":"Checking courses..."}\n\n',
      'event: delta\ndata: {"text":"Here are "}\n\n',
      'event: delta\ndata: {"text":"your registered "}\n\n',
      'event: delta\ndata: {"text":"courses: CS101."}\n\n',
      'event: citation\ndata: {"citation":{"id":"c1","documentTitle":"Course Catalog 2026","pageNumber":12}}\n\n',
      'event: action\ndata: {"actionProposal":{"id":"act-1","actionType":"ENROLL_COURSE","status":"PROPOSED"}}\n\n',
      'event: done\ndata: {"conversationId":"conv-99","reply":"Here are your registered courses: CS101."}\n\n',
    ];

    globalThis.fetch = async (url, options) => {
      assert.ok(url.includes('/ai/conversations/conv-99/messages/stream'));
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['Accept'], 'text/event-stream');
      const body = JSON.parse(options.body);
      assert.equal(body.message, 'List my courses');

      return {
        ok: true,
        status: 200,
        body: createMockSseStream(ssePayloadChunks),
      };
    };

    const receivedMeta = [];
    const receivedStatuses = [];
    const deltas = [];
    const citations = [];
    const actions = [];
    let doneResult = null;

    await streamConversationMessage(
      'conv-99',
      { message: 'List my courses' },
      {
        onMeta: (meta) => receivedMeta.push(meta),
        onStatus: (status) => receivedStatuses.push(status),
        onDelta: (delta) => deltas.push(delta),
        onCitation: (cite) => citations.push(cite),
        onAction: (act) => actions.push(act),
        onDone: (done) => { doneResult = done; },
      }
    );

    assert.equal(receivedMeta.length, 1);
    assert.equal(receivedMeta[0].conversationId, 'conv-99');
    assert.equal(receivedStatuses.length, 2);
    assert.equal(receivedStatuses[0].phase, 'thinking');
    assert.equal(receivedStatuses[1].phase, 'tools');
    assert.equal(deltas.join(''), 'Here are your registered courses: CS101.');
    assert.equal(citations.length, 1);
    assert.equal(citations[0].documentTitle, 'Course Catalog 2026');
    assert.equal(actions.length, 1);
    assert.equal(actions[0].id, 'act-1');
    assert.ok(doneResult);
    assert.equal(doneResult.reply, 'Here are your registered courses: CS101.');
  });

  await t.test('2. Fragmented network chunks across boundaries are reconstructed seamlessly', async () => {
    // Single SSE event split into 3 micro-chunks across boundaries
    const sseFragments = [
      'event: delta\nda',
      'ta: {"text":"Frag',
      'mented word"}\n\n',
    ];

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      body: createMockSseStream(sseFragments),
    });

    const deltas = [];
    await streamConversationMessage(
      'conv-frag',
      { message: 'Test split' },
      {
        onDelta: (d) => deltas.push(d),
      }
    );

    assert.equal(deltas.length, 1);
    assert.equal(deltas[0], 'Fragmented word');
  });

  await t.test('3. Client cancellation abort signal terminates stream with CLIENT_ABORTED', async () => {
    const abortController = new AbortController();

    globalThis.fetch = async (url, options) => {
      // Simulate stream that halts when aborted
      let streamController;
      const stream = new ReadableStream({
        start(c) {
          streamController = c;
          c.enqueue(new TextEncoder().encode('event: delta\ndata: {"text":"Starting..."}\n\n'));
        },
      });

      options.signal?.addEventListener('abort', () => {
        try {
          streamController?.error(new DOMException('The user aborted a request.', 'AbortError'));
        } catch {
          // ignore
        }
      });

      return {
        ok: true,
        status: 200,
        body: stream,
      };
    };

    let interruptedReason = null;
    const promise = streamConversationMessage(
      'conv-abort',
      { message: 'Cancel me' },
      {
        onInterrupted: (data) => {
          interruptedReason = data.reason;
        },
      },
      abortController.signal
    );

    // Abort client connection 10ms into stream
    await new Promise((r) => setTimeout(r, 10));
    abortController.abort();

    await promise;
    assert.equal(interruptedReason, 'CLIENT_ABORTED');
  });

  await t.test('4. Upstream HTTP error returns clean error callback without crashing UI', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 503,
      json: async () => ({ message: 'AI assistant is temporarily unavailable' }),
    });

    let reportedError = null;
    await streamConversationMessage(
      'conv-err',
      { message: 'Will fail' },
      {
        onError: (err) => {
          reportedError = err;
        },
      }
    );

    assert.ok(reportedError);
    assert.equal(reportedError.message, 'AI assistant is temporarily unavailable');
    assert.equal(reportedError.code, 'HTTP_503');
  });

  await t.test('5. createAndStreamConversation initiates new conversation with SSE stream', async () => {
    globalThis.fetch = async (url, options) => {
      assert.ok(url.includes('/ai/conversations/stream'));
      assert.equal(options.method, 'POST');
      const body = JSON.parse(options.body);
      assert.equal(body.title, 'New Conversation');
      assert.equal(body.message, 'Hello from new chat');

      return {
        ok: true,
        status: 200,
        body: createMockSseStream([
          'event: meta\ndata: {"conversationId":"new-conv-44"}\n\n',
          'event: delta\ndata: {"text":"Welcome!"}\n\n',
          'event: done\ndata: {"conversationId":"new-conv-44","reply":"Welcome!"}\n\n',
        ]),
      };
    };

    let metaId = null;
    const deltas = [];
    await createAndStreamConversation(
      { title: 'New Conversation', message: 'Hello from new chat' },
      {
        onMeta: (meta) => { metaId = meta.conversationId; },
        onDelta: (d) => deltas.push(d),
      }
    );

    assert.equal(metaId, 'new-conv-44');
    assert.equal(deltas.join(''), 'Welcome!');
  });
});
