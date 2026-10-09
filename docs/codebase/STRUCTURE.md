# Codebase Structure

Scope: SHAHEEN 3D identity baseline, inspected 2026-10-03.

## 1) Top-Level Map

| Path | Purpose | Evidence |
|---|---|---|
| `artifacts/university-app/` | React frontend and browser harnesses | app manifest, `src/main.tsx` |
| `artifacts/api-server/` | Backend workspace, excluded from visual edits | server manifest |
| `lib/` and `scripts/` | Shared workspaces and utility workspace | `pnpm-workspace.yaml` |
| `docs/` | Project documentation | root README |
| `scratch/` | Existing local evidence and temporary tooling | browser test evidence path |

## 2) Entry Points

- Frontend: `artifacts/university-app/src/main.tsx` mounts App with theme and language providers.
- Lab: `src/App.tsx` conditionally loads and routes `/shaheen-lab` under `import.meta.env.DEV`.
- Preview: `motion-preview-3d/index.html` and `motion.tsx` form a separate Vite development entry.
- Backend manifest selects `src/index.ts` for development and `dist/index.mjs` for start. [TODO] Backend boot flow not investigated.

## 3) Module Boundaries

| Boundary | Responsibility | Constraint |
|---|---|---|
| `components/ai/interactive-orb/` | Canonical visual runtime, component, declarations, CSS | No AI authorization or execution logic |
| `pages/ai/ShaheenLabPage.tsx` | Development controls and one-second telemetry | Keep production integration out of this phase |
| `motion-preview-3d/` | Shared renderer comparison/export harness | Do not fork the engine |
| `tests/` | Runtime and browser regressions | Preserve interaction and lifecycle assertions |

## 4) Naming and Organization Rules

React components use PascalCase filenames, runtime modules camelCase or descriptive lowercase, CSS uses kebab-case. The AI frontend is feature grouped. Vite and TypeScript map `@/*` to app `src/*`; the canonical runtime uses relative imports. `motion-preview-3d/orb.js` re-exports the canonical renderer.

## 5) Evidence

- `pnpm-workspace.yaml`, `README.md`
- `artifacts/university-app/src/main.tsx`, `artifacts/university-app/src/App.tsx`
- `artifacts/university-app/src/components/ai/interactive-orb/Interactive3DOrb.tsx`
- `artifacts/university-app/src/pages/ai/ShaheenLabPage.tsx`
- `artifacts/university-app/motion-preview-3d/orb.js`
