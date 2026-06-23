# Spec.md — auth.controller.js → auth.controller.ts

## Review Level: Highest (matching auth.middleware.ts)
This is the last JS file in `controllers/` and the most sensitive file in the entire folder
(login, registration, possibly password reset / refresh token / 2FA).
**No full automatic execution. Every step below must be done in order, without skipping.**

---

## Step 1 — Read-Only First (no editing allowed at this step)
1. Display the full content of `auth.controller.js` as-is, without summarizing.
2. List all functions present in it by name only (e.g., `login`, `register`, `refreshToken`, `verify2FA`, etc. — based on what actually exists).
3. For each function, determine:
   - Does it return a JWT or deal with cookies/headers?
   - Does it deal with passwords (hashing/compare)?
   - Does it use Redis (blacklist/session)?
   - Does it use Prisma directly or call a service?
4. **Stop here and wait for confirmation** that the understanding is correct before proceeding to Step 2.

---

## Step 2 — Conversion (Conversion Only, zero behavior change)
The golden rule: **the result must be 100% behaviorally identical**. None of the following may change:
- The order of token extraction (if any): cookie before Bearer header, or whatever order actually exists — copied exactly as-is, with no "improvement."
- The full text of error messages, character for character.
- Status codes (401, 403, 409, etc.) exactly as they are.
- 2FA logic (if present), in its current sequence, with no modification.
- Any Redis call (e.g., blacklist check) with the same condition and same order.
- Any condition specific to SUPER_ADMIN or any existing bypass.

What is allowed only:
- Converting `require()`/`module.exports` to `import`/`export`.
- Adding explicit types (parameters, return types, request/response generics from Express).
- Adding a new interface or type if needed (e.g., `LoginRequestBody`).
- Using the extended `Request`/`Response` type (if there is `req.user` from a prior `auth.middleware.ts` augmentation — use that same existing module augmentation, do not create a second copy).

---

## Step 3 — If something unusual is found (very important)
If, while adding types, you notice any of the following:
- A comparison between two values of different types (e.g., `string === number`) — **possibly a bug like the one that occurred in notification.utils.js**.
- Fallback logic that returns broader permissions than expected — **possibly a bug like the one that occurred in scope.utils.js**.
- Any use of an environment variable (e.g., `process.env.JWT_SECRET`) without validating that it exists.

**Do not fix any of these automatically.** Stop immediately, and write the note in `Result.md` under a separate section titled "Potential Pre-Existing Issue — NOT FIXED", explaining the location and the reason, and wait for an explicit decision from the user (exactly as happened with `jwt.utils.ts` in the previous report: flag only, no automatic fix).

---

## Step 4 — Verification (Verification Loop, same loop as the rest of the project)
In order, each one must pass before moving to the next:
1. `npx tsc --noEmit` → must be zero errors.
2. `npm test` → must have the same number of passing tests as before the conversion (it should still match the reference count from the report — confirm the current count yourself first).
3. `npm run dev` → server runs, plus a real live test:
   - Try logging in with a valid test account → confirm the same response (status + body shape) before and after.
   - Try logging in with wrong credentials → confirm the same error message and same status code.
4. The original `auth.controller.js` is not deleted **until after** the three steps above pass successfully.

---

## Step 5 — Commit
- If the conversion is entirely without any behavior change: one commit with a clear title:
  `refactor(controllers): convert auth.controller.js to TypeScript (no behavior change)`
- If any "Potential Pre-Existing Issue" note was written in Result.md: **no final commit** until a decision arrives from the user. The file stays as a draft.

---

## What gets written in Result.md (required in this exact format)
```
## auth.controller.ts — Conversion Result

### Functions converted: [list of names]

### Behavior verification:
- tsc --noEmit: [PASS/FAIL]
- npm test: [X/X passing]
- Live login test (valid creds): [result]
- Live login test (invalid creds): [result]

### Potential Pre-Existing Issues (if any): [or "None found"]

### Ready for commit: [YES / NO — pending user decision]
```
