---
name: JWT secret gate
description: JWT_SECRET must be a Replit Secret (not a shared env var) to avoid committing it to .replit; server exits on startup if missing or too short.
---

## Rule
`JWT_SECRET` must be stored as a **Replit Secret** (via the Secrets panel / `requestEnvVar`), NOT as a shared env var via `setEnvVars`. Shared env vars are written to `.replit` and committed to source control.

**Why:** Using `setEnvVars` for JWT_SECRET wrote it into `.replit` → the file is committed to the repo → the secret is exposed in version control. Replit Secrets are stored in Replit's vault and never appear in `.replit`.

**How to apply:** If JWT_SECRET is missing, use `requestEnvVar({ requestType: "secret", keys: ["JWT_SECRET"] })` so the user sets it in the Secrets panel. The server index.ts will `process.exit(1)` if it is not set or shorter than 32 chars.
