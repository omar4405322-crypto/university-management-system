# Security Audit Remediation Report

Audit date: 2026-09-03

Session scope: SEC-07 through SEC-40, excluding SEC-13, SEC-14, SEC-24, and SEC-33.

Execution order: the priority order supplied for this session.

The commit-hash cell for the item being committed says `this commit` because a Git commit cannot contain its own hash. The exact immutable hash is available from the matching commit subject in `git log`; completed earlier rows will be backfilled when a later item updates this report.

| SEC-ID | Status (Fixed/Partial/Skipped) | Files changed | Commit hash | Notes/assumptions |
| --- | --- | --- | --- | --- |
| SEC-22 | Fixed | `.dockerignore`; `Dockerfile`; `scripts/docker-context-security.test.mjs`; `CODEX-OVERNIGHT-REPORT.md` | this commit (`fix(security): prevent secrets entering Docker images`) | Docker context is default-deny and re-admits only required manifests, TypeScript source, Prisma schema, and active migration files. Builder and runner copies are explicit; root `.npmrc`, local env files, uploads, tests, seeds, archived migrations, and whole builder filesystems are excluded. Static exploit canaries, local API build, and `tsc --noEmit` pass. Docker is unavailable on this host, so a real image/layer inspection remains a CI verification step. Existing migration commands were preserved but no migration or database operation was run. |

## Assumptions and remaining risks

- SEC-22: Existing production startup/migration behavior was preserved for compatibility; this session did not execute it.
- SEC-22: The API and its referenced workspace libraries currently use TypeScript source files only (apart from two inert `.gitkeep` files), so the Docker source allowlist admits `.ts` files and excludes unknown file types by default.
- SEC-22: Docker is not installed on the host. The regression check validates build-context rules and copy boundaries, and the local production bundle builds successfully, but final image contents and layers still need inspection in Docker-enabled CI.
- SEC-22: The current unrelated dependency work includes a package that declares a newer Node engine than the Docker base image; this may independently affect a future Docker build and was not changed under this finding.

## Not reached yet

SEC-35, SEC-38, SEC-39, SEC-26, SEC-29, SEC-34, SEC-07, SEC-08, SEC-09, SEC-10, SEC-27, SEC-28, SEC-16, SEC-17, SEC-18, SEC-19, SEC-20, SEC-30, SEC-21, SEC-12, SEC-15, SEC-25, SEC-36, SEC-37, SEC-32, SEC-23, SEC-31, SEC-11, and SEC-40.

Explicitly out of scope: SEC-13, SEC-14, SEC-24, and SEC-33.
