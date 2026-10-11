# Release and Versioning Strategy

**Classification:** Internal Production Operations Guide  
**Scope:** UniCore Production System  
**Last Updated:** 2026-10-12  

---

## 1. Semantic Versioning Specification

UniCore strictly follows **Semantic Versioning (SemVer 2.0.0)** (`MAJOR.MINOR.PATCH`):

1. **MAJOR (X.0.0):** Incompatible API changes, breaking database schema contractions, or major architectural shifts.
2. **MINOR (1.X.0):** Backwards-compatible functionality additions (e.g., new endpoints, non-breaking schema expansions, new features).
3. **PATCH (1.0.X):** Backwards-compatible bug fixes, security patches, dependency audit overrides, and performance optimizations.

---

## 2. Pre-Release Quality Gates

No release candidate may be tagged, built, or deployed without passing the authoritative quality gates in exact pipeline sequence:

| Step | Gate Name | Command / Condition | Failure Criteria |
| :--- | :--- | :--- | :--- |
| 1 | **Dependency Audit** | `pnpm audit --prod --audit-level high` | Any high or critical CVE in runtime production dependencies |
| 2 | **Static Linting** | `pnpm run lint` | Any ESLint syntax, styling, or import errors |
| 3 | **Database Migration Verification** | `prisma migrate deploy` (clean target) | Unapplied, drifted, or failing migrations |
| 4 | **Production Build** | `pnpm run build` | TypeScript compile errors or asset bundle failures |
| 5 | **Test Suites** | `pnpm run test` (API 367+ / Web 394+) | Any unit or integration regression |
| 6 | **Contract Drift Check** | `pnpm run test:contract` (43/43) | Frontend/backend type drift or missing endpoints |

---

## 3. Git Tagging and Release Workflow

1. **Working Tree Cleanliness:** Ensure all working tree edits are committed or stashed.
2. **Version Bump:** Update version in root `package.json`, `artifacts/api-server/package.json`, and `artifacts/university-app/package.json`.
3. **Annotated Tag:** Create an annotated git tag following the format `vMAJOR.MINOR.PATCH`:
   ```bash
   git tag -a v1.0.1 -m "Release v1.0.1: Security audit remediation and edge hardening"
   ```
4. **Container Image Tagging:** When building release images, tag with both the version and immutable commit SHA:
   ```bash
   docker build -f Dockerfile -t ghcr.io/unicore/api:v1.0.1 -t ghcr.io/unicore/api:$(git rev-parse --short HEAD) .
   docker build -f Dockerfile.web -t ghcr.io/unicore/web:v1.0.1 -t ghcr.io/unicore/web:$(git rev-parse --short HEAD) .
   ```

---

## 4. Emergency Patching and Rollback Hand-off

If an incident occurs post-deployment:
- Refer to [docs/operations/ROLLBACK.md](ROLLBACK.md) for immediate application container revert and database recovery procedures.
- For non-breaking hotfixes, deploy a patch bump (`1.0.X`) following the full gate verification workflow.
