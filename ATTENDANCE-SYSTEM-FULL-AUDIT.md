# Attendance System — Full Audit Report

**Date:** 2026-08-10  
**Auditor:** Antigravity AI (static code analysis only)  
**Scope:** Backend (`api-server/`) + Frontend (`university-app/`) — all attendance-related code

---

## 1. Executive Summary

The attendance system is **architecturally sound and mostly functional**. The Driver pattern rewrite was properly integrated into the existing session-scoped routes (there is **no abandoned parallel route set** — the Drivers are consumed internally by the AttendanceEngine, which is called by the original controllers/services). The most critical issue found is a **`recordedById` persistence bug on RFID updates**: when an existing manual-override record is updated by an RFID tap, the old `recordedById` is retained instead of being cleared to `null`, potentially mis-attributing an automated scan to a human instructor.

**Single most important thing to fix:** The `recordedById` not being cleared to `null` on RFID update path in `attendance.engine.ts`.

---

## 2. Architecture As It Actually Exists Today

### Route Registration
- **Single route set is live:** `/api/attendance/*` registered at [app.ts:249](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/app.ts#L249).
- All routes defined in [attendance.routes.ts](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/attendance.routes.ts).
- **No abandoned parallel `/attendance/manual`, `/attendance/qr`, etc. top-level route files exist.** The Driver pattern (ManualDriver, QrDriver, RfidDriver, FaceDriver, GpsDriver) is used as an **internal strategy pattern** inside the engine, NOT as separate route sets.

### Request Flow Diagram (in-words)

**Manual Attendance (faculty marks student):**
```
POST /api/attendance/session/:sessionId/mark
  -> protect middleware -> adminOrTeacher auth
  -> attendance-session.controller.markStudentAttendance()
  -> AttendanceSessionService.markStudentAttendance() [ownership check]
  -> attendanceEngine.recordAttendance({ method: 'MANUAL', ... })
  -> ManualDriver.buildIntent() -> engine validates -> $transaction create/update
```

**QR Attendance (student scans):**
```
POST /api/attendance/qr  (or /api/attendance/scan-qr alias)
  -> protect middleware -> qrLimiter
  -> attendance.controller.recordAttendanceQr()
  -> AttendanceService.recordByMethod('QR', ...)
  -> attendanceEngine.recordAttendance({ method: 'QR', ... })
  -> QrDriver.buildIntent() -> TOTP verify -> geofence check -> $transaction
```

**RFID Attendance (device taps):**
```
POST /api/attendance/rfid
  -> rfidLimiter (NO protect -- machine-to-machine auth via device secret)
  -> attendance.controller.recordAttendanceRfid()
  -> AttendanceService.recordByMethod('RFID', ...)
  -> attendanceEngine.recordAttendance({ method: 'RFID', ... })
  -> RfidDriver.buildIntent() -> device lookup by roomId -> bcrypt secret verify -> $transaction
```

### Dead Code Assessment
- **FaceDriver** and **GpsDriver** are stub implementations returning 501 "not implemented" -- registered in the DriverRegistry but functionally inert. The frontend correctly disables Face and GPS tabs.
- **`ActiveSessionQR.tsx`** appears to be a **legacy/redundant component** -- all its functionality is replicated (and improved) in the `FacultyAttendanceDashboard.tsx` QR tab. It is still importable but may not be actively routed to. **Needs manual verification** of whether any route/page still renders it.
- The route file has **duplicate path aliases** for backward compatibility (e.g., `/sessions/start` and `/session/start`, `/sessions/:id/stop` and `/session/stop/:id`). These are intentional, not dead code.

---

## 3. Verified Working (with file/line evidence)

| Feature | Evidence |
|---------|----------|
| **Session-scoped attendance model** | `@@unique([studentId, sessionId])` at [schema.prisma:235](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L235). Old `@@unique([studentId, courseId, date])` constraint is **removed** -- confirmed by absence in schema. |
| **AttendanceMethod enum consistency** | Schema (schema.prisma:243-249): `MANUAL, QR, RFID, FACE, GPS`. Frontend type (attendance.service.ts:25): matches. Backend DriverRegistry (drivers/index.ts:13-17): registers all five. Consistent. |
| **Session creation in $transaction** | [attendance-session.service.ts:255-283](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/attendance-session.service.ts#L255-L283) -- `prisma.$transaction(...)` with `isolationLevel: 'Serializable'`. Deactivates prior active sessions, then creates new one atomically. |
| **Attendance recording in $transaction** | [attendance.engine.ts:93-238](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/attendance.engine.ts#L93-L238) -- `prisma.$transaction(...)` with `isolationLevel: 'Serializable'`. Duplicate-device check + upsert are atomic. |
| **TOTP window = 1 step** | [QrDriver.ts:53-59](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/drivers/QrDriver.ts#L53-L59) -- `window: 1` in `speakeasy.totp.verify()`. |
| **Redis-backed used-token tracking** | [QrDriver.ts:100-116](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/drivers/QrDriver.ts#L100-L116) -- checks Redis via `getCache(tokenKey)`, sets via `setCache(tokenKey, '1', TTL)`, plus in-memory `Set` as fallback. |
| **Timezone-aware expiresAt** | [attendance-session.service.ts:4,203-213](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/attendance-session.service.ts#L203-L213) -- `import { toZonedTime, fromZonedTime } from 'date-fns-tz'`, timezone hardcoded to `'Africa/Cairo'`. |
| **Cron auto-expiry** | [cron.ts:145-162](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/utils/cron.ts#L145-L162) -- runs every 5 min, closes sessions where `expiresAt <= now`. Started at [index.ts:42](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/index.ts#L42). |
| **RfidDevice.roomId as device identifier** | [RfidDriver.ts:46](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/drivers/RfidDriver.ts#L46) -- `prisma.rfidDevice.findUnique({ where: { roomId: deviceId } })`. Schema confirms `roomId String @unique` at [schema.prisma:808](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L808). |
| **Geolocation is soft-check** | [QrDriver.ts:152-171](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/drivers/QrDriver.ts#L152-L171) -- sets `locationFlagged = true` but does NOT throw/block. [attendance.engine.ts:251-254](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/attendance.engine.ts#L251-L254) -- adds warning message but allows attendance to proceed. |
| **Geo override UI exists** | [FacultyAttendanceDashboard.tsx:278-285](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/attendance/FacultyAttendanceDashboard.tsx#L278-L285) -- `approveFlagged()` calls `attendanceService.overrideFlaggedRecord()`. Flagged records panel at lines 996-1025, plus modal view at lines 526-561. |
| **Ownership checks on session endpoints** | `verifySessionOwnership()` at [attendance-session.service.ts:28-57](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/attendance-session.service.ts#L28-L57) -- used in `stopSession` (L310-337), `getCurrentCode` (L412), `getFlaggedRecords` (L438), `markStudentAttendance` (L471), `getSessionRoster` (L509), `updateSessionLocation` (L589). Checks Admin roles + Doctor via `doctorId` + TA via `teachingAssistantId`. |
| **Error middleware doesn't leak stack in production** | [error.middleware.ts:74-95](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/middleware/error.middleware.ts#L74-L95) -- `sendErrorProd` only sends `message` for operational errors, generic "Something went very wrong!" for unknown errors. No stack trace. |
| **Rate limiting on attendance endpoints** | `qrLimiter` (10/15min) on QR routes, `sessionLimiter` (100/15min) on session routes, `rfidLimiter` (100/min) on RFID, global `apiLimiter` (2000/15min) on `/api`. Defined at [attendance.routes.ts:10-27](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/attendance.routes.ts#L10-L27). |
| **Input validation on attendance routes** | `body('token').notEmpty()` on QR (L126), `body('deviceId/rfidTag/secret').notEmpty()` on RFID (L136-139), `body('studentId').optional().isInt()` + `body('records.*.status').isIn([...])` on manual (L102-116), `param('courseId').isInt()` on course endpoints (L60, L69). All pass through `validate` middleware. |

---

## 4. Issues Found

### CRITICAL

#### C1. `recordedById` NOT cleared to `null` on RFID update path

- **Files:** [attendance.engine.ts:176-179](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/attendance.engine.ts#L176-L179) and [RfidDriver.ts:131](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/drivers/RfidDriver.ts#L131)
- **Description:** `RfidDriver.buildIntent()` correctly sets `recordedById: null`. However, in `attendance.engine.ts` `updateData`, the spread condition is `intent.recordedById !== undefined && intent.recordedById !== null` -- meaning when `recordedById` IS `null`, it's excluded from `updateData`. If a prior MANUAL record exists for this student+session (set by a faculty member), an RFID tap will update the record's status but leave the old `recordedById` intact, falsely attributing the RFID scan to the instructor.
- **Impact:** Audit trail integrity -- automated scans can appear to be instructor-verified.
- **Suggested fix:** Change the `updateData` spread to: `...(intent.recordedById !== undefined && { recordedById: intent.recordedById })` (allow `null` through). Apply same logic to `createData` path.

---

### HIGH

#### H1. `/scan-qr` alias bypasses body validation

- **File:** [attendance.routes.ts:270-275](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/attendance.routes.ts#L270-L275)
- **Description:** The `/scan-qr` route (L270-275) applies `protect` and `qrLimiter` but does NOT apply the `body('token').notEmpty()` validator or `validate` middleware, unlike the primary `/qr` route (L121-130). A request with an empty token would reach the controller un-validated.
- **Impact:** Minor security gap -- the QrDriver's own validation would catch it, but inconsistent defense-in-depth.
- **Suggested fix:** Add the same `body('token').notEmpty(), validate` middleware chain to the `/scan-qr` alias.

#### H2. No ownership check on `getSlotSessions`

- **File:** [attendance-session.controller.ts:77-84](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/controllers/attendance-session.controller.ts#L77-L84)
- **Description:** `getSlotSessions` at [attendance-session.service.ts:488-497](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/attendance-session.service.ts#L488-L497) fetches all sessions for a slot without checking if the requesting user owns/is associated with that slot. Any authenticated Doctor/TA can query sessions for any slot.
- **Impact:** Information disclosure -- a TA can see attendance counts for slots they don't teach.
- **Suggested fix:** Add `verifySessionOwnership` or a slot-ownership check before returning data.

#### H3. In-memory `usedTokens` Set is not shared across server instances

- **File:** [QrDriver.ts:15](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/drivers/QrDriver.ts#L15)
- **Description:** `const usedTokens = new Set<string>()` is a process-local set. If the app runs behind multiple instances/replicas, the in-memory set won't prevent token replay across instances. The Redis check (`getCache(tokenKey)`) is the actual replay protection, but if `REDIS_URL` is not configured, Redis is `null` ([redis.utils.ts:6,39](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/utils/redis.utils.ts#L6)), both `getCache` and `setCache` become no-ops, and only the process-local Set protects against replay.
- **Impact:** If Redis is unavailable and the app runs multiple instances, TOTP replay is possible across instances.
- **Suggested fix:** Log a warning at startup if `REDIS_URL` is not set, since replay protection depends on it. Consider making Redis mandatory for production.

---

### MEDIUM

#### M1. `@ts-ignore` proliferation in backend `app.ts`

- **File:** [app.ts:3-75](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/app.ts#L3-L75) -- 20+ `// @ts-ignore` pragmas on import lines.
- **Impact:** Suppresses type errors that could catch real issues during compilation. Not a runtime bug but degrades type safety.
- **Suggested fix:** Install missing `@types/*` packages for `cors`, `helmet`, `rateLimit`, `cookieParser`, etc.

#### M2. Frontend `ActiveSessionQR.tsx` has empty i18n keys

- **File:** [ActiveSessionQR.tsx](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/components/attendance/ActiveSessionQR.tsx) -- lines 150, 160, 169, 180, 199, 209, 215, 230 all have `t('', '')`.
- **Impact:** All button labels and headings render as empty strings. If this component is actively used anywhere, the UI is broken.
- **Suggested fix:** Either remove this component (if replaced by FacultyAttendanceDashboard) or populate i18n keys.

#### M3. `FacultyAttendanceDashboard` has some empty i18n keys and duplicate filter buttons

- **File:** [FacultyAttendanceDashboard.tsx:58,232,1074](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/attendance/FacultyAttendanceDashboard.tsx#L58) -- `t('', '')` used in error state and start-session button.
- **File:** Lines 466-475 and 500-509 -- duplicate "Absent" filter buttons in the roster modal.
- **Impact:** Empty error messages shown to users; confusing double-absent filter button.

#### M4. `locationFlagged` not set on `createData` when value is `false`

- **File:** [attendance.engine.ts:215](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/attendance.engine.ts#L215)
- **Description:** The `createData` spread uses `...(intent.locationFlagged && {...})` -- JavaScript falsy check means `locationFlagged: false` is never explicitly set. The DB default is `@default(false)` so this is benign for new records, but the pattern is misleading and could mask bugs if the default changes.

#### M5. Duplicate-device check only fires for QR method

- **File:** [attendance.engine.ts:96-116](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/attendance.engine.ts#L96-L116)
- **Description:** The IP+deviceId duplicate check in `$transaction` only triggers when `intent.method === 'QR'` (L99). Manual attendance can technically bypass this. This may be intentional (faculty marking from their own device for multiple students), but it means there's no duplicate-device protection on the `/manual` endpoint.

---

### LOW

#### L1. Frontend roster poll has no error backoff

- **File:** [FacultyAttendanceDashboard.tsx:135](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/attendance/FacultyAttendanceDashboard.tsx#L135)
- **Description:** `pollingRef.current = setInterval(fetchSessionData, 3000)` -- if the server is down or network fails, this will log errors every 3 seconds indefinitely with no exponential backoff.
- **Impact:** Console noise; unnecessary network traffic during outages.
- **Note:** Intervals are properly cleared on unmount via the effect cleanup (L137-140).

#### L2. `FacultyAttendanceDashboard` start-session button text is empty

- **File:** [FacultyAttendanceDashboard.tsx:1074](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/attendance/FacultyAttendanceDashboard.tsx#L1074) -- `t('', '')` renders as empty string.
- **Impact:** Button has no visible label text (only the Play icon is shown).

---

## 5. Status of Previously Reported Issues

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 1 | Manual attendance tab roster not rendering | **Fixed** | Roster renders from `roster` state at [FacultyAttendanceDashboard.tsx:894](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/attendance/FacultyAttendanceDashboard.tsx#L894). Data fetched via `getSessionRoster()` (L167-169). Buttons use `s.id`. Needs manual testing to confirm with real data. |
| 2 | QR code auto-refresh at timer=0 | **Fixed** | Timer uses absolute-time math at [FacultyAttendanceDashboard.tsx:120-129](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/attendance/FacultyAttendanceDashboard.tsx#L120-L129). When `remaining <= 0`, resets target and calls `updateToken()`. |
| 3 | Manual attendance ID bug (studentId vs id) | **Fixed** | [FacultyAttendanceDashboard.tsx:924](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/attendance/FacultyAttendanceDashboard.tsx#L924): `handleManualToggle(s.id, 'PRESENT')` sends internal PK. Only one route set exists. |
| 4 | IDOR on faculty endpoints | **Fixed** | `verifySessionOwnership()` on all session-mutating endpoints. **Exception:** `getSlotSessions` has NO ownership check (see H2). |
| 5 | TOTP replay window | **Fixed** | `window: 1` at [QrDriver.ts:58](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/drivers/QrDriver.ts#L58). Redis+in-memory dual tracking at [QrDriver.ts:100-116](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/drivers/QrDriver.ts#L100-L116). |
| 6 | Session expiry timezone | **Fixed** | `date-fns-tz` with `'Africa/Cairo'` at [attendance-session.service.ts:4,203-213](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/attendance-session.service.ts#L203-L213). |
| 7 | Race conditions ($transaction) | **Fixed** | Session creation: Serializable tx at [attendance-session.service.ts:255-283](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/attendance-session.service.ts#L255-L283). Attendance recording: Serializable tx at [attendance.engine.ts:93-238](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/attendance.engine.ts#L93-L238). |
| 8 | Duplicate-attendance prevention | **Fixed** | `@@unique([studentId, sessionId])` at [schema.prisma:235](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L235). Old constraint removed. Migration confirms. Needs manual multi-session test. |
| 9 | RfidDevice roomId as deviceId | **Fixed** | [RfidDriver.ts:46](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/drivers/RfidDriver.ts#L46): `findUnique({ where: { roomId: deviceId } })`. |
| 10 | Browser fingerprinting | **Confirmed: load-bearing** | [StudentAttendanceScanner.tsx:112-129](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/components/attendance/StudentAttendanceScanner.tsx#L112-L129): generates `visitorId`, sent as `deviceId`, used in engine duplicate-device check. |
| 11 | Migration baseline | **Cannot Verify Statically** | Baseline migration exists. CourseMaterial is in schema. Requires `prisma migrate diff` against live DB. |
| 12 | Geolocation soft-check | **Fixed (still soft)** | QrDriver flags but doesn't block. Override UI exists in dashboard + backend auth check. |
| 13 | `recordedById` on RFID scans | **Still Broken** | RfidDriver sets null, but engine updateData excludes null values. See C1 above. |
| 14 | `@ts-nocheck` | **No attendance files affected** | Found in 50+ non-attendance files. Zero attendance controllers/services/drivers/components have it. |

---

## 6. Needs Manual Testing

| Item | What to test | Why static analysis can't confirm |
|------|-------------|-----------------------------------|
| **Manual tab roster rendering** | Log in as Doctor/TA, start session, switch to Manual tab, verify student list appears with toggle buttons | Rendering depends on roster API returning data for the specific course/enrollment configuration |
| **QR auto-refresh visual** | Start a session, watch the QR code on the faculty dashboard, wait for timer to reach 0, confirm the QR image + manual code visibly change | Timer logic looks correct in code but browser throttling in background tabs could still cause issues |
| **Multi-session same-day** | Start session for Course A slot 1, record attendance, stop, start session for same course slot 2, record attendance for same student, verify no DB crash | The `@@unique([studentId, sessionId])` constraint should allow it, but need to confirm no application-level block |
| **ActiveSessionQR.tsx is dead code** | Search all route/page components for imports of `ActiveSessionQR` | Could be imported by a non-attendance page |
| **CourseMaterial migration baseline** | Run `npx prisma migrate diff --from-schema-datamodel --to-schema-datasource` to check schema-DB drift | Requires live DB connection |
| **RFID recordedById on update** | Have a Doctor manually mark student PRESENT, then have student tap RFID for same session, check if `recordedById` is cleared to null | Confirms the C1 bug in production |
| **Mobile rendering of tabbed layout** | Open FacultyAttendanceDashboard on a mobile viewport (under 640px), check if QR/Manual/RFID/Face/GPS tabs wrap gracefully | CSS uses `flex-wrap` but needs visual confirmation |
| **Redis availability in production** | Verify `REDIS_URL` env var is set in production deployment | If missing, TOTP replay protection degrades to process-local only |

---

## 7. Open Questions

| # | Question | Context |
|---|----------|---------|
| 1 | **Is `ActiveSessionQR.tsx` still used anywhere?** | It has 17 empty i18n keys (`t('', '')`), suggesting it may have been abandoned during the dashboard rewrite. If it's dead code, it should be removed to avoid confusion. |
| 2 | **Should duplicate-device checks apply to MANUAL method?** | Currently only QR scans are checked ([attendance.engine.ts:99](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/attendance.engine.ts#L99)). Faculty manually marking from the same device for multiple students is expected behavior, so this may be intentional. |
| 3 | **Auto-creation of ScheduleSlot in startSession -- is this intended?** | [attendance-session.service.ts:108-168](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/attendance-session.service.ts#L108-L168) -- if no matching slot exists, the code auto-creates one with `startTime: '08:00'`, `endTime: '22:00'`. Very permissive and could create garbage ScheduleSlot records. |
| 4 | **What happens when Redis is unavailable?** | `getCache`/`setCache` silently return null/void. The in-memory `usedTokens` Set provides process-local replay protection only. Should the system refuse to start QR sessions without Redis? |
| 5 | **RFID endpoint has no `protect` middleware -- is this intentional?** | [attendance.routes.ts:132-142](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/attendance.routes.ts#L132-L142) -- authentication is via bcrypt device secret. Makes sense for embedded devices, but the endpoint is publicly accessible. Rate limiting (100/min) is the only brute-force defense. |
| 6 | **The cron auto-expiry job and timezone coupling** | `expiresAt` is stored as UTC (correctly computed via `fromZonedTime`). The cron compares against UTC `new Date()`. This is correct today, but the coupling is implicit. Consider adding a comment documenting this UTC assumption to prevent future regressions. |
