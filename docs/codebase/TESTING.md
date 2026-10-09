# Testing Patterns

Scope: SHAHEEN baseline, verified 2026-10-03 before visual edits.

## 1) Test Stack and Commands

Node test runner with node:assert/strict; browser tests import Playwright Core from an absolute Windows installation and launch Edge. Root scripts expose API, web, contract and coverage commands.

```powershell
pnpm test:web
node --test artifacts/university-app/tests/shaheen_runtime.test.mjs artifacts/university-app/tests/shaheen_browser.test.mjs artifacts/university-app/tests/ai_shared_interactive_orb.test.mjs
node --test artifacts/university-app/tests/ai_hero_3d_browser.test.mjs
pnpm --filter @workspace/university-app typecheck
pnpm --filter @workspace/university-app build
```

## 2) Test Layout

Frontend tests live in `artifacts/university-app/tests/*.test.mjs`; browser helpers live in `tests/helpers/`. Preview also has `motion-preview-3d/interaction.test.mjs`, which expects a running localhost:5173 server.

## 3) Test Scope Matrix

| Scope | Covered | Target |
|---|---|---|
| Runtime | Yes | State interpolation and quality bounds |
| Shared component | Yes | Canonical renderer imports and re-export |
| Browser | Yes | Lab state transitions, canvas persistence, input, quality, preferences and fallback |
| Production hero | Separate built-app suite | Lazy loading, no layout shift and failure behavior |
| Approved falcon silhouette | Pending | Master reference not attached at baseline inspection |

## 4) Mocking and Isolation Strategy

Lab tests start an ephemeral Vite server, mock session/network routes, and close browser/server in finally. Direct renderer checks run in-page and dispose their own canvas. Touch uses CDP input. Evidence is written to `scratch/shaheen-phase1/`. Absolute tooling paths reduce portability.

## 5) Coverage and Quality Signals

Focused baseline command: 6 passed, 0 failed, 0 skipped, duration 26.99 seconds. Frontend typecheck: exit 0. Frontend build: exit 0, 21.13 seconds; existing >500 kB chunk warning. Canonical orb JS chunk: 533.75 kB, gzip 136.54 kB. [TODO] Full suite and application-source coverage have not been measured in this inspection.

Existing projected-cap assertions must be replaced with equivalent 3D falcon movement/depth checks when identity changes; retain all kinetic/lifecycle coverage.

## 6) Evidence

- `package.json`, `artifacts/university-app/package.json`
- `artifacts/university-app/tests/shaheen_runtime.test.mjs`
- `artifacts/university-app/tests/shaheen_browser.test.mjs`
- `artifacts/university-app/tests/ai_shared_interactive_orb.test.mjs`
- `artifacts/university-app/tests/ai_hero_3d_browser.test.mjs`
- `artifacts/university-app/tests/helpers/orb-brand.mjs`
- Baseline command results recorded in `scratch/shaheen-falcon/inspection.md`
