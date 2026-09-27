import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webSrcDir = path.resolve(__dirname, '../src');

// Dynamically load and transpile the ACTUAL production helper without reimplementation
async function loadProductionRefreshLock() {
  const rootPackageJson = path.resolve(__dirname, '../../../package.json');
  const req = createRequire(rootPackageJson);
  const ts = req('typescript');

  const helperPath = path.join(webSrcDir, 'services/refreshLock.ts');
  const source = fs.readFileSync(helperPath, 'utf8');

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const dataUri =
    'data:text/javascript;base64,' +
    Buffer.from(transpiled).toString('base64');
  return await import(dataUri);
}

describe('SESSION-P1C-01: Multi-Tab Refresh Coordination (Production Runtime Verification)', () => {
  let originalNavigator;

  beforeEach(() => {
    originalNavigator = globalThis.navigator;
  });

  afterEach(() => {
    globalThis.navigator = originalNavigator;
  });

  it('1. Lock Name & Runtime Execution: Actual production helper requests "auth-token-refresh"', async () => {
    const { withCrossTabRefreshLock } = await loadProductionRefreshLock();
    assert.equal(typeof withCrossTabRefreshLock, 'function', 'Must export withCrossTabRefreshLock');

    let requestedLockName = null;
    let callbackExecuted = false;

    globalThis.navigator = {
      locks: {
        request: async (name, fn) => {
          requestedLockName = name;
          return await fn();
        },
      },
    };

    const result = await withCrossTabRefreshLock(async () => {
      callbackExecuted = true;
      return 'OK-VALUE';
    });

    assert.equal(requestedLockName, 'auth-token-refresh', 'Production helper must request auth-token-refresh');
    assert.equal(callbackExecuted, true, 'Production helper must execute the passed callback');
    assert.equal(result, 'OK-VALUE', 'Production helper must return callback result');
  });

  it('2. Runtime Concurrent Serialization: Actual production helper serializes concurrent calls without overlap', async () => {
    const { withCrossTabRefreshLock } = await loadProductionRefreshLock();

    // Mock realistic exclusive Web Locks serialization queue in globalThis.navigator
    const lockQueue = [];
    let isHeld = false;
    let concurrentExecutionCount = 0;
    let maxObservedConcurrency = 0;

    globalThis.navigator = {
      locks: {
        request: async (name, callback) => {
          assert.equal(name, 'auth-token-refresh');
          if (isHeld) {
            await new Promise((resolve) => lockQueue.push(resolve));
          }
          isHeld = true;
          concurrentExecutionCount++;
          if (concurrentExecutionCount > maxObservedConcurrency) {
            maxObservedConcurrency = concurrentExecutionCount;
          }

          try {
            return await callback();
          } finally {
            concurrentExecutionCount--;
            isHeld = false;
            const next = lockQueue.shift();
            if (next) next();
          }
        },
      },
    };

    const executionLog = [];

    // Call actual production withCrossTabRefreshLock twice concurrently
    const callA = withCrossTabRefreshLock(async () => {
      executionLog.push('A starts');
      await new Promise((resolve) => setTimeout(resolve, 25));
      executionLog.push('A finishes');
      return 'RESULT_A';
    });

    const callB = withCrossTabRefreshLock(async () => {
      executionLog.push('B starts');
      await new Promise((resolve) => setTimeout(resolve, 10));
      executionLog.push('B finishes');
      return 'RESULT_B';
    });

    const [resA, resB] = await Promise.all([callA, callB]);

    assert.equal(resA, 'RESULT_A');
    assert.equal(resB, 'RESULT_B');
    assert.equal(maxObservedConcurrency, 1, 'Lock must strictly serialize executions (max concurrency = 1)');
    assert.deepEqual(
      executionLog,
      ['A starts', 'A finishes', 'B starts', 'B finishes'],
      'Execution order must be strictly serialized with zero overlap'
    );
  });

  it('3. Runtime Error Release: Exception in callback cleanly releases lock and does not deadlock future calls', async () => {
    const { withCrossTabRefreshLock } = await loadProductionRefreshLock();

    const lockQueue = [];
    let isHeld = false;

    globalThis.navigator = {
      locks: {
        request: async (name, callback) => {
          assert.equal(name, 'auth-token-refresh');
          if (isHeld) {
            await new Promise((resolve) => lockQueue.push(resolve));
          }
          isHeld = true;
          try {
            return await callback();
          } finally {
            isHeld = false;
            const next = lockQueue.shift();
            if (next) next();
          }
        },
      },
    };

    // First call rejects with network/token error
    await assert.rejects(
      withCrossTabRefreshLock(async () => {
        throw new Error('Refresh 401 Unauthorized');
      }),
      /Refresh 401 Unauthorized/
    );

    // Second call immediately follows
    let secondCallRan = false;
    const secondResult = await withCrossTabRefreshLock(async () => {
      secondCallRan = true;
      return 'RECOVERED';
    });

    assert.equal(secondCallRan, true, 'Second call must execute immediately without deadlocking');
    assert.equal(secondResult, 'RECOVERED');
  });

  it('4. Runtime Fallback: Executes callback exactly once when navigator.locks is unavailable', async () => {
    const { withCrossTabRefreshLock } = await loadProductionRefreshLock();

    // 4a. navigator without locks
    globalThis.navigator = {};
    let runCount1 = 0;
    const res1 = await withCrossTabRefreshLock(async () => {
      runCount1++;
      return 'FALLBACK_1';
    });
    assert.equal(runCount1, 1, 'Must execute callback exactly once when locks is missing');
    assert.equal(res1, 'FALLBACK_1');

    // 4b. navigator completely undefined
    delete globalThis.navigator;
    let runCount2 = 0;
    const res2 = await withCrossTabRefreshLock(async () => {
      runCount2++;
      return 'FALLBACK_2';
    });
    assert.equal(runCount2, 1, 'Must execute callback exactly once when navigator is undefined');
    assert.equal(res2, 'FALLBACK_2');
  });

  it('5. Production Interceptor Wiring: api.ts imports refreshLock and wraps performRefresh with withCrossTabRefreshLock', () => {
    const apiPath = path.join(webSrcDir, 'services/api.ts');
    const content = fs.readFileSync(apiPath, 'utf8');

    // Source assertion for interceptor wiring:
    assert.ok(
      content.includes("import { withCrossTabRefreshLock } from './refreshLock';"),
      'api.ts must import withCrossTabRefreshLock from ./refreshLock'
    );
    assert.ok(
      content.includes('export { withCrossTabRefreshLock };'),
      'api.ts must re-export withCrossTabRefreshLock'
    );
    assert.ok(
      content.includes('return withCrossTabRefreshLock(() => performRefresh());'),
      'Production response interceptor refresh path must invoke withCrossTabRefreshLock(() => performRefresh())'
    );
  });

  it('6. Security property: No access or refresh token is persisted to localStorage or sessionStorage', () => {
    const apiPath = path.join(webSrcDir, 'services/api.ts');
    const authContextPath = path.join(webSrcDir, 'context/AuthContext.tsx');
    const apiContent = fs.readFileSync(apiPath, 'utf8');
    const authContent = fs.readFileSync(authContextPath, 'utf8');

    const forbiddenStoragePattern = /(localStorage|sessionStorage)\.setItem\s*\(\s*['"`](accessToken|refreshToken|token|auth)/i;

    assert.equal(
      forbiddenStoragePattern.test(apiContent),
      false,
      'api.ts must not store tokens in localStorage or sessionStorage'
    );
    assert.equal(
      forbiddenStoragePattern.test(authContent),
      false,
      'AuthContext.tsx must not store tokens in localStorage or sessionStorage'
    );
  });

  it('7. Security property: No token is transmitted through BroadcastChannel', () => {
    function scanDirForBroadcast(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDirForBroadcast(fullPath);
        } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
          const code = fs.readFileSync(fullPath, 'utf8');
          if (code.includes('BroadcastChannel')) {
            assert.equal(
              code.includes('refreshToken'),
              false,
              `File ${entry.name} must never send refresh tokens over BroadcastChannel`
            );
          }
        }
      }
    }

    scanDirForBroadcast(webSrcDir);
  });

  it('8. Same-runtime coordination: isRefreshing and failedQueue preserve single-tab deduplication', () => {
    const apiPath = path.join(webSrcDir, 'services/api.ts');
    const content = fs.readFileSync(apiPath, 'utf8');

    assert.ok(content.includes('let isRefreshing = false;'), 'Must maintain in-memory isRefreshing flag');
    assert.ok(content.includes('let failedQueue: any[] = [];'), 'Must maintain in-memory failedQueue');
    assert.ok(content.includes('processQueue(null, accessToken);'), 'Must process queue upon success');
    assert.ok(content.includes('processQueue(refreshError, null);'), 'Must reject queue upon failure');
  });
});
