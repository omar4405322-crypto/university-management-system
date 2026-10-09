# Technology Stack

Scope: SHAHEEN 3D identity baseline, inspected 2026-10-03. Backend internals are outside this phase.

## 1) Runtime Summary

| Area | Value | Evidence |
|---|---|---|
| Language | TypeScript ~5.9.3; canonical renderer uses JavaScript with a declaration file | `package.json`, `renderer.js`, `renderer.d.ts` |
| Runtime | Node 24.x required by manifests | `package.json` |
| Package manager | pnpm 10.34.4, workspace packages | `package.json`, `pnpm-workspace.yaml` |
| Modules/build | ESM, Vite; TypeScript bundler resolution | app `package.json`, `vite.config.ts`, `tsconfig.json` |

## 2) Production Frameworks and Dependencies

- Three.js ^0.185.1 supplies the canonical imperative WebGL renderer.
- React and React DOM resolve to catalog version 19.1.0. They are declared under the app's devDependencies despite being imported by runtime source.
- React Three Fiber ^9.6.1 and Drei ^10.7.8 are installed; the canonical orb uses direct Three.js instead.
- Backend manifest declares Express ^5.2.1, Prisma client ^6.19.3, ioredis ^5.11.1, OpenAI ^6.49.0 and Google GenAI 2.24.0. [TODO] Backend implementation details were not audited in this frontend phase.

## 3) Development Toolchain

- Vite ^7.3.5 catalog range, React plugin, Tailwind v4 plugin.
- ESLint, React Hooks and JSX accessibility plugins; Prettier is installed.
- Node test runner, Playwright Core through an absolute local installation in the SHAHEEN browser harness.

## 4) Key Commands

```powershell
pnpm --filter @workspace/university-app typecheck
pnpm --filter @workspace/university-app build
node --test artifacts/university-app/tests/shaheen_runtime.test.mjs artifacts/university-app/tests/shaheen_browser.test.mjs artifacts/university-app/tests/ai_shared_interactive_orb.test.mjs
pnpm lint
```

## 5) Environment and Config

Vite reads PORT, BASE_PATH, NODE_ENV and REPL_ID. WebGL rendering requires a browser, canvas and DOM observers. The Lab route is development guarded. The renderer itself makes no provider/API requests. [TODO] Production container and backend environment were not validated.

## 6) Evidence

- `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- `artifacts/university-app/package.json`, `artifacts/university-app/vite.config.ts`
- `artifacts/university-app/src/components/ai/interactive-orb/renderer.js`
- `artifacts/university-app/tests/shaheen_browser.test.mjs`
- `artifacts/api-server/package.json`
