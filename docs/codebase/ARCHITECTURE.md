# Architecture

Scope: SHAHEEN 3D identity baseline, inspected 2026-10-03; this describes the existing orb before falcon construction.

## 1) Architectural Style

The frontend combines React feature components with an imperative Three.js runtime behind a typed renderer interface. One canonical renderer serves the Lab, preview and lazy-loaded production hero. The brief confines this phase to visual identity; backend behavior and API contracts are excluded.

## 2) System Flow

```text
Lab controls -> Interactive3DOrb effects -> createOrb/configure
browser/input clock -> draw -> quaternion/material/orbits -> persistent canvas
runtime state -> one-second Lab sampling -> telemetry
context failure -> onError/onReady(false) -> fallback
```

The component creates the renderer, configures controls without replacing it, owns its autoplay clock, suspends on visibility/intersection changes, and disposes on unmount. Preview supplies a shared external clock instead. Shader state targets interpolate through `approachVisual`. Pointer and keyboard handlers alter renderer orientation directly.

## 3) Layer/Module Responsibilities

| Module | Owns | Must not own | Evidence |
|---|---|---|---|
| React adapter | DOM, preference hooks, lifecycle and accessibility | Per-frame React state | `Interactive3DOrb.tsx` |
| Renderer | Scene, shaders, quaternion input, quality, resources | AI tools/provider behavior | `renderer.js` |
| Runtime constants | Seven state targets and three quality tiers | DOM or resource ownership | `shaheenRuntime.js` |
| Lab | User controls, state settling and telemetry | Production navigation | `ShaheenLabPage.tsx`, `App.tsx` |

## 4) Reused Patterns

- Factory returns draw/configure/state/reset/dispose methods.
- Lazy import and error boundary surround the production hero.
- Ref-held renderer and reusable quaternion/vector objects avoid per-frame React updates.
- Set-based disposal deduplicates scene geometry/material cleanup.

## 5) Known Architectural Risks

The cap parameter, projected emblem and capMode controls span adapter, declarations, preview and tests; removing them requires synchronized changes. Production `AiAssistantAvatar` has a separate cap fallback outside the canonical adapter. Context loss currently enters fallback rather than restoring that WebGL context. [TODO] Backend architectural review is outside this task.

## 6) Evidence

- `artifacts/university-app/src/components/ai/interactive-orb/Interactive3DOrb.tsx`
- `artifacts/university-app/src/components/ai/interactive-orb/renderer.js`
- `artifacts/university-app/src/components/ai/interactive-orb/shaheenRuntime.js`
- `artifacts/university-app/src/components/ai/AiAssistantAvatar.tsx`
- `artifacts/university-app/src/pages/ai/ShaheenLabPage.tsx`
- `artifacts/university-app/motion-preview-3d/motion.tsx`
