# Environment Variables Reference

This document serves as the authoritative specification for all environment variables used by the University Management System.

---

## 1. Quick Reference Matrix

| Variable Name | Required? | Default (Dev) | Production Requirement | Security Sensitivity |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Optional | `development` | Must be `production` | Public |
| `PORT` / `APP_PORT` | Optional | `8080` (API) / `5000` (Container) | Set in `deploy.env` (`8080`) | Public |
| `DATABASE_URL` | **Required** | `postgresql://...` | Dedicated connection string | **CRITICAL SECRET** |
| `REDIS_URL` | **Required** | `redis://127.0.0.1:6379` | `redis://redis:6379` | **SECRET** |
| `JWT_SECRET` | **Required** | Random dev secret | Must be cryptographically generated string (min 32 chars) | **CRITICAL SECRET** |
| `ENCRYPTION_KEY` | **Required** | Random dev key | 64-character hex string (32 bytes AES-256) | **CRITICAL SECRET** |
| `PUBLIC_ORIGIN` / `ALLOWED_ORIGINS` | **Required** | `http://localhost:5173` | Full public HTTPS URL (e.g., `https://ums.example.edu`) | Configuration |
| `FRONTEND_URL` | Optional | Matches `PUBLIC_ORIGIN` | Matches `PUBLIC_ORIGIN` | Configuration |
| `REQUIRE_2FA` | Mandatory in Prod | `true` (dev default) | Must be `"true"` (mandatory for admins; `"false"` causes boot failure) | Security Policy |
| `UPLOAD_DIR` | Optional | `./uploads` | Bound to persistent Docker volume (`/app/uploads`) | Storage Path |
| `METRICS_TOKEN` | Recommended | Unset (permissive in dev) | Random high-entropy secret | **SECRET** |
| `SENTRY_DSN` | Optional | Unset | Ingestion DSN for Sentry monitoring | Sensitive URL |
| `CLOUDINARY_CLOUD_NAME` | Optional | Unset (uses local disk) | Required only if Cloudinary enabled | Configuration |
| `CLOUDINARY_API_KEY` | Optional | Unset | Required only if Cloudinary enabled | **SECRET** |
| `CLOUDINARY_API_SECRET` | Optional | Unset | Required only if Cloudinary enabled | **CRITICAL SECRET** |
| `SHUTDOWN_TIMEOUT_MS` | Optional | `15000` (15s) | Time allowed for in-flight requests during graceful shutdown | Operational |
| `ENABLE_FACE_ATTENDANCE` | Optional | `false` | Must remain `false` unless explicitly authorized | Feature Flag |

---

## 2. Detailed Variable Specifications

### `DATABASE_URL`
- **Purpose:** Primary PostgreSQL connection URI used by Prisma Client and Prisma Migrate.
- **Development Behavior:** Connects to local or Dockerized PostgreSQL (`postgresql://postgres:postgres@localhost:5432/university?schema=public`).
- **Production Behavior:** Must point to the isolated PostgreSQL cluster/container. Never commit credentials to version control.
- **Example:** `postgresql://ums_user:secure_password@db:5432/ums_production?schema=public`

### `REDIS_URL`
- **Purpose:** Redis connection string for Socket.IO multi-instance adapter, distributed Redlock locks, and sliding-window rate limit stores.
- **Development Behavior:** Connects to `redis://127.0.0.1:6379`.
- **Production Behavior:** Connects to container service `redis://redis:6379` or managed Redis instance.
- **Example:** `redis://redis:6379` or `rediss://:authpass@redis.internal:6379`

### `JWT_SECRET`
- **Purpose:** HMAC key used to cryptographically sign and verify access tokens.
- **Development Behavior:** If unset in dev mode, a random fallback secret is generated (with console warnings).
- **Production Behavior:** Fatal error if unset or fewer than 32 characters.
- **Generation Example:** `openssl rand -hex 32`

### `ENCRYPTION_KEY`
- **Purpose:** 256-bit symmetric encryption key used for sensitive database columns and credentials (AES-256-GCM).
- **Development Behavior:** Generates ephemeral dev key if omitted.
- **Production Behavior:** Fatal error if missing or not exactly a 64-character hex string (32 bytes).
- **Generation Example:** `openssl rand -hex 32`

### `PUBLIC_ORIGIN` & `ALLOWED_ORIGINS`
- **Purpose:** Authoritative public origin for CORS validation and Content Security Policy (CSP) frame/connect directives.
- **Development Behavior:** Allows local dev servers (`http://localhost:5173`, `http://localhost:8080`).
- **Production Behavior:** Strict origin matching; rejects unlisted origins and prevents CORS hijacking.
- **Example:** `https://portal.university.edu`

### `METRICS_TOKEN`
- **Purpose:** Bearer authentication token for Prometheus scraping of `/metrics`.
- **Development Behavior:** When unset in `NODE_ENV=development` or `test`, `/metrics` permits local scraping.
- **Production Behavior:** Scrapers must provide header `Authorization: Bearer <METRICS_TOKEN>` or `x-metrics-token: <METRICS_TOKEN>` (unless accessed by an authenticated `SUPER_ADMIN` session).
- **Example:** `openssl rand -base64 32`

### `REQUIRE_2FA`
- **Purpose:** Enforces mandatory Two-Factor Authentication (RFC 6238 TOTP) for administrative roles (`SUPER_ADMIN`, `ADMIN`, `COLLEGE_ADMIN`, `DEPARTMENT_ADMIN`).
- **Development Behavior:** Defaults to active (`process.env.REQUIRE_2FA !== 'false'`). Can be explicitly disabled for local testing with `REQUIRE_2FA=false`.
- **Production Behavior:** Mandatory. Setting `REQUIRE_2FA=false` when `NODE_ENV=production` throws a fatal startup error preventing server boot.

### `ENABLE_FACE_ATTENDANCE`
- **Purpose:** Feature flag controlling availability of face recognition attendance (`POST /api/attendance/face`).
- **Development Behavior:** Defaults to disabled (`false`). Requests return `403 FEATURE_DISABLED`.
- **Production Behavior:** Must remain `false`. Biometric processing pipelines require explicit legal approval and infrastructure provisioning before enablement.

---

## 3. Production Deployment File: `deploy.env`

For production container deployment, configure `deploy.env` based on `deploy.env.example`:

```sh
cp deploy.env.example deploy.env
chmod 600 deploy.env
```

**Never** commit `deploy.env` or any production credential files to version control.
