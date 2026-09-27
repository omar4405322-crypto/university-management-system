# API Architecture & Contract Guidelines

This document outlines the design principles, conventions, and contract verification workflows for the University Management System API.

---

## 1. OpenAPI Specification & Schema Contracts

The API is formally defined via OpenAPI 3.0 specifications maintained in the repository:
- **Specification Source:** `artifacts/api-server/src/openapi/`
- **Specification Package:** `lib/api-spec/`
- **Generated Types & Schemas:** `lib/api-zod/` (Zod schemas)
- **Generated Client Hooks:** `lib/api-client-react/` (React Query client)

### Contract Drift Verification
To ensure the backend implementation never drifts from the declared API contract, run the automated contract verification check:

```sh
pnpm run test:contract
```

This command runs `scripts/contract_drift_check.ts` to validate route definitions against OpenAPI schemas and fail CI if discrepancies are detected.

---

## 2. Authentication Model

All protected API endpoints require JWT authentication:

### Access Token
- **Format:** Signed HMAC SHA-256 JWT.
- **Delivery:** Passed via the standard HTTP header:
  ```http
  Authorization: Bearer <access_token>
  ```
- **Lifespan:** Short-lived (15 minutes).
- **Claims:** User ID (`id`), account state epoch (`tokenVersion`), and base role (`role`).

### Refresh Token & Session Revocation
- **Delivery:** Issued as an `httpOnly`, `Secure`, `SameSite=Strict` cookie.
- **Rotation:** Refresh tokens are cryptographically hashed and rotated on every exchange.
- **Session Revocation (Token Epoch):** The backend maintains an integer `tokenVersion` on each User record. Modifying `tokenVersion` (via password change, logout-all, or deactivation) immediately invalidates all active sessions without requiring Redis blocklists.

---

## 3. Standard Request & Response Envelopes

### 3.1 Success Envelope
Standard single-resource response:
```json
{
  "success": true,
  "data": {
    "id": 42,
    "name": "Software Engineering"
  }
}
```

### 3.2 Pagination Convention
List endpoints accept `page` (1-indexed, default 1) and `limit` (default 20, capped at 100). Responses return data and pagination metadata:
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

### 3.3 Standard Error Envelope
All error responses adhere to a consistent error schema with an appropriate HTTP status code (400, 401, 403, 404, 422, 500):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid student identification number",
    "details": [
      {
        "field": "studentId",
        "issue": "Must be a positive integer"
      }
    ]
  }
}
```

---

## 4. Operational Conventions

### 4.1 Request Correlation (`X-Request-Id`)
Every incoming HTTP request is assigned a unique correlation UUID:
- Accepted from upstream reverse proxies if valid: `X-Request-Id: <uuid>`.
- Returned on every response header: `X-Request-Id`.
- Tagged in all server log entries and Sentry error captures.

### 4.2 Monetary Decimal Precision
To avoid IEEE 754 floating-point inaccuracies in financial and tuition calculations:
- Monetary amounts are persisted in PostgreSQL as `Decimal(10, 2)`.
- Serialized in JSON as numbers or precise decimal strings (e.g. `1250.00`).
- Mathematical operations are handled with exact decimal arithmetic.

### 4.3 Timestamps & Timezone Conventions
- **Wire & Database Format:** All timestamps in requests, responses, and PostgreSQL records are strictly in UTC ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- **Academic Scheduling & Business Timezone:** Timetables, session active periods, and attendance windows are evaluated using the university business timezone: `Africa/Cairo` (`UTC+2` / `UTC+3` daylight saving). Date-boundary calculations utilize `date-fns-tz`.
