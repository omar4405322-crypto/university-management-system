# Attendance System — Full Audit Request (Read-Only, No Code Changes)

## Role & Goal

You are performing a **full technical audit** of the Attendance System inside the University Management System (UMS) monorepo (React 19 + TypeScript + Tailwind CSS v4 frontend, Node.js + Express + Prisma + PostgreSQL backend, deployed on Vercel/Railway).

Your job in this task is **analysis only**. Do **not** modify, refactor, or "fix" anything yet. Produce a single, extremely detailed markdown report. A second prompt will be sent later to actually implement fixes based on this report, so the value of this task depends entirely on how complete and precise the report is.

## System Context (what you're auditing)

The attendance system is a QR-code + geolocation based attendance flow, with RFID/ESP32 support in progress. Known components include (verify all of this against the actual code — do not assume it's correct or complete):

- Prisma models: `AttendanceSession`, `RfidDevice` (and their relations to Course/Section/Slot/Student/Doctor/TA models)
- Backend: `attendance-session.controller.ts` and related routes — session start/stop, `scan-qr` endpoint, `rfid` endpoint(s)
- Dynamic QR codes generated via server-side TOTP (speakeasy, 10-second step)
- Geolocation check implemented as a **soft check** (logged + flagged, with manual override by Doctor/TA) — not a hard block
- Duplicate-attendance prevention based on the combination of **IP address + Device ID**
- A cron job that auto-expires sessions (should only deactivate, never hard-delete)
- Ownership checks: only the Doctor/TA assigned to a given slot can start/manage its session
- RFID device assignment is admin-only; RFID/ESP32 devices are meant to use per-device/per-room credentials (not a shared static token) — this part is only partially implemented
- Frontend components: `ActiveSessionQR` (displays/rotates the QR) and `StudentAttendanceScanner` (scans QR, submits geolocation)
- Full Arabic/English localization via `ar.json` / `en.json`
- A previously known, still-unresolved issue: Prisma migration drift on Railway (schema pushed via `db:push` rather than proper migrations), which may affect `AttendanceSession`, `RfidDevice`, and also `CourseMaterial`
- A previously known, still-unresolved issue: mobile devices have had CORS/network access problems reaching the dev environment — check if this could also affect students scanning QR codes from their phones in production

## Step 0 — Build the Map First

Before writing any findings, do a full read-only pass and build a complete inventory:

1. Every backend file that touches attendance or RFID (controllers, services, routes, middleware, cron/jobs, Prisma schema + migrations folder).
2. Every frontend file that touches attendance (pages, components, hooks, API client calls).
3. The exact end-to-end flow: how a session is created → how the QR is generated/rotated → how a student scans it → how geolocation is captured and checked → how duplicate checks run → how the record is persisted → how/when the session auto-expires → how attendance is reported/viewed afterward.
4. The actual current Prisma schema vs. actual migration history (to check for the known drift issue).

List every file you inspected at the top of the report before the findings section.

## Required Audit Areas (go through each one explicitly)

1. **Data Model & Migration Integrity**
   - Are `AttendanceSession` and `RfidDevice` schemas correct and complete (fields, types, relations, indexes, unique constraints)?
   - Is there a unique constraint actually enforced at the DB level to prevent duplicate attendance rows (not just app-level logic)?
   - Confirm current migration state vs. `schema.prisma` — is there drift? Which models are affected?
   - Any missing `onDelete`/`onUpdate` cascade rules that could orphan records or break cron cleanup?

2. **QR / TOTP Generation & Verification**
   - Is the TOTP secret generated/stored securely per session (not reused, not exposed to the client)?
   - Is verification strictly server-side with correct time-step/window tolerance (replay window analysis)?
   - Is there any way a captured QR frame could be replayed after its 10-second step, e.g. clock drift, window tolerance too generous, or missing "already used" tracking?
   - Rate limiting / brute-force protection on the `scan-qr` endpoint?

3. **Geolocation Soft-Check Flow**
   - Confirm it truly never hard-blocks. Are flagged records clearly surfaced to Doctor/TA for override, with an audit trail of who overrode what and when?
   - What happens if the browser denies location permission, or location is spoofed (mock location on Android)? Is spoofing detection considered at all?

4. **Duplicate-Attendance Prevention (IP + Device ID)**
   - Edge case: many students on the same campus Wi-Fi/NAT will share the same public IP — could this cause false-positive duplicate blocks for legitimate different students?
   - How is "Device ID" generated/stored on the frontend — is it stable, and how easily can it be spoofed or cleared (incognito, browser reset, different browser)?
   - Is the duplicate check race-condition-safe if two requests hit at the same time (DB-level constraint vs. app-level check-then-insert)?

5. **RBAC / Ownership & Authorization**
   - Confirm ownership check (Doctor/TA must own the slot) is enforced on **every** relevant endpoint, not just session-start — check for IDOR on session-stop, session-status, attendance-list, and override endpoints.
   - Can a student hit any attendance endpoint for a session/course they're not enrolled in?
   - Is the RFID assignment endpoint actually restricted to admin roles at the middleware level, not just hidden in the UI?

6. **RFID / ESP32 Readiness**
   - Since this is only partially implemented: what currently exists vs. what's still a placeholder?
   - Are per-device/per-room credentials actually issued and validated, or is there still a shared/static token anywhere in the code?
   - Credential rotation/revocation story if a device is lost or compromised?

7. **Auto-Expiry Cron Job**
   - Confirm it only deactivates sessions and never hard-deletes.
   - What happens on server restart/redeploy mid-cycle — could sessions be left active indefinitely, or expired too early?
   - Timezone handling — is everything consistently UTC or is there a local/server timezone mismatch risk?

8. **Concurrency & Race Conditions**
   - Two students scanning within the same millisecond, double-submits from a slow network/double-tap, double-click on "Start Session" creating two active sessions for the same slot.

9. **Frontend Components**
   - `ActiveSessionQR`: does the displayed QR actually rotate in sync with the 10-second server TOTP step, or can there be a mismatch window where a stale QR is shown?
   - `StudentAttendanceScanner`: camera permission failure handling, poor/lost network handling, clear error messaging (in Arabic/English), behavior if the session expires mid-scan.

10. **Error Handling, Logging & Observability**
    - Are failures (geolocation flags, duplicate blocks, expired sessions, RFID errors) logged in a way that's actually usable for debugging/support, or silently swallowed?

11. **i18n Coverage**
    - Any attendance-related UI strings missing from `ar.json` and/or `en.json`? Any hardcoded strings that bypass the i18n system?

12. **Security Hardening**
    - Rate limiting across all attendance endpoints.
    - Any sensitive data (TOTP secrets, device identifiers, raw geolocation) leaking into API responses, logs, or frontend state that shouldn't have it.
    - Does the known mobile CORS/network access issue affect students scanning from their own phones in production, or is that isolated to the dev environment?

13. **Deployment State**
    - Concretely confirm whether `AttendanceSession`/`RfidDevice` (and `CourseMaterial`) are affected by the Railway migration drift, and what the actual risk is if a proper `prisma migrate deploy` were run today.

## Output Format (strict)

Produce a single markdown file named `ATTENDANCE-SYSTEM-AUDIT.md` at the repo root with this structure:

```
# Attendance System Audit

## 1. Files Inspected
(full list)

## 2. End-to-End Flow (as it actually works today)
(diagram-in-text or step list, based on real code, not assumptions)

## 3. Findings
For each finding:
### [SEVERITY: Critical | High | Medium | Low] Short title
- **Location:** file path + line number(s)
- **What's wrong:** clear technical description
- **Why it matters / impact:** what breaks, who's affected, worst case
- **How to reproduce:** concrete steps
- **Suggested direction:** one or two sentences on the general fix approach — NOT full implementation

## 4. Summary Table
| # | Severity | Area | Title |

## 5. Open Questions
(anything you couldn't verify from the code alone and need Omar to confirm)
```

## Hard Constraints

- **Do not edit any source file.** This task is read-only analysis.
- **Do not skip an area** listed above even if it looks fine — explicitly state "No issue found" with a one-line justification rather than omitting it.
- Every finding must cite an actual file path and line number — no vague or generic findings.
- Be exhaustive rather than brief. Missing a real bug is worse than a long report.
