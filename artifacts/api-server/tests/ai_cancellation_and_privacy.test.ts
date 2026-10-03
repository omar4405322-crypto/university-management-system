import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import type { AuthActor } from '../src/types/auth.types';
import {
  createClientDisconnectAbortController,
} from '../src/utils/requestCancellation';
import {
  canAccessAiDiagnostics,
  getAiFallbackProvider,
  getAiProvider,
} from '../src/utils/aiConfig';
import { getMissingRuntimeEnvVars } from '../src/utils/runtimeEnvironment';
import {
  createAiChatController,
} from '../src/controllers/ai.controller';
import {
  addAiMessageController,
  createAiConversationController,
} from '../src/controllers/aiConversation.controller';
import {
  orchestrateAiRequest,
} from '../src/services/aiOrchestrator.service';
import {
  aiCircuitBreaker,
} from '../src/services/aiCircuitBreaker.service';
import {
  createAiRouter,
} from '../src/routes/ai.routes';
import prisma from '../src/utils/prismaClient';

process.env.NODE_ENV = 'test';
process.env.AI_ASSISTANT_ENABLED = 'true';
process.env.AI_PROVIDER = 'gemini';
process.env.GEMINI_API_KEY = 'gemini-mock-test-key';
process.env.GEMINI_MODEL = 'gemini-2.5-flash';
process.env.OPENAI_API_KEY = 'openai-mock-test-key';
process.env.OPENAI_MODEL = 'gpt-6-luna';
process.env.AI_FALLBACK_PROVIDER = 'none';

// Mock MockResponse for testing Express controllers
class MockExpressResponse extends EventEmitter {
  public statusCode: number = 200;
  public writableEnded: boolean = false;
  public finished: boolean = false;
  public headersSent: boolean = false;
  public jsonData: any = null;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(data: any) {
    this.jsonData = data;
    this.writableEnded = true;
    this.finished = true;
    this.headersSent = true;
    this.emit('finish');
    this.emit('close');
    return this;
  }

  // Simulate premature client disconnect before response writes
  clientDisconnect() {
    this.writableEnded = false;
    this.finished = false;
    this.emit('close');
  }
}

// Mock Request
class MockExpressRequest extends EventEmitter {
  public body: any;
  public params: any;
  public user?: AuthActor;
  public headers: Record<string, string>;
  public socket: any;
  public path: string;
  public query: Record<string, string>;

  constructor(options: { body?: any; params?: any; user?: AuthActor; headers?: Record<string, string>; path?: string; query?: Record<string, string> } = {}) {
    super();
    this.body = options.body ?? {};
    this.params = options.params ?? {};
    this.user = options.user;
    this.headers = options.headers ?? {};
    this.socket = { destroyed: false };
    this.path = options.path ?? '/messages';
    this.query = options.query ?? {};
  }

  // Simulate incoming stream ending its body
  completeRequestBody() {
    this.emit('end');
    this.emit('close');
  }
}

const mockStudent: AuthActor = {
  id: 888101,
  role: 'STUDENT',
  student: { id: 991 },
  tokenVersion: 0,
  isActive: true,
};

const mockDoctor: AuthActor = {
  id: 888102,
  role: 'DOCTOR',
  doctor: { id: 992 },
  tokenVersion: 0,
  isActive: true,
};

const mockAdmin: AuthActor = {
  id: 888103,
  role: 'ADMIN',
  adminRole: 'SUPER_ADMIN',
  tokenVersion: 0,
  isActive: true,
};

const mockSuperAdmin: AuthActor = {
  id: 888104,
  role: 'SUPER_ADMIN',
  tokenVersion: 0,
  isActive: true,
};

const mockPlatformAdmin: AuthActor = {
  id: 888105,
  role: 'ADMIN',
  tokenVersion: 0,
  isActive: true,
};

const mockCollegeAdmin: AuthActor = {
  id: 888106,
  role: 'COLLEGE_ADMIN',
  managedCollegeId: 3,
  tokenVersion: 0,
  isActive: true,
};

const mockDepartmentAdmin: AuthActor = {
  id: 888107,
  role: 'DEPARTMENT_ADMIN',
  managedDepartmentId: 5,
  tokenVersion: 0,
  isActive: true,
};

const mockTeachingAssistant: AuthActor = {
  id: 888108,
  role: 'TEACHING_ASSISTANT',
  tokenVersion: 0,
  isActive: true,
};

async function runCancellationAndPrivacyTests() {
  console.log('========================================================');
  console.log('STARTING PHASE 12.1: CANCELLATION, FALLBACK & PRIVACY TESTS');
  console.log('========================================================');

  // =========================================================================
  // 1. REQUEST CANCELLATION TESTS
  // =========================================================================
  console.log('[1/5] Testing Client-Disconnect vs Normal Completion Lifecycle...');

  // Test 1.1: Normal POST request body completion does NOT abort provider signal
  {
    const req = new MockExpressRequest({ body: { message: 'Hello' } });
    const res = new MockExpressResponse();

    const { abortController, cleanup } = createClientDisconnectAbortController(req as any, res as any);

    // Simulate Node.js stream emitting 'close' when POST body has finished reading
    req.completeRequestBody();

    // Must NOT abort because the response has not prematurely disconnected!
    assert.equal(abortController.signal.aborted, false);
    cleanup();
    console.log('✓ Normal POST request body completion does not abort in-flight work.');
  }

  // Test 1.2: Premature client disconnect aborts the signal
  {
    const req = new MockExpressRequest({ body: { message: 'Hello' } });
    const res = new MockExpressResponse();

    const { abortController, cleanup } = createClientDisconnectAbortController(req as any, res as any);

    assert.equal(abortController.signal.aborted, false);

    // Client drops connection while handler is executing
    res.clientDisconnect();

    assert.equal(abortController.signal.aborted, true);
    assert.equal((abortController.signal.reason as Error)?.message, 'CLIENT_DISCONNECTED');
    cleanup();
    console.log('✓ Premature client disconnect cleanly triggers provider AbortSignal.');
  }

  // Test 1.3: Normal response completion does NOT abort when res closes
  {
    const req = new MockExpressRequest({ body: { message: 'Hello' } });
    const res = new MockExpressResponse();

    const { abortController, cleanup } = createClientDisconnectAbortController(req as any, res as any);

    // Provider finishes and handler responds
    res.json({ success: true, reply: 'Finished normally' });

    assert.equal(abortController.signal.aborted, false);
    assert.equal(res.writableEnded, true);
    cleanup();
    console.log('✓ Normal response completion does not abort on finish/close.');
  }

  // Test 1.4: Timeout aborts pending request
  {
    const req = new MockExpressRequest({ body: { message: 'Hello' } });
    const res = new MockExpressResponse();

    const { abortController, cleanup } = createClientDisconnectAbortController(req as any, res as any, { timeoutMs: 25 });

    assert.equal(abortController.signal.aborted, false);

    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.equal(abortController.signal.aborted, true);
    assert.equal((abortController.signal.reason as Error)?.message, 'REQUEST_TIMEOUT');
    cleanup();
    console.log('✓ Configured request timeout triggers provider AbortSignal.');
  }

  // Test 1.5: Controller execution with client disconnect
  {
    let providerSignalAbortedDuringExecution = false;
    let providerCompletedExecution = false;

    const mockSlowChat = async (
      _message: string,
      _client?: any,
      _actor?: any,
      _runTool?: any,
      _history?: any,
      options?: { signal?: AbortSignal },
    ): Promise<string> => {
      // Simulate waiting for upstream response
      return new Promise<string>((resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          providerSignalAbortedDuringExecution = true;
          reject(new Error('CLIENT_DISCONNECTED'));
        });
        setTimeout(() => {
          providerCompletedExecution = true;
          resolve('Late reply');
        }, 2000);
      });
    };

    const chatController = createAiChatController(mockSlowChat as any);

    const req = new MockExpressRequest({
      body: { message: 'Tell me about the university' },
      user: mockStudent,
    });
    const res = new MockExpressResponse();

    const handlePromise = chatController(req as any, res as any, () => {});

    // Client disconnects 10ms into execution
    await new Promise((resolve) => setTimeout(resolve, 10));
    res.clientDisconnect();

    await handlePromise;

    assert.equal(providerSignalAbortedDuringExecution, true);
    assert.equal(providerCompletedExecution, false);
    // Response was not written to severed socket
    assert.equal(res.jsonData, null);
    console.log('✓ Controller cleanly halts provider and avoids writing to severed socket.');
  }

  // =========================================================================
  // 2. CONVERSATION PERSISTENCE CONSISTENCY AFTER DISCONNECT
  // =========================================================================
  console.log('[2/5] Testing Conversation Persistence Integrity Across Disconnect...');

  {
    const testUserId = 888201;
    await prisma.user.upsert({
      where: { id: testUserId },
      update: { email: 'disconnect-test@test.edu', role: 'STUDENT', isActive: true },
      create: {
        id: testUserId,
        email: 'disconnect-test@test.edu',
        password: 'hash',
        role: 'STUDENT',
        isActive: true,
      },
    });

    // Create a new conversation
    const conv = await prisma.aIConversation.create({
      data: {
        userId: testUserId,
        title: 'Disconnect Turn Consistency',
      },
    });

    let clientAbortedDuringAddMessage = false;

    // Simulate provider that halts on abort
    const abortableClient = {
      interactions: {
        create: async (_params: any) => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve({
                status: 'completed',
                output_text: 'Should never arrive if aborted',
                steps: [],
              });
            }, 2000);
          });
        },
      },
    } as any;

    const addController = addAiMessageController({ client: abortableClient });

    const req = new MockExpressRequest({
      params: { id: conv.id },
      body: { message: 'Can you show my courses?' },
      user: { id: testUserId, role: 'STUDENT', tokenVersion: 0, isActive: true },
    });
    const res = new MockExpressResponse();

    let disconnectControllerError: any = null;
    const postPromise = addController(req as any, res as any, (err: any) => {
      disconnectControllerError = err;
    });

    // Client disconnects quickly while provider is running
    await new Promise((resolve) => setTimeout(resolve, 50));
    res.clientDisconnect();

    await postPromise;
    await new Promise((resolve) => setTimeout(resolve, 50));

    if (disconnectControllerError) {
      throw disconnectControllerError;
    }

    // Verify conversation state in database:
    // 1. User message exists
    const messages = await prisma.aIMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { sequence: 'asc' },
    });

    assert.equal(messages.length, 1);
    assert.equal(messages[0].role, 'USER');
    assert.equal(messages[0].content, 'Can you show my courses?');

    // 2. NO assistant message was committed!
    const assistantMessages = messages.filter((m) => m.role === 'ASSISTANT');
    assert.equal(assistantMessages.length, 0);

    // 3. User reconnects and retries the request with a successful client
    const successClient = {
      interactions: {
        create: async () => ({
          status: 'completed',
          output_text: 'Here are your registered courses.',
          steps: [],
        }),
      },
    } as any;

    const retryController = addAiMessageController({ client: successClient });
    const req2 = new MockExpressRequest({
      params: { id: conv.id },
      body: { message: 'Can you show my courses?' },
      user: { id: testUserId, role: 'STUDENT', tokenVersion: 0, isActive: true },
    });
    const res2 = new MockExpressResponse();

    let controllerError: any = null;
    await new Promise<void>((resolve) => {
      res2.on('finish', () => resolve());
      retryController(req2 as any, res2 as any, (err: any) => {
        controllerError = err;
        resolve();
      });
    });

    if (controllerError) {
      console.error('Controller failed with error:', controllerError);
    }

    assert.equal(controllerError, null);
    assert.equal(res2.statusCode, 201);
    assert.equal(res2.jsonData.success, true);
    assert.equal(res2.jsonData.data.reply, 'Here are your registered courses.');

    // Verify final message history: exactly 1 USER message and 1 ASSISTANT message
    const finalMessages = await prisma.aIMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { sequence: 'asc' },
    });

    assert.equal(finalMessages.length, 2);
    assert.equal(finalMessages[0].role, 'USER');
    assert.equal(finalMessages[1].role, 'ASSISTANT');
    assert.equal(finalMessages[1].content, 'Here are your registered courses.');

    // Cleanup
    await prisma.aIMessage.deleteMany({ where: { conversationId: conv.id } });
    await prisma.aIConversation.delete({ where: { id: conv.id } });
    await prisma.user.delete({ where: { id: testUserId } });

    console.log('✓ Conversation persistence remains uncorrupted after disconnect and safely resumes on retry.');
  }

  // =========================================================================
  // 3. SAFE FALLBACK DEFAULT & SAME-PROVIDER NORMALIZATION
  // =========================================================================
  console.log('[3/5] Testing Safe Fallback Default & Same-Provider Normalization...');

  {
    // Save original env
    const origFallback = process.env.AI_FALLBACK_PROVIDER;
    const origProvider = process.env.AI_PROVIDER;

    try {
      // 3.1: No env value -> returns 'none'
      delete process.env.AI_FALLBACK_PROVIDER;
      assert.equal(getAiFallbackProvider(), 'none');

      // 3.2: Empty string -> returns 'none'
      process.env.AI_FALLBACK_PROVIDER = '   ';
      assert.equal(getAiFallbackProvider(), 'none');

      // 3.3: 'none' -> returns 'none'
      process.env.AI_FALLBACK_PROVIDER = 'none';
      assert.equal(getAiFallbackProvider(), 'none');

      // 3.4: 'disabled' / 'off' -> returns 'none'
      process.env.AI_FALLBACK_PROVIDER = 'disabled';
      assert.equal(getAiFallbackProvider(), 'none');
      process.env.AI_FALLBACK_PROVIDER = 'off';
      assert.equal(getAiFallbackProvider(), 'none');

      // 3.5: Redundant same-provider fallback is safely normalized to 'none'
      // When primary is gemini:
      process.env.AI_PROVIDER = 'gemini';
      process.env.AI_FALLBACK_PROVIDER = 'gemini';
      assert.equal(getAiFallbackProvider(), 'none', 'gemini -> gemini must normalize to none');

      // When primary is openai:
      process.env.AI_PROVIDER = 'openai';
      process.env.AI_FALLBACK_PROVIDER = 'openai';
      assert.equal(getAiFallbackProvider(), 'none', 'openai -> openai must normalize to none');

      // 3.6: Explicit cross-provider fallback works
      process.env.AI_PROVIDER = 'gemini';
      process.env.AI_FALLBACK_PROVIDER = 'openai';
      assert.equal(getAiFallbackProvider(), 'openai', 'gemini -> openai cross-provider fallback must work');

      process.env.AI_PROVIDER = 'openai';
      process.env.AI_FALLBACK_PROVIDER = 'gemini';
      assert.equal(getAiFallbackProvider(), 'gemini', 'openai -> gemini cross-provider fallback must work');

      // 3.7: Arbitrary/unknown value -> returns 'none'
      process.env.AI_FALLBACK_PROVIDER = 'anthropic';
      assert.equal(getAiFallbackProvider(), 'none');

      // 3.8: Production startup validation rejects same-provider fallback
      const missingSameGemini = getMissingRuntimeEnvVars({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://localhost/test',
        JWT_SECRET: 'test-secret',
        ENCRYPTION_KEY: 'test-key',
        REDIS_URL: 'redis://localhost',
        AI_ASSISTANT_ENABLED: 'true',
        AI_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'test-gemini-key',
        GEMINI_MODEL: 'gemini-2.5-flash',
        AI_FALLBACK_PROVIDER: 'gemini',
      });
      assert(missingSameGemini.includes('AI_FALLBACK_PROVIDER'), 'Production startup must reject gemini -> gemini fallback');

      const missingSameOpenai = getMissingRuntimeEnvVars({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://localhost/test',
        JWT_SECRET: 'test-secret',
        ENCRYPTION_KEY: 'test-key',
        REDIS_URL: 'redis://localhost',
        AI_ASSISTANT_ENABLED: 'true',
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'test-openai-key',
        AI_FALLBACK_PROVIDER: 'openai',
      });
      assert(missingSameOpenai.includes('AI_FALLBACK_PROVIDER'), 'Production startup must reject openai -> openai fallback');

      // Valid cross-provider configuration is accepted in production
      const missingCrossValid = getMissingRuntimeEnvVars({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://localhost/test',
        JWT_SECRET: 'test-secret',
        ENCRYPTION_KEY: 'test-key',
        REDIS_URL: 'redis://localhost',
        AI_ASSISTANT_ENABLED: 'true',
        AI_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'test-gemini-key',
        GEMINI_MODEL: 'gemini-2.5-flash',
        AI_FALLBACK_PROVIDER: 'openai',
        OPENAI_API_KEY: 'test-openai-key',
      });
      assert.equal(missingCrossValid.length, 0, 'Production startup must accept valid gemini -> openai cross-provider fallback');

      // 3.9: Orchestrator behavior:
      // (a) Primary success never calls fallback
      process.env.AI_PROVIDER = 'gemini';
      process.env.AI_FALLBACK_PROVIDER = 'openai';
      let primaryCalls = 0;
      let fallbackCalls = 0;
      const primarySucceeding = {
        interactions: {
          create: async () => {
            primaryCalls++;
            return { status: 'completed', output_text: 'Primary success', steps: [] };
          },
        },
      } as any;
      const fallbackSpy = {
        responses: {
          create: async () => {
            fallbackCalls++;
            return { status: 'completed', output_text: 'Fallback', output: [] };
          },
        },
      } as any;

      const successRes = await orchestrateAiRequest('Hi', primarySucceeding, mockStudent, undefined, [], {
        delayFn: async () => {},
        fallbackClient: fallbackSpy,
      });
      assert.equal(successRes.reply, 'Primary success');
      assert.equal(primaryCalls, 1);
      assert.equal(fallbackCalls, 0, 'Primary success must NEVER call fallback');

      // (b) Same-provider fallback does NOT create duplicate provider attempts
      process.env.AI_PROVIDER = 'gemini';
      process.env.AI_FALLBACK_PROVIDER = 'gemini'; // redundant/invalid
      fallbackCalls = 0;
      const failingPrimary = {
        interactions: {
          create: async () => {
            const err = new Error('Primary Gemini outage');
            (err as any).status = 503;
            throw err;
          },
        },
      } as any;

      await assert.rejects(
        async () => {
          await orchestrateAiRequest('Test', failingPrimary, mockStudent, undefined, [], {
            delayFn: async () => {},
            fallbackClient: fallbackSpy,
          });
        },
        (err: any) => {
          assert.equal(err.statusCode, 503);
          return true;
        },
      );
      // Because gemini -> gemini normalized to 'none', fallbackSpy was NEVER called
      assert.equal(fallbackCalls, 0, 'Same-provider fallback must NOT trigger secondary provider attempts');

      // (c) Explicit cross-provider fallback still works
      process.env.AI_PROVIDER = 'gemini';
      process.env.AI_FALLBACK_PROVIDER = 'openai';
      fallbackCalls = 0;
      aiCircuitBreaker.reset();

      const crossFallbackRes = await orchestrateAiRequest('Test', failingPrimary, mockStudent, undefined, [], {
        delayFn: async () => {},
        fallbackClient: fallbackSpy,
      });
      assert.equal(crossFallbackRes.fallbackUsed, true);
      assert.equal(crossFallbackRes.providerUsed, 'openai');
      assert.equal(fallbackCalls, 1, 'Cross-provider fallback must be invoked when primary fails');

      // (d) Default remains none: failure throws 503 and never invokes fallback
      process.env.AI_PROVIDER = 'gemini';
      process.env.AI_FALLBACK_PROVIDER = 'none';
      fallbackCalls = 0;
      aiCircuitBreaker.reset();

      await assert.rejects(
        async () => {
          await orchestrateAiRequest('Test', failingPrimary, mockStudent, undefined, [], {
            delayFn: async () => {},
            fallbackClient: fallbackSpy,
          });
        },
        (err: any) => {
          assert.equal(err.statusCode, 503);
          return true;
        },
      );
      assert.equal(fallbackCalls, 0, 'Default none fallback must never invoke fallback client');
    } finally {
      process.env.AI_FALLBACK_PROVIDER = origFallback ?? 'none';
      process.env.AI_PROVIDER = origProvider ?? 'gemini';
    }

    console.log('✓ Safe fallback default and same-provider normalization verified.');
  }

  // =========================================================================
  // 4. PROVIDER HEALTH PRIVACY & RBAC
  // =========================================================================
  console.log('[4/5] Testing Provider Health Privacy & RBAC (GET /api/ai/status)...');

  {
    // Test 4.0: canAccessAiDiagnostics RBAC unit tests
    assert.equal(canAccessAiDiagnostics(mockSuperAdmin), true, 'SUPER_ADMIN must have diagnostic access');
    assert.equal(canAccessAiDiagnostics({ role: 'ADMIN', adminRole: 'SUPER_ADMIN', id: 1 } as any), true, 'ADMIN with adminRole SUPER_ADMIN must have diagnostic access');
    assert.equal(canAccessAiDiagnostics(mockPlatformAdmin), true, 'Platform ADMIN must have diagnostic access');
    assert.equal(canAccessAiDiagnostics({ role: 'admin', id: 2 } as any), true, 'Case-insensitive ADMIN must have diagnostic access');

    // Scoped / non-platform roles must NOT have diagnostic access
    assert.equal(canAccessAiDiagnostics(mockStudent), false, 'STUDENT must not have diagnostic access');
    assert.equal(canAccessAiDiagnostics(mockDoctor), false, 'DOCTOR must not have diagnostic access');
    assert.equal(canAccessAiDiagnostics(mockTeachingAssistant), false, 'TEACHING_ASSISTANT must not have diagnostic access');
    assert.equal(canAccessAiDiagnostics({ role: 'TA', id: 3 } as any), false, 'TA must not have diagnostic access');
    assert.equal(canAccessAiDiagnostics(mockCollegeAdmin), false, 'COLLEGE_ADMIN must not have diagnostic access');
    assert.equal(canAccessAiDiagnostics(mockDepartmentAdmin), false, 'DEPARTMENT_ADMIN must not have diagnostic access');
    assert.equal(canAccessAiDiagnostics({ role: 'ADMIN', adminRole: 'COLLEGE_ADMIN', id: 4 } as any), false, 'Scoped college admin must not have diagnostic access');
    assert.equal(canAccessAiDiagnostics({ role: 'ADMIN', adminRole: 'DEPARTMENT_ADMIN', id: 5 } as any), false, 'Scoped department admin must not have diagnostic access');
    assert.equal(canAccessAiDiagnostics({ role: 'ADMIN', managedCollegeId: 99, id: 6 } as any), false, 'Admin scoped to managedCollegeId must not have diagnostic access');
    assert.equal(canAccessAiDiagnostics(undefined), false, 'Anonymous actor must not have diagnostic access');

    // Test 4.1: Route-level dispatch for all roles
    aiCircuitBreaker.reset();
    const router = createAiRouter();

    const dispatchStatus = async (user: AuthActor): Promise<{ status: number; body: any }> => {
      const req = new MockExpressRequest({ user });
      const res = new MockExpressResponse();

      return new Promise((resolve) => {
        const routes = (router as any).stack;
        const statusLayer = routes.find((l: any) => l.route?.path === '/status');
        assert(statusLayer, 'Status route must be registered');

        const handler = statusLayer.route.stack[0].handle;
        handler(req as any, res as any, () => {});

        resolve({ status: res.statusCode, body: res.jsonData });
      });
    };

    // 4.1: Normal Student user receives ONLY status enum
    const studentResult = await dispatchStatus(mockStudent);
    assert.equal(studentResult.status, 200);
    assert.deepEqual(studentResult.body, { success: true, data: { status: 'AVAILABLE' } });
    assert.equal('primary' in studentResult.body.data, false);
    assert.equal('fallback' in studentResult.body.data, false);
    assert.equal('circuitState' in studentResult.body.data, false);

    // 4.2: Doctor user receives ONLY status enum
    const doctorResult = await dispatchStatus(mockDoctor);
    assert.equal(doctorResult.status, 200);
    assert.deepEqual(doctorResult.body, { success: true, data: { status: 'AVAILABLE' } });
    assert.equal('primary' in doctorResult.body.data, false);

    // 4.3: Teaching assistant receives ONLY status enum
    const taResult = await dispatchStatus(mockTeachingAssistant);
    assert.equal(taResult.status, 200);
    assert.deepEqual(taResult.body, { success: true, data: { status: 'AVAILABLE' } });
    assert.equal('primary' in taResult.body.data, false);

    // 4.4: Scoped COLLEGE_ADMIN receives ONLY status enum
    const collegeAdminResult = await dispatchStatus(mockCollegeAdmin);
    assert.equal(collegeAdminResult.status, 200);
    assert.deepEqual(collegeAdminResult.body, { success: true, data: { status: 'AVAILABLE' } });
    assert.equal('primary' in collegeAdminResult.body.data, false);

    // 4.5: Scoped DEPARTMENT_ADMIN receives ONLY status enum
    const deptAdminResult = await dispatchStatus(mockDepartmentAdmin);
    assert.equal(deptAdminResult.status, 200);
    assert.deepEqual(deptAdminResult.body, { success: true, data: { status: 'AVAILABLE' } });
    assert.equal('primary' in deptAdminResult.body.data, false);

    // 4.6: SUPER_ADMIN receives diagnostic health metadata
    const superAdminResult = await dispatchStatus(mockSuperAdmin);
    assert.equal(superAdminResult.status, 200);
    assert.equal(superAdminResult.body.data.status, 'AVAILABLE');
    assert.equal(superAdminResult.body.data.primary.provider, 'gemini');
    assert.equal(superAdminResult.body.data.primary.circuitState, 'CLOSED');
    assert.equal(superAdminResult.body.data.fallback.provider, 'none');

    // 4.7: Platform ADMIN receives diagnostic health metadata
    const platformAdminResult = await dispatchStatus(mockPlatformAdmin);
    assert.equal(platformAdminResult.status, 200);
    assert.equal(platformAdminResult.body.data.status, 'AVAILABLE');
    assert.equal(platformAdminResult.body.data.primary.provider, 'gemini');

    // 4.8: Zero secret leakage in admin payload
    const adminJson = JSON.stringify(superAdminResult.body);
    assert.equal(adminJson.includes('gemini-mock-test-key'), false);
    assert.equal(adminJson.includes('openai-mock-test-key'), false);
    assert.equal(adminJson.includes('http'), false);
    assert.equal(adminJson.includes('token'), false);
    assert.equal(adminJson.includes('model'), false);

    console.log('✓ Health status privacy verified: normal & tenant admins receive status only; platform & super admins receive sanitized diagnostics.');
  }

  // =========================================================================
  // 5. ABORT CANCELLATION DOES NOT TRIP CIRCUIT BREAKER
  // =========================================================================
  console.log('[5/5] Testing Circuit Breaker Immunity on Client Aborts...');

  {
    aiCircuitBreaker.reset();

    const clientAbortError = new Error('CLIENT_DISCONNECTED');
    const abortingClient = {
      interactions: {
        create: async () => {
          throw clientAbortError;
        },
      },
    } as any;

    const controller = new AbortController();
    controller.abort(clientAbortError);

    // Run 3 aborted requests
    for (let i = 0; i < 3; i++) {
      await assert.rejects(
        async () => {
          await orchestrateAiRequest(
            'Should abort immediately',
            abortingClient,
            mockStudent,
            undefined,
            [],
            { signal: controller.signal },
          );
        },
        (err: any) => {
          assert.equal(err.statusCode, 499);
          return true;
        },
      );
    }

    // Circuit breaker state must STILL be CLOSED! Client disconnects must NOT penalize provider health!
    const health = aiCircuitBreaker.getStatus('gemini');
    assert.equal(health.state, 'CLOSED');
    assert.equal(health.consecutiveFailures, 0);

    console.log('✓ Circuit breaker correctly ignores client disconnects without penalizing provider health.');
  }

  console.log('========================================================');
  console.log('ALL PHASE 12.1 CANCELLATION, FALLBACK & PRIVACY TESTS PASSED!');
  console.log('========================================================');
}

runCancellationAndPrivacyTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
