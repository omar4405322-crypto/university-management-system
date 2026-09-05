# Security Audit Remediation Report

Audit date: 2026-09-03

Session scope: SEC-07 through SEC-40, excluding SEC-13, SEC-14, SEC-24, and SEC-33.

Execution order: the priority order supplied for this session.

The commit-hash cell for the item being committed says `this commit` because a Git commit cannot contain its own hash. The exact immutable hash is available from the matching commit subject in `git log`; completed earlier rows will be backfilled when a later item updates this report.

| SEC-ID | Status (Fixed/Partial/Skipped) | Files changed | Commit hash | Notes/assumptions |
| --- | --- | --- | --- | --- |
| SEC-22 | Fixed | `.dockerignore`; `Dockerfile`; `scripts/docker-context-security.test.mjs`; `CODEX-OVERNIGHT-REPORT.md` | `ab7e37c` | Docker context is default-deny and re-admits only required manifests, TypeScript source, Prisma schema, and active migration files. Builder and runner copies are explicit; root `.npmrc`, local env files, uploads, tests, seeds, archived migrations, and whole builder filesystems are excluded. Static exploit canaries, local API build, and `tsc --noEmit` pass. Docker is unavailable on this host, so a real image/layer inspection remains a CI verification step. Existing migration commands were preserved but no migration or database operation was run. |
| SEC-35 | Fixed | `artifacts/api-server/src/app.ts`; `artifacts/api-server/tests/health_security.test.ts`; `CODEX-OVERNIGHT-REPORT.md` | `6e6ce8ee` | Public `/api/health` and `/api/healthz` are rate-limited, dependency-free liveness aliases returning only `{ status: 'ok' }`. Detailed `/api/health/readiness` is rate-limited and restricted to active, current-session `SUPER_ADMIN` users; failures return a generic 503 and log details server-side. Focused live HTTP tests cover exact public shape, absence of public/unauthorized DB queries, 401/403/200/503 paths, error redaction, and 429 limiting. `tsc --noEmit` passes. Redis remains optional when unconfigured, preserving the existing policy. |
| SEC-38 | Fixed | `artifacts/api-server/src/index.ts`; `artifacts/api-server/src/server.ts`; `artifacts/api-server/src/utils/jwtSecretValidation.ts`; `artifacts/api-server/tests/jwt_secret_validation_security.test.ts`; `CODEX-OVERNIGHT-REPORT.md` | `ee1c73e9` | The actual esbuild/Docker entry point and the legacy server now share a side-effect-free validator that rejects missing, undersized, and known-default secrets without echoing configured values. Tests cover all known defaults, case/whitespace variants, the length boundary, and a legitimate strong value. The production bundle exits with code 1 for a known-default secret before listening. API build and `tsc --noEmit` pass. |
| SEC-39 | Fixed | `Dockerfile`; `scripts/docker-context-security.test.mjs`; `CODEX-OVERNIGHT-REPORT.md` | `123eaf2` | Builder installation now requires the committed lockfile. The final image uses the base image's unprivileged `node` user; only `/app/uploads` is made application-writable for existing local upload behavior. Static regression checks reject lockfile drift and root runtime execution. `tsc --noEmit` passes. Docker is unavailable locally, so a real container build/user/write-path smoke test remains a CI step. |
| SEC-26 | Fixed | `artifacts/api-server/src/routes/college.routes.ts`; `artifacts/api-server/src/controllers/college.controller.ts`; `artifacts/api-server/src/services/college.service.ts`; `artifacts/api-server/src/utils/scope.utils.ts`; `artifacts/api-server/tests/college_public_projection_security.test.ts`; `artifacts/university-app/src/services/college.service.ts`; `artifacts/university-app/src/pages/colleges/CollegesList.tsx`; `artifacts/university-app/src/pages/registration/AdminsList.tsx`; `CODEX-OVERNIGHT-REPORT.md` | `7a5b8fd1` | Public list/detail responses select only `id`, `name`, and `nameAr`. Counts, descriptions, department trees, and assigned-admin identifiers/emails moved to authenticated `/manage` routes with fail-closed college scope for super, legacy, college, and department admins. Administrative UI consumers use the protected routes; registration and dropdown consumers retain the minimal public list. Tests prove the public Prisma projection cannot fetch sensitive fields and cross-tenant detail IDs are intersected with scope rather than substituted. API and frontend `tsc --noEmit` pass. |
| SEC-29 | Fixed | `artifacts/api-server/src/controllers/exams.controller.ts`; `artifacts/api-server/tests/exam_metadata_scope_security.test.ts`; `CODEX-OVERNIGHT-REPORT.md` | this commit (`fix(security): scope exam metadata reads`) | Exam-by-ID now intersects the requested ID with `getScopeWhere(user, 'exam')` inside the Prisma query instead of attempting to interpret only admin-shaped course predicates after loading the record. Tests cover college admin, department admin, doctor, TA, student, and an out-of-scope 404 without returning metadata. `tsc --noEmit` passes. |

## Assumptions and remaining risks

- SEC-22: Existing production startup/migration behavior was preserved for compatibility; this session did not execute it.
- SEC-22: The API and its referenced workspace libraries currently use TypeScript source files only (apart from two inert `.gitkeep` files), so the Docker source allowlist admits `.ts` files and excludes unknown file types by default.
- SEC-22: Docker is not installed on the host. The regression check validates build-context rules and copy boundaries, and the local production bundle builds successfully, but final image contents and layers still need inspection in Docker-enabled CI.
- SEC-22: The current unrelated dependency work includes a package that declares a newer Node engine than the Docker base image; this may independently affect a future Docker build and was not changed under this finding.
- SEC-35: `SUPER_ADMIN` is the conservative in-repository interpretation of internal operational access because no mTLS, internal-network, or dedicated probe-secret middleware exists. Public deployment probes retain the cheap liveness aliases.
- SEC-39: The official Node Alpine image's existing `node` account is used instead of creating another UID. Runtime dependencies and migrations remain read-only; `/app/uploads` is the only application-owned writable directory.

## Not reached yet

SEC-34, SEC-07, SEC-08, SEC-09, SEC-10, SEC-27, SEC-28, SEC-16, SEC-17, SEC-18, SEC-19, SEC-20, SEC-30, SEC-21, SEC-12, SEC-15, SEC-25, SEC-36, SEC-37, SEC-32, SEC-23, SEC-31, SEC-11, and SEC-40.

Explicitly out of scope: SEC-13, SEC-14, SEC-24, and SEC-33.
