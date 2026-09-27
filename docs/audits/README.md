# Audit and Compliance Archive Index

This directory serves as the centralized repository archive for past audits, point-in-time assessments, and historical analysis reports.

---

## 1. Classification & Source of Truth

| Classification | Document | Purpose & Status |
| :--- | :--- | :--- |
| **CURRENT SOURCE OF TRUTH** | [REMEDIATION-MASTER-PLAN.md](../../REMEDIATION-MASTER-PLAN.md) | **Authoritative living remediation tracker** covering all findings across Phases 0 through 8. Any remediation or verification updates must be tracked here. |
| **HISTORICAL BASELINE** | [FULL-SYSTEM-PROFESSIONAL-AUDIT.md](../../FULL-SYSTEM-PROFESSIONAL-AUDIT.md) | **Authoritative baseline audit** (September 17, 2026). Preserved intact as historical evidence and baseline finding registry. |
| **SUPERSEDED** | [BASELINE-VERIFICATION.md](./BASELINE-VERIFICATION.md) | Initial Phase 0 verification report. Superseded by active test suites and Phase 1–8 implementations. |
| **SUPERSEDED** | [SECURITY-AUDIT-2026-09-08.md](./SECURITY-AUDIT-2026-09-08.md) | Point-in-time security audit. Findings consolidated into `FULL-SYSTEM-PROFESSIONAL-AUDIT.md`. |
| **SUPERSEDED** | [SECURITY-AUDIT-2026-09-03.md](./SECURITY-AUDIT-2026-09-03.md) | Point-in-time security assessment. Findings consolidated into `FULL-SYSTEM-PROFESSIONAL-AUDIT.md`. |
| **SUPERSEDED** | [audit-2026-08.md](./audit-2026-08.md) | August 2026 security review. Superseded by September audits. |
| **SUPERSEDED** | [ATTENDANCE-SYSTEM-FULL-AUDIT.md](./ATTENDANCE-SYSTEM-FULL-AUDIT.md) | Attendance module deep-dive. Fully addressed in Phase 1 and Phase 5 remediations. |
| **SUPERSEDED** | [TASKS-SYSTEM-FULL-AUDIT.md](./TASKS-SYSTEM-FULL-AUDIT.md) | Tasks and assignments system audit. Addressed in Phase 3 remediations. |
| **SUPERSEDED** | [SCHEDULING-ENDPOINTS-MAP.md](./SCHEDULING-ENDPOINTS-MAP.md) | Historical endpoint map. Superseded by authoritative OpenAPI specifications (`artifacts/api-server/src/openapi/`). |
| **SUPERSEDED** | [SCHEDULING-CONTROLLER-SNIPPETS.md](./SCHEDULING-CONTROLLER-SNIPPETS.md) | Controller code snippets preserved during early refactoring. Superseded by production codebase. |
| **SUPERSEDED** | [SCHEDULING-MIDDLEWARE-MAP.md](./SCHEDULING-MIDDLEWARE-MAP.md) | Middleware mapping notes. Superseded by active production routing architecture. |
| **SUPERSEDED** | [CODEX-OVERNIGHT-REPORT.md](./CODEX-OVERNIGHT-REPORT.md) | Historical overnight automated run and analysis report. |

---

## 2. Retention Policy

- **Do Not Modify Historical Content:** Archived audit documents retain their original findings, dates, and text to preserve an unalterable compliance trail.
- **Prepend Status Markers:** Superseded reports must include a `STATUS: SUPERSEDED` callout linking back to the authoritative remediation tracker.
- **Single Source of Truth:** Operators and developers should consult [REMEDIATION-MASTER-PLAN.md](../../REMEDIATION-MASTER-PLAN.md) for current finding statuses, verified controls, and remaining items.
