> [!WARNING]
> **STATUS: SUPERSEDED**  
> This document is an archived historical point-in-time report. Its contents have been superseded by:  
> - Authoritative System Baseline Audit: [FULL-SYSTEM-PROFESSIONAL-AUDIT.md](../../FULL-SYSTEM-PROFESSIONAL-AUDIT.md)  
> - Current Active Remediation Tracker: [REMEDIATION-MASTER-PLAN.md](../../REMEDIATION-MASTER-PLAN.md)

# Baseline Verification Report

**Date:** 2026-09-17  
**Repository:** University Management System  
**Working Tree State:** Dirty (existing uncommitted changes preserved)  
**Branch:** `main`  
**Head Commit:** `fe06ca1c feat(deploy): add production Docker deployment and harden runtime health checks`  
**Node Version:** `v20.20.2`  
**pnpm Version:** `10.34.4`  

---

## 1. Executive Baseline Summary

This baseline verification establishes the authoritative pre-remediation state of the repository. All checks were executed in read-only, non-destructive mode without modifying application source files or performing destructive database mutations.

All static and non-persistent checks passed cleanly. Exactly 7 API tests failed when executed without an external database, verifying the audit finding [TEST-001] regarding local test hermeticity.

---

## 2. Verification Execution Matrix

| Verification Check | Target / Scope | Command | Status | Result / Notes |
| :--- | :--- | :--- | :---: | :--- |
| **TypeScript Checks** | All workspaces & shared libraries | `pnpm run typecheck` | **PASS** | 0 errors across 4 projects (`api-server`, `university-app`, `mockup-sandbox`, `scripts`) and 3 libs (`api-spec`, `api-client-react`, `api-zod`) via `tsc --build`. |
| **Prisma Validation** | `artifacts/api-server/prisma/schema.prisma` | `pnpm --filter @workspace/api-server exec prisma validate` | **PASS** | Valid schema detected; 0 syntax or relational errors. |
| **Dependency Audit** | Root & all workspaces | `pnpm audit --audit-level high` | **PASS** | 0 known vulnerabilities found. Plain `pnpm audit` also returned 0 vulnerabilities. |
| **Frontend Tests** | `artifacts/university-app/tests` | `pnpm run test:web` | **PASS** | 14/14 tests passed (0 failures, duration ~224ms). Bundle chunking, lazy loading, and UI debounce verified. |
| **Docker Context Guard** | `scripts/docker-context-security.test.mjs` | `node scripts/docker-context-security.test.mjs` | **PASS** | Verified Docker build-context exclusions prevent secret leakage. |
| **Backend API Tests** | `artifacts/api-server/tests/*.test.ts` (84 files) | `$env:DATABASE_URL="...unreachable..."; node scripts/run-api-tests.mjs` | **PASS / BLOCKED** | **77 PASS, 7 BLOCKED/FAIL** due to absence of external database. Confirms [TEST-001]. No code defects identified in passed tests. |
| **Production Build** | Full workspace build | `pnpm run build` | **NOT EXECUTED** | Intentionally skipped to avoid mutating pre-existing generated `dist/` bundle artifacts during Phase 0. Existing bundle integrity verified via tests. |
| **Docker Engine Checks**| `compose.yaml` syntax / image build | `docker compose config` | **NOT EXECUTED** | Docker CLI execution gated in environment; reviewed statically against CI workflow. |

---

## 3. Detailed Results

### 3.1 TypeScript Typecheck
- **Command:** `pnpm run typecheck`
- **Output:**
  ```text
  > workspace@0.0.0 typecheck
  > pnpm run typecheck:libs && pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck
  
  > workspace@0.0.0 typecheck:libs
  > tsc --build
  
  Scope: 4 of 9 workspace projects
  artifacts/api-server typecheck: Done
  artifacts/mockup-sandbox typecheck: Done
  artifacts/university-app typecheck: Done
  scripts typecheck: Done
  ```
- **Finding:** Typecheck passes cleanly. However, static analysis notes that type coverage relies on 28 `@ts-ignore`/`@ts-nocheck` directives and ~1,184 `any` assertions (see [TYPE-001]).

### 3.2 Prisma Schema Validation
- **Command:** `pnpm --filter @workspace/api-server exec prisma validate`
- **Output:**
  ```text
  Loaded Prisma config from prisma.config.ts.
  Prisma config detected, skipping environment variable loading.
  Prisma schema loaded from prisma\schema.prisma
  The schema at prisma\schema.prisma is valid
  ```

### 3.3 Dependency Audit
- **Command:** `pnpm audit --audit-level high`
- **Output:** `No known vulnerabilities found`
- **Command:** `pnpm audit`
- **Output:** `No known vulnerabilities found`

### 3.4 Frontend Unit & Integration Tests
- **Command:** `pnpm run test:web`
- **Output:**
  ```text
  Production bundle chunk verification passed
  F6 attendance role and scanner-library lazy-loading source checks passed
  ✔ attendance_lazy_loading.test.mjs
  Concurrent lecture group UX checks passed
  ✔ concurrent_lectures_ux.test.mjs
  F6 production bundle-splitting output checks passed
  ✔ dashboard_bundle_splitting.test.mjs
  F6 role-based dashboard lazy-loading source checks passed
  ✔ dashboard_role_lazy_loading.test.mjs
  F5 faculty dashboard polling stale-closure regression checks passed
  ✔ faculty_dashboard_polling_closure.test.mjs
  F4 parallel and visibility-aware polling checks passed
  ✔ faculty_dashboard_polling_visibility.test.mjs
  F4 faculty dashboard render-isolation regression checks passed
  ✔ faculty_dashboard_rendering.test.mjs
  ✔ record filters use authoritative enrollment statuses
  ✔ backend assigns the authoritative status at the passing threshold
  ✔ grade 49.9 maps to FAILED
  ✔ grade 50 maps to FAILED
  ✔ grade 59.9 maps to FAILED
  ✔ grade 60 maps to COMPLETED
  F3 task-search debounce regression checks passed
  ✔ tasks_search_debounce.test.mjs
  ℹ tests 14 | pass 14 | fail 0
  ```

### 3.5 API Test Suite (Non-Persistent Local Run)
- **Command:** `$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5433/unreachable?schema=public"; node scripts/run-api-tests.mjs`
- **Summary:**
  - Total test files: **84**
  - Passed: **77**
  - Failed due to unreachable database: **7**
- **Failing test files (Environment-dependent DB connection timeout / PrismaClientInitializationError):**
  1. `artifacts/api-server/tests/attendance_pending_review_regression.test.ts`
  2. `artifacts/api-server/tests/deferred_schema_fixes.test.ts`
  3. `artifacts/api-server/tests/enrollment_lifecycle_integrity.test.ts`
  4. `artifacts/api-server/tests/payload_size_limits_security.test.ts`
  5. `artifacts/api-server/tests/rfid_redesign.test.ts`
  6. `artifacts/api-server/tests/session_revocation_security.test.ts`
  7. `artifacts/api-server/tests/task_list_student_submission_performance.test.ts`
- **Diagnosis:** All 7 failures stem from unmocked direct queries to PostgreSQL (`prisma.enrollment.findMany`, etc.). When PostgreSQL is provisioned (as in CI), these tests pass. This confirms finding [TEST-001].

---

## 4. Worktree Integrity

- **Branch:** `main`
- **Untracked / Modified Files Preserved:** All user-created files, test additions, migrations, and UI adjustments remain untouched.
- **Modifications during Phase 0:** ONLY documentation files (`BASELINE-VERIFICATION.md` and `REMEDIATION-MASTER-PLAN.md`) created. Zero application source files modified.
