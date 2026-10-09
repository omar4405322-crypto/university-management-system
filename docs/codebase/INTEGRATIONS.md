# External Integrations

Scope: visual runtime integrations only, inspected 2026-10-03. Installed backend SDKs are not evidence of active provider configuration.

## 1) Integration Inventory

| System | Type | Purpose | Auth | Evidence |
|---|---|---|---|---|
| Three.js/WebGL | Browser GPU | Scene rendering | None | `renderer.js` |
| DOM observers | Browser APIs | Resize and visibility suspension | None | renderer and component |
| matchMedia | Browser preference | Reduced-motion detection | None | component |
| Vite proxy | Development HTTP proxy | `/api` and `/uploads` to localhost:5000 | [TODO] Server authentication not reviewed | `vite.config.ts` |
| Playwright/Edge | Local test tools | Browser validation | Mocked session | `shaheen_browser.test.mjs` |

## 2) Data Stores

The canonical renderer accesses no database/cache. Server manifest declares Prisma client and ioredis. [TODO] Actual database/cache connections and access layers are outside this phase.

## 3) Secrets and Credentials Handling

The renderer contains no provider credential reads. Vite selects port/base and optional development plugins from environment variables. [TODO] Backend secrets, rotation and repository-wide hardcoding audit were not investigated.

## 4) Reliability and Failure Behavior

WebGL context loss prevents default handling and signals fallback. Shader-link failure also signals fallback. The component cancels animation on failure; unmount disposes resources. No external network retry or timeout exists in this renderer. [TODO] Provider retry/circuit-breaker behavior was not audited.

## 5) Observability for Integrations

Lab samples frame counts every second and displays estimated FPS, frame interval, DPR, quality, readiness and state energy. These are local runtime indicators, not GPU timing or field performance measurements. [TODO] Backend metrics/tracing remain outside scope.

## 6) Evidence

- `artifacts/university-app/src/components/ai/interactive-orb/renderer.js`
- `artifacts/university-app/src/components/ai/interactive-orb/Interactive3DOrb.tsx`
- `artifacts/university-app/src/pages/ai/ShaheenLabPage.tsx`
- `artifacts/university-app/vite.config.ts`
- `artifacts/api-server/package.json`
