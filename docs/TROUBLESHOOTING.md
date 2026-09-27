# Troubleshooting & Incident Remediation Runbook

This runbook outlines diagnosis and remediation steps for common operational issues across the University Management System.

---

## 1. PostgreSQL Database Issues

### Symptom: API crashes on startup or `/api/ready` returns 503
- **Root Cause:** PostgreSQL container is down, unreachable, or credentials in `DATABASE_URL` do not match.
- **Diagnosis:**
  ```sh
  docker compose --env-file deploy.env ps db
  docker compose --env-file deploy.env logs db --tail 100
  ```
- **Remediation:**
  1. Verify the database container healthcheck: `docker compose exec db pg_isready -U university -d university`.
  2. Confirm `DATABASE_URL` in `deploy.env` contains URL-encoded credentials without unescaped special characters.
  3. If storage is exhausted, free disk space on the host volume (`postgres_data`).

### Symptom: Prisma connection pool exhaustion (`Timed out fetching a new connection from the pool`)
- **Root Cause:** Too many concurrent database connections or unclosed transactions.
- **Diagnosis:** Inspect active PostgreSQL connections:
  ```sql
  SELECT count(*), state FROM pg_stat_activity GROUP BY state;
  ```
- **Remediation:**
  1. Ensure `connection_limit` parameter is appropriately tuned in `DATABASE_URL` (e.g. `?connection_limit=25`).
  2. Restart the API cluster to release orphaned connections: `docker compose --env-file deploy.env restart api`.

---

## 2. Redis & Distributed Lock Issues

### Symptom: Readiness probe 503 or warnings regarding Redis connection
- **Root Cause:** Redis container stopped, crashed, or memory limit reached.
- **Diagnosis:**
  ```sh
  docker compose --env-file deploy.env exec redis redis-cli ping
  docker compose --env-file deploy.env logs redis --tail 50
  ```
- **Remediation:**
  1. Verify Redis is running and responding with `PONG`.
  2. In local development or degraded mode, the rate limiters and loggers fall back defensively (`rateLimiterPassOnStoreError`), but production clusters require Redis for distributed cron locks and Socket.IO scaling.
  3. Restart Redis: `docker compose --env-file deploy.env restart redis`.

---

## 3. Database Migration Failures

### Symptom: `prisma migrate deploy` fails with schema lock or failed migration
- **Root Cause:** A previous migration was aborted, or concurrent deployments attempted to migrate simultaneously.
- **Diagnosis:** Check `_prisma_migrations` table:
  ```sh
  pnpm --filter @workspace/api-server exec prisma migrate status
  ```
- **Remediation:**
  1. Inspect the failed migration record. If the SQL was partially applied, resolve inconsistencies manually via `psql`.
  2. Mark the migration as resolved:
     ```sh
     pnpm --filter @workspace/api-server exec prisma migrate resolve --applied "<migration_name>"
     ```
  3. Re-run `prisma migrate deploy`.

---

## 4. Real-Time Socket.IO Issues

### Symptom: Clients connect but events are not delivered across multiple API instances
- **Root Cause:** Redis adapter connection failure or invalid token in handshake.
- **Diagnosis:**
  1. Inspect browser console for WebSocket handshake errors (e.g. `401 Unauthorized`).
  2. Check API server logs for `@socket.io/redis-adapter` connection warnings.
- **Remediation:**
  1. Verify the client is passing a valid Bearer token in `auth: { token: ... }`.
  2. Confirm both API instances share the exact same `REDIS_URL`.

---

## 5. Security & Browser CSP Headers

### Symptom: Browser blocks font, stylesheet, or API request with Content Security Policy violation
- **Root Cause:** External domain or CDN asset requested without whitelist in `helmet` CSP.
- **Diagnosis:** Inspect browser developer tools Console for:
  ```
  Refused to load ... because it violates the following Content Security Policy directive
  ```
- **Remediation:**
  1. Check `src/bootstrap.ts` (Helmet configuration).
  2. Whitelist the necessary trusted origin in `connectSrc`, `fontSrc`, or `imgSrc` directives, or host the asset locally within the application bundle.

---

## 6. API Contract Drift Failures

### Symptom: `pnpm run test:contract` fails in CI or local verification
- **Root Cause:** Express route signature, HTTP verb, path parameter, or schema changed without updating OpenAPI specifications.
- **Diagnosis:** Run contract check locally to identify offending route:
  ```sh
  pnpm run test:contract
  ```
- **Remediation:**
  1. Inspect the diff reported between `src/openapi/` and registered Express routes in `src/app.ts`.
  2. Update the corresponding OpenAPI path definition in `artifacts/api-server/src/openapi/` or adjust the route registration.
  3. Re-run `pnpm run test:contract` to verify green status before committing.

---

## 7. Automated Restore Drill Failures

### Symptom: `scripts/operations/verify-restore-drill.sh` fails
- **Root Cause:** Database container lacks `pg_dump`/`pg_restore` or test database recreation failed.
- **Diagnosis:** Check script console output for the exact step failure (e.g., checksum mismatch, table row count divergence).
- **Remediation:**
  1. Confirm the user running the script has sudo / Docker execution permissions.
  2. Check PostgreSQL user privileges: ensure `POSTGRES_USER` has rights to create and drop temporary drill databases (`ums_drill_*`).
