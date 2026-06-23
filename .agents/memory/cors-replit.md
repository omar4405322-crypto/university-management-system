---
name: CORS Replit dev domains
description: How to correctly configure CORS for Replit's dev proxy — Vite port is dynamic, replit.dev subdomains include extra segments.
---

## Rule
Allow all `localhost:*` ports and use `[^/]*` (not `.*`) in the Replit regex to correctly match multi-segment subdomains like `bc443ac4-....janeway.replit.dev`.

## Why
Vite is assigned a random port from `$PORT` (e.g. 22006), not the hardcoded 5173/3000/3001. When the browser makes requests from the Vite origin to the Express API, `Origin: http://localhost:22006` was rejected. Additionally Replit's dev domain format is `<id>.janeway.replit.dev` which the original `.*\.replit\.dev$` regex did technically match, but `[^/]*` is safer and more explicit.

## How to apply
In `app.ts` CORS origin callback:
- `isLocalhost`: `/^https?:\/\/localhost(:\d+)?$/.test(origin)`
- `isReplitOrigin`: use `[^/]*` instead of `.*` before `.replit.dev`, `.replit.app`, `.repl.co`
- Also add `REPLIT_DEV_DOMAIN` explicitly to `allowedOrigins` list as `https://${process.env.REPLIT_DEV_DOMAIN}`
