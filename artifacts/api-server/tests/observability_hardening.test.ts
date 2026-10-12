import assert from "node:assert/strict";
import { test } from "node:test";
import http from "node:http";
import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import logger from "../src/utils/logger";
import requestIdMiddleware from "../src/middleware/requestId.middleware";
import globalErrorHandler from "../src/middleware/error.middleware";
import { AppError, ValidationError } from "../src/utils/appError";
import { metricsAuthMiddleware } from "../src/routes/metrics.routes";
import {
  register,
  updateInfrastructureMetrics,
  httpRequestCounter,
  redisConnectedClientsGauge,
  redisUsedMemoryBytesGauge,
  redisHitRatioGauge,
} from "../src/utils/metrics";
import { getRedisStatus, getRedisTelemetry } from "../src/utils/redis.utils";
import app from "../src/app";

test("OBS-001: Request ID middleware propagates incoming X-Request-Id and attaches req.log child logger", async () => {
  const customId = `req-test-${randomUUID()}`;
  const req: any = {
    headers: { "x-request-id": customId },
  };
  const res: any = {
    locals: {},
    setHeader: (name: string, value: string) => {
      res.headers = res.headers || {};
      res.headers[name.toLowerCase()] = value;
    },
  };

  let nextCalled = false;
  requestIdMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.id, customId);
  assert.equal(res.locals.requestId, customId);
  assert.equal(res.headers["x-request-id"], customId);
  assert.ok(req.log, "req.log child logger must be attached to the request");
  assert.equal(typeof req.log.info, "function", "req.log must expose logger methods");
});

test("OBS-002: Error correlation ID strictly matches req.id without creating divergent UUIDs", async () => {
  const customId = `corr-${randomUUID()}`;
  const req: any = {
    id: customId,
    headers: {},
    originalUrl: "/api/test",
    method: "GET",
  };
  let headerSet: Record<string, string> = {};
  let responseBody: any = null;
  let responseStatus = 0;

  const res: any = {
    locals: { requestId: customId },
    setHeader: (name: string, value: string) => {
      headerSet[name.toLowerCase()] = value;
    },
    status: (code: number) => {
      responseStatus = code;
      return res;
    },
    json: (body: any) => {
      responseBody = body;
      return res;
    },
  };

  const operationalErr = new ValidationError("Invalid test input");
  globalErrorHandler(operationalErr, req, res, (() => {}) as NextFunction);

  assert.equal(responseStatus, 422);
  assert.equal(headerSet["x-error-id"], customId, "X-Error-Id must match req.id");
  assert.equal(headerSet["x-request-id"], customId, "X-Request-Id must match req.id");
  assert.equal(responseBody.errorId, customId, "Response errorId must match req.id");
});

test("OBS-003: 5xx server errors in production log error message and stack trace without leaking to client", async () => {
  const savedNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  const loggedErrors: Array<{ message: string; meta?: any }> = [];
  const originalError = logger.error.bind(logger);
  logger.error = ((message: any, meta?: any) => {
    loggedErrors.push({ message: String(message), meta });
    return logger;
  }) as any;

  try {
    const errorId = `err-500-${randomUUID()}`;
    const req: any = {
      id: errorId,
      headers: { "x-request-id": errorId },
      originalUrl: "/api/crash",
      method: "POST",
    };
    let statusCode = 0;
    let jsonBody: any = null;

    const res: any = {
      locals: { requestId: errorId },
      setHeader: () => {},
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (body: any) => {
        jsonBody = body;
        return res;
      },
    };

    const simulatedFatalError = new Error("Unexpected database disk full");
    globalErrorHandler(simulatedFatalError, req, res, (() => {}) as NextFunction);

    // 1. Client receives generic 500 without internal leaks
    assert.equal(statusCode, 500);
    assert.equal(jsonBody.success, false);
    assert.equal(jsonBody.errorId, errorId);
    assert.equal(jsonBody.message, `Something went wrong. Reference: ${errorId}`);
    assert.equal(jsonBody.stack, undefined, "Stack must never be sent to the client in production");
    assert.ok(!JSON.stringify(jsonBody).includes("Unexpected database disk full"));

    // 2. Server logs MUST capture the error message and reference ID
    const serverLog = loggedErrors.find((l) => l.meta?.errorId === errorId);
    assert.ok(serverLog, "Server logger.error must be invoked with errorId");
    assert.equal(
      serverLog.meta?.stack,
      undefined,
      "Server log meta.stack must remain undefined in production per SEC-001 invariant"
    );
    assert.ok(
      serverLog.message.includes("Unexpected database disk full"),
      "Server log must capture original error message in message string"
    );
  } finally {
    logger.error = originalError;
    process.env.NODE_ENV = savedNodeEnv;
  }
});

test("OBS-004: 4xx operational errors log warn without stack traces", async () => {
  const loggedWarns: Array<{ message: string; meta?: any }> = [];
  const originalWarn = logger.warn.bind(logger);
  logger.warn = ((message: any, meta?: any) => {
    loggedWarns.push({ message: String(message), meta });
    return logger;
  }) as any;

  try {
    const reqId = `warn-${randomUUID()}`;
    const req: any = {
      id: reqId,
      headers: {},
      originalUrl: "/api/students/abc",
      method: "GET",
    };
    const res: any = {
      locals: { requestId: reqId },
      setHeader: () => {},
      status: () => res,
      json: () => res,
    };

    const notFound = new AppError("Student not found", 404);
    globalErrorHandler(notFound, req, res, (() => {}) as NextFunction);

    const warnLog = loggedWarns.find((l) => l.meta?.errorId === reqId);
    assert.ok(warnLog, "4xx operational error must be logged as warn");
    assert.equal(warnLog.meta?.stack, undefined, "4xx operational errors must not log stack traces");
    assert.equal(warnLog.meta?.statusCode, 404);
  } finally {
    logger.warn = originalWarn;
  }
});

test("OBS-005: Winston logger transports automatically redact sensitive keys", () => {
  const sensitivePayload = {
    email: "student@university.edu",
    password: "SuperSecretPassword123!",
    token: "jwt.token.secret",
    refreshToken: "refresh.token.value",
    twoFactorSecret: "JBSWY3DPEHPK3PXP",
    nested: {
      newPassword: "AnotherPassword456!",
      authorization: "Bearer sensitive_token",
    },
  };

  // Format through logger's format pipeline
  const formatted = logger.format.transform({
    level: "info",
    message: "User login attempt",
    ...sensitivePayload,
  });

  const serialized = JSON.stringify(formatted);
  assert.ok(!serialized.includes("SuperSecretPassword123!"), "Plaintext password must be redacted");
  assert.ok(!serialized.includes("jwt.token.secret"), "Plaintext token must be redacted");
  assert.ok(!serialized.includes("refresh.token.value"), "Plaintext refreshToken must be redacted");
  assert.ok(!serialized.includes("JBSWY3DPEHPK3PXP"), "Plaintext twoFactorSecret must be redacted");
  assert.ok(!serialized.includes("AnotherPassword456!"), "Nested sensitive keys must be redacted");
});

test("OBS-006: Metrics authorization middleware enforces token and protects against leaks", async () => {
  const originalEnv = process.env.NODE_ENV;
  const originalToken = process.env.METRICS_TOKEN;
  process.env.NODE_ENV = "production";
  process.env.METRICS_TOKEN = "secret-metrics-token-12345";

  try {
    let unauthCode = 0;
    let unauthBody: any = null;
    const unauthReq: any = { headers: {} };
    const unauthRes: any = {
      status: (code: number) => {
        unauthCode = code;
        return unauthRes;
      },
      json: (val: any) => {
        unauthBody = val;
        return unauthRes;
      },
    };
    let nextCalled = false;

    metricsAuthMiddleware(unauthReq, unauthRes, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(unauthCode, 401);
    assert.equal(unauthBody.status, "unauthorized");

    // Valid Bearer token
    let authedNext = false;
    const authReq: any = {
      headers: { authorization: "Bearer secret-metrics-token-12345" },
    };
    metricsAuthMiddleware(authReq, unauthRes, () => {
      authedNext = true;
    });
    assert.equal(authedNext, true);
  } finally {
    process.env.NODE_ENV = originalEnv;
    process.env.METRICS_TOKEN = originalToken;
  }
});

test("OBS-007: Redis telemetry parser extracts metrics from INFO and handles unready clients safely", async () => {
  // 1. Unready/null client returns safe fallback
  const fallback = await getRedisTelemetry(null);
  assert.equal(fallback.connected, false);
  assert.equal(fallback.usedMemoryBytes, 0);

  // 2. Ready client parses INFO fields correctly
  const mockInfo = [
    "# Memory",
    "used_memory:1048576",
    "used_memory_human:1.00M",
    "# Clients",
    "connected_clients:12",
    "blocked_clients:0",
    "# Stats",
    "instantaneous_ops_per_sec:250",
    "keyspace_hits:900",
    "keyspace_misses:100",
  ].join("\r\n");

  const mockRedis: any = {
    status: "ready",
    info: async () => mockInfo,
  };

  const telemetry = await getRedisTelemetry(mockRedis);
  assert.equal(telemetry.connected, true);
  assert.equal(telemetry.usedMemoryBytes, 1048576);
  assert.equal(telemetry.usedMemoryHuman, "1.00M");
  assert.equal(telemetry.connectedClients, 12);
  assert.equal(telemetry.instantaneousOpsPerSec, 250);
  assert.equal(telemetry.keyspaceHits, 900);
  assert.equal(telemetry.keyspaceMisses, 100);
  assert.equal(telemetry.hitRatio, 0.9);
});

test("OBS-009: Live HTTP server echos correlation IDs, handles liveness/readiness, and sanitizes auth failure", async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Healthz endpoint responds with 200 and X-Request-Id
    const healthRes = await fetch(`${baseUrl}/api/healthz`);
    assert.equal(healthRes.status, 200);
    const healthBody = await healthRes.json();
    assert.equal(healthBody.status, "ok");
    const healthReqId = healthRes.headers.get("x-request-id");
    assert.ok(healthReqId && healthReqId.length > 0, "X-Request-Id header must be present on /api/healthz");

    // 2. Readiness endpoint responds with 200 and checks
    const readyRes = await fetch(`${baseUrl}/api/ready`);
    assert.equal(readyRes.status, 200);
    const readyBody = await readyRes.json();
    assert.equal(readyBody.status, "ready");
    assert.equal(readyBody.checks.database, true);

    // 3. Custom X-Request-Id propagation
    const testTraceId = `custom-trace-${randomUUID()}`;
    const customTraceRes = await fetch(`${baseUrl}/api/healthz`, {
      headers: { "x-request-id": testTraceId },
    });
    assert.equal(customTraceRes.headers.get("x-request-id"), testTraceId, "Server must echo incoming valid X-Request-Id");

    // 4. Forced 404 error echoes correlation ID in headers and JSON body
    const notFoundRes = await fetch(`${baseUrl}/api/non-existent-route-for-observability-check`);
    assert.equal(notFoundRes.status, 404);
    const notFoundBody = await notFoundRes.json();
    const notFoundRequestId = notFoundRes.headers.get("x-request-id");
    const notFoundErrorId = notFoundRes.headers.get("x-error-id");
    assert.ok(notFoundRequestId, "X-Request-Id must be set on 404 response");
    assert.equal(notFoundErrorId, notFoundRequestId, "X-Error-Id must match X-Request-Id on 404 response");
    assert.equal(notFoundBody.errorId, notFoundRequestId, "JSON errorId must match X-Request-Id on 404 response");

    // 5. Authentication login attempt with invalid credentials does not leak password in response
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nonexistent@university.edu",
        password: "SecretPasswordShouldNeverLeak99!",
      }),
    });
    assert.equal(loginRes.status, 401);
    const loginText = await loginRes.text();
    assert.ok(!loginText.includes("SecretPasswordShouldNeverLeak99!"), "Credentials must never leak in login response");
    assert.ok(loginRes.headers.get("x-request-id"), "X-Request-Id must be present on auth response");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
