# Phase 7 — Dependency security audit
Date: 2026-09-30. Runtime: Node v24.15.0; package manager: Corepack pnpm 10.34.4.

## A / K — Exact audit and counts

Full registry JSON: [before](../../scratch/phase7-dependency-audit/audit-before.json), [after](../../scratch/phase7-dependency-audit/audit-after.json), [production-only after](../../scratch/phase7-dependency-audit/audit-prod-after.json).

| Severity | Before | After |
| --- | ---: | ---: |
| Critical | 0 | 0 |
| High | 11 | 0 |
| Moderate | 11 | 0 |
| Low / informational | 0 | 0 |
| Total unique advisories | 22 | 0 |

Full audit dependency count: 1068 → 1065. All 22 advisories resolved; six vulnerable package versions replaced.

## B / C — Production relevance

Classification retains registry severity; applicability is a separate judgment:
- **A:** currently reachable production path: Multer disk uploads (one moderate).
- **B:** shipped runtime dependency with conditional or currently absent exploit prerequisites: fast-uri, ip-address, five Axios advisories (three high, seven moderate).
- **C:** development/build-only: brace-expansion and markdown-it (two high, two moderate).
- **D:** advisory targets a Node Axios adapter/proxy mechanism absent from this browser application (six high, one moderate).
- **E:** no compatible fix available: none.

Before, runtime review A+B contained 11 advisories (three high/eight moderate), of which only the Multer advisory had a demonstrated applicable application path. After, both the full workspace and A+B review contain zero findings. `pnpm audit --prod` also reports zero, but alone is insufficient: Axios is declared in frontend devDependencies and still ships inside the browser bundle.

## D — Ownership, paths and individual findings

Path keys used for every finding below:
- **M:** direct backend runtime: `artifacts/api-server → multer`.
- **F:** transitive backend runtime: `artifacts/api-server → swagger-jsdoc → @apidevtools/swagger-parser → ajv → fast-uri`; also code generation via `lib/api-spec → orval → @scalar/openapi-parser → ajv`.
- **I:** transitive backend runtime: `artifacts/api-server → express-rate-limit → ip-address` (also rate-limit-redis's peer path).
- **T:** transitive development: `lib/api-spec → orval → typedoc → markdown-it`.
- **R:** transitive development: `root → eslint → minimatch → brace-expansion`; also ESLint plugin/config paths, including minimatch 3.
- **X:** direct frontend dependency shipped in production: `artifacts/university-app → axios`.

Each ID links to its advisory. Exact original titles, vulnerable ranges, patched ranges, all reported paths and CVEs are retained in the before JSON.

| Advisory | Severity | Path / class | Mechanism and current applicability | Affected range / first fix |
| --- | --- | --- | --- | --- |
| [GHSA-3pph-fpjx-jg34](https://github.com/expressjs/multer/security/advisories/GHSA-3pph-fpjx-jg34) | Moderate | M / A | Aborted upload orphaned disk writes; course material diskStorage is reachable by authorized managers. | ≥2.2.0 <2.4.0 / 2.4.0 |
| [GHSA-qw65-cvwx-89v3](https://github.com/fastify/fast-uri/security/advisories/GHSA-qw65-cvwx-89v3) | High | F / B | URI authority injection through serialize port; Swagger uses repository-owned schemas, no user schemas or URI allowlist. | ≥3 <3.1.7 / 3.1.7 |
| [GHSA-58mr-gqgx-xq4g](https://github.com/advisories/GHSA-58mr-gqgx-xq4g) | High | F / B | Unclosed authority bracket host confusion; same trusted-schema boundary. | =3.1.6 / 3.1.7 |
| [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) | Moderate | F / B | Percent-encoded host case inconsistency; no application security decision based on this normalization. | ≥3 <3.1.8 / 3.1.8 |
| [GHSA-j6r3-76f7-8jcv](https://github.com/advisories/GHSA-j6r3-76f7-8jcv) | Moderate | I / B | Mixed-family subnet comparison bypass; rate limiter compares IPv6 instances, not mixed families. | ≤10.7.0 / 10.7.1 |
| [GHSA-h3mg-xc3c-68pw](https://github.com/advisories/GHSA-h3mg-xc3c-68pw) | Moderate | I / B | Long Address6 parse diagnostics DoS; rate limiter guards with node:net isIPv6 before construction. | ≤10.7.0 / 10.7.1 |
| [GHSA-253c-mchw-3w2r](https://github.com/advisories/GHSA-253c-mchw-3w2r) | Moderate | T / C | Quadratic linkify processing in documentation tooling; no runtime import. | <14.3.1 / 14.3.1 |
| [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | Moderate | R / C | Quadratic brace rewriting in lint/build patterns. | ≥4 <5.0.12 / 5.0.12 |
| [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | High | R / C | Nested group recursion stack exhaustion in tooling. | ≥4 <5.0.11 / 5.0.11 |
| [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | High | R / C | parseCommaParts recursion stack exhaustion in tooling. | ≥4 <5.0.10 / 5.0.10 |
| [GHSA-vh66-26gq-q6x8](https://github.com/axios/axios/security/advisories/GHSA-vh66-26gq-q6x8) | Moderate | X / B | Fetch-adapter prototype pollution gadget; browser uses default XHR, no fetch opt-in or pollution source identified. | ≥1.7 <1.20 / 1.20.0 |
| [GHSA-9fr6-4gfg-395g](https://github.com/advisories/GHSA-9fr6-4gfg-395g) | Moderate | X / B | Inherited method override; application uses explicit own methods, no pollution source identified. | ≥1 <1.20 / 1.20.0 |
| [GHSA-c29m-xwm3-cm6r](https://github.com/advisories/GHSA-c29m-xwm3-cm6r) | High | X / D | Node fromDataURI regex DoS; Node HTTP adapter absent from production browser path. | ≥1.16.1 <1.20 / 1.20.0 |
| [GHSA-mghh-pgcx-3jjj](https://github.com/advisories/GHSA-mghh-pgcx-3jjj) | High | X / D | Node proxy redirect host normalization ReDoS; Node proxy path absent. | ≥1.15 <1.20 / 1.20.0 |
| [GHSA-x97p-jq2g-jp4f](https://github.com/axios/axios/security/advisories/GHSA-x97p-jq2g-jp4f) | High | X / B | Inherited toFormData options gadget; multipart callers exist, but requires independent prototype pollution. | ≥1.15.1 <1.20 / 1.20.0 |
| [GHSA-3pq3-5fj3-cg6v](https://github.com/advisories/GHSA-3pq3-5fj3-cg6v) | High | X / D | HTTP2 DNS/proxy bypass; no server Axios HTTP2 use. | ≥1.13 <1.20 / 1.20.0 |
| [GHSA-542g-h47m-68v8](https://github.com/advisories/GHSA-542g-h47m-68v8) | High | X / D | HTTP2Session unhandled error DoS; same absent Node HTTP2 path. | ≥1.13 <1.20 / 1.20.0 |
| [GHSA-j8rh-479h-cp32](https://github.com/axios/axios/security/advisories/GHSA-j8rh-479h-cp32) | Moderate | X / B | Inherited headers after minimal interceptor; application retains full config and sets own Authorization, no pollution source identified. | ≥1 <1.20 / 1.20.0 |
| [GHSA-4hqw-qxg8-jxx2](https://github.com/advisories/GHSA-4hqw-qxg8-jxx2) | Moderate | X / B | Inherited FormData.getHeaders in fetch adapter; no fetch adapter or Node getHeaders configured. | ≥1.12 <1.20 / 1.20.0 |
| [GHSA-m8m8-qj5v-23w3](https://github.com/advisories/GHSA-m8m8-qj5v-23w3) | High | X / D | Inherited createConnection in Node HTTP adapter; browser-only application use. | ≥1.15.2 <1.20 / 1.20.0 |
| [GHSA-44g4-m2mj-wpvx](https://github.com/advisories/GHSA-44g4-m2mj-wpvx) | Moderate | X / D | NO_PROXY CIDR ignored; Node proxy environment path absent in browser. | ≥1.15 <1.20 / 1.20.0 |
| [GHSA-r4gj-5m52-g5wh](https://github.com/advisories/GHSA-r4gj-5m52-g5wh) | High | X / D | Fetch maxRedirects:0 ignored SSRF; no server Axios or configured fetch/maxRedirects:0 path. | ≥1.17 <1.20 / 1.20.0 |

Source checks: materialUpload.middleware.ts and courses.routes.ts authorize the disk upload; utils/swagger.ts creates Swagger from repository definitions; express-rate-limit's installed ipKeyGenerator validates IPv6 before Address6; frontend lib/api.ts uses Axios for browser requests and refresh with explicit methods. These are repository-grounded applicability judgments, not proof against every hypothetical future use.

## E / F — Phase 7 files and remediation

Implementation changes only:
- `artifacts/api-server/package.json`: Multer ^2.3.0 → ^2.4.0 (same-major minor).
- `artifacts/university-app/package.json`: Axios ^1.18.1 → ^1.20.0 (same-major minor).
- `pnpm-workspace.yaml`: existing brace-expansion override 5.0.9 → 5.0.12; fast-uri 3.1.6 → 3.1.8; markdown-it 14.2.0 → 14.3.1; scoped express-rate-limit>ip-address override 10.7.1.
- `pnpm-lock.yaml`: those six version replacements, two importer updates and required parent edges; obsolete Multer dependencies concat-stream/buffer-from/typedarray removed.

Additional outputs: this report and `scratch/phase7-dependency-audit/` audit/baseline/status/stat evidence. Temporary audit helper removed after capture.

Parent compatibility: ajv ^3.0.1 accepts fast-uri 3.1.8; express-rate-limit ^10.2.0 accepts ip-address 10.7.1; typedoc ^14.1.1 accepts markdown-it 14.3.1; minimatch 10 ^5.0.5 accepts brace-expansion 5.0.12. The inherited global brace-expansion 5 override already substituted major 5 under minimatch 3, whose declared range is ^1.1.7. Phase 7 only patches that existing override; lint and frontend build pass. No new cross-major substitution was introduced.

Lockfile-only resolution used ignore-scripts; installed with frozen lockfile and ignore-scripts. Unrelated resolver changes to existing es-object-atoms edges were restored against the pre-task snapshot, then frozen installation passed. Node 24, pnpm pin and OpenAI 6.49.0 remain unchanged.

## G / H / I / L — Fixed and remaining

All 22 findings fixed. No remaining audited advisories, unavailable compatible fixes or required breaking upgrades. Existing peer warnings (ESLint plugin versus ESLint 10; Swagger parser openapi-types peer; Cloudinary storage peer) were not introduced by Phase 7 and are outside this remediation.

## J — Validation

All validation commands used Node 24.15.0 and Corepack pnpm 10.34.4.

| Check | Result |
| --- | --- |
| Frozen lockfile installation, ignore scripts | Pass |
| Library, backend, frontend and scripts typechecks | Pass through equivalent individual commands |
| Root lint | Pass; one existing unused eslint-disable warning |
| Backend build: prisma generate && node build.mjs | Pass on retry; initial parallel attempt hit Windows engine DLL lock |
| Frontend production build | Pass |
| Express app import | Pass, Node v24.15.0 |
| Prisma validate | Pass; no DB mutation |
| API AI/auth/scope/environment/privacy/course material/upload checks (13 files) | Pass: 15 reported tests, zero failed |
| Frontend AI checks | Pass, fake API client |
| AI browser flow against built frontend | Pass, mocked API only |
| OpenAPI contract drift | Pass: 37 priority routes documented; 183 auxiliary routes remain |
| Full frontend test command | 95 passed, 2 failed out of 97 |
| git diff --check | Pass; CRLF conversion warnings only |
| Full and production-only audit | Zero findings |

Commands: `corepack pnpm run typecheck:libs`; `corepack pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck`; `corepack pnpm run lint`; `corepack pnpm --filter @workspace/api-server build`; `corepack pnpm --filter @workspace/university-app build`; `corepack pnpm --filter @workspace/university-app test`; `corepack pnpm --filter @workspace/api-server exec prisma validate`; `corepack pnpm --filter @workspace/scripts exec tsx ./contract_drift_check.ts`; `node --test artifacts/university-app/tests/ai_assistant_browser.test.mjs`.

The root combined typecheck wrapper invokes plain pnpm internally and encountered a separate pnpm 12.4.2 shim mismatch; both constituent checks passed when invoked explicitly through pinned Corepack. The pin was not changed. Corepack was narrowly allowed in lean-ctx's command policy to run the repository's pinned tool.

Two failures are RESP-01 (hamburger visibility at 768px) and RESP-02 (menu button timeout) in responsive_layout_regression.test.mjs. They log in to an independently running localhost:5173 application rather than serving the production artifact built by this check. These failures are not proven pre-existing and are not attributed to Axios without evidence. No unrelated UI/test changes were made; this validation gate remains unresolved.

## Working tree provenance

Pre-task dirty tree: 151 tracked files changed, 431 insertions, 17023 deletions. Final tracked diff: 152 files changed, 468 insertions, 17080 deletions. Most are earlier phase changes and skill deletions. See [status before](../../scratch/phase7-dependency-audit/status-before.txt), [status after](../../scratch/phase7-dependency-audit/status-after.txt), [git diff --stat before](../../scratch/phase7-dependency-audit/diff-before.txt), [git diff --stat after](../../scratch/phase7-dependency-audit/diff-after.txt). The after-status snapshot was captured immediately before removal of the temporary audit helper. These whole-tree stats must not be attributed entirely to Phase 7; untracked report/evidence files are not included in git diff --stat. The pre-task dependency files are retained alongside the audit JSON for exact comparison.

## M — Readiness

Dependency security remediation is complete. **Not ready to claim a fully green release gate** until the two live responsive-layout checks are resolved or rerun successfully against the intended application. No additional dependency major upgrade is required by this audit. Stop at Phase 7.

FORCE AUDIT FIX USED: NO  
REAL OPENAI API CALLS MADE: NONE  
DEPLOYMENTS MADE: NONE  
DATABASE MIGRATIONS/SEEDS/RESETS: NONE

