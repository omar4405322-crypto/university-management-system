import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import globalErrorHandler from '../src/middleware/error.middleware';
import { NotFoundError, ValidationError, ConflictError } from '../src/utils/appError';
import logger from '../src/utils/logger';

async function withServer(
  app: express.Express,
  run: (endpoint: string) => Promise<void>
): Promise<void> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

test('SEC-001: Production mode hides stack traces and emits reference error ID', async () => {
  const originalEnv = process.env.NODE_ENV;
  const originalConsoleError = console.error;
  const originalLoggerError = logger.error;

  process.env.NODE_ENV = 'production';
  let consoleErrorCalled = false;
  const loggedErrors: any[] = [];

  console.error = () => {
    consoleErrorCalled = true;
  };

  logger.error = (msg: string, meta?: any) => {
    loggedErrors.push({ msg, meta });
    return logger;
  };

  try {
    const app = express();
    app.get('/crash', () => {
      const err = new Error('Sensitive database connection string: postgres://user:secret@db:5432/main');
      err.stack = 'Error: Sensitive database connection string\n    at /internal/db.ts:42:15';
      throw err;
    });
    app.use(globalErrorHandler);

    await withServer(app, async (endpoint) => {
      const res = await fetch(`${endpoint}/crash`, {
        headers: { 'X-Request-Id': 'req-test-123' },
      });

      assert.equal(res.status, 500);
      assert.equal(res.headers.get('X-Error-Id'), 'req-test-123');

      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.status, 'error');
      assert.equal(body.errorId, 'req-test-123');
      assert.match(body.message, /Something went wrong\. Reference: req-test-123/);
      assert.equal(body.stack, undefined, 'Stack trace must not be exposed to client in production');
      assert.equal(JSON.stringify(body).includes('secret'), false, 'Sensitive DB secret must not be exposed in client response');

      // Console error must NOT be called in production
      assert.equal(consoleErrorCalled, false, 'console.error must not be called in production');

      // Logger error must not leak raw stack in meta
      assert.equal(loggedErrors.length, 1);
      const meta = loggedErrors[0].meta;
      assert.equal(meta.errorId, 'req-test-123');
      assert.equal(meta.stack, undefined, 'Logger meta must not contain raw stack trace in production');
      assert.equal(meta.statusCode, 500);
    });
  } finally {
    process.env.NODE_ENV = originalEnv;
    console.error = originalConsoleError;
    logger.error = originalLoggerError;
  }
});

test('SEC-001: Operational 4xx errors preserve status codes and messages in production', async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    const app = express();
    app.get('/not-found', () => {
      throw new NotFoundError('Student profile not found');
    });
    app.get('/validation', () => {
      throw new ValidationError('Invalid student ID format');
    });
    app.get('/conflict', () => {
      throw new ConflictError('Course enrollment already exists');
    });
    app.use(globalErrorHandler);

    await withServer(app, async (endpoint) => {
      // Test 404
      const res404 = await fetch(`${endpoint}/not-found`);
      assert.equal(res404.status, 404);
      const body404 = await res404.json();
      assert.equal(body404.message, 'Student profile not found');
      assert.ok(body404.errorId);

      // Test 422 (ValidationError)
      const res422 = await fetch(`${endpoint}/validation`);
      assert.equal(res422.status, 422);
      const body422 = await res422.json();
      assert.equal(body422.message, 'Invalid student ID format');
      assert.ok(body422.errorId);

      // Test 409
      const res409 = await fetch(`${endpoint}/conflict`);
      assert.equal(res409.status, 409);
      const body409 = await res409.json();
      assert.equal(body409.message, 'Course enrollment already exists');
      assert.ok(body409.errorId);
    });
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test('SEC-001: Development mode retains diagnostic error and stack information for developers', async () => {
  const originalEnv = process.env.NODE_ENV;
  const originalConsoleError = console.error;
  process.env.NODE_ENV = 'development';

  // Mute console.error during test
  console.error = () => {};

  try {
    const app = express();
    app.get('/dev-crash', () => {
      throw new Error('Dev specific diagnostic error');
    });
    app.use(globalErrorHandler);

    await withServer(app, async (endpoint) => {
      const res = await fetch(`${endpoint}/dev-crash`);
      assert.equal(res.status, 500);

      const body = await res.json();
      assert.equal(body.message, 'Dev specific diagnostic error');
      assert.ok(body.stack, 'Development response must retain stack trace for debugging');
      assert.ok(body.errorId);
    });
  } finally {
    process.env.NODE_ENV = originalEnv;
    console.error = originalConsoleError;
  }
});
