> [!WARNING]
> **STATUS: SUPERSEDED**  
> This document is an archived historical point-in-time report. Its contents have been superseded by:  
> - Authoritative System Baseline Audit: [FULL-SYSTEM-PROFESSIONAL-AUDIT.md](../../FULL-SYSTEM-PROFESSIONAL-AUDIT.md)  
> - Current Active Remediation Tracker: [REMEDIATION-MASTER-PLAN.md](../../REMEDIATION-MASTER-PLAN.md)

# Comprehensive Security Audit Report
**Target Platform:** University Management System (Full-Stack: React 19 + TypeScript + Node.js Express + Prisma + PostgreSQL + Redis)  
**Audit Date:** September 8, 2026  
**Assessment Type:** Ground-Up, Read-Only Source Code Security Audit (Frontend & Backend)  
**Classification:** Confidential — Security Telemetry & Remediation Specification  

---

## Executive Summary

A comprehensive, static security review of the pre-launch university management system was conducted across all backend services (`artifacts/api-server`), frontend applications (`artifacts/university-app`), shared libraries (`lib/`), database models, and runtime dependency trees.

The platform implements numerous modern defenses, including AES-256-GCM authenticated encryption for TOTP secrets and RFID keys, centralized role/scope utils, timing-safe equality checks on select HMAC routines, and fail-closed storage policies. However, the audit identified **15 distinct security findings**, including **3 Critical**, **6 High**, **5 Medium**, and **1 Low** severity vulnerabilities.

### Key Risk Areas:
1. **Public File Disclosure (Critical):** The entire `/uploads` root directory is served statically without authentication (`app.use('/uploads', express.static(...))`), allowing unauthenticated external actors to access and download private course materials, homework submissions, and student profile photos.
2. **Broken Object-Level Authorization / PII Exposure (Critical):** `GET /api/departments/:id` lacks role-based access control and fails to restrict student/faculty roles, permitting any authenticated student to query any department across the university and retrieve the complete student and faculty roster (including names, student IDs, and academic levels).
3. **Pre-Exam / Quiz Question Leakage (Critical):** `GET /api/quizzes/:id` omits quiz start-window verification, allowing enrolled students to retrieve all questions and multiple-choice options days or weeks prior to the scheduled examination.
4. **Account Lockout Denial of Service (High):** The login rate limiter strictly keys on `email:${email}` with a 5-request threshold over 15 minutes without incorporating the client IP, allowing unauthenticated attackers to trivially lock out administrators and faculty members.
5. **Attendance Bypass & Evasion Vectors (High):** Duplicate device detection in self-service check-in can be completely bypassed by omitting the optional `deviceId` property. Furthermore, QR code resolution scans all university-wide active sessions when `sessionId` is omitted, causing potential cross-session collisions and attendance spoofing.
6. **Severe Dependency CVEs (High):** Package manifests contain 50 vulnerabilities (11 Critical, 24 High), including Critical Remote Code Execution in `orval` (CVE-2026-62681) and High-severity host confusion in `fast-uri` (CVE-2026-13676).

---

## Audit Findings Matrix

| Finding ID | Title | Severity | Impact Area | Primary File Reference |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Unauthenticated Public Access to Full Uploads Directory | **Critical** | Confidentiality / PII | `artifacts/api-server/src/app.ts:188` |
| **SEC-02** | BOLA / IDOR in Department Details Exposes University Rosters | **Critical** | Authorization / PII | `artifacts/api-server/src/routes/department.routes.ts:19` |
| **SEC-03** | Premature Quiz Question & Option Disclosure Prior to Start Window | **Critical** | Academic Integrity | `artifacts/api-server/src/controllers/quiz.controller.ts:205-244` |
| **SEC-04** | Distributed Account Lockout DoS via IP-Agnostic Login Rate Limiter | **High** | Availability / Auth | `artifacts/api-server/src/middleware/rateLimiter.middleware.ts:117-125` |
| **SEC-05** | Attendance Duplicate-Device Enforcement Bypass via Omitted `deviceId` | **High** | Attendance Integrity | `artifacts/api-server/src/attendance/attendance.engine.ts:251-272` |
| **SEC-06** | Cross-Session QR Attendance Collision via Unscoped Global Scan | **High** | Attendance Integrity | `artifacts/api-server/src/attendance/drivers/QrDriver.ts:122-135` |
| **SEC-07** | Unbounded Loop DoS in Student Group Auto-Division & Splitting | **High** | Availability / Resource Exhaustion | `artifacts/api-server/src/controllers/studentGroups.controller.ts:22-99` |
| **SEC-08** | Timing Side-Channel in RFID Base64 Signature Verification | **High** | Cryptographic Verification | `artifacts/api-server/src/attendance/drivers/RfidDriver.ts:203` |
| **SEC-09** | Critical & High Supply-Chain CVEs (Orval RCE & fast-uri Desync) | **High** | Dependency Security | `package.json` / `pnpm-lock.yaml` |
| **SEC-10** | Missing Algorithm Restriction in JWT Access Token Verification | **Medium** | Authentication | `artifacts/api-server/src/utils/jwt.utils.ts:140-152` |
| **SEC-11** | Arbitrary External Redirection via Unvalidated Task Submission URL | **Medium** | Frontend / Phishing | `artifacts/api-server/src/services/task.service.ts:425-437` |
| **SEC-12** | MemoryStore Fallback for Rate Limiters and 2FA Anti-Replay | **Medium** | Distributed Security | `artifacts/api-server/src/routes/attendance.routes.ts:14-31` |
| **SEC-13** | Missing Boot-Time Verification of Mandatory `ENCRYPTION_KEY` | **Medium** | Runtime Stability / Secrets | `artifacts/api-server/src/server.ts:22` |
| **SEC-14** | Missing Route-Level Input Validation on Critical Financial & Academic Endpoints | **Medium** | Input Validation | `artifacts/api-server/src/routes/enrollment.routes.ts:22-38` |
| **SEC-15** | Dead Code & Unregistered Handlers (`resetDoctorPassword` / SQL Helper) | **Low** | Code Hygiene / Maintainability | `artifacts/api-server/src/routes/doctors.routes.ts:5` |

---

## Detailed Findings

### SEC-01: Unauthenticated Public Access to Full Uploads Directory
- **Severity:** Critical
- **CWE:** CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor), CWE-306 (Missing Authentication for Critical Function)
- **File Location:** [`artifacts/api-server/src/app.ts:181-188`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/app.ts#L181-L188)

#### Vulnerable Code Excerpt
```typescript
// artifacts/api-server/src/app.ts
// 6. STATIC FILES
app.use(
  '/uploads/materials',
  express.static(path.join(process.cwd(), 'uploads/materials'), {
    setHeaders: setMaterialDownloadHeaders,
  })
);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
```

#### Exploit Scenario
The server mounts `/uploads` directly as an unauthenticated static directory. All files placed on the local disk (including lecture notes, exam problem sets, assignment submissions, and student profile photos in `/uploads/profiles`) can be accessed by any unauthenticated external client without passing through `protect` middleware or permission checks. An external adversary or unauthorized student can enumerate or guess filenames (e.g. using timestamps generated during upload) and download confidential university files, assignments, and personal student photos directly over HTTP.

#### Recommended Fix
1. Remove `app.use('/uploads', express.static(...))` from `app.ts`.
2. Implement an authenticated, authorization-scoped route for downloading files (e.g. `GET /api/materials/:id/download` and `GET /api/users/:id/avatar`).
3. For production deployments, stream files through authorized controllers or redirect to short-lived, presigned private cloud storage URLs (e.g., AWS S3 / Cloudinary authenticated delivery).

---

### SEC-02: BOLA / IDOR in Department Details Exposes University Rosters
- **Severity:** Critical
- **CWE:** CWE-285 (Improper Authorization), CWE-639 (Authorization Bypass Through User-Controlled Key)
- **File Location:** [`artifacts/api-server/src/routes/department.routes.ts:18-19`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/department.routes.ts#L18-L19), [`artifacts/api-server/src/controllers/department.controller.ts:67-123`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/controllers/department.controller.ts#L67-L123)

#### Vulnerable Code Excerpt
```typescript
// artifacts/api-server/src/routes/department.routes.ts
router.get('/', protect, getAllDepartments);
router.get('/:id', protect, adminIdValidation, validate, getDepartmentById);

// artifacts/api-server/src/controllers/department.controller.ts
export const getDepartmentById = catchAsync(async (req: Request, res: Response) => {
  const department = await prisma.department.findUnique({
    where: { id: parseInt(req.params.id as string) },
    include: {
      college: true,
      students: {
        where: getEffectiveActiveStudentWhere(),
        select: { id: true, firstName: true, lastName: true, studentId: true, year: true },
        orderBy: { lastName: 'asc' },
      },
      courses: { ... },
      doctors: { ... },
      _count: { ... },
    },
  });
  if (!department) {
    throw new NotFoundError('Department not found');
  }

  // Enforce scope: COLLEGE_ADMIN/DEPARTMENT_ADMIN
  if (
    req.user &&
    req.user.role === 'COLLEGE_ADMIN' &&
    department.collegeId !== req.user.managedCollegeId
  ) {
    throw new AuthorizationError('Access denied');
  }
  if (
    req.user &&
    req.user.role === 'DEPARTMENT_ADMIN' &&
    department.id !== req.user.managedDepartmentId
  ) {
    throw new AuthorizationError('Access denied');
  }

  res.json({ success: true, data: department });
});
```

#### Exploit Scenario
`GET /api/departments/:id` only enforces `protect` on the route, lacking role restrictions. Inside `getDepartmentById`, the scope guard only checks `req.user.role === 'COLLEGE_ADMIN'` and `req.user.role === 'DEPARTMENT_ADMIN'`. If a user with role `STUDENT`, `DOCTOR`, or `TEACHING_ASSISTANT` makes a request, both conditions evaluate to `false`, completely bypassing the authorization check. The handler proceeds to return the department object along with the complete list of enrolled students (`id`, `firstName`, `lastName`, `studentId`, `year`) and assigned doctors. An attacker logged in with any student account can iterate over department IDs `1..N` and scrape the entire university student directory and enrollment lists.

#### Recommended Fix
1. In `department.routes.ts`, restrict `GET /:id` to administrative roles:
   ```typescript
   router.get(
     '/:id',
     protect,
     authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
     adminIdValidation,
     validate,
     getDepartmentById
   );
   ```
2. If non-admin roles require department information, direct them to `GET /api/departments/public` or a stripped public endpoint that omits sensitive student rosters.

---

### SEC-03: Premature Quiz Question & Option Disclosure Prior to Start Window
- **Severity:** Critical
- **CWE:** CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor), CWE-668 (Exposure of Resource to Wrong Sphere)
- **File Location:** [`artifacts/api-server/src/routes/quiz.routes.ts:21`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/quiz.routes.ts#L21), [`artifacts/api-server/src/controllers/quiz.controller.ts:205-244`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/controllers/quiz.controller.ts#L205-L244)

#### Vulnerable Code Excerpt
```typescript
// artifacts/api-server/src/controllers/quiz.controller.ts
export const getQuizById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const quizId = parseInt(req.params.id as string);
  const isStudent = String(req.user?.role || '').toUpperCase() === 'STUDENT';
  const quiz: any = await prisma.quiz.findFirst({
    where: getQuizWhere(quizId, req.user),
    include: {
      questions: isStudent
        ? {
            select: {
              id: true,
              text: true,
              optionA: true,
              optionB: true,
              optionC: true,
              optionD: true,
              points: true,
            },
          }
        : true,
      course: { select: { id: true, name: true, courseCode: true } },
      doctor: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!quiz) {
    return rejectMissingScopedQuiz(quizId);
  }

  if (isStudent) {
    const studentId = req.user?.student?.id;
    if (!studentId) return next(new AuthorizationError('Student profile is required'));
    const studentSubmission = await prisma.quizSubmission.findFirst({
      where: { quizId: quiz.id, studentId },
      select: { id: true },
    });
    quiz.hasSubmitted = !!studentSubmission;
  }

  res.json({ success: true, data: quiz });
});
```

#### Exploit Scenario
`getQuizById` is accessible to enrolled students via `GET /api/quizzes/:id`. While the field `correct` is omitted from the question select, all questions (`text`, `optionA`, `optionB`, `optionC`, `optionD`, `points`) are returned immediately upon request. The timing check `assertQuizSubmissionWindow` is defined on line 70, but is **only** executed when submitting answers in `submitQuiz` (line 273), never when viewing the quiz in `getQuizById`. An enrolled student can query `GET /api/quizzes/:id` days before the quiz is scheduled to occur, extract all questions, solve them in advance, and instantly submit answers when the quiz window opens.

#### Recommended Fix
In `getQuizById`, if `isStudent` is true, verify that the current time falls strictly within the active quiz window before returning question data:
```typescript
if (isStudent) {
  assertQuizSubmissionWindow(quiz, new Date());
}
```
If the quiz has not yet started, return only high-level metadata (`id`, `title`, `duration`, `startTime`, `endTime`, `course`) and exclude `questions`.

---

### SEC-04: Distributed Account Lockout DoS via IP-Agnostic Login Rate Limiter
- **Severity:** High
- **CWE:** CWE-400 (Uncontrolled Resource Consumption), CWE-307 (Improper Restriction of Excessive Authentication Attempts)
- **File Location:** [`artifacts/api-server/src/middleware/rateLimiter.middleware.ts:106-125`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/middleware/rateLimiter.middleware.ts#L106-L125)

#### Vulnerable Code Excerpt
```typescript
// artifacts/api-server/src/middleware/rateLimiter.middleware.ts
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: createRedisStore('login'),
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    if (email) {
      return `email:${email}`;
    }
    const ip = req.ip || req.get?.('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    return `ip:${ip}`;
  },
});
```

#### Exploit Scenario
The login rate limiter generates its key strictly as `email:${email}` when an email is present in the request body. Because the threshold is set to only 5 requests per 15 minutes, an unauthenticated attacker from any remote IP can send 5 failed login attempts with a victim's email address (e.g. `dean@university.edu` or `admin@university.edu`). Once 5 attempts are logged in Redis, all subsequent login attempts for that email are blocked globally for 15 minutes. The attacker can run a simple cron loop to persistently deny system access to university leadership and faculty.

#### Recommended Fix
1. Change the rate limiter key to combine both the client IP and the email address:
   ```typescript
   keyGenerator: (req) => {
     const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
     const ip = req.ip || req.get?.('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
     return email ? `login:${ip}:${email}` : `login:ip:${ip}`;
   }
   ```
2. Maintain a distinct, global per-IP limiter to prevent credential stuffing across multiple accounts, and implement CAPTCHA or progressive delays rather than a hard global lockout on the account identifier alone.

---

### SEC-05: Attendance Duplicate-Device Enforcement Bypass via Omitted `deviceId`
- **Severity:** High
- **CWE:** CWE-284 (Improper Access Control), CWE-807 (Reliance on Untrusted Inputs in a Security Decision)
- **File Location:** [`artifacts/api-server/src/attendance/attendance.engine.ts:251-272`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/attendance.engine.ts#L251-L272), [`artifacts/api-server/src/routes/attendance.routes.ts:161-170, 359-366`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/attendance.routes.ts#L161-L170)

#### Vulnerable Code Excerpt
```typescript
// artifacts/api-server/src/attendance/attendance.engine.ts
const txResult = await prisma.$transaction<TransactionResult>(
  async (tx) => {
    if (
      intent.deviceId &&
      intent.ipAddress &&
      intent.sessionId &&
      (intent.method === 'QR' || intent.method === 'GPS') // Duplicate-device check
    ) {
      const duplicate = await tx.attendance.findFirst({
        where: {
          sessionId: intent.sessionId,
          ipAddress: intent.ipAddress as string,
          deviceId: intent.deviceId as string,
          studentId: { not: intent.studentId },
        },
      });

      if (duplicate) {
        throw new AppError(
          'تم استخدام هذا الجهاز لتقييد حضور طالب آخر في هذه الجلسة.',
          403
        );
      }
    }
    // ...
```

#### Exploit Scenario
The system's anti-proxying mechanism detects when one device checks in multiple students during a lecture session. However, the check begins with `if (intent.deviceId && intent.ipAddress && ... )`. In `attendance.routes.ts`, the routes `POST /api/attendance/qr` and `POST /api/attendance/scan-qr` validate `token`, but do not require `deviceId`. An attacker using a modified browser script, Postman, or custom application can submit QR check-in requests omitting the `deviceId` field. Because `intent.deviceId` is null, the duplicate check is completely bypassed, allowing a single physical device to record attendance for multiple absent students in the same lecture.

#### Recommended Fix
1. Enforce `deviceId` as a mandatory, validated non-empty string in the validation middleware for `/qr`, `/scan-qr`, and `/gps` endpoints:
   ```typescript
   body('deviceId').isString().trim().notEmpty().withMessage('Device identifier is required')
   ```
2. In `attendance.engine.ts`, perform duplicate checks on IP address or hardware fingerprint, and fail-closed if `deviceId` is absent for self-service attendance methods.

---

### SEC-06: Cross-Session QR Attendance Collision via Unscoped Global Scan
- **Severity:** High
- **CWE:** CWE-287 (Improper Authentication), CWE-305 (Authentication Bypass by Primary Weakness)
- **File Location:** [`artifacts/api-server/src/attendance/drivers/QrDriver.ts:108-135`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/drivers/QrDriver.ts#L108-L135)

#### Vulnerable Code Excerpt
```typescript
// artifacts/api-server/src/attendance/drivers/QrDriver.ts
if (sessionId) {
  const foundSession = await prisma.attendanceSession.findUnique({
    where: { id: parseInt(sessionId) },
    include: { scheduleSlot: { include: { course: true } } },
  });
  if (foundSession && foundSession.isActive) {
    const isValid = verifyTokenForSession(foundSession);
    if (isValid) {
      session = foundSession;
    }
  }
}

if (!session) {
  const activeSessions = await prisma.attendanceSession.findMany({
    where: { isActive: true },
    include: { scheduleSlot: { include: { course: true } } },
  });

  for (const s of activeSessions) {
    if (verifyTokenForSession(s)) {
      session = s;
      sessionId = s.id;
      break;
    }
  }
}
```

#### Exploit Scenario
When a client submits `POST /api/attendance/qr` without `sessionId` (or if an invalid `sessionId` is provided), the driver falls back to querying all currently active sessions university-wide (`where: { isActive: true }`) and evaluates the TOTP code sequentially against each session. Because TOTP tokens are short 6-digit numeric strings with a time-drift window of 1, each active session accepts 3 distinct valid codes at any given second. In an institution with 40 simultaneous lectures, ~120 valid codes exist at any moment. A student attempting a random or shared 6-digit code has a high probability of colliding with a completely different session, accidentally or maliciously recording attendance in an unintended course across campus.

#### Recommended Fix
1. Require `sessionId` as a mandatory integer parameter in `QrDriver.ts` and in the request validation schema in `attendance.routes.ts`.
2. Remove the fallback loop that scans all university-wide active sessions. If `sessionId` is missing or invalid, reject the request immediately with `400 Bad Request`.

---

### SEC-07: Unbounded Loop DoS in Student Group Auto-Division & Splitting
- **Severity:** High
- **CWE:** CWE-400 (Uncontrolled Resource Consumption), CWE-834 (Excessive Iteration)
- **File Location:** [`artifacts/api-server/src/controllers/studentGroups.controller.ts:22-99, 101-180`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/controllers/studentGroups.controller.ts#L22-L99)

#### Vulnerable Code Excerpt
```typescript
// artifacts/api-server/src/controllers/studentGroups.controller.ts
export const autoDivideStudents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const departmentId = parseInt(req.params.departmentId as string);
    let { numberOfGroups, maxGroupSize, confirmed, year } = req.body || {};
    // ...
    await prisma.$transaction(async (tx) => {
      // ...
      const groups = [];
      for (let i = 0; i < numberOfGroups; i++) {
        groups.push(await tx.studentGroup.create({
          data: { name: toBase26(i), departmentId, year: academicYear }
        }));
      }
      // ...
```

#### Exploit Scenario
In both `autoDivideStudents` and `splitGroup`, the input values `numberOfGroups` and `numberOfSubgroups` are extracted directly from `req.body` without upper-bound validation. An authorized administrative user (or a compromised department admin account) can send `numberOfGroups: 1000000`. The server executes a loop that attempts 1,000,000 sequential `tx.studentGroup.create()` database calls within a single transaction. This operation locks department records, blocks database connections, exhausts Node.js process memory, and causes a catastrophic denial of service across the API server.

#### Recommended Fix
1. Introduce an express-validator schema on `studentGroups.routes.ts` enforcing strict numeric ranges on `numberOfGroups` and `numberOfSubgroups`:
   ```typescript
   body('numberOfGroups')
     .optional()
     .isInt({ min: 1, max: 50 })
     .withMessage('Number of groups must be between 1 and 50')
   ```
2. Batch creation operations using `tx.studentGroup.createMany()` rather than executing queries sequentially inside a transaction loop.

---

### SEC-08: Timing Side-Channel in RFID Base64 Signature Verification
- **Severity:** High
- **CWE:** CWE-208 (Observable Timing Discrepancy), CWE-385 (Covert Timing Channel)
- **File Location:** [`artifacts/api-server/src/attendance/drivers/RfidDriver.ts:183-209`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/attendance/drivers/RfidDriver.ts#L183-L209)

#### Vulnerable Code Excerpt
```typescript
// artifacts/api-server/src/attendance/drivers/RfidDriver.ts
const cleanSig = reqSignature.trim();
let isSigValid = false;

try {
  const sigBuf = Buffer.from(cleanSig.toLowerCase(), 'hex');
  const expBuf = Buffer.from(expectedSigHex.toLowerCase(), 'hex');
  if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
    isSigValid = true;
  } else if (cleanSig === expectedSigBase64) {
    isSigValid = true;
  }
} catch {
  isSigValid = false;
}
```

#### Exploit Scenario
`RfidDriver` supports both hexadecimal and Base64 formatted HMAC signatures from ESP32 hardware readers. While hexadecimal signatures are correctly verified using `crypto.timingSafeEqual`, Base64 signatures fallback to standard JavaScript `cleanSig === expectedSigBase64` string comparison (line 203). Because string equality operators compare character-by-character and terminate immediately upon the first non-matching character, this creates a measurable execution time variance. An adversary on the local network sniffing RFID device traffic can measure response latency over repetitive requests to iteratively discover valid HMAC bytes without possessing the device's 256-bit AES-encrypted signing key.

#### Recommended Fix
Ensure that Base64 signatures are converted to binary buffers and compared strictly using `crypto.timingSafeEqual`:
```typescript
const sigBase64Buf = Buffer.from(cleanSig, 'base64');
const expBase64Buf = Buffer.from(expectedSigBase64, 'base64');
if (
  sigBase64Buf.length === expBase64Buf.length &&
  crypto.timingSafeEqual(sigBase64Buf, expBase64Buf)
) {
  isSigValid = true;
}
```

---

### SEC-09: Critical & High Supply-Chain CVEs (Orval RCE & fast-uri Desync)
- **Severity:** High
- **CWE:** CWE-94 (Improper Control of Generation of Code), CWE-436 (Interpretation Conflict)
- **File Location:** `package.json`, `pnpm-lock.yaml`

#### Raw Package Audit Evidence
```text
50 vulnerabilities found
Severity: 3 low | 12 moderate | 24 high | 11 critical
```
Key high/critical CVE telemetry extracted from package manifest:
1. **`orval` (<8.21.0):** Critical Severity — **CVE-2026-62681** (GHSA-fg9p-mrxr-hvq7). Remote Code Execution via unescaped OpenAPI path emitting into client URL template literals without escaping backtick characters.
2. **`fast-uri` (>=3.0.0 <3.1.3):** High Severity — **CVE-2026-13676** (GHSA-4c8g-83qw-93j6). Host confusion via failed IDN canonicalization in URL parsing.
3. Transitive high vulnerabilities across build and bundling dependencies.

#### Exploit Scenario
An adversary who submits or modifies an OpenAPI route description containing backtick expressions can escape template string literals in client code generated by Orval, executing arbitrary Node.js code in CI/CD pipelines or running server environments.

#### Recommended Fix
1. Update `orval` to version `>=8.21.0` in root and workspace package files.
2. Update `@apidevtools/swagger-parser` / `fast-uri` to version `>=3.1.3`.
3. Perform a targeted `pnpm update <package>` without running non-deterministic `audit fix` scripts.

---

### SEC-10: Missing Algorithm Restriction in JWT Access Token Verification
- **Severity:** Medium
- **CWE:** CWE-327 (Use of a Broken or Risky Cryptographic Algorithm)
- **File Location:** [`artifacts/api-server/src/utils/jwt.utils.ts:140-152`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/utils/jwt.utils.ts#L140-L152)

#### Vulnerable Code Excerpt
```typescript
// artifacts/api-server/src/utils/jwt.utils.ts
export const verifyToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET as string, {
      issuer: 'Smart University Platform',
      audience: 'University Users',
    }) as TokenPayload;
  } catch (error: any) {
    // ...
```

#### Exploit Scenario
`jwt.verify` specifies `issuer` and `audience`, but omits the `algorithms` array. In certain configurations or legacy JWT libraries, omitting explicit algorithm restrictions allows tokens signed with unexpected symmetric/asymmetric algorithm combinations or algorithm substitution tricks to be processed.

#### Recommended Fix
Specify the expected algorithm whitelist explicitly:
```typescript
return jwt.verify(token, getTokenSigningSecret(), {
  issuer: 'Smart University Platform',
  audience: 'University Users',
  algorithms: ['HS256'],
}) as TokenPayload;
```

---

### SEC-11: Arbitrary External Redirection via Unvalidated Task Submission URL
- **Severity:** Medium
- **CWE:** CWE-601 (URL Redirection to Untrusted Site), CWE-79 (Cross-site Scripting vectors)
- **File Location:** [`artifacts/api-server/src/services/task.service.ts:425-437`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L425-L437), [`artifacts/university-app/src/components/tasks/SubmissionsGradingModal.tsx:226-235`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/components/tasks/SubmissionsGradingModal.tsx#L226-L235)

#### Vulnerable Code Excerpt
```typescript
// artifacts/api-server/src/services/task.service.ts
if (data.fileUrl) {
  const url = data.fileUrl.trim();
  if (url.length > 500) {
    throw new ValidationError('File URL is too long');
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new ValidationError('File URL must start with http or https');
    }
  } catch (e) {
    throw new ValidationError('Invalid file URL format');
  }
}

// artifacts/university-app/src/components/tasks/SubmissionsGradingModal.tsx
{sub?.fileUrl && (
  <a
    href={sub.fileUrl}
    target="_blank"
    rel="noreferrer"
    className="text-xs text-brand-primary-500 hover:underline font-bold inline-flex items-center gap-1 mt-2"
  >
    <FileUp size={14} /> {t('tasks.uploadedFile')}
  </a>
)}
```

#### Exploit Scenario
When students submit assignments, the backend only checks that `fileUrl` starts with `http:` or `https:`. Any arbitrary third-party domain is accepted. A student can submit a phishing URL (e.g. simulating the university login portal or containing malware). When the grading professor reviews the student's submission and clicks "Uploaded file", the professor's browser navigates directly to the attacker's phishing site.

#### Recommended Fix
1. Enforce domain restrictions on `fileUrl` in `task.service.ts` to only permit internal storage domains (e.g., `res.cloudinary.com` or the official university CDN).
2. In `SubmissionsGradingModal.tsx`, add `rel="noopener noreferrer"` and render an external link warning or preview dialog if the link does not originate from trusted storage.

---

### SEC-12: MemoryStore Fallback for Rate Limiters and 2FA Anti-Replay
- **Severity:** Medium
- **CWE:** CWE-362 (Concurrent Execution using Shared Resource with Improper Synchronization)
- **File Location:** [`artifacts/api-server/src/routes/attendance.routes.ts:14-31`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/attendance.routes.ts#L14-L31), [`artifacts/api-server/src/utils/twoFactor.utils.ts:52-60`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/utils/twoFactor.utils.ts#L52-L60)

#### Vulnerable Code Excerpt
```typescript
// artifacts/api-server/src/routes/attendance.routes.ts
const qrLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many QR scan attempts, please try again later.',
});

const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req: any) => `session_${req.user!.id}`,
});

const rfidLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
});
```

#### Exploit Scenario
Unlike `authLimiter` and `loginLimiter`, the rate limiters in `attendance.routes.ts` (`qrLimiter`, `sessionLimiter`, `rfidLimiter`) do not pass a Redis store, falling back to express-rate-limit's default in-memory store. When the application runs across multiple containers or cluster nodes on Railway, each node tracks request counts in its own local memory. An attacker can distribute rapid QR scan attempts or RFID replay attempts across different server instances to bypass the configured rate limits.

#### Recommended Fix
Pass `store: createRedisStore('attendance_qr')`, `store: createRedisStore('attendance_session')`, and `store: createRedisStore('attendance_rfid')` to all attendance route limiters.

---

### SEC-13: Missing Boot-Time Verification of Mandatory `ENCRYPTION_KEY`
- **Severity:** Medium
- **CWE:** CWE-311 (Missing Encryption of Sensitive Data), CWE-755 (Improper Handling of Exceptional Conditions)
- **File Location:** [`artifacts/api-server/src/server.ts:22-36`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/server.ts#L22-L36)

#### Vulnerable Code Excerpt
```typescript
// artifacts/api-server/src/server.ts
const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET'];

const missingRequired = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingRequired.length > 0) {
  logger.error('❌ FATAL: Missing required environment variables: ' + missingRequired.join(', '));
  process.exit(1);
}
```

#### Exploit Scenario
The server validates `DATABASE_URL` and `JWT_SECRET` upon boot, but omits `ENCRYPTION_KEY`. `ENCRYPTION_KEY` is strictly required by `encryption.utils.ts` for AES-256-GCM encryption of User 2FA secrets and RFID device signing keys. If a production environment is deployed with `ENCRYPTION_KEY` unset, the server starts without error, but crashes or throws 500 internal server errors as soon as any user attempts to enable 2FA, log in with 2FA, provision an RFID device, or submit an RFID attendance tap.

#### Recommended Fix
Add `ENCRYPTION_KEY` to `REQUIRED_ENV_VARS` in `server.ts` and call `getEncryptionKey()` during initialization to validate its 32-byte cryptographic length before accepting traffic.

---

### SEC-14: Missing Route-Level Input Validation on Critical Financial & Academic Endpoints
- **Severity:** Medium
- **CWE:** CWE-20 (Improper Input Validation)
- **File Location:** [`artifacts/api-server/src/routes/enrollment.routes.ts:22, 27, 34`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/enrollment.routes.ts#L22), [`artifacts/api-server/src/routes/exams.routes.ts:139`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/exams.routes.ts#L139), [`artifacts/api-server/src/routes/timetable.routes.ts:12-37`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/timetable.routes.ts#L12)

#### Vulnerable Code Excerpt
```typescript
// artifacts/api-server/src/routes/enrollment.routes.ts
router.post('/', protect, adminRoles, enrollStudent);
router.delete('/:id', protect, adminRoles, withdrawStudent);
router.patch('/:id/grade', protect, authorize('DOCTOR', 'COLLEGE_ADMIN', 'SUPER_ADMIN'), updateGrade);

// artifacts/api-server/src/routes/exams.routes.ts
router.put('/submissions/:submissionId/grade', authorize('DOCTOR', 'ADMIN', 'SUPER_ADMIN'), examsController.gradeSubmission);
router.delete('/questions/:questionId', authorize('DOCTOR', 'ADMIN'), examsController.deleteExamQuestion);
```

#### Exploit Scenario
Several mutation routes in `enrollment.routes.ts`, `exams.routes.ts`, and `timetable.routes.ts` do not mount standard `express-validator` middleware chains on route declarations. While some controllers implement manual type assertions, the absence of route-level validation schemas creates inconsistency, allows unvalidated parameters (such as non-numeric IDs or malformed payloads) to enter controller logic, and bypasses uniform input sanitization.

#### Recommended Fix
Define standardized Zod or express-validator middleware chains for all mutation routes in `enrollment.routes.ts`, `exams.routes.ts`, and `timetable.routes.ts` before passing control to controllers.

---

### SEC-15: Dead Code & Unregistered Handlers (`resetDoctorPassword` / SQL Helper)
- **Severity:** Low
- **CWE:** CWE-1164 (Irrelevant Code)
- **File Location:** [`artifacts/api-server/src/routes/doctors.routes.ts:5`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/doctors.routes.ts#L5), [`artifacts/api-server/src/services/attendance.service.ts:183-339`](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/attendance.service.ts#L183-L339)

#### Vulnerable Code Excerpt
```typescript
// artifacts/api-server/src/routes/doctors.routes.ts
import { resetDoctorPassword, getSuggestedDoctors } from '../controllers/doctors.controller';
// resetDoctorPassword is never bound to any router endpoint

// artifacts/api-server/src/services/attendance.service.ts
const buildStaffWarningSql = (courseIds: number[], options: StaffWarningOptions) => { ... };
// buildStaffWarningSql is defined but never invoked anywhere in the codebase
```

#### Exploit Scenario
Administrative users attempting to reset a doctor's password via the API will discover no route is registered for `resetDoctorPassword` on `/api/doctors/:id/reset-password`. Meanwhile, unused complex SQL builders increase maintenance overhead and potential attack surface.

#### Recommended Fix
1. Register `resetDoctorPassword` on `PATCH /api/doctors/:id/reset-password` with appropriate authorization (`SUPER_ADMIN`, `ADMIN`) and rate limiting.
2. Remove or wire up unused SQL builders in `attendance.service.ts`.

---

## Verification & Remediation Roadmap

1. **Immediate Pre-Launch Blockers (P0):**
   - Restrict `/uploads` by removing static directory exposure in `app.ts` (SEC-01).
   - Add role authorization (`authorize('SUPER_ADMIN', ... )`) to `GET /api/departments/:id` (SEC-02).
   - Gate question retrieval in `GET /api/quizzes/:id` behind `assertQuizSubmissionWindow` (SEC-03).
   - Fix `loginLimiter` to key on IP + email to prevent account lockout DoS (SEC-04).
   - Enforce `deviceId` validation in QR attendance and remove the unscoped global session matching loop (SEC-05, SEC-06).
2. **Short-Term Hardening (P1):**
   - Add max bounds to group division inputs (SEC-07).
   - Use `crypto.timingSafeEqual` on Base64 RFID signatures (SEC-08).
   - Upgrade vulnerable dependencies (`orval`, `fast-uri`) (SEC-09).
   - Enforce `algorithms: ['HS256']` in JWT verification (SEC-10).
   - Restrict assignment submission URLs to trusted storage domains (SEC-11).
3. **Defense-in-Depth (P2):**
   - Connect Redis stores to attendance rate limiters (SEC-12).
   - Add `ENCRYPTION_KEY` to required boot variables in `server.ts` (SEC-13).
   - Unify validation middleware on enrollment and exam grade mutations (SEC-14, SEC-15).
