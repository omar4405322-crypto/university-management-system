import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import {
  gracefulShutdown,
  isShuttingDown,
  setShuttingDown,
  resetShutdownState,
} from "../src/utils/shutdown";
import { createReadinessHandler } from "../src/app";

beforeEach(() => {
  resetShutdownState();
});

test("BE-001: Graceful shutdown coordinator sets isShuttingDown and runs all drain steps in order", async () => {
  const callOrder: string[] = [];
  let exitCodeReceived: number | null = null;

  const mockServer = {
    close: (cb: (err?: Error) => void) => {
      callOrder.push("http_close");
      cb();
    },
  };

  const mockDeps = {
    server: mockServer as any,
    stopCron: () => {
      callOrder.push("stop_cron");
    },
    closeSockets: async () => {
      callOrder.push("close_sockets");
    },
    disconnectPrisma: async () => {
      callOrder.push("disconnect_prisma");
    },
    closeRedisConnections: async () => {
      callOrder.push("close_redis");
    },
    flushLogs: () => {
      callOrder.push("flush_logs");
    },
    exit: (code: number) => {
      exitCodeReceived = code;
    },
    timeoutMs: 2000,
  };

  assert.equal(isShuttingDown(), false);

  await gracefulShutdown("SIGTERM", 0, mockDeps);

  assert.equal(isShuttingDown(), true);
  assert.deepEqual(callOrder, [
    "stop_cron",
    "http_close",
    "close_sockets",
    "disconnect_prisma",
    "close_redis",
    "flush_logs",
  ]);
  assert.equal(exitCodeReceived, 0);
});

test("BE-001: Graceful shutdown handles SIGINT and propagates exit code", async () => {
  let exitedCode: number | null = null;
  let cronStopped = false;

  await gracefulShutdown("SIGINT", 0, {
    stopCron: () => {
      cronStopped = true;
    },
    closeSockets: async () => {},
    disconnectPrisma: async () => {},
    closeRedisConnections: async () => {},
    exit: (code: number) => {
      exitedCode = code;
    },
    timeoutMs: 1000,
  });

  assert.equal(cronStopped, true);
  assert.equal(exitedCode, 0);
});

test("BE-001: Graceful shutdown is idempotent when called multiple times concurrently", async () => {
  let executionCount = 0;
  let exitCalls = 0;

  const mockDeps = {
    stopCron: async () => {
      executionCount += 1;
      await new Promise((r) => setTimeout(r, 20));
    },
    closeSockets: async () => {},
    disconnectPrisma: async () => {},
    closeRedisConnections: async () => {},
    exit: () => {
      exitCalls += 1;
    },
    timeoutMs: 1000,
  };

  const [res1, res2] = await Promise.all([
    gracefulShutdown("FIRST_CALL", 0, mockDeps),
    gracefulShutdown("SECOND_CALL", 0, mockDeps),
  ]);

  assert.equal(executionCount, 1, "Drain operations must execute exactly once");
  assert.equal(exitCalls, 1, "Exit function must be called only once");
});

test("BE-001: Forces exit with code 1 if shutdown deadline expires", async () => {
  let forcedExitCode: number | null = null;

  const mockDeps = {
    stopCron: () => new Promise(() => {}), // never resolves (simulates hanging task)
    exit: (code: number) => {
      forcedExitCode = code;
    },
    timeoutMs: 100, // short timeout for testing
  };

  await gracefulShutdown("TIMEOUT_TEST", 0, mockDeps);

  assert.equal(forcedExitCode, 1, "Forced exit code must be 1 on timeout");
  assert.equal(isShuttingDown(), true);
});

test("BE-001: Readiness endpoint fails (503 not_ready) when isShuttingDown is true", async () => {
  // Test with isShuttingDown = false
  let statusResult: number | null = null;
  let jsonResult: any = null;

  const mockRes = {
    status: (code: number) => {
      statusResult = code;
      return mockRes;
    },
    json: (body: any) => {
      jsonResult = body;
    },
  };

  const readinessHandler = createReadinessHandler(
    () => ({ configured: true, connected: true, status: "ready" }),
    () => true // shutting down
  );

  await readinessHandler({} as any, mockRes as any);

  assert.equal(statusResult, 503);
  assert.equal(jsonResult.status, "not_ready");
  assert.equal(jsonResult.shuttingDown, true);
});
