# Security Architecture & Controls Policy

This document outlines the defensive security architecture, cryptography standards, and operational controls implemented in the University Management System.

---

## 1. Authentication & Session Architecture

### 1.1 Dual-Token Authentication
- **Access Tokens:** Signed via HMAC SHA-256 (`HS256`) with a 15-minute lifespan. Validated on every incoming protected request.
- **Refresh Tokens:** Issued as `httpOnly`, `Secure` cookies with configurable `SameSite` attribute (governed by `REFRESH_COOKIE_SAMESITE`; defaults to `'none'` in production to support decoupled cross-site HTTPS SPA/API topology, and `'lax'` in development). Stored in the database as salted cryptographic hashes. On every refresh, the old token is invalidated and a fresh pair is issued.

### 1.2 Instant Session Revocation (Token Epoch)
Every User record maintains an integer `tokenVersion`. When any of the following events occur:
- Password change or administrative reset
- Role change or tenant permission update
- Explicit "Logout All Devices"
- Account suspension or deactivation

The `tokenVersion` is incremented. All existing access tokens and refresh tokens containing the older epoch are immediately rejected by middleware, without requiring external Redis blocklists.

---

## 2. Multi-Factor Authentication (MFA / 2FA)

- **Standard:** Time-based One-Time Password (TOTP) compliant with RFC 6238 via Speakeasy.
- **Enforcement:** Strictly mandatory for administrative personnel (`SUPER_ADMIN`, `ADMIN`, `COLLEGE_ADMIN`, `DEPARTMENT_ADMIN`). In production (`NODE_ENV=production`), attempts to disable 2FA via `REQUIRE_2FA=false` are fatal and prevent server boot. In development, defaults to active unless explicitly disabled.
- **Recovery:** Account access recovery is managed administratively via scoped admin identity verification; automated offline backup codes are not supported.

---

## 3. Rate Limiting & Denial-of-Service Defense

Tiered sliding-window rate limiters backed by Redis (`rate-limit-redis`) protect sensitive endpoints:

| Endpoint Pattern | Window | Max Requests | Purpose |
| :--- | :--- | :--- | :--- |
| `POST /api/auth/login` | 15 minutes | 5 attempts | Brute-force & credential stuffing defense |
| `POST /api/attendance/qr/scan` | 15 minutes | 10 attempts | QR code replay & guessing defense |
| `POST /api/attendance/session` | 15 minutes | 100 requests | Session exhaustion defense |
| `POST /api/attendance/rfid` | 1 minute | 100 requests | Hardware sensor replay defense |
| Global API fallback | 1 minute | 300 requests | General DoS mitigations |

In the event of Redis downtime, limiters fail closed or open safely per security policy while logging warnings (`rateLimiterPassOnStoreError`).

---

## 4. Input Validation & Request Limits

- **Body Size Caps:** Global JSON and URL-encoded request bodies are capped at 10MB (`express.json({ limit: '10mb' })`, `express.urlencoded({ limit: '10mb' })`) to permit bulk schedule grid synchronization and batch updates while protecting against unbounded payloads.
- **Strict Sanitization:** Input fields are validated through `express-validator` and `zod` schemas. Path and query parameters are type-checked and cast defensively.
- **Feature Flags:** Unimplemented or experimental endpoints (e.g. face attendance) are disabled by default via environment flags (`ENABLE_FACE_ATTENDANCE=false`) and return `403 FEATURE_DISABLED`.

---

## 5. File Upload Security & Magic-Byte Inspection

File uploads are guarded through a multi-stage validation pipeline:
1. **MIME & Magic-Byte Verification:** The system uses `file-type` to inspect the file header's actual binary magic bytes rather than trusting the client-supplied `Content-Type` header.
2. **Strict Extension Whitelisting:** Permitted file formats are strictly controlled:
   - **Course Materials (`uploads/materials`):** Documents (`.pdf`, `.docx`, `.pptx`, `.xlsx`, `.doc`, `.ppt`, `.xls`), archives (`.zip`, `.rar`, `.7z`), images (`.png`, `.jpg`, `.jpeg`, `.webp`), and video lectures (`.mp4`, `.webm`, `.mkv`) up to 50MB.
   - **Profile Avatars (`uploads/profiles` / Cloudinary):** Image formats (`.jpg`, `.jpeg`, `.png`, `.webp`) up to 5MB.
   - Executables (`.exe`, `.sh`, `.bat`, `.js`, etc.) and unwhitelisted formats are unconditionally rejected.
3. **Storage Isolation:** Uploads are stored on a dedicated Docker volume or remote cloud bucket with restricted execution permissions (`no-exec`).

---

## 6. Multi-Tenant Scoping & Data Isolation

Multi-tenant isolation is enforced at the database query layer:
- Role and tenant scope helpers (`requireCollegeScope`, `requireDepartmentScope`, `requireCourseStaff`) inspect authenticated tokens against requested entity identifiers.
- Cross-tenant queries are blocked before reaching database execution, returning `403 Forbidden`.
- Student queries are strictly pinned to the verified `req.user.id`.

---

## 7. Security Headers & Browser Hardening

Configured through Helmet:
- **Content Security Policy (CSP):** Restricts script, frame, and connect execution to self and explicitly whitelisted domains.
- **Transport Security (HSTS):** Enforces HTTPS transport with a 1-year max-age and preload directives in production.
- **X-Frame-Options:** `DENY` to eliminate clickjacking vectors.
- **X-Content-Type-Options:** `nosniff` to prevent MIME-confusion attacks.

---

## 8. Log Privacy & Operational Confidentiality

- **Masking:** Passwords, tokens, HMAC signatures, cookies, and sensitive PII are stripped prior to logging.
- **Probe Quieting:** High-frequency health probes (`/api/healthz`, `/api/ready`) returning `200 OK` are silenced from production logs.
- **Metrics Protection:** The Prometheus `/metrics` endpoint requires Bearer token authentication via `METRICS_TOKEN` or an active `SUPER_ADMIN` session in production.
