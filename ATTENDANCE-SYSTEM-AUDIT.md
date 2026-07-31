# Attendance System Audit

## 1. Files Inspected
- **Database Schema**: `artifacts/api-server/prisma/schema.prisma`
- **Controllers**: 
  - `artifacts/api-server/src/controllers/attendance-session.controller.ts`
  - `artifacts/api-server/src/controllers/attendance.controller.ts`
- **Routes**: `artifacts/api-server/src/routes/attendance.routes.ts`
- **Background Jobs**: `artifacts/api-server/src/utils/cron.ts`
- **App Entry Points**: `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/server.ts`, `artifacts/api-server/src/index.ts`
- **Frontend Pages**: 
  - `artifacts/university-app/src/pages/attendance/FacultyAttendanceDashboard.tsx`
  - `artifacts/university-app/src/pages/attendance/StudentAttendanceDashboard.tsx`
- **Frontend Components**:
  - `artifacts/university-app/src/components/attendance/ActiveSessionQR.tsx`
  - `artifacts/university-app/src/components/attendance/StudentAttendanceScanner.tsx`

## 2. End-to-End Flow (as it actually works today)

1. **Session Creation**: A Doctor or TA initiates a session from `FacultyAttendanceDashboard`. The client attempts to capture their GPS coordinates. 
2. **Backend Setup**: The `/api/attendance/session/start` endpoint automatically deactivates any existing sessions for the slot. It generates a 20-byte TOTP secret using `speakeasy`, calculates an `expiresAt` timestamp based on the slot's end time, and creates the `AttendanceSession` in the database.
3. **QR Generation**: The faculty frontend continuously polls `/api/attendance/session/code` (via local `setInterval`) to fetch the current TOTP token and displays it as a QR code or manual 6-digit code.
4. **Student Scan**: The student uses `StudentAttendanceScanner.tsx` to scan the QR. The app captures their GPS location (if granted) and a persistent browser `deviceId` (UUID stored in `localStorage`).
5. **Backend Verification**: 
   - The token is verified against the session's secret using a 20-second step and a massive 2-window tolerance.
   - The system checks for duplicate attendance using an `ipAddress` + `deviceId` constraint (to prevent multiple students scanning from the same device on the same network).
   - Distance is calculated using the Haversine formula against the room's or professor's coordinates. If the student is outside the `radius`, they are flagged but *not blocked*.
   - Status (PRESENT vs LATE) is determined based on the session's `gracePeriodMins`.
6. **Reporting**: The faculty dashboard polls session data. The professor can manually review and approve flagged records (e.g., if geolocation failed).
7. **Cleanup**: A cron job (`startSessionAutoExpiryJob`) runs every 5 minutes, deactivating sessions where `expiresAt` has passed.

## 3. Findings

### [CRITICAL] IDOR (Insecure Direct Object Reference) on Faculty Endpoints
- **Location:** `artifacts/api-server/src/controllers/attendance-session.controller.ts` (Lines 271, 513, 528, 548, 618)
- **What's wrong:** Multiple endpoints (`getCurrentCode`, `updateSessionLocation`, `getFlaggedRecords`, `overrideFlaggedRecord`, `getSessionRoster`) check if the `req.user.role` is a DOCTOR or TEACHING_ASSISTANT, but **never verify if the user actually owns the session**.
- **Why it matters / impact:** Any logged-in professor or TA can view the roster, modify the geographic location, approve flagged students, and extract the live TOTP token for *any other professor's* active class. 
- **How to reproduce:** As Doctor A, send an API request to `/api/attendance/session/<Doctor_B_Session_ID>/roster`. The server will return the data.
- **Suggested direction:** Add an ownership authorization check verifying that `session.scheduleSlot.doctorId === req.user.id` (or the TA equivalent) before returning data or allowing modifications.

### [HIGH] Incorrect Timezone Handling for Session Expiry
- **Location:** `artifacts/api-server/src/controllers/attendance-session.controller.ts` (Lines 110-112)
- **What's wrong:** `expiresAt` is calculated using `new Date().setHours(hours, minutes, 0, 0)`. The `Date` object evaluates this in the **server's local timezone**, not the university's timezone.
- **Why it matters / impact:** If the production server is in UTC (common on platforms like Railway) and the university is in UTC+3, a class ending at 14:00 local time will be set to expire at 14:00 UTC (17:00 local time). Sessions will remain active for hours after the class ends, breaking the auto-expiry cron job.
- **How to reproduce:** Deploy to a UTC server. Start a session for a slot ending at 10:00 AM local time. Check the database `expiresAt` timestamp.
- **Suggested direction:** Parse the slot times using a library like `date-fns-tz` to explicitly set the timezone, or normalize all times to UTC.

### [HIGH] Massive TOTP Replay Window
- **Location:** `artifacts/api-server/src/controllers/attendance-session.controller.ts` (Lines 319-325)
- **What's wrong:** The TOTP verification step uses `window: 2` with a `step` of 20 seconds. This allows 2 steps before and 2 steps after the current time, resulting in a 100-second valid window for a single token.
- **Why it matters / impact:** A student can snap a photo of the QR code and send it to a chat group. Students have nearly 2 minutes to scan that exact same code from anywhere (they will be flagged for location, but the scan will succeed).
- **How to reproduce:** Wait for a QR code to generate. Wait 40 seconds. Manually enter the code on a student device. It will be accepted.
- **Suggested direction:** Reduce `window` to `1` (or `0` with slight drift tolerance) and implement a simple token caching mechanism to mark successful tokens as "used" so they can't be replayed.

### [MEDIUM] Unenrolled Students Can Record Attendance
- **Location:** `artifacts/api-server/src/controllers/attendance-session.controller.ts` (Line 291 - `scanQr`)
- **What's wrong:** The endpoint verifies the token and student identity, but **lacks a check to confirm the student is enrolled in the course** associated with the session.
- **Why it matters / impact:** A student can mistakenly (or intentionally) scan a QR code for a class they are not registered in, polluting attendance records and reports.
- **How to reproduce:** Log in as Student A (enrolled in CS101, not CS102). Scan the QR code for a CS102 session. The system will accept it.
- **Suggested direction:** Add an enrollment validation query (`prisma.studentCourse` or `enrollment`) before proceeding with the attendance `upsert`.

### [MEDIUM] Frontend QR Code Desync due to `setInterval` Throttle
- **Location:** `artifacts/university-app/src/pages/attendance/FacultyAttendanceDashboard.tsx` (Line 113)
- **What's wrong:** The UI timer counts down using a browser `setInterval` of 1 second. If the professor minimizes the tab or switches windows, modern browsers heavily throttle `setInterval` (e.g., to 1 execution per minute).
- **Why it matters / impact:** The frontend timer will fall behind the server's time. When the professor returns to the tab, the displayed QR code will be stale and invalid, causing mass "Invalid Code" errors for students.
- **How to reproduce:** Start a session. Open a new browser tab for 3 minutes. Return to the faculty tab and scan the QR code currently shown. It will fail.
- **Suggested direction:** Do not mutate a local counter. Calculate `timeLeft` dynamically based on absolute system time (`Date.now() % (step * 1000)`).

### [MEDIUM] Race Condition in Duplicate Device Check
- **Location:** `artifacts/api-server/src/controllers/attendance-session.controller.ts` (Lines 376-386)
- **What's wrong:** The duplicate device/IP check relies on a `findFirst` query followed later by an `upsert`. This is not atomic.
- **Why it matters / impact:** If two students share a device and rapidly fire concurrent requests to `/api/attendance/scan-qr`, both requests might pass the `findFirst` check before either is inserted, bypassing the restriction.
- **How to reproduce:** Send two concurrent API POST requests with the same `deviceId` and `ipAddress` but different `studentId`s.
- **Suggested direction:** Enforce duplicate IP+Device checks via a Redis lock or at the database transaction level.

### [MEDIUM] Race Condition on Session Creation (Double-Submit)
- **Location:** `artifacts/api-server/src/controllers/attendance-session.controller.ts` (Lines 120-153)
- **What's wrong:** Deactivating old sessions and creating a new one happens sequentially without a transaction lock.
- **Why it matters / impact:** If a professor double-clicks "Start Session" quickly, it can spawn two simultaneous active sessions for the same schedule slot.
- **How to reproduce:** Double-click the "Start Session" button or fire concurrent POST requests to the start endpoint.
- **Suggested direction:** Wrap the deactivation and creation logic in a Prisma `$transaction`.

### [LOW] Missing Database Relation for RfidDevice
- **Location:** `artifacts/api-server/prisma/schema.prisma` (Line 798)
- **What's wrong:** `roomId` in `RfidDevice` is a `String`, while the actual `Room` model's primary key `id` is an `Int`. No foreign key relation exists.
- **Why it matters / impact:** If a `Room` is deleted, the RFID device record is orphaned without cascading deletion or validation.
- **How to reproduce:** Review the schema fields.
- **Suggested direction:** Change `roomId` to `Int` and add a formal `@relation(fields: [roomId], references: [id])`.

### [LOW] Device ID Spoofing
- **Location:** `artifacts/university-app/src/components/attendance/StudentAttendanceScanner.tsx` (Line 86)
- **What's wrong:** `deviceId` is generated as a standard UUID and stored in `localStorage`. 
- **Why it matters / impact:** Students can easily bypass the "one scan per device" rule by opening an Incognito window or clearing their site data.
- **How to reproduce:** Scan attendance. Clear browser local storage. Scan attendance for a different student. It succeeds.
- **Suggested direction:** Combine the UUID with a lightweight browser fingerprint, though the existing IP check already provides a secondary layer of defense.

### [LOW] Hardcoded Arabic Strings Bypassing i18n
- **Location:** `artifacts/university-app/src/pages/attendance/FacultyAttendanceDashboard.tsx`
- **What's wrong:** Several strings are hardcoded in Arabic without translation keys (e.g., `alert('تم حفظ الموقع الجغرافي للقاعة بنجاح');`, `الكل`, `مدة التحديث:`).
- **Why it matters / impact:** Breaks localization for English-speaking faculty members.
- **How to reproduce:** Switch the app language to English. Interact with the faculty dashboard. Arabic alerts and labels will persist.
- **Suggested direction:** Wrap all hardcoded strings in the `t('key', 'fallback')` translation function.

## 4. Summary Table

| # | Severity | Area | Title |
|---|---|---|---|
| 1 | CRITICAL | Security (API) | IDOR on Faculty Endpoints |
| 2 | HIGH | Core Logic | Incorrect Timezone Handling for Session Expiry |
| 3 | HIGH | Security (Logic) | Massive TOTP Replay Window |
| 4 | MEDIUM | Core Logic | Unenrolled Students Can Record Attendance |
| 5 | MEDIUM | Frontend | QR Code Desync due to `setInterval` Throttle |
| 6 | MEDIUM | Concurrency | Race Condition in Duplicate Device Check |
| 7 | MEDIUM | Concurrency | Race Condition on Session Creation |
| 8 | LOW | Database | Missing Database Relation for RfidDevice |
| 9 | LOW | Security (Logic) | Device ID Spoofing via LocalStorage |
| 10| LOW | Frontend | Hardcoded Arabic Strings Bypassing i18n |

## 5. Open Questions
- **Production Timezones:** Is the production PostgreSQL database set to UTC? We need to align the `expiresAt` logic with the server/DB timezone configuration.
- **Mobile CORS:** You mentioned potential CORS/network access problems for mobile devices. How are mobile devices accessing the production environment? Is the frontend URL in the `allowedOrigins` array in `app.ts`? (Note: `scanQr` does not rely on local network checks in production, so as long as the origin is correct, it should work).
- **Migration Drift:** The schema contains `model RfidDevice`, but because of past `db:push` commands, Prisma migrations might be out of sync on Railway. Have you attempted a recent `prisma migrate deploy` in production, or are we strictly using `db:push` moving forward?
- **RFID Implementation:** The API contains an endpoint for the ESP32 to ping (`rfidScan`), but there are no backend controllers or frontend UI to *assign* or *manage* RFID tags for students or rooms. Is this feature parked for a future phase?
