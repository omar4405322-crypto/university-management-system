# Attendance System Implementation Plan — Revised

> Revision of `implementation_plan.md` after architecture review. Incorporates confirmed decisions on RFID auth, geolocation strictness, and duplicate-prevention logic, plus fixes for integration with the existing scheduling system, RBAC, and i18n conventions already used elsewhere in the codebase.

## Confirmed Decisions

| Question | Decision |
|---|---|
| RFID (ESP32) authentication | Per-device/per-room credentials, not a shared static token |
| Geolocation strictness | Soft check: always logged, flagged if outside radius, Doctor/TA can manually override. Not a hard block. |
| Duplicate prevention | Block only when **both** IP address AND Device ID match an existing record for the session (AND logic) |

**Note on duplicate logic:** requiring both to match avoids blocking legitimate students who share the same public IP behind the campus Wi-Fi NAT. In practice this behaves like a Device ID check with IP as a secondary corroborating signal, not as an independent trigger. Do not implement this as "block if IP OR Device ID matches" — that would reject most of the class on any shared network.

## Database Schema Updates (`schema.prisma`)

### `Student`
- `rfidTag String? @unique` — assigned by an Admin during onboarding/card issuance only. No self-service "register my card" flow, or a student could register a friend's card.

### `AttendanceMethod` (enum)
```prisma
enum AttendanceMethod {
  MANUAL
  QR
  RFID
}
```

### `Attendance` (add fields)
- `method AttendanceMethod @default(MANUAL)`
- `ipAddress String?`, `deviceId String?`, `locationData Json?` — stored for every submission, always, for audit
- `locationFlagged Boolean @default(false)` — set when geolocation falls outside the session radius
- `overriddenBy String?`, `overrideNote String?` — set when a Doctor/TA manually approves a flagged record

### `AttendanceSession` (new)
- `id`, `courseSectionId` (FK to `CourseSection` — **not** a bare `courseId`, so a session maps to the specific section/slot rather than the whole course; needed since a course can have multiple concurrent sections), `doctorId`, `isActive`, `secretKey`, `latitude`, `longitude`, `radius` (default suggestion: 100–120m to account for indoor GPS drift), `createdAt`, `expiresAt`

### `RfidDevice` (new)
- `id`, `roomId`, `secretHash` (hash the secret at rest, never store plaintext), `label`, `isActive`, `lastSeenAt`, `createdAt`
- Replaces the flat shared `ESP32_SECURE_TOKEN` — every physical reader gets its own row and its own secret

## Backend Implementation (`api-server`)

### Attendance Session Controllers
- `POST /api/attendance/session/start`
  - Verify the requesting Doctor/TA actually owns `courseSectionId` (same class of ownership check as the earlier college-scoping fixes — don't skip this)
  - Set `expiresAt` to the section's scheduled duration; a background job auto-closes sessions past `expiresAt` in case the Doctor forgets to stop it
- `POST /api/attendance/session/stop`

### QR Code Scan Endpoint
- `POST /api/attendance/scan-qr`
  - TOTP validation against `secretKey`
  - Compute distance from session lat/long; always log it; set `locationFlagged` if outside `radius` — do not reject the request outright
  - Duplicate check: reject only if both `ipAddress` and `deviceId` match an existing `Attendance` row for this `AttendanceSession`
  - Rate-limited per IP and per student account

### RFID ESP32 Endpoint
- `POST /api/attendance/rfid`
  - Authenticate against `RfidDevice.secretHash`, looked up by the device's own identifier — not a single global secret
  - Resolve `roomId` from the authenticated `RfidDevice` record server-side; never trust a `roomId` field in the request payload
  - Rate-limited

### Audit Reporting (new)
- Admin-facing report: `deviceId`s associated with attendance records for more than one distinct student across the term. Surface as a review list, not an automatic block — this catches "lending your phone" patterns that a single-session check would miss.

## Frontend Implementation (`university-app`)

### `AttendancePage.tsx` (Doctor/TA view)
- "Start Session" limited to sections the logged-in Doctor/TA actually teaches
- Dynamic QR code, refreshing every 10s
- A "Flagged" review list (records with `locationFlagged = true`) with one-tap approve/reject, so the geolocation soft-check has somewhere to land

### `StudentAttendanceScanner.tsx` (Student view)
- Camera scan + GPS read + submit
- Graceful fallback when camera or location permission is denied (e.g., a "request manual check-in" path that notifies the TA, rather than a dead end)

### i18n
- New strings for both components go into `ar.json`/`en.json` in the same commit that introduces them

## Verification Plan

### Automated Tests
- `scan-qr`: TOTP validity window, distance calculation and flagging (not rejection), duplicate logic requiring both IP and Device ID together
- `session/start`: rejects a Doctor/TA who doesn't own the `courseSectionId`
- `rfid`: rejects unregistered/inactive devices, ignores a client-supplied `roomId` in favor of the server-side mapping
- Auto-expiry job closes a session past `expiresAt`

### Manual Verification
- Start a session as a Doctor, confirm QR auto-refresh and that the session is scoped to the correct section
- Scan as a Student from within the radius (clean pass) and from outside it (flagged, appears in the review list, Doctor can approve)
- Attempt two scans from the same device for two different student accounts in the same session — confirm the second is blocked
- Simulate an ESP32 POST with a valid and an invalid device secret
