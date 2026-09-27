import assert from "node:assert/strict";
import { test } from "node:test";
import http from "node:http";
import express from "express";
import { requestIdMiddleware } from "../src/middleware/requestId.middleware";
import { normalizeRoute, register, httpRequestCounter } from "../src/utils/metrics";
import { metricsAuthMiddleware } from "../src/routes/metrics.routes";

test("OBS-001: Request ID middleware generates fresh UUID v4 when no header provided", () => {
  let capturedReqId: string | undefined;
  let capturedHeader: string | undefined;

  const req: any = { headers: {} };
  const res: any = {
    locals: {},
    setHeader: (name: string, value: string) => {
      if (name === "X-Request-Id") capturedHeader = value;
    },
  };

  requestIdMiddleware(req, res, () => {
    capturedReqId = req.id;
  });

  assert.ok(capturedReqId);
  assert.equal(capturedHeader, capturedReqId);
  // Must match UUID format
  assert.match(capturedReqId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
});

test("OBS-001: Request ID middleware accepts and propagates valid incoming correlation ID", () => {
  const validIncomingId = "upstream-gateway-trace-123456";
  let capturedReqId: string | undefined;
  let capturedHeader: string | undefined;

  const req: any = { headers: { "x-request-id": validIncomingId } };
  const res: any = {
    locals: {},
    setHeader: (name: string, value: string) => {
      if (name === "X-Request-Id") capturedHeader = value;
    },
  };

  requestIdMiddleware(req, res, () => {
    capturedReqId = req.id;
  });

  assert.equal(capturedReqId, validIncomingId);
  assert.equal(capturedHeader, validIncomingId);
  assert.equal(res.locals.requestId, validIncomingId);
});

test("OBS-001: Request ID middleware rejects oversized or malicious header values and generates clean UUID", () => {
  const oversizedId = "a".repeat(200); // Exceeds 128 chars limit
  let capturedReqId: string | undefined;

  const req: any = { headers: { "x-request-id": oversizedId } };
  const res: any = {
    locals: {},
    setHeader: () => {},
  };

  requestIdMiddleware(req, res, () => {
    capturedReqId = req.id;
  });

  assert.notEqual(capturedReqId, oversizedId);
  assert.match(capturedReqId!, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

  // Unsafe characters (e.g. carriage return/newline header injection or HTML)
  const injectionId = "trace\r\nInjected-Header: evil<script>";
  const req2: any = { headers: { "x-request-id": injectionId } };
  requestIdMiddleware(req2, res, () => {
    capturedReqId = req2.id;
  });

  assert.notEqual(capturedReqId, injectionId);
  assert.match(capturedReqId!, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
});

test("OBS-001: Route normalizer prevents high cardinality metrics explosion", () => {
  assert.equal(normalizeRoute("/api/courses/42"), "/api/courses/:id");
  assert.equal(normalizeRoute("/api/students/999/grades"), "/api/students/:id/grades");
  assert.equal(
    normalizeRoute("/api/tasks/550e8400-e29b-41d4-a716-446655440000"),
    "/api/tasks/:id"
  );
  assert.equal(
    normalizeRoute("/api/submissions/60d5ecb8b5c9c6123456789a"),
    "/api/submissions/:id"
  );
  assert.equal(normalizeRoute("/api/auth/login?redirect=dashboard"), "/api/auth/login");
});

test("OBS-001: Metrics endpoint security enforces METRICS_TOKEN in production", () => {
  const origEnv = process.env.NODE_ENV;
  const origToken = process.env.METRICS_TOKEN;

  try {
    process.env.NODE_ENV = "production";
    process.env.METRICS_TOKEN = "super-secret-prometheus-token";

    let nextCalled = false;
    let statusCode: number | null = null;
    let jsonBody: any = null;

    const mockRes: any = {
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: (data: any) => {
        jsonBody = data;
      },
    };

    // 1. Unauthorized request
    metricsAuthMiddleware({ headers: {} } as any, mockRes, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(statusCode, 401);
    assert.equal(jsonBody.status, "unauthorized");

    // 2. Authorized request with Bearer token
    nextCalled = false;
    metricsAuthMiddleware(
      { headers: { authorization: "Bearer super-secret-prometheus-token" } } as any,
      mockRes,
      () => {
        nextCalled = true;
      }
    );
    assert.equal(nextCalled, true);

    // 3. Authorized request with SUPER_ADMIN role
    nextCalled = false;
    metricsAuthMiddleware(
      { headers: {}, user: { role: "SUPER_ADMIN" } } as any,
      mockRes,
      () => {
        nextCalled = true;
      }
    );
    assert.equal(nextCalled, true);
  } finally {
    process.env.NODE_ENV = origEnv;
    process.env.METRICS_TOKEN = origToken;
  }
});

test("OBS-001: Prometheus metrics registry formats and outputs standard metrics", async () => {
  httpRequestCounter.inc({ method: "GET", route: "/api/healthz", status_code: "200" });

  const output = await register.metrics();
  assert.ok(output.includes("ums_http_requests_total"));
  assert.ok(output.includes('route="/api/healthz"'));
  assert.ok(output.includes("ums_active_connections") || output.includes("ums_http_active_connections"));
});
