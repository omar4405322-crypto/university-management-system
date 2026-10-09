# Codebase Concerns

Scope: SHAHEEN identity baseline, inspected 2026-10-03. These are observed implementation constraints, not a security audit.

## 1) Top Risks (Prioritized)

| Concern | Evidence | Impact | Action |
|---|---|---|---|
| Canonical renderer is shared with production hero | component imports, avatar lazy import | Identity changes propagate beyond the Lab | Preserve page layout; review shared compatibility |
| Cap API crosses preview, declarations and tests | capMode/createOrb search | Partial removal breaks callers or leaves dead identity | Update all active callers and identity-specific checks |
| External master image pending | User clarification | Approved proportions cannot yet be validated | Wait for attachment before visual construction |

## 2) Technical Debt

Baseline contract describes missing Lab/state/quality behavior that now exists in source; use live implementation over historical status claims. README says React 18, while workspace catalog selects React 19.1.0. Separate production hero fallback still includes GraduationCap. Browser harness imports a machine-specific Playwright path. The scan includes scratch dependencies/media and does not reliably distinguish production debt.

## 3) Security Concerns

The canonical renderer has no backend/tool authorization responsibility; the brief prohibits changing those layers. [TODO] No backend vulnerability assessment was performed. Do not treat the scan's "no security configs detected" line as proof that security guidance is absent: README explicitly references `docs/SECURITY.md`.

## 4) Performance and Scaling Concerns

| Concern | Evidence | Observed symptom | Action |
|---|---|---|---|
| Heavy lazy orb chunk | Baseline build | 533.75 kB; 136.54 kB gzip | Measure additions against baseline |
| Geometry/material cleanup | renderer dispose | Existing deduplicated disposal | Include every new geometry/material |
| Depth versus opacity | bead draw loop | Back beads have opacity changes as well as depth testing | Validate actual occlusion for falcon |
| FPS telemetry is sampled | Lab timer | Not GPU timing | Report measurement limits |

## 5) Fragile/High-Churn Areas

Scan's last-90-days counts: both locale files 31 changes, faculty attendance dashboard 23, exams controller 22, API schema 18. These are outside the visual task. Preserve unrelated local changes. The SHAHEEN runtime specifically needs shared caller regression checks.

## 6) `[ASK USER]` Questions

No unanswered intent questions: user confirmed the master reference will be attached externally, and visual implementation should wait for it. [TODO] Record the attachment and final visual validation after it arrives.

## 7) Evidence

- `README.md`, `pnpm-workspace.yaml`
- `SHAHEEN-BASELINE-AND-IMPLEMENTATION-CONTRACT.md`
- `artifacts/university-app/src/components/ai/interactive-orb/renderer.js`
- `artifacts/university-app/src/components/ai/AiAssistantAvatar.tsx`
- `artifacts/university-app/tests/helpers/orb-brand.mjs`
- `scratch/shaheen-falcon/codebase-scan.txt`, high-churn section
