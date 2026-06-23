---
name: Auth tokenVersion logout
description: How logout invalidation works without Redis — tokenVersion increments in DB on logout, middleware rejects old tokens.
---

## Rule
Logout increments `tokenVersion` on the `User` record. The `protect` middleware reads `tokenVersion` from the DB on every request and rejects the access token if the payload's `tokenVersion` no longer matches.

**Why:** Redis was removed (not available on Replit free tier). Token invalidation is done via DB-side version bump instead of a blacklist.

**How to apply:**
- `auth.controller.ts` `logout` handler: `prisma.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } })`
- `generateAccessToken(userId, tokenVersion)` embeds `tokenVersion` in the JWT payload
- `auth.middleware.ts` `protect`: verifies token, then fetches user and compares `user.tokenVersion === decoded.tokenVersion`
- No Redis calls anywhere in auth flow
