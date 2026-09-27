# Full System Professional Audit

**Repository:** University Management System  
**Audit date:** 2026-09-20  
**Mode:** Production-grade read-only audit of the existing working tree  
**Overall score:** **6.8/10**  
**Production-readiness score:** **5.9/10**  
**Findings:** **0 Critical · 3 High · 13 Medium · 10 Low · 4 Info**

---

## 1. Executive Summary

This is a substantial modular-monolith university platform: an Express/TypeScript API, React/Vite SPA, PostgreSQL through Prisma, Redis-assisted security/caching/coordination, Socket.IO, Docker/Nginx deployment assets, and broad academic, attendance, assessment, finance, scheduling, and administration workflows. The codebase has unusually strong security-regression coverage for its maturity. Scope helpers, token-version checks, refresh-token rotation, replay controls, upload signature checks, transactional workflows, structured logging, distributed job locks, and operational documentation are genuine strengths.

The audited working tree is **not currently releasable**. A stray leading asterisk in artifacts/api-server/src/controllers/schedules.controller.ts:1 prevents backend parsing. Type checking, the root build, contract tests, and 13 API unit suites fail. Independently, production MFA configuration is weaker than its name and documentation imply: REQUIRE_2FA=true only challenges users already enrolled in TOTP, so privileged users without enrollment remain single-factor. Scheduling data was paginated at 50 rows, but three primary UI flows neither request additional pages nor consume pagination metadata, silently producing incomplete timetables.

No Critical issue was confirmed. The package vulnerability audit is clean; no likely live credential was found; Prisma validation, frontend tests/build, API integration tests, and Compose validation pass. The compile failure, MFA gap, incomplete schedules, dependency-blind readiness, misleading coverage, partial API contract, local-disk materials, and unproven backup objective keep the system below production-ready.

| Executive area | Score |
|---|---:|
| Overall | 6.8 |
| Architecture | 7.2 |
| Security | 7.3 |
| Performance | 6.6 |
| Backend | 6.8 |
| Frontend | 6.8 |
| Database | 7.8 |
| UX | 6.7 |
| Testing | 7.0 |
| Production readiness | 5.9 |

- **Biggest strength:** consistent server-side organizational scoping and security-focused regression tests.
- **Biggest architectural concern:** runtime routes, handwritten services, generated clients, and OpenAPI do not share one authoritative contract.
- **Biggest security concern:** mandatory MFA does not require privileged-user enrollment.
- **Biggest performance concern:** large initial frontend assets and a 23 MB promotional video; measurement is still required.
- **Biggest database concern:** academic numeric invariants remain partly application-only.
- **Biggest frontend concern:** schedule views silently stop at the first 50 rows.
- **Biggest backend concern:** the current scheduling controller does not parse.
- **Biggest operational concern:** readiness is dependency-blind and backup RPO is not repository-enforced.

## 2. Audit Scope

The audit covered root/workspace configuration, API bootstrap and middleware, all API route modules, representative and risk-critical controllers/services, authentication and authorization helpers, attendance drivers, scheduling, exams/quizzes/tasks, enrollment, payments, analytics, search, uploads, WebSockets, jobs, Redis utilities, Prisma schema/migrations, shared API packages, SPA routing/context/services/hooks/components/pages, tests, Docker/Compose/Nginx/Vercel, CI, and operational/security documentation.

No deployment, destructive command, persistent data mutation, migration application, external message, or production-system interaction occurred.

## 3. Audit Methodology

1. Mapped the monorepo, applications, packages, routes, tests, migrations, and deployment surfaces.
2. Traced critical workflows through UI, client, route, middleware, controller/service, query, response, and UI state.
3. Verified authorization across routes, services, query predicates, and global middleware before reporting gaps.
4. Applied OWASP-aligned review to authentication, access control, input, uploads, browser controls, secrets, logging, and availability.
5. Reviewed Prisma integrity, indexes, transactions, raw SQL, pagination, and query patterns.
6. Ran safe lint, type, build, contract, unit, integration, coverage, dependency, Prisma, Compose, secret, and whitespace checks.
7. Labeled uncertainty as CONFIRMED, LIKELY, POTENTIAL, or NEEDS RUNTIME VERIFICATION.

Scores describe the current working tree, not the last commit or historical reports.

## 4. Repository Overview

| Area | Purpose | Technology |
|---|---|---|
| artifacts/api-server | API, sockets, jobs, business logic | Express 5, TypeScript, Prisma 6, PostgreSQL, Redis, Socket.IO |
| artifacts/university-app | Multi-role SPA | React 19.1, Vite 7, Tailwind 4, Radix, Axios |
| lib/api-spec | API description | OpenAPI YAML |
| lib/api-client-react | Generated API types/client | TypeScript |
| lib/api-zod | Generated runtime schemas | Zod |
| scripts | Contract/deployment/security checks | Node/PowerShell |
| docs | Architecture, operations, security | Markdown |
| root deployment | Containers and proxy | Docker, Compose, Nginx |
| .github/workflows/ci.yml | Quality/container gates | GitHub Actions |

Inventory signals: about 808 non-dependency files, 28 API route modules, 96 API test files, 37 frontend tests, and 25 active migration directories.

## 5. System Architecture

The project is a modular monolith. Nginx serves the SPA and proxies API/Socket.IO traffic. Express applies headers, CORS, body limits, cookies, request IDs, rate limits, authentication, authorization, validation, controllers/services, Prisma/PostgreSQL, Redis, and notifications. Scheduled jobs run inside the API process with Redis leases. Profile images use Cloudinary; course materials use local disk.

This design is appropriate now. At 2× size it remains manageable if contract convergence and decomposition continue. At 5×, large modules, local files, in-process jobs, and handwritten contracts become material bottlenecks. At 10×, long jobs, exports, notifications, analytics read models, and material processing should move behind queues/object storage; the academic core need not become microservices.

## 6. System Map

    Browser / role-specific SPA
      ├─ lazy React routes and AuthContext
      ├─ handwritten Axios services plus partial generated types
      └─ Socket.IO client
               │ HTTPS / WSS
    Nginx / Vercel routing
               │
    Express application
      ├─ Helmet, CORS, request ID, body/rate limits
      ├─ protect → active user + tokenVersion
      ├─ role/capability/scope middleware
      ├─ validation → controllers → services
      ├─ centralized errors, audit and HTTP logs
      ├─ authenticated Socket.IO rooms
      └─ Cairo cron jobs with Redis leases
               ├─ PostgreSQL via Prisma
               ├─ Redis: cache, limits, replay, locks, sockets
               ├─ Cloudinary: profile images
               └─ local volume: course materials

Data enters through registration/login, scoped CRUD, attendance proofs, assessments, scheduling, payments, uploads, and sockets. Scope is enforced primarily through middleware, scope.utils.ts predicates, and service ownership checks. Cache keys cover public dashboard and scoped analytics.

## 7. Overall Scorecard

| Area | Score /10 |
|---|---:|
| Overall System | 6.8 |
| Architecture | 7.2 |
| Backend | 6.8 |
| Frontend | 6.8 |
| Database Design | 7.8 |
| API Design | 6.5 |
| Authentication | 6.8 |
| Authorization | 8.0 |
| Security | 7.3 |
| Data Isolation | 7.7 |
| Business Logic | 7.4 |
| Code Quality | 6.2 |
| Maintainability | 6.3 |
| Type Safety | 5.9 |
| Validation | 7.4 |
| Error Handling | 7.8 |
| Performance | 6.6 |
| Scalability | 6.5 |
| Reliability | 6.3 |
| Redis / Cache Design | 7.8 |
| Concurrency Safety | 7.5 |
| Logging | 7.5 |
| Observability | 7.0 |
| Testing | 7.0 |
| UI Design | 7.3 |
| UX | 6.7 |
| Accessibility | 5.8 |
| Responsive Design | 7.0 |
| DevOps | 7.1 |
| Deployment Readiness | 5.8 |
| CI/CD | 6.2 |
| Documentation | 6.3 |
| Production Readiness | 5.9 |

## 8. Detailed Scorecards

### Security

| Sub-area | Score | Evidence |
|---|---:|---|
| Password authentication | 7.5 | Dummy-hash comparison, bcrypt, central policy |
| MFA | 5.0 | Replay-safe TOTP, but enrollment is not enforced |
| Token/session handling | 8.5 | Short JWT, hashed rotated refresh tokens, tokenVersion |
| Authorization | 8.0 | Strong route/query scoping; conflict-check exception |
| IDOR protection | 8.0 | Broad scope/ownership regression tests |
| Input validation | 7.5 | Validators and caps; fragmented contracts |
| Rate limiting | 8.0 | Specialized Redis-backed production limits |
| File uploads | 6.8 | Signature/size/name checks; no malware scan |
| Secrets | 8.0 | Startup validation/encryption; no likely live secret found |
| Headers/CORS/cookies | 7.0 | Helmet and strict CORS; unsafe-inline remains |
| XSS/injection | 7.8 | React escaping and tagged Prisma SQL |
| Multi-instance security | 7.8 | Redis replay/limits/locks/socket adapter |

### Architecture and quality

| Sub-area | Score |
|---|---:|
| Module boundaries | 7.2 |
| Cohesion | 7.0 |
| Dependency direction | 7.0 |
| API contract authority | 5.5 |
| Runtime validation | 7.4 |
| Database integrity | 7.8 |
| Transaction design | 8.0 |
| Frontend state/data flow | 6.8 |
| Test risk coverage | 8.0 |
| Test measurement integrity | 4.5 |
| Operational automation | 6.0 |
| Incident diagnosability | 7.3 |

## 9. Architecture Review

Strengths include a coherent modular-monolith boundary, shared scope helpers, decomposed scheduling controllers, attendance drivers, typed errors, and explicit bootstrap/shutdown. There is no evidence that microservices would improve the current system.

The primary weakness is contract drift. Express is authoritative; OpenAPI describes 34 paths but not the full route surface; most frontend services are handwritten and commonly return ApiResponse<any>; generated clients exist but are not universal. FE-001 demonstrates the consequence.

## 10. Backend Review

The backend generally uses asyncHandler, centralized errors, explicit authorization, Prisma selects, and transactions. Enrollment, token rotation, schedule mutation, quiz submission, and task grading have concurrency defenses. Search is bounded and scoped.

Current health is dominated by schedules.controller.ts:1, which prevents parsing. Elsewhere route quality is strong, but pagination defaults and envelope placement vary, and limits above 100 are silently clamped.

## 11. Frontend Review

The SPA has lazy route loading, role/capability guards, reusable primitives, bilingual resources, loading/error/empty states, and in-memory access tokens. Its production build passes.

Weaknesses are handwritten response shapes, broad any usage, duplicated list/filter patterns, oversized pages, and incomplete pagination consumption. Shared accessible primitives exist, but several pages implement their own overlays and clickable div controls.

## 12. Database Review

The Prisma schema has clear relationships, foreign keys, timestamps, enums, compound uniqueness, and targeted indexes. Strong examples include unique enrollment per student/course/term, unique attendance per student/session, unique assessment submissions, Decimal payments, a positive-payment constraint, and active-session indexes.

Risks are application-only Float range rules, production-unmeasured analytics, intentionally large exports, and the lack of a restore exercise. Prisma validation passed; migrations were not applied.

## 13. API Review

REST naming and verbs are broadly consistent; errors are centralized and sensitive routes are rate-limited. Pagination is common but its shape and UI use are inconsistent. Explicit URL versioning is absent. OpenAPI/generated packages are valuable but partial. Contract tests exist but cannot currently import the malformed API.

## 14. Security Review

No confirmed SQL injection, command injection, path traversal, committed private key, live provider token, or direct XSS sink was found. Prisma raw SQL uses tagged templates; upload names are generated; material downloads are controller-authorized; logs redact credentials.

Primary gaps are MFA enrollment semantics, the schedule conflict oracle, permissive CSP, absent malware/archive scanning, and documentation drift.

## 15. Authentication Review

Login normalizes email, compares a dummy bcrypt hash, uses generic errors, checks user/request state, optionally verifies TOTP, and issues an in-memory bearer token plus hashed refresh-token cookie. Refresh rotation is transactional and detects reuse. Password change/deactivation increments tokenVersion; Socket.IO rechecks it.

REQUIRE_2FA is misleading: production forbids false, but login only verifies TOTP when twoFactorEnabled is already true. Forced enrollment, recovery codes, and a controlled recovery workflow are absent.

## 16. Authorization Review

Administrative mutations generally use role middleware plus getAdminMutationTargetWhere or scope predicates. Student/faculty access usually validates identity, enrollment, assignment, department, or college. Numerous scope-security tests substantiate the design.

The notable exception is POST /api/schedules/check-conflict, available to every authenticated role and accepting caller-selected department/staff/room fields without visible caller scoping.

## 17. Data Isolation Review

College/department admins are usually constrained server-side; students by identity/enrollment; faculty by assignments. Analytics constructs role-sensitive Prisma and tagged-SQL predicates. Public organization discovery appears intentionally required for registration.

Maturity is good, not complete. Conflict checking and future autocomplete/export endpoints need the same scoping standard. Runtime two-college adversarial testing remains necessary.

## 18. Business Logic Review

- Enrollment uniqueness and lifecycle are transaction-backed.
- Attendance uses session state, enrollment/assignment scope, replay controls, mode drivers, thresholds, and pending/excused states.
- Scheduling validates organization, assignments, overlap, and concurrent commits.
- Exams/quizzes/tasks enforce participant scope and submission concurrency.
- Payments use Decimal and positive database checks.
- Registration requests use scoped review workflows.

The dominant business defect is display completeness: schedule rows after 50 can exist but disappear. Several numeric rules also lack database constraints.

## 19. Performance Review

**Potential performance risks — measurement required:**

- 454.76 kB base JS, 349.01 kB CSS, heavy chart/attendance chunks.
- PNG dashboard heroes despite WebP variants, and a 23 MB promotional video.
- Analytics joins/aggregations and 10,000-row exports.
- Redis pattern invalidation via SCAN.
- Risk jobs iterating broad student sets with per-user notifications.
- Selectors attempting 200–1,000-row payloads.

Positive controls include lazy routes, bounded search, pagination, selected Prisma fields, caching, compound indexes, and query-count tests.

## 20. Redis / Cache Review

Redis supports rate limiting, TOTP/attendance replay, cache, cron leases, and Socket.IO scaling. Analytics keys include scope/filters; TTLs are bounded. Security-sensitive production operations generally fail closed, while local development can fall back in-process.

The fixed job lease has no renewal. Cache invalidation should be traced under production mutations to prove aggregate freshness.

## 21. Concurrency Review

Strong patterns include serializable transactions, unique constraints, atomic refresh rotation, Redis SET NX EX, Lua owner-safe release, replay counters, expected-submission timestamps, and conflict-specific errors.

Residual risks are job work exceeding fixed leases, duplicate risk notifications without an obvious durable idempotency key, and non-versioned concurrent administrative edits.

## 22. Error Handling Review

Typed errors and centralized middleware map validation, authentication, authorization, conflicts, Prisma errors, and safe production responses. Stack traces are not returned in production. Frontend clients normalize API failures.

Some pages still collapse failures to generic toasts. Dependency timeout/retry policy is not uniformly visible. The parser failure shows backend lint is an incomplete early gate.

## 23. Logging & Observability

Pino, request IDs, timing, audit logs, credential redaction, Prometheus, Sentry sanitization, security events, and graceful shutdown provide a credible incident foundation. Metrics require production authorization.

No deployable alert rules/dashboard definitions tied to SLOs are versioned here, and public readiness is not dependency-aware. Instrumentation is stronger than operationalization.

## 24. Reliability Review

Graceful shutdown closes HTTP, sockets, Prisma, Redis, and jobs with a deadline. Multi-instance controls use Redis. Liveness and detailed health are separated.

However, public readiness checks only shutdown state, Compose uses liveness, course files depend on a local volume, and backup instructions are primarily manual.

## 25. Testing Review

Testing breadth is a major strength: 96 API test files emphasize authorization, scope, concurrency, privacy, uploads, configuration, health, shutdown, and business integrity. The frontend has 37 tests for capabilities, contracts, focus, filtering, and regressions.

- Frontend tests: **37/37 passed**.
- API integration: **2/2 passed** with transaction cleanup.
- API unit: **142/155 passed; 13 failed**, cascading from the parser error.
- Coverage command: passed, but its 97.86% line figure measures loaded test/config files rather than application source.

### Top 20 missing or insufficient tests by risk

1. REQUIRE_2FA blocks privileged users who are not enrolled.
2. Mandatory users cannot disable MFA.
3. Lost-TOTP recovery.
4. Schedule UI loads more than 50 slots.
5. Selectors page beyond 100 records.
6. Student conflict probes cannot cross departments.
7. College admin conflict probes cannot cross colleges.
8. Public readiness fails when PostgreSQL fails.
9. Production readiness policy when Redis fails.
10. Cron overrun cannot duplicate execution.
11. Risk notification idempotency.
12. Malware/archive-bomb rejection.
13. Materials across two API hosts.
14. External-upload timeout/cleanup.
15. Backup restore rehearsal.
16. Production-size analytics EXPLAIN.
17. Keyboard/focus behavior for every modal.
18. Small-mobile E2E for tables/timetables.
19. Contract coverage for every mounted route.
20. Database rejection of out-of-range scores.

## 26. Dependency Review

pnpm audit --audit-level high passed with no known vulnerabilities. pnpm outdated -r found available releases and deprecations for @types/bcryptjs and prom-client; major upgrades exist for Prisma, Zod, ioredis, Recharts, Vite, and others. Upgrade in tested cohorts; do not mass-upgrade. Advisory reachability and SBOM analysis remain CI opportunities.

## 27. Build / Lint / Type Health

| Check | Result | Cause / impact |
|---|---|---|
| Root lint | Pass | Frontend only; API/scripts excluded |
| Root typecheck | **Fail** | TS1109 at schedules.controller.ts:1,17 |
| Root build | **Fail** | Stops at backend typecheck |
| Contract test | **Fail** | Same app-import parser error |
| Frontend build | Pass | Production bundle generated |
| Prisma validate | Pass | Schema valid |
| API unit tests | **Fail** | 13 suites affected by parser error |
| API integration | Pass | 2 tests |
| Frontend tests | Pass | 37 tests |
| Compose config | Pass | Example environment resolves |
| Git diff whitespace | **Fail** | Pre-existing whitespace/EOF issues |

## 28. DevOps Review

The repository includes multi-stage Docker construction, non-root intent, Compose dependency checks, Nginx, environment examples, migration deployment, rollback/disaster-recovery docs, and container/security tests.

The runtime dependency footprint is not tightly pruned. Readiness and backup evidence are insufficient, and local course materials restrict horizontal scaling.

## 29. Deployment Review

Deployment is **Partial**. A production build currently fails. Once repaired, migration order, secret validation, proxy configuration, health routes, and graceful shutdown are well represented. Missing proofs include dependency readiness, restore drills, shared storage, alerting, and exercised rollback.

## 30. CI/CD Review

CI covers lint, typecheck, unit/integration/frontend tests, a misleading coverage task, migrations against PostgreSQL, package audit, Docker security checks, and container build. The current compile failure should be caught.

Gaps: API/scripts are not linted; contract tests and explicit Prisma validation are absent; source coverage is invalid; browser accessibility/performance and post-deploy smoke gates are absent.

## 31. UI Review

The UI is consistent, modern, bilingual, and role-aware. Layouts, cards, tables, filters, loaders, notifications, and dashboards share design patterns.

Behavioral consistency lags visual consistency: custom modals bypass shared semantics, selectors can omit options without warning, and large pages mix orchestration, validation, and rendering.

## 32. UX Review

Strengths include loading/error/empty states, destructive confirmations, session-expiry feedback, translations, and scoped navigation.

Risks include incomplete schedule displays, silently capped selectors, inconsistent modal escape/focus, crowded small-screen tables, and no indication that a selector only contains the first page.

## 33. Accessibility Review

Accessibility maturity is **developing (5.8/10)**. The shared Modal has semantic dialog behavior, focus containment, Escape, and return focus. Form labels and translations are common.

Several custom modals lack equivalent semantics/focus lifecycle. Clickable cards activate on Enter but not Space. Static inspection cannot prove contrast, reading order, or screen-reader output.

## 34. Responsive Design Review

Responsive utilities, mobile navigation, wrapping filters, and overflow containers are common. Static review suggests good desktop/laptop and acceptable basic mobile behavior.

Large tables, timetables, analytics, and long modals are highest risk at 320–768 px. No browser persona run was completed because the API does not compile and seeded credentials were unavailable.

## 35. Code Quality Review

Naming and domain intent are generally clear. Security comments/tests are valuable and schedule decomposition is directionally good.

Maintainability suffers from large controllers/services/pages, repeated parsing/normalization, any, duplicate modal/list patterns, role/status strings, and whitespace drift. A one-character parser defect having repository-wide impact demonstrates missing backend lint/parser coverage.

## 36. Type Safety Review

TypeScript, Prisma types, authenticated-user types, shared enums, and generated packages provide a good base. Runtime validators protect many HTTP boundaries.

Static search found roughly 201 backend and 765 frontend explicit any-style occurrences, with no ts-nocheck. Highest-risk uses include ApiResponse<any>, transaction clients, Socket casts, and UI response normalization. Generated schemas should replace boundary uncertainty incrementally.

## 37. Validation Review

Validation spans forms, express-validator, services, and database keys. Security rules generally do not rely on the frontend.

Gaps are inconsistent shared schemas, partial OpenAPI/Zod coverage, application-only numeric ranges, and silent pagination coercion. A requested limit=1000 becoming 100 should be explicit or rejected.

## 38. Date / Time Review

Jobs explicitly use Africa/Cairo; database timestamps use DateTime; date-fns-tz appears in scheduling/attendance.

Some business logic still uses native current-year/local parsing. Academic-year behavior can differ by host timezone near boundaries. Cairo-boundary tests are needed.

## 39. Pagination / Search / Filtering Review

Most large collections paginate and cap pages at 100. Search is generally bounded and scoped.

Schedule defaults are 50 while major views consume only page one. Selectors request 200–1,000 but are silently capped. Pagination metadata can be top-level or nested. Stable ordering exists often but is not one explicit contract.

## 40. WebSocket / Real-Time Review

Sockets verify JWT, active state, and tokenVersion; users join private user/role rooms. Redis adapter support exists.

Multi-replica reconnect, adapter outage, and cross-user leakage behavior were not load-tested. These require a production-like runtime test.

## 41. Scheduled Jobs Review

Jobs cover risk detection, session expiry, and pending-review resolution. They use Cairo timezone and owner-safe Redis leases.

Fixed 240/3,600-second leases have no renewal. Risk processing sends notifications during the lease without an evident durable per-run idempotency key.

## 42. Privacy Review

Responses commonly exclude passwords/MFA secrets; refresh tokens are hashed; MFA/RFID/attendance secrets are encrypted or hashed. HTTP logs omit bodies/sensitive headers; audit bodies are recursively redacted.

Risks are indirect conflict inference, broad privileged PII by design, and no documented retention/deletion policy. No secret value is reproduced here.

## 43. Configuration Review

Critical secrets and production invariants are validated at startup. CORS, cookies, Redis, encryption, metrics, Sentry, and proxy behavior are configurable.

Ambiguity remains in REQUIRE_2FA, an independent frontend MFA flag, 10 MB global bodies, and documentation that describes different runtime behavior.

## 44. Documentation Review

Documentation is broad: architecture, API, security, environment, deployment, rollback, backup, disaster recovery, operations, performance, testing, and troubleshooting.

It is not reliably authoritative. docs/SECURITY.md claims a 2 MB JSON cap while code uses 10 MB; it implies stronger MFA/recovery and narrower uploads than implemented. React version references are stale. Testable behavior should drive documentation.

## 45. Legacy / Dead Code Review

Archived migrations and historical reports are labeled but add noise. No source was classified as safely dead without import/runtime evidence. Health aliases and parallel generated/handwritten clients may be transitional. Deletion is not recommended without telemetry and import/route proof.

## 46. Cross-Module Consistency

Authorization is more consistent than response shapes. Scope, errors, and auditing are reusable. Pagination defaults/envelopes, modal behavior, validation reuse, and generated-contract adoption vary.

Scheduling is the clearest drift example: backend pagination was added in isolation without migrating every consumer.

## 47. Edge-Case Review

Handled well: duplicate enrollment/submission, expired/reused tokens, inactive users, replayed proofs, concurrent schedule commits, ambiguous staff names, stale grading, missing records, and partial shutdown.

Residuals include more than 50 schedule rows, more than 100 selector records, unenrolled/recovery-locked admins, jobs exceeding leases, liveness during dependency failure, local files across hosts, timezone boundaries, malicious archive contents, and two-admin edits.

## 48. Feature Coverage Matrix

Legend: G good, P partial, N not ready.

| Feature | Backend | Frontend | DB | AuthZ | Validation | Errors | Perf | Tests | UX | Production |
|---|---|---|---|---|---|---|---|---|---|---|
| Login/session/MFA | G | G | G | G | G | G | G | G | P | P |
| Registration | G | G | G | G | G | G | P | G | G | G |
| Organization/users | G | G | G | G | G | G | P | G | G | G |
| Courses/enrollment | G | G | G | G | G | G | G | G | G | G |
| Scheduling | N | P | G | P | G | G | P | P | N | N |
| Attendance | G | G | G | G | G | G | P | G | G | P |
| Exams/quizzes/tasks | G | G | G | G | G | G | P | G | G | G |
| Grades/transcripts | G | G | P | G | G | G | P | G | G | P |
| Payments | G | G | G | G | G | G | P | G | G | P |
| Analytics | G | G | G | G | G | G | P | G | G | P |
| Notifications/sockets | G | G | G | G | P | G | G | P | G | P |
| Materials | G | G | G | G | G | G | P | G | G | P |
| Search/export | G | G | G | G | G | G | P | G | G | P |
| Health/operations | P | — | — | G | G | G | G | G | — | P |

## 49. Role / Persona Audit

| Role | What they can see/do | Enforcement assessment |
|---|---|---|
| Applicant | Register; discover colleges/departments | Intentional limited public surface |
| Student | Own schedule, attendance, assessments, transcript, payments | Generally identity/enrollment scoped; conflict endpoint too broad |
| Doctor | Assigned courses, attendance, assessments, grading | Assignment checks common |
| Teaching assistant | Assigned schedules/course support | Department/assignment checks common |
| Department admin | Department people/courses/schedules/analytics | Strong query-scope helper use |
| College admin | College/department administration | College predicates generally applied |
| Super admin | System-wide/security/metrics | Broad by design; MFA not guaranteed |

Reviewed delete/export operations are privileged. Frontend hiding is not relied upon as the primary control. Runtime multi-college testing remains necessary.

## 50. Attack Surface Map

| Surface | Exposure | Main controls | Residual risk |
|---|---|---|---|
| Login/refresh/logout | Public/cookie | Limits, dummy hash, rotation/reuse | MFA enrollment |
| Registration | Public | Validation, approval workflow | Abuse-volume testing |
| Organization discovery | Public | Read-only, bounded | Intentional metadata |
| Privileged CRUD | Auth/admin | Role, scope, audit | Contract inconsistency |
| Attendance | Authenticated | Scope, replay, timing, limits | Distributed failure/load |
| Assessments | Authenticated | Ownership/session/uniqueness | Browser anti-cheat limits |
| Conflict check | Any authenticated | Validation | Cross-unit inference |
| Upload/download | Authenticated | Size/type/signature/auth | Malware, local storage |
| Analytics/export/search | Authenticated | Scope, pagination/caps | Expensive queries |
| Socket.IO | Authenticated | TokenVersion, private rooms | Replica reconnect |
| Metrics/health | Mixed | Token/admin/rate limit | Readiness blind |
| Cron | Internal | Redis lease/timezone | Lease overrun |
| External services | Outbound | Secrets/config | Timeout/retry not proven |

## 51. Performance Hotspots

| Rank | Location | Problem | Expected impact | Action |
|---:|---|---|---|---|
| 1 | frontend build/assets | Large base JS/CSS and media | Mobile startup/data | RUM, WebP/AVIF, lazy video, budgets |
| 2 | attendance analytics | Complex joins/aggregates | Dashboard latency | Production-size EXPLAIN |
| 3 | utils/cron.ts:176-279 | Broad risk loop | DB/email pressure | Batch/queue/metrics |
| 4 | warning export | Up to 10k rows | Memory/payload | Stream or async export |
| 5 | selector lists | 200–1,000-row intent | Incomplete/heavy forms | Searchable pagination |
| 6 | Redis invalidation | Pattern SCAN | Keyspace latency | Versioned/explicit keys |
| 7 | chart/attendance chunks | Heavy feature bundles | Navigation delay | On-demand load/profile |
| 8 | conflict checks | Multiple overlap queries | Schedule latency | Measure/index/consolidate |
| 9 | material serving | API streams local files | API bandwidth | Object storage/CDN |
| 10 | request waterfalls | Repeated independent lists | Form latency | Parallel/cache |

## 52. Database Hotspots

| Model/query | Pattern | Assessment | Action |
|---|---|---|---|
| Attendance dashboards | joins/aggregates by scope/date | indexes exist; plan unknown | EXPLAIN at scale |
| Schedule conflicts | staff/room/group/day/time overlap | range selectivity unknown | benchmark composite indexes |
| Risk detection | broad active student traversal | periodic heavy work | batch/materialize if needed |
| Analytics | scoped counts/raw SQL | cached; plan unknown | capture p95/buffers |
| Warning export | 10k bounded set | bounded but heavy | async streaming |
| Enrollment/submission | unique + transaction | strong | preserve pattern |
| Payment | Decimal/index/check | strong | define currency if needed |
| Scores/thresholds | Float/app checks | direct invalid writes possible | add CHECK after data audit |

Index proposals require EXPLAIN (ANALYZE, BUFFERS) and write-volume evidence.

## 53. Complete Findings Register

### BLD-001 — Backend parser error blocks release

- **Status:** CONFIRMED
- **Severity / confidence:** High / High
- **Category:** Build, backend, production readiness
- **Location:** artifacts/api-server/src/controllers/schedules.controller.ts:1 and :17
- **Evidence:** A standalone asterisk precedes the opening documentation comment. Typecheck reports TS1109; build/contract tests fail; 13 API unit suites fail during import.
- **Why it matters:** The API cannot be compiled.
- **User impact:** No release; noisy development feedback.
- **Production impact:** CI/container build stops; bypassed gates yield a non-starting API.
- **Reproduction / trigger:** pnpm run typecheck, build, or test:contract.
- **Recommended fix:** Remove the token, then rerun all gates and inspect newly unmasked failures.
- **Effort / priority:** XS / P1

### AUTH-001 — Mandatory MFA does not mandate enrollment

- **Status:** CONFIRMED
- **Severity / confidence:** High / High
- **Category:** Authentication
- **Location:** artifacts/api-server/src/utils/twoFactorConfig.ts:1-12; controllers/auth.controller.ts:224-244; controllers/user.controller.ts:82-105; university-app/src/constants/featureFlags.ts:5
- **Evidence:** Production rejects REQUIRE_2FA=false, but login verifies TOTP only for users whose twoFactorEnabled is already true. Enrolled users can disable TOTP; the SPA warning flag is separately false.
- **Why it matters:** Operators may believe all administrators have MFA when they do not.
- **User impact:** A privileged password may be enough for takeover.
- **Production impact:** Elevated compromise and inaccurate compliance posture.
- **Reproduction / trigger:** Log in as a privileged account with twoFactorEnabled=false under production policy.
- **Recommended fix:** Define mandatory roles, gate tokens until enrollment, prevent disablement under policy, implement recovery codes/admin recovery, and expose server policy to the UI.
- **Effort / priority:** M / P1

### FE-001 — Pagination silently truncates schedules and selectors

- **Status:** CONFIRMED
- **Severity / confidence:** High / High
- **Category:** Frontend, API contract, business logic
- **Location:** api-server/src/controllers/schedules.controller.ts:100-101,253; utils/requestLimits.ts:1; middleware/requestLimits.middleware.ts:32-36; university-app/src/hooks/useTimetableData.ts:126-134,215; pages/schedules/WeeklySchedule.tsx:125; SchedulesList.tsx:171-184
- **Evidence:** Schedule lists default to 50 and return metadata, but consumers do not page. Selectors request 200, 300, or 1,000 while middleware silently rewrites limits above 100.
- **Why it matters:** The UI presents partial collections as complete.
- **User impact:** Valid slots, staff, courses, or departments are invisible.
- **Production impact:** Incorrect timetable decisions and failed assignments.
- **Reproduction / trigger:** Create more than 50 schedule rows or 100 selector records.
- **Recommended fix:** Standardize a typed pagination envelope, page/infinite-load schedules, and use searchable paginated comboboxes.
- **Effort / priority:** M / P1

### SEC-001 — Conflict endpoint can disclose cross-unit schedule data

- **Status:** LIKELY; runtime response verification recommended
- **Severity / confidence:** Medium / High
- **Category:** Authorization, privacy, data isolation
- **Location:** api-server/src/routes/schedules.routes.ts:127-132; controllers/schedulesConflict.controller.ts:20-113; services/timetable.service.ts:30-167
- **Evidence:** The protected route has no role/capability restriction, accepts caller-selected department/staff/room fields, and globally returns conflict details without visible caller-scope predicates.
- **Why it matters:** It can act as an organizational-data oracle.
- **User impact:** Staff/timetable detail may cross unit boundaries.
- **Production impact:** Horizontal information disclosure.
- **Reproduction / trigger:** Probe another department as a student.
- **Recommended fix:** Restrict roles, derive scope from req.user, and minimize returned detail.
- **Effort / priority:** M / P1

### TEST-001 — Coverage metric measures tests, not application source

- **Status:** CONFIRMED
- **Severity / confidence:** Medium / High
- **Category:** Testing, governance
- **Location:** package.json:15
- **Evidence:** The 97.86% line result covers loaded frontend test/config files rather than React/API production modules.
- **Why it matters:** Release decisions can rely on false assurance.
- **User impact:** Untested behavior may ship.
- **Production impact:** Hidden regression risk.
- **Reproduction / trigger:** pnpm run test:coverage.
- **Recommended fix:** Instrument production sources and publish separate backend/frontend risk-based coverage.
- **Effort / priority:** M / P1

### CI-001 — Static analysis omits backend lint and contract tests

- **Status:** CONFIRMED
- **Severity / confidence:** Medium / High
- **Category:** CI/CD
- **Location:** package.json:8-9; eslint.config.mjs; .github/workflows/ci.yml
- **Evidence:** Lint targets only frontend and ignores API/scripts. CI does not explicitly run contract tests or Prisma validate. The backend syntax defect passes lint.
- **Why it matters:** Feedback is delayed and backend rules cannot run.
- **User impact:** Slower fixes.
- **Production impact:** Contract drift survives longer.
- **Reproduction / trigger:** Lint passes while typecheck fails.
- **Recommended fix:** Add backend/script lint, contract, Prisma, and real coverage gates.
- **Effort / priority:** M / P2

### OPS-001 — Public readiness is dependency-blind

- **Status:** CONFIRMED
- **Severity / confidence:** Medium / High
- **Category:** Reliability, deployment
- **Location:** api-server/src/app.ts:149-159; compose.yaml health check
- **Evidence:** /api/ready checks shutdown state only. Detailed dependency readiness requires SUPER_ADMIN. Compose marks the API healthy with liveness.
- **Why it matters:** Listening is not the same as serving DB/Redis traffic.
- **User impact:** Requests reach failing instances.
- **Production impact:** Unsafe rollouts and misleading health.
- **Reproduction / trigger:** Make PostgreSQL unavailable while API listens.
- **Recommended fix:** Expose non-sensitive dependency readiness and use it for orchestration; retain liveness separately.
- **Effort / priority:** S / P1

### OPS-002 — Backup RPO is not operationally enforced

- **Status:** CONFIRMED repository gap; environment controls unknown
- **Severity / confidence:** Medium / Medium
- **Category:** Disaster recovery
- **Location:** docs/operations/BACKUP-RESTORE.md:48; DISASTER-RECOVERY.md; compose.yaml
- **Evidence:** Sub-hour objectives coexist with daily manual/host-cron dumps; PITR is conditional. No backup service, off-host retention automation, or restore evidence is versioned here.
- **Why it matters:** Stated RPO and executable recovery differ.
- **User impact:** Academic/payment data loss can exceed expectations.
- **Production impact:** Extended outage or unrecoverable loss.
- **Reproduction / trigger:** Repository-only deployment has no backup job.
- **Recommended fix:** Implement monitored encrypted off-site backup/PITR and periodic restore drills.
- **Effort / priority:** L / P1

### DOC-001 — Security documentation disagrees with runtime

- **Status:** CONFIRMED
- **Severity / confidence:** Medium / High
- **Category:** Documentation, configuration
- **Location:** docs/SECURITY.md:27,50; docs/ENVIRONMENT.md:19; api-server/src/app.ts:200; controllers/auth.controller.ts:51-73; middleware/materialUpload.middleware.ts:15-32
- **Evidence:** Docs claim enforced admin MFA, 2 MB bodies, stricter cookie/upload behavior, and recovery codes; runtime differs.
- **Why it matters:** Operators deploy under false assumptions.
- **User impact:** Weak recovery/configuration.
- **Production impact:** Compliance and incident confusion.
- **Reproduction / trigger:** Compare cited files.
- **Recommended fix:** Make tested behavior authoritative and assign documentation ownership.
- **Effort / priority:** S / P2

### TYPE-001 — Handwritten any contracts weaken type safety

- **Status:** CONFIRMED
- **Severity / confidence:** Medium / High
- **Category:** Type safety, maintainability
- **Location:** university-app/src/services/schedules.service.ts:22; api-server/src/services/timetable.service.ts:30; broad src use
- **Evidence:** Roughly 201 backend and 765 frontend explicit any-style occurrences, including response envelopes, transactions, sockets, and UI normalization.
- **Why it matters:** Contract changes compile but fail behaviorally.
- **User impact:** Missing data/runtime UI errors.
- **Production impact:** Higher regression rate.
- **Reproduction / trigger:** Change an envelope consumed through any.
- **Recommended fix:** Prioritize generated boundary types and typed transaction/request payloads.
- **Effort / priority:** L / P2

### API-001 — OpenAPI/generated clients cover only part of runtime

- **Status:** CONFIRMED
- **Severity / confidence:** Medium / High
- **Category:** API architecture
- **Location:** lib/api-spec/openapi.yaml; generated client/Zod packages; api-server/src/routes; university-app/src/services
- **Evidence:** OpenAPI has 34 paths while 28 route modules expose materially more operations; most SPA calls are handwritten.
- **Why it matters:** No single authority exists for pagination, status, nullability, and contracts.
- **User impact:** UI/API drift.
- **Production impact:** Integration regressions.
- **Reproduction / trigger:** Compare route inventory with OpenAPI after BLD-001.
- **Recommended fix:** Describe all supported endpoints, generate clients in CI, and fail on drift.
- **Effort / priority:** L / P2

### A11Y-001 — Custom modals bypass shared dialog/focus behavior

- **Status:** CONFIRMED
- **Severity / confidence:** Medium / High
- **Category:** Accessibility, frontend
- **Location:** university-app/src/components/ui/Modal.tsx:160-172; pages/courses/CourseModal.tsx:167; EditCourseModal.tsx:63; teaching-assistants/AssignDoctorModal.tsx:84
- **Evidence:** Shared Modal has dialog/focus behavior; cited fixed overlays do not.
- **Why it matters:** Keyboard/screen-reader users can lose context.
- **User impact:** Administrative actions become difficult or inaccessible.
- **Production impact:** WCAG/support risk.
- **Reproduction / trigger:** Navigate each modal without a pointer.
- **Recommended fix:** Migrate overlays to the shared primitive and test focus/Escape/return.
- **Effort / priority:** M / P2

### PERF-001 — Frontend payload and media are heavy

- **Status:** POTENTIAL PERFORMANCE RISK — measurement required
- **Severity / confidence:** Medium / High
- **Category:** Frontend performance
- **Location:** frontend build output; university-app/src/constants/universityAssets.ts:7-9; public assets
- **Evidence:** 454.76 kB base JS, 349.01 kB CSS, 420.41 kB chart vendor, 206.91 kB attendance page, and 23 MB MP4. PNG heroes are selected despite WebP variants.
- **Why it matters:** Mobile CPU/network costs affect interaction.
- **User impact:** Slow load and high data use.
- **Production impact:** Poor Web Vitals/abandonment.
- **Reproduction / trigger:** Mid-tier mobile slow-4G test.
- **Recommended fix:** RUM/Lighthouse, responsive WebP/AVIF, lazy video, chunk/budget work.
- **Effort / priority:** M / P2

### SCALE-001 — Course materials are tied to local API disk

- **Status:** CONFIRMED design; scaling impact LIKELY
- **Severity / confidence:** Medium / High
- **Category:** Scalability, storage
- **Location:** api-server/src/middleware/materialUpload.middleware.ts:8,46; app.ts:223; compose.yaml
- **Evidence:** Materials write to uploads/materials and use a local volume; only profile images use Cloudinary.
- **Why it matters:** Files are not naturally shared across hosts.
- **User impact:** Intermittent missing downloads after failover/scale.
- **Production impact:** Replica affinity and backup complexity.
- **Reproduction / trigger:** Upload on one host, download through another.
- **Recommended fix:** Private object storage with authorized signed delivery, scanning, lifecycle, and migration.
- **Effort / priority:** L / P2

### CONC-001 — Cron leases cannot renew and side effects lack durable idempotency

- **Status:** POTENTIAL; runtime duration verification required
- **Severity / confidence:** Medium / Medium
- **Category:** Concurrency, jobs
- **Location:** api-server/src/utils/cron.ts:176-279,488-493; utils/distributedLock.utils.ts:51-90
- **Evidence:** Jobs use fixed leases with owner-safe release but no heartbeat. Risk work sends notifications without an evident durable per-run key.
- **Why it matters:** A slow/paused worker can outlive the lease.
- **User impact:** Duplicate notices or repeated processing.
- **Production impact:** Load spikes/inconsistent jobs.
- **Reproduction / trigger:** Force work beyond TTL.
- **Recommended fix:** Add renewal/fencing, batch/queue work, and idempotency keys.
- **Effort / priority:** M / P2

### UPLOAD-001 — Course archives/media are not malware-scanned

- **Status:** CONFIRMED absence; exploitability depends on clients
- **Severity / confidence:** Medium / High
- **Category:** File security
- **Location:** api-server/src/middleware/materialUpload.middleware.ts:15-32,55-112
- **Evidence:** Size, extension, declared type, and signature are checked, but ZIP/RAR/7z/video up to 50 MB have no antivirus, sandbox, expansion, or content-disarm step.
- **Why it matters:** Correct format is not safe content.
- **User impact:** Malicious teaching files can be downloaded.
- **Production impact:** Malware distribution/storage abuse.
- **Reproduction / trigger:** Upload a valid malicious archive.
- **Recommended fix:** Quarantine and asynchronously scan; block download until clean; cap archive expansion.
- **Effort / priority:** L / P2

### SEC-002 — CSP retains unsafe-inline

- **Status:** CONFIRMED
- **Severity / confidence:** Low / High
- **Category:** Browser security
- **Location:** api-server/src/app.ts:73-74; nginx.conf
- **Evidence:** Script/style CSP permits unsafe-inline.
- **Why it matters:** It weakens mitigation if injection appears.
- **User impact:** Potential amplification of a future XSS.
- **Production impact:** Defense-in-depth weakness; no XSS sink confirmed.
- **Reproduction / trigger:** Inspect response headers.
- **Recommended fix:** Use nonces/hashes after compatibility testing.
- **Effort / priority:** M / P3

### CONFIG-001 — Global 10 MB body limit is broader than needed

- **Status:** CONFIRMED
- **Severity / confidence:** Low / High
- **Category:** Availability, configuration
- **Location:** api-server/src/app.ts:200-201
- **Evidence:** Every JSON/urlencoded endpoint accepts up to 10 MB before route validation.
- **Why it matters:** Small-payload routes allow excessive parsing work.
- **User impact:** Latency during abuse.
- **Production impact:** CPU/memory amplification.
- **Reproduction / trigger:** Send near-limit JSON to an ordinary endpoint.
- **Recommended fix:** Lower global limits and selectively increase justified routes.
- **Effort / priority:** S / P3

### DB-001 — Academic score/range integrity is application-only

- **Status:** CONFIRMED
- **Severity / confidence:** Low / High
- **Category:** Database integrity
- **Location:** api-server/prisma/schema.prisma score/percentage/threshold fields and related migrations
- **Evidence:** Several measures use Float plus application checks without equivalent CHECK constraints.
- **Why it matters:** Scripts/future services can persist impossible values.
- **User impact:** Incorrect grades/analytics.
- **Production impact:** Cleanup and trust loss.
- **Reproduction / trigger:** Direct database write outside application.
- **Recommended fix:** Audit data, define ranges, add CHECK constraints and Decimal where exactness matters.
- **Effort / priority:** M / P3

### CQ-001 — High-change modules and formatting drift reduce maintainability

- **Status:** CONFIRMED
- **Severity / confidence:** Low / High
- **Category:** Maintainability
- **Location:** attendance.service.ts; courses.controller.ts; exams.controller.ts; students.controller.ts; large schedule/attendance pages; whitespace reported at payments.controller.ts:165 and WeeklySchedule.tsx:148,153
- **Evidence:** Core modules mix policy, query, transformation, and side effects. git diff --check reports trailing whitespace/EOF issues.
- **Why it matters:** Reviews and changes become harder and noisier.
- **User impact:** Slower fixes and more regressions.
- **Production impact:** Higher change-failure rate over time.
- **Reproduction / trigger:** Trace a cross-cutting change; run git diff --check.
- **Recommended fix:** Extract behavior-backed domain/query/policy units and add formatting gates.
- **Effort / priority:** L / P3

### A11Y-002 — Clickable cards lack full button keyboard behavior

- **Status:** CONFIRMED
- **Severity / confidence:** Low / High
- **Category:** Accessibility
- **Location:** university-app/src/pages/colleges/CollegeDetails.tsx:237-270; departments/DepartmentDetails.tsx:355-432
- **Evidence:** div role=button handlers activate on Enter, not Space.
- **Why it matters:** They do not match native button interaction.
- **User impact:** Inconsistent keyboard controls.
- **Production impact:** Accessibility gap.
- **Reproduction / trigger:** Focus a card and press Space.
- **Recommended fix:** Use native button or implement full semantics.
- **Effort / priority:** XS / P3

### DEVOPS-001 — Runtime image is not production-pruned

- **Status:** LIKELY
- **Severity / confidence:** Low / Medium
- **Category:** Container hardening
- **Location:** Dockerfile; workspace manifests
- **Evidence:** Runtime construction retains broad workspace dependencies/tooling rather than a narrow API deploy artifact.
- **Why it matters:** Larger images increase pull time and package surface.
- **User impact:** Slower rollout/recovery.
- **Production impact:** More CVE churn/cost.
- **Reproduction / trigger:** Inspect final image inventory/size.
- **Recommended fix:** Produce a pruned runtime artifact and SBOM.
- **Effort / priority:** M / P3

### TIME-001 — Some academic-year logic depends on server-local Date behavior

- **Status:** POTENTIAL
- **Severity / confidence:** Low / Medium
- **Category:** Date/time
- **Location:** api-server/src/services/enrollment.service.ts current-year paths; mixed native Date parsing
- **Evidence:** Jobs standardize Cairo, but some current-year comparisons use native server behavior.
- **Why it matters:** Boundary results vary by host timezone/input format.
- **User impact:** Rare incorrect term/year eligibility.
- **Production impact:** Boundary incidents.
- **Reproduction / trigger:** Run in UTC around Cairo midnight/year boundary.
- **Recommended fix:** Centralize an academic clock/timezone and test boundaries.
- **Effort / priority:** S / P3

### DEP-001 — Maintenance debt exists despite a clean vulnerability audit

- **Status:** CONFIRMED
- **Severity / confidence:** Low / High
- **Category:** Dependencies
- **Location:** workspace manifests and lockfile
- **Evidence:** Outdated check reports major gaps and deprecations for @types/bcryptjs and prom-client; the vulnerability audit is clean.
- **Why it matters:** Deferred majors accumulate migration cost.
- **User impact:** No immediate impact confirmed.
- **Production impact:** Future support/security friction.
- **Reproduction / trigger:** pnpm outdated -r.
- **Recommended fix:** Remove redundant types if safe and upgrade in tested cohorts.
- **Effort / priority:** M / P3

### OBS-001 — Metrics lack repository-owned alerts/SLO definitions

- **Status:** CONFIRMED repository gap; external monitoring unknown
- **Severity / confidence:** Low / Medium
- **Category:** Observability
- **Location:** api-server/src/routes/metrics.routes.ts; docs/operations; deployment configuration
- **Evidence:** Metrics/docs exist, but no alert rules, dashboard definitions, burn-rate policy, or paging thresholds are versioned.
- **Why it matters:** Instrumentation alone does not detect incidents.
- **User impact:** Slower detection.
- **Production impact:** Higher MTTA/MTTR.
- **Reproduction / trigger:** Review deployment artifacts.
- **Recommended fix:** Version SLOs/alerts/dashboards or link the authoritative external system.
- **Effort / priority:** M / P3

### AUTH-002 — Password and recovery policy is incomplete

- **Status:** CONFIRMED
- **Severity / confidence:** Low / High
- **Category:** Authentication
- **Location:** api-server/src/utils/passwordPolicy.ts:8-25; recovery UI/docs
- **Evidence:** Eight-character composition rules exist, but breached/common-password screening, secure self-service recovery, and MFA recovery codes do not.
- **Why it matters:** Composition does not prevent common compromised passwords; manual recovery invites social engineering.
- **User impact:** Lockout or avoidable compromise.
- **Production impact:** Support burden/security risk.
- **Reproduction / trigger:** Submit a common password meeting composition rules.
- **Recommended fix:** Longer minimum, breached-password screen, secure reset, and one-time recovery codes.
- **Effort / priority:** M / P3

### INFO-001 — Face attendance fails explicitly instead of pretending

- **Status:** CONFIRMED
- **Severity / confidence:** Info / High
- **Category:** Feature maturity
- **Location:** api-server/src/attendance/drivers/FaceDriver.ts
- **Evidence:** The feature is gated and returns unsupported rather than weak biometric verification.
- **Why it matters:** Honest failure avoids false assurance.
- **User/production impact:** Feature unavailable, but not insecurely simulated.
- **Reproduction / trigger:** Invoke disabled face mode.
- **Recommended fix:** Keep disabled until privacy, consent, liveness, retention, accuracy, and threat models exist.
- **Effort / priority:** XL / P4

### INFO-002 — Public organization discovery is intentional

- **Status:** CONFIRMED
- **Severity / confidence:** Info / High
- **Category:** Privacy, product design
- **Location:** api-server/src/routes/college.routes.ts:18 and public department routes
- **Evidence:** Basic organization data supports pre-auth registration.
- **Why it matters:** This is not automatically an authorization bug.
- **User/production impact:** Enables registration while exposing basic metadata.
- **Reproduction / trigger:** Access public organization endpoints.
- **Recommended fix:** Keep fields minimized and document policy.
- **Effort / priority:** XS / P4

### INFO-003 — No likely live secret or unsafe raw SQL was found

- **Status:** CONFIRMED within static scope
- **Severity / confidence:** Info / Medium
- **Category:** Security assurance
- **Location:** repository-wide scan and Prisma query sites
- **Evidence:** Pattern scans found no likely private key/live token. No queryRawUnsafe/executeRawUnsafe call was identified; analytics uses tagged Prisma SQL.
- **Why it matters:** Reduces immediate credential/injection concern.
- **User/production impact:** Positive evidence, not proof about history/runtime.
- **Reproduction / trigger:** Repeat history-aware scans in CI.
- **Recommended fix:** Add secret and SAST gates.
- **Effort / priority:** S / P4

### INFO-004 — Package vulnerability audit is clean

- **Status:** CONFIRMED at audit time
- **Severity / confidence:** Info / High
- **Category:** Supply chain
- **Location:** pnpm-lock.yaml
- **Evidence:** pnpm audit --audit-level high returned no known vulnerabilities.
- **Why it matters:** No advisory currently blocks release.
- **User/production impact:** Positive snapshot; advisories change.
- **Reproduction / trigger:** Rerun audit/SBOM scanner.
- **Recommended fix:** Schedule audits and assess reachability.
- **Effort / priority:** XS / P4

## 54. Critical Findings

None confirmed.

## 55. High Findings

1. BLD-001 — backend parser error blocks build/release.
2. AUTH-001 — mandatory MFA does not mandate enrollment.
3. FE-001 — pagination silently hides valid schedule/list records.

## 56. Medium Findings

SEC-001, TEST-001, CI-001, OPS-001, OPS-002, DOC-001, TYPE-001, API-001, A11Y-001, PERF-001, SCALE-001, CONC-001, and UPLOAD-001.

## 57. Low Findings

SEC-002, CONFIG-001, DB-001, CQ-001, A11Y-002, DEVOPS-001, TIME-001, DEP-001, OBS-001, and AUTH-002.

## 58. Informational Findings

INFO-001 through INFO-004.

## 59. Top System Risks

### Top 10 most dangerous problems

BLD-001, AUTH-001, FE-001, SEC-001, OPS-001, OPS-002, SCALE-001, TEST-001, UPLOAD-001, and CONC-001.

### Top 10 security problems

AUTH-001, SEC-001, UPLOAD-001, SEC-002, AUTH-002, OPS-001, DOC-001, CONFIG-001, CONC-001, and missing history-aware secret/SAST automation.

### Top 10 performance problems

Frontend/media weight; unmeasured analytics; broad cron loops; 10k exports; oversized selector intent; Redis pattern invalidation; heavy feature chunks; conflict query fan-out; API-served files; and request waterfalls.

### Top 10 architecture problems

Partial contract authority; large domain modules; local material storage; in-process jobs; inconsistent pagination envelopes; generated-client underuse; application-only invariants; duplicated MFA policy; incomplete readiness; and missing observability-as-code.

### Top 10 backend problems

Parser failure; MFA enrollment; conflict scope; readiness; lease renewal; upload scanning; global body cap; large modules; partial contract; and external timeout uncertainty.

### Top 10 frontend problems

Schedule truncation; capped selectors; custom modals; any; base bundle; large media; oversized pages; inconsistent pagination; clickable non-buttons; and limited browser E2E.

### Top 10 database problems

Application-only score bounds; unmeasured analytics; overlap-index uncertainty; large exports; broad risk scans; untested restore; Float exactness; invalid direct writes; cache dependence; and absent scale baselines.

### Top 10 UX problems

Incomplete schedules; missing selector options; modal keyboard gaps; dense mobile tables; no partial-result warning; manual MFA recovery; heavy startup; generic errors; complex admin pages; and limited mobile verification.

### Top 10 maintainability problems

Handwritten contracts; any; large files; partial OpenAPI; frontend-only lint; false coverage; docs drift; inconsistent envelopes; duplicate UI logic; and formatting noise.

## 60. System Strengths

1. Reusable server-side scope helpers and layered authorization.
2. Risk-focused security/concurrency/privacy regression tests.
3. Hashed rotated refresh tokens, reuse detection, and tokenVersion invalidation.
4. Unique constraints, serializable transactions, and atomic Redis controls.
5. Strong relational schema, Decimal payments, indexes, and migrations.
6. Request IDs, Pino redaction, Prometheus, Sentry scrub, audit logs, and graceful shutdown.
7. Generated upload names, size/type/signature checks, and private download authorization.
8. Lazy routes, role guards, in-memory access token, reusable primitives, and bilingual UI.
9. Redis-backed rate limits, replay protection, scoped cache, sockets, and job leases.
10. Honest feature gating for unsupported face attendance.

Enrollment transactions, scope-security tests, shared Modal, refresh rotation, and secret redaction should be internal reference patterns.

## 61. Technical Debt Map

| Area | Debt | Severity | Long-term impact | Timing |
|---|---|---|---|---|
| Architecture | Multiple contract authorities | Medium | Integration drift | P2 |
| Security | MFA enrollment/recovery | High | Privileged compromise | P1 |
| Testing | False coverage metric | Medium | Bad release confidence | P1 |
| Database | App-only numeric constraints | Low | Invalid states | P3 |
| Frontend | Pagination, any, custom modals | High/Medium | Wrong UI/a11y debt | P1–P2 |
| Backend | Parser defect/large modules | High/Low | Release block/change friction | P1/P3 |
| DevOps | Readiness, backups, local files | Medium | Failed scale/recovery | P1–P2 |
| Observability | No SLO/alerts as code | Low | Slow detection | P3 |
| Documentation | Runtime drift | Medium | Unsafe assumptions | P2 |

## 62. Production Readiness Matrix

| Requirement | Status | Explanation |
|---|---|---|
| Authentication | Partial | Strong sessions; MFA policy incomplete |
| Authorization | Ready with exception | Strong scope; fix conflict endpoint |
| Security | Partial | Good baseline; MFA/upload/CSP gaps |
| Database | Ready with validation | Sound design; scale/restore unverified |
| Backups | Not Ready | No enforced RPO/PITR/restore evidence |
| Redis | Partial | Strong use; failover/lease-overrun untested |
| Rate limiting | Ready | Specialized distributed controls |
| Logging | Ready | Structured, correlated, redacted |
| Monitoring | Partial | Metrics/Sentry; no alerts/SLO deployment |
| Error handling | Ready | Centralized and safe |
| Testing | Partial | Broad tests; current failures/false coverage |
| Performance | Partial | No load/RUM/EXPLAIN baseline |
| Deployment | Not Ready | Current backend build fails |
| Rollback | Partial | Documented, not rehearsed |
| Secrets | Ready with validation | Startup checks/encryption; automate history scan |
| CI/CD | Partial | Good gates; lint/contracts/coverage gaps |
| Scalability | Partial | Redis-ready; files/jobs limit scale |
| Documentation | Partial | Broad but drifted |

## 63. Quick Wins

| Item | Benefit | Effort |
|---|---|---:|
| Repair BLD-001 and rerun gates | Restore build/test signal | XS |
| Add API parser/lint coverage | Earlier failures | S |
| Make /api/ready dependency-aware | Safer rollout | S |
| Correct security/environment docs | Accurate operations | S |
| Replace clickable divs with buttons | Accessibility | XS |
| Lower global body cap | Availability defense | S |
| Remove redundant deprecated type package after verification | Hygiene | XS |
| Add pagination completeness tests | Prevent truncation | S |
| Version alert/SLO ownership | Faster incidents | S |

## 64. Remediation Roadmap

### P0 — Immediate blockers

No confirmed P0 exploit or active corruption.

### P1 — Before production

1. BLD-001: restore parser/build health and rerun every suite.
2. AUTH-001: mandatory privileged MFA enrollment/disable/recovery policy.
3. FE-001: complete typed pagination for schedules/selectors.
4. SEC-001: scope and restrict conflict checking.
5. OPS-001: deployment-grade dependency readiness.
6. OPS-002: monitored backup/PITR plus restore drill.
7. TEST-001: real production-source coverage.

Fix build first; then add contract/pagination tests. Design recovery before enforcing MFA. Select backup storage before automation.

### P2 — Important

CI-001, DOC-001, TYPE-001, API-001, A11Y-001, PERF-001, SCALE-001, CONC-001, UPLOAD-001. Establish contract authority before broad type cleanup. Treat object storage and malware scanning as one material pipeline. Measure before optimizing performance.

### P3 — Quality improvements

SEC-002, CONFIG-001, DB-001, CQ-001, A11Y-002, DEVOPS-001, TIME-001, DEP-001, OBS-001, AUTH-002.

### P4 — Long term

Biometric governance if face attendance is pursued; cleanup only with telemetry; architectural extraction only when scale data justifies it; ongoing supply-chain and secret automation.

## 65. Suggested Future Architecture

Retain the modular monolith and evolve these boundaries:

    Typed OpenAPI/Zod contract
      ├─ generated SPA client
      └─ validated Express adapters
    Domain modules
      ├─ policy/scope
      ├─ transactional/idempotent commands
      ├─ stable paginated queries
      └─ events/outbox
    Infrastructure
      ├─ PostgreSQL
      ├─ Redis
      ├─ object storage + malware scan
      ├─ queue/worker for long jobs/exports
      └─ metrics/traces/SLO alerts

Extract only workloads with independent scale/failure characteristics: file processing, long exports, notifications, and periodic analytics.

## 66. Final Assessment

The system has **upper-intermediate engineering maturity** with several production-grade security and consistency patterns. Authorization, sessions, transactions, risk-focused tests, database fundamentals, and instrumentation are stronger than the aggregate score.

It is **not production-ready in the audited working tree** because the backend does not compile. After that repair, mandatory MFA, schedule completeness, readiness, backup/restore proof, conflict scoping, and source-coverage integrity are launch blockers or near-blockers. Priorities are: restore green gates; close privileged MFA; restore complete scheduling UX; make health/recovery truthful; then converge API contracts and storage.

## 67. Audit Commands Executed

| Command/check | Purpose | Result |
|---|---|---|
| rg --files and Lean Context inventory | Repository map | Succeeded |
| Targeted rg/Lean Context searches | Trace routes, auth, scope, jobs, UI, docs | Succeeded |
| git status --short | Establish initial tree state | Succeeded; extensively dirty before audit |
| pnpm run lint | Static lint | Passed; frontend only |
| pnpm run typecheck | Type health | Failed: TS1109 |
| pnpm run build | Full production build | Failed at backend typecheck |
| pnpm run test:contract | Contract drift | Failed at parser error |
| pnpm run test:web | Frontend tests | Passed: 37 |
| pnpm run test:api:unit | API tests | Failed: 142 pass, 13 import failures |
| pnpm run test:api:integration | DB integration | Passed: 2 |
| pnpm --filter @workspace/university-app run build | SPA bundle | Passed |
| pnpm run test:coverage | Configured coverage | Command passed; metric invalid for source |
| pnpm --filter @workspace/api-server exec prisma validate --schema=prisma/schema.prisma | Schema validation | Passed |
| Root pnpm exec prisma validate attempt | Initial schema check | Command resolution failed; corrected command passed |
| pnpm audit --audit-level high | Dependency vulnerabilities | Passed: none |
| pnpm outdated -r | Maintenance state | Completed; exit 1 because updates exist |
| docker compose --env-file deploy.env.example config --quiet | Compose validation | Passed |
| Secret filename/pattern scans | Credential exposure | No likely live secret found |
| Unsafe Prisma raw query scan | Injection surface | No unsafe raw call found |
| git diff --check | Whitespace | Failed on pre-existing formatting issues |

## 68. Audit Coverage

### Inspected

- Root workspace, package, TypeScript, ESLint, ignore, Docker, Compose, Nginx, Vercel, and CI files.
- All API route modules and critical middleware/bootstrap/configuration.
- Auth/session/scope/audit/logging/limits/health/metrics/sockets/Redis/jobs/uploads.
- Organization, users, courses, enrollment, attendance, scheduling, assessments, transcripts, payments, analytics, notifications, search.
- Prisma schema, migration inventory, representative constraints/indexes, seed/configuration.
- SPA router, contexts, clients/services, scheduling hooks/pages, dashboards, forms, UI primitives, assets.
- OpenAPI/generated client/generated Zod packages.
- API/frontend tests and operational/security documentation.

### Checks executed

Lint, typecheck, root build, contract tests, frontend tests, API unit/integration tests, frontend production build, configured coverage, Prisma validation, dependency audit/outdated check, Compose validation, secret scan, raw-query scan, and whitespace check.

### Not verified / requires runtime or production access

- Redis failover, Socket.IO multi-replica delivery, and distributed rate-limit behavior.
- Full browser persona and assistive-technology walkthroughs.
- Real email/Cloudinary/object-storage timeout/retry behavior.
- Load, soak, chaos, race, and real-user performance tests.
- Production-size PostgreSQL EXPLAIN (ANALYZE, BUFFERS).
- Backup age, off-site retention, PITR, and restore drill.
- External infrastructure: managed backups, WAF, alerting, TLS, secret manager.
- Git-history secret scan and external SBOM/reachability.
- Migration deployment on a disposable production-like database.
- Runtime schedule contract inventory after BLD-001.
- Mobile/tablet visual QA while the API cannot start.

### Files changed by this audit

- FULL-SYSTEM-PROFESSIONAL-AUDIT.md — replaced the historical report with this current audit.

No source, configuration, dependency, migration, database, environment, deployment, or generated file was intentionally modified.
