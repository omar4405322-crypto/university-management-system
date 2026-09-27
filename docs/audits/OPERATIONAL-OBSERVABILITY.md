# Operational Observability & Alerting Guide (OBS-001)

> **Document Status:** Initial Phase 5 Baseline.
> **Note on Thresholds:** Alert rules and thresholds documented below represent initial conservative engineering targets. Production runtime validation and fine-tuning must be verified during **Phase 9**.

---

## 1. Request Correlation & Distributed Tracing

Every HTTP request entering the application is tagged with a correlation identifier:
- **Header:** `X-Request-Id` (accepted from upstream load-balancer/gateway or generated as a UUID v4).
- **Validation:** Must match `^[a-zA-Z0-9_-]{1,128}$`. Any missing, malformed, or oversized value is stripped and replaced with a fresh UUID to prevent header injection.
- **Propagation:**
  - Attached to Express `req.id` and `res.locals.requestId`.
  - Emitted in the response header `X-Request-Id`.
  - Tagged into Sentry error reports (`Sentry.setTag('requestId', validId)`).
  - Included in all structured JSON HTTP completion logs.

---

## 2. Structured HTTP Request Logging

Request completion logs are output via Winston in JSON format in production:
- **Captured fields:** `timestamp`, `level`, `requestId`, `method`, `path`, `route` (normalized pattern), `status`, `durationMs`, `actorId`, `actorRole`, `ip`.
- **Privacy Guarantees:**
  - Passwords, tokens, cookies, authorization headers, and request bodies are **never** logged.
  - High-volume health check probes (`/api/health`, `/api/healthz`, `/api/ready`) are silenced from production logs when returning 200 OK.

---

## 3. Prometheus Metrics & Scrape Endpoint

Metrics are exposed via the `/metrics` endpoint using standard Prometheus exposition format.

### Metrics Endpoint Security Policy
- **Public Protection:** The `/metrics` endpoint is protected against unauthenticated internet scrapers.
- **Authentication Methods:**
  1. `METRICS_TOKEN` environment variable: Scrapers must send `Authorization: Bearer <METRICS_TOKEN>` or header `x-metrics-token: <METRICS_TOKEN>`.
  2. Authenticated `SUPER_ADMIN` session: Administrators can access `/metrics` with their session JWT.
  3. Non-production fallback: In `development` and `test` environments when `METRICS_TOKEN` is unset, local access is permitted.

### Core Metrics Catalog

| Metric Name | Type | Labels | Description |
|---|---|---|---|
| `ums_http_requests_total` | Counter | `method`, `route`, `status_code` | Total count of processed HTTP requests. |
| `ums_http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Latency histogram (buckets: 5ms to 10s). |
| `ums_http_active_connections` | Gauge | None | Number of in-flight HTTP requests. |
| `ums_socketio_connected_clients` | Gauge | None | Active Socket.IO client connections. |
| `ums_cron_job_executions_total` | Counter | `job_name`, `status` | Total cron job executions (success/failure). |
| `ums_cron_job_duration_seconds` | Histogram | `job_name` | Runtime duration of scheduled jobs. |
| `ums_database_up` | Gauge | None | PostgreSQL health probe (1 = UP, 0 = DOWN). |
| `ums_redis_up` | Gauge | None | Redis connection probe (1 = UP, 0 = DOWN). |
| `ums_process_cpu_seconds_total` | Counter | None | Node.js process CPU utilization. |
| `ums_nodejs_heap_size_used_bytes` | Gauge | None | V8 heap memory usage. |

*Note: High-cardinality values (user IDs, emails, dynamic entity IDs) are strictly excluded from metric labels. Routes are normalized to patterns (e.g., `/api/courses/:id`).*

---

## 4. Service Level Indicators (SLIs) & Objectives (SLOs)

| Objective | Target (SLO) | Indicator Calculation (SLI) | Alert Condition |
|---|---|---|---|
| **API Availability** | 99.9% uptime over 30d | `sum(rate(ums_http_requests_total{status_code!~"5.."}[5m])) / sum(rate(ums_http_requests_total[5m]))` | Availability < 99.5% for > 5m |
| **API Latency (p95)** | < 500ms | `histogram_quantile(0.95, sum(rate(ums_http_request_duration_seconds_bucket[5m])) by (le))` | p95 > 1000ms for > 5m |
| **5xx Error Rate** | < 0.1% | `sum(rate(ums_http_requests_total{status_code=~"5.."}[5m])) / sum(rate(ums_http_requests_total[5m]))` | 5xx rate > 1% for > 2m |
| **Database Health** | 100% reachable | `ums_database_up == 1` | `ums_database_up == 0` for > 30s |
| **Redis Health** | 99.9% reachable | `ums_redis_up == 1` | `ums_redis_up == 0` for > 60s |
| **Cron Success Rate** | 100% of nightly runs | `rate(ums_cron_job_executions_total{status="failed"}[1h])` | Any failed execution on risk detection |
| **Socket Adapter Health**| Connected | `ums_socketio_connected_clients` & adapter pub/sub | Redis disconnected in production |

---

## 5. Initial Alert Rules Configuration (PromQL)

```yaml
groups:
  - name: ums-production-alerts
    rules:
      - alert: DatabaseUnavailable
        expr: ums_database_up == 0
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL Database connection failed"
          description: "API server unable to ping PostgreSQL database for > 30 seconds."

      - alert: RedisUnavailable
        expr: ums_redis_up == 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Redis Cache and Lock service unavailable"
          description: "Redis instance is down. Caching degraded and distributed cron executions are blocked."

      - alert: HighHttpErrorRate5xx
        expr: (sum(rate(ums_http_requests_total{status_code=~"5.."}[5m])) / sum(rate(ums_http_requests_total[5m]))) > 0.01
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "HTTP 5xx error rate exceeded 1%"
          description: "Elevated 5xx responses detected over 5m sliding window."

      - alert: HighHttpLatencyP95
        expr: histogram_quantile(0.95, sum(rate(ums_http_request_duration_seconds_bucket[5m])) by (le)) > 1.0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P95 API request latency exceeded 1 second"
          description: "API response times degraded for > 5 minutes."

      - alert: CronJobFailed
        expr: increase(ums_cron_job_executions_total{status="failed"}[1h]) > 0
        labels:
          severity: warning
        annotations:
          summary: "Scheduled job execution failed"
          description: "A background cron task encountered an unhandled error during execution."
```
