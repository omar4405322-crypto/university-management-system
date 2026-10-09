---
name: university-release-review
description: Orchestrates end-to-end production-readiness reviews for existing modules in the University Management System. Use when asked to review, audit, verify, harden, fix, or validate any module before production release (e.g. Attendance, Grades, Auth, Tasks, Courses, Financials). Coordinates sub-skills across React/Vite frontend, Node.js/Express backend, PostgreSQL/Prisma database, Redis caching, Vercel frontend, and Railway backend deployment.
---

# University Release Review

## Overview

This skill orchestrates a rigorous, multi-dimensional **production-readiness review and hardening process** for already-built modules of the University Management System.

> [!IMPORTANT]
> **This is NOT a development-from-scratch skill.** The system and its modules are already implemented.
> The primary objective is to inspect, audit, verify, harden, debug, fix, and re-test existing module functionality before shipping to production.

---

## Target Stack & Architecture

- **Frontend**: React + Vite (SPA) — *No Next.js (do not use App Router, Server Components, or Server Actions)*
- **Backend**: Node.js + Express (REST API)
- **Database**: PostgreSQL with Prisma ORM
- **Cache / Store**: Redis (sessions, token blacklist, rate limiting, caching)
- **Frontend Hosting**: Vercel
- **Backend / DB Hosting**: Railway
- **E2E & UI Testing**: Playwright CLI (`playwright-cli`)

---

## Orchestrated Sub-Skills

This skill coordinates existing project skills without duplicating their contents. Delegate or refer to specific skills during each review phase:

- **Codebase Context**: `acquire-codebase-knowledge`
- **Code Quality & Review**: `code-review-and-quality`
- **Triage & Root Cause Fixes**: `debugging-and-error-recovery`
- **API Contracts & Validation**: `api-and-interface-design`
- **Security & RBAC Audit**: `security-best-practices`, `security-review`, `security-threat-model`
- **PostgreSQL & Prisma**: `postgres-best-practices`
- **Redis Operations & Hardening**: `redis-core`, `redis-connections`, `redis-observability`, `redis-security`
- **Frontend & Accessibility**: `frontend-design`, `web-design-guidelines`, `vercel-composition-patterns`, `vercel-react-best-practices` (React client rules only)
- **Browser Automation Verification**: `playwright-cli`
- **Performance & Profiling**: `performance-optimization`
- **Logging & Monitoring**: `observability-and-instrumentation`
- **Regression Testing**: `test-driven-development`
- **CI Quality Gates**: `ci-cd-and-automation`
- **Deployment & Production Prep**: `deploy-to-vercel`, `use-railway`, `shipping-and-launch`

---

## Step-by-Step 20-Stage Review Workflow

When requested to review a module (e.g., `"Review the Attendance module for production readiness"`), follow this exact 20-stage sequence:

### 1. Module Boundaries & Context
Inspect existing routes, UI components, Prisma schemas, and service layers for the target module. Do not guess business logic; rely strictly on existing code and `docs/`.

### 2. Component Mapping
Identify all participating layers: React/Vite UI (`artifacts/university-app`), Express controllers (`artifacts/api-server`), Prisma models (`prisma/schema.prisma`), Redis keys/hashes, and external integration points.

### 3. Correctness & Code Quality
Review implementation against `code-review-and-quality`. Ensure control flows read clearly, error paths are handled, and dead code is noted.

### 4. API Contract & Boundary Validation
Check REST endpoint conventions, status code mappings, Zod/Joi validation at Express request boundaries, and error payload consistency per `api-and-interface-design`.

### 5. Authentication, Authorization & RBAC
Audit session/JWT checks, role permissions (Student, Instructor, Admin, Staff), and multi-tenant / data-scoping isolation (e.g. preventing student $A$ from accessing student $B$'s records).

### 6. Security Deep-Dive
Scan for OWASP Top 10 risks using `security-review` and `security-best-practices`: SQL injection (raw query checks), XSS in React rendering, CSRF, and secret leaks.

### 7. PostgreSQL & Prisma Query Review
Use `postgres-best-practices` to audit Prisma queries for N+1 patterns (`include` vs loop queries), missing composite indexes, unindexed foreign keys, and missing transaction boundaries (`prisma.$transaction`) on multi-step updates.

### 8. Redis Usage Audit
Check key naming conventions, expiration (TTL), connection pooling, rate limiter stability, and eviction behavior using `redis-core` and `redis-connections`.

### 9. Frontend React/Vite & Accessibility Review
Inspect client component behavior, state management, render efficiency (`vercel-react-best-practices`), keyboard navigation, screen reader attributes, and ARIA compliance (`web-design-guidelines`).

### 10. Playwright Browser E2E Verification
Use `playwright-cli` to interactively run user flows in Chrome/Edge, verifying forms, state persistence, modal triggers, and visual responses.

### 11. Edge Cases & Boundary States
Verify handling of invalid input, unauthenticated/unauthorized access attempts, loading spinners/skeletons, empty states, and error fallback UI boundaries.

### 12. Performance & Resource Audit
Check API response latencies, DB query execution time, bundle chunking, and memory leak vectors using `performance-optimization`.

### 13. Logging & Observability Audit
Confirm structured JSON logging, correlation IDs (`x-request-id`), Express error middleware logging, and metric tracking using `observability-and-instrumentation`.

### 14. Severity Triage
Catalog every finding by strict severity levels:
- **Critical**: Security vulnerability, data loss, unauthorized data access, severe crash blocking core flow.
- **High**: Broken business logic, uncaught exceptions, N+1 query causing database timeouts, missing permission checks.
- **Medium**: Validation flaws, accessibility failures, UI flickers, missing error messages, unindexed queries.
- **Low**: Non-blocking edge case glitches, minor styling inconsistencies, unoptimized bundle imports.
- **Improvement**: Code style, refactoring suggestions without functional impact.

### 15. Prioritized Root-Cause Fixes
Apply targeted fixes in order of severity (**Critical** $\rightarrow$ **High** $\rightarrow$ **Medium** $\rightarrow$ **Low**). Address root causes, not symptoms. Do not introduce broad structural refactors on working architecture.

### 16. Regression Test Suite Expansion
Add or update unit, integration, or contract tests using `test-driven-development` to prove the fix and lock in regression protection.

### 17. Local Quality Gate Verification
Re-run repository commands:
```bash
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run test
```

### 18. E2E Browser Re-testing
Re-run `playwright-cli` workflows for fixed scenarios to verify complete end-to-end resolution.

### 19. Cross-Module Impact Check
Ensure fixes in the target module did not regress adjacent modules (e.g. modifying shared auth middleware or database helpers).

### 20. Production-Readiness Report
Generate a final summary report containing:
- Module Name & Scope
- Audit Findings Matrix (Severity, Description, Location, Fix Status)
- Verification Results (Lint, Typecheck, Unit/Integration Tests, Playwright E2E)
- Deployment & Launch Readiness Verdict (**READY** or **BLOCKED** with remaining issues)

---

## Hard Rules & Constraints

1. **No Unnecessary Architecture Rewrites**: Preserve established project conventions and existing working code unless proven unsafe or broken.
2. **Targeted Fixes**: Keep edits tightly scoped to the module being reviewed. Do not modify unrelated code.
3. **No Business Logic Guesses**: Inspect existing source code, Prisma schemas, and `docs/` first. Ask for clarification if ambiguous.
4. **Security & Data Safety**: All security and RBAC changes require multi-role verification. Database schema edits require migration safety checks.
5. **No Release With Blocker Issues**: Never mark a module as **Production Ready** while any **Critical** or **High** severity issue remains unresolved.
6. **Empirical Proof**: Every finding marked as fixed MUST be backed by clean verification output (test runner logs or Playwright browser interaction).

---

## Example Usage Prompts

- *"Review the Attendance module for production readiness."*
- *"Review the Grades system before release."*
- *"Perform a final production-readiness review of Authentication."*
- *"Audit the Tasks module and fix verified issues."*
