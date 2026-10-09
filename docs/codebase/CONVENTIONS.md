# Coding Conventions

Scope: inspected SHAHEEN frontend sources, 2026-10-03.

## 1) Naming Rules

| Item | Observed convention | Example |
|---|---|---|
| Components/interfaces | PascalCase | Interactive3DOrb, OrbRenderer |
| Runtime functions/variables | camelCase | createOrb, approachVisual, orbitTime |
| Constant maps | Uppercase | STATE_VISUALS, QUALITY_TIERS |
| CSS classes | kebab-case | lab-stage, orb-hit |

## 2) Formatting and Linting

`eslint.config.mjs` enforces hooks ordering and JSX alt text/ARIA validity; exhaustive hook dependencies are warnings. Prettier is installed; [TODO] A project-wide formatting policy was not established in this scoped inspection. Run `pnpm lint`. TypeScript base enables noImplicitAny, strictNullChecks, noImplicitReturns and isolatedModules; strictFunctionTypes is disabled.

## 3) Import and Module Conventions

The canonical runtime uses relative ESM imports. JavaScript modules have adjacent TypeScript declarations. App `@/*` aliases resolve to `src/*`. Preview `orb.js` re-exports rather than duplicating the engine. [TODO] No global import-order policy was verified.

## 4) Error and Logging Conventions

The component catches creation/draw failures, reports readiness and renders a static fallback. Renderer shader-link and context-loss failures call lifecycle onError. No renderer logging or backend credentials are involved. [TODO] Server logging/redaction conventions were not audited.

## 5) Testing Conventions

`tests/*.test.mjs` uses node:test and node:assert/strict. Browser tests use Edge via Playwright and mocked API routes. Tests assert state, identity of the canvas, kinetic behavior, fallback and disposal. [TODO] No source coverage threshold was verified for SHAHEEN.

## 6) Evidence

- `eslint.config.mjs`, `package.json`, `tsconfig.base.json`
- `artifacts/university-app/tsconfig.json`, `artifacts/university-app/vite.config.ts`
- `artifacts/university-app/src/components/ai/interactive-orb/renderer.d.ts`
- `artifacts/university-app/tests/shaheen_browser.test.mjs`
