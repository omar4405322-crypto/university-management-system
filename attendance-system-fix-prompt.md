# Attendance System — Staged Fix Implementation

You previously produced `ATTENDANCE-SYSTEM-AUDIT.md` with 10 findings. This prompt implements fixes for all of them, in a specific order, with verification gates between stages. **Do not skip ahead to a later stage before the current stage is verified.**

## Ground Rules

- Follow this project's existing verification loop after every change: `tsc --noEmit`, run the existing test suite if present, confirm the server boots cleanly.
- Do **not** run `prisma db push` for any schema change in this task. Use `prisma migrate dev` locally, review the generated SQL, and only then consider deploy — this project has known migration drift on Railway and we don't want to add to it.
- For every fix, re-run the exact "How to reproduce" steps from the audit and confirm they no longer reproduce before marking it done.
- After Stage 1, stop and summarize your findings before touching any code.

---

## Stage 1 — Investigate & Report Only (no code changes yet)

1. **Migration drift check:** Run `npx prisma migrate status`. List the contents of `prisma/migrations/`. Compare against current `schema.prisma` for `AttendanceSession`, `RfidDevice`, and `CourseMaterial`. State clearly whether each is in sync or drifted, and what the actual difference is.
2. **RFID assignment check:** Search the *entire* backend (not just the files already inspected) for any controller/route that assigns or manages RFID tags/devices for students or rooms. Confirm concretely whether admin-only RFID assignment exists anywhere in the codebase, or whether it genuinely does not exist yet.
3. **Rate limiting check:** Confirm whether rate-limiting middleware currently applies to `/api/attendance/scan-qr`, `/api/attendance/session/code`, and `/api/attendance/session/start`. Identify which rate-limiting pattern/library is already used elsewhere in this project (e.g. on auth endpoints), so we reuse the same one — this project has previously had a rate-limiter deduplication bug, so do not introduce a second, conflicting limiter.
4. **TOTP config consistency check:** Search the codebase for every place `step`/`window` are configured for attendance TOTP (both generation and verification paths). Confirm whether they're consistent between `getCurrentCode` and `scanQr`, or whether they diverge.
5. **Timezone check:** Confirm the actual production timezone configuration (Railway environment variables, Postgres timezone setting) so Stage 2's fix uses the real value instead of an assumption.

Report a short summary of all five points. Wait for confirmation before proceeding to Stage 2.

---

## Stage 2 — Critical & High Severity (code-level only, no schema changes)

1. **IDOR fix** — In `attendance-session.controller.ts`, add ownership verification to `getCurrentCode`, `updateSessionLocation`, `getFlaggedRecords`, `overrideFlaggedRecord`, and `getSessionRoster`: the requesting Doctor/TA must own `session.scheduleSlot` (matching however ownership is already checked in `session/start`). Return 403 with a proper i18n'd error message if not. Add a test/manual check: Doctor A must not be able to hit any of these five endpoints for Doctor B's session.

2. **TOTP replay window fix** — Reduce `window` to `1` (verify this still tolerates reasonable clock drift; if not, `0` with a small custom grace) and align `step` across every place found in Stage 1. Additionally, track which token has already been redeemed per session so the same valid token cannot be used twice by different students within the tolerance window, even if it's technically still time-valid.

3. **Timezone fix** — Replace `new Date().setHours(...)` in the `expiresAt` calculation with an explicit timezone-aware calculation (e.g. via `date-fns-tz`), using the real timezone confirmed in Stage 1. Add a check that creates a session for a slot ending at a known local time and asserts the stored `expiresAt` (UTC) is correct.

4. **Rate limiting** — Apply the project's existing rate-limiting pattern (identified in Stage 1) to `scan-qr`, `session/code`, and `session/start`.

Verify (tsc, tests, server boot, re-run audit repro steps for items 1–3 of the audit) before moving on.

---

## Stage 3 — Medium Severity

1. **Enrollment check** — In `scanQr`, verify the student is actually enrolled in the session's course before accepting the scan. Reject with a clear i18n'd message if not.
2. **Frontend timer desync fix** — In both `FacultyAttendanceDashboard.tsx` and `ActiveSessionQR.tsx`, compute remaining time from absolute `Date.now()` math against the known step boundary, instead of a mutated `setInterval` counter, so a throttled/backgrounded tab doesn't desync from the server.
3. **Duplicate-check race condition** — Make the IP+deviceId duplicate check atomic: either wrap the check-then-upsert in a single Prisma transaction, or add a DB-level unique constraint covering (session, ipAddress, deviceId) so the database itself rejects the race rather than relying on app-level sequencing.
4. **Session-creation race condition** — Wrap the "deactivate old sessions + create new session" logic in `session/start` in a single Prisma `$transaction`.

Verify before moving on.

---

## Stage 4 — Low Severity (schema change — do last, and only if Stage 1 gives the go-ahead)

1. **RfidDevice relation fix** — Only proceed if Stage 1 confirmed this won't collide with existing drift. Change `RfidDevice.roomId` to `Int` with a proper `@relation(fields: [roomId], references: [id])` to `Room`. Use `prisma migrate dev`, review the generated SQL migration file before applying it, and confirm it doesn't silently drop or truncate existing data.
2. **i18n cleanup** — Replace hardcoded Arabic strings in `FacultyAttendanceDashboard.tsx` (e.g. the `alert(...)` calls, `الكل`, `مدة التحديث:`) with proper `t('key', 'fallback')` calls in `ar.json`/`en.json`.
3. **Device ID hardening** — Optional, lowest priority. The IP check already provides a secondary layer of defense against localStorage-clearing, so this can stay deferred unless explicitly requested.

---

## Final Step

Once all four stages are verified, produce a short `ATTENDANCE-SYSTEM-FIXES-SUMMARY.md` listing each of the 10 original findings and its resolution status (Fixed / Deferred with reason), plus the answers gathered in Stage 1.
