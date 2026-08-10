# Tasks/Assignments System — Full Audit Report

**Date:** 2026-08-10  
**Auditor:** Static code analysis (no runtime / no screenshots)  
**Scope:** Backend (`api-server`) + Frontend (`university-app`) — everything task/assignment-related

---

## 1. Executive Summary

The tasks/assignments system is **in solid shape** after the prior audit-and-fix cycle. The 10 previously-reported issues were all genuinely addressed — IDOR fixes, unique constraint, max-score validation, feedback field, grading UI, soft-delete, and service-layer pattern are all present in the code. The grading UI is a real, fully-wired component that calls the correct API endpoint.

**The single most important thing to address first:**  
`// @ts-nocheck` is present in the **frontend** [task.service.ts](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/services/task.service.ts#L1) (line 1). This disables all TypeScript checking for the frontend API client layer — the one file that bridges every UI action to the backend. Any type mismatch (e.g., sending `score` as a string instead of a number) would be silently ignored. This is the highest-leverage low-effort fix.

**Secondary priority:** Three hardcoded strings (2 Arabic, 1 English) bypass i18n, and `DEPARTMENT_ADMIN` is missing from the frontend route's `allowedRoles` list despite being allowed on every backend endpoint.

---

## 2. Architecture As It Actually Exists Today

### 2.1 Data Models

| Model | Key Fields | File Reference |
|-------|-----------|----------------|
| **Task** | `id`, `title`, `description`, `courseId` → Course, `doctorId` → Doctor, `dueDate`, `maxScore` (default 100), `isDeleted`, `deletedAt`, `createdAt` | [schema.prisma L389–406](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L389-L406) |
| **TaskSubmission** | `id`, `taskId` → Task, `studentId` → Student, `fileUrl?`, `notes?`, `score?`, `feedback?`, `submittedAt` | [schema.prisma L408–422](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L408-L422) |

**Constraints:**
- `@@unique([taskId, studentId])` on `TaskSubmission` — prevents duplicate submissions at the DB level ([schema.prisma L421](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L421))
- `@@index([taskId, studentId])` — composite index for lookup performance ([schema.prisma L420](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L420))
- `@@index([isDeleted])` on Task — for soft-delete filtering ([schema.prisma L405](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L405))
- Task → Course: `onDelete: Cascade`; Task → Doctor: `onDelete: Restrict`
- TaskSubmission → Task: `onDelete: Cascade`; TaskSubmission → Student: `onDelete: Cascade`

### 2.2 Endpoints

All endpoints mounted at `/api/tasks` with `protect` middleware globally applied in [app.ts L214](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/app.ts#L214). Per-endpoint `authorize()` in [task.routes.ts](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/task.routes.ts):

| Method | Path | Auth Roles | Service Method | Route Line |
|--------|------|-----------|----------------|------------|
| `POST` | `/` | DOCTOR | `createTask` | [L21](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/task.routes.ts#L21) |
| `GET` | `/` | Any authenticated | `getTasks` | [L23](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/task.routes.ts#L23) |
| `PUT` | `/:id` | DOCTOR, ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN, SUPER_ADMIN | `updateTask` | [L58](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/task.routes.ts#L58) |
| `DELETE` | `/:id` | DOCTOR, ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN, SUPER_ADMIN | `deleteTask` | [L72](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/task.routes.ts#L72) |
| `POST` | `/:id/submit` | STUDENT | `submitTask` | [L80](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/task.routes.ts#L80) |
| `PUT` | `/:id/submissions/:sid/grade` | DOCTOR, ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN, SUPER_ADMIN | `gradeSubmission` | [L82](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/task.routes.ts#L82) |
| `GET` | `/:id/submissions` | DOCTOR, ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN, SUPER_ADMIN | `getTaskSubmissions` | [L95](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/task.routes.ts#L95) |
| `GET` | `/:id/submission` | STUDENT | `getMySubmission` | [L121](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/task.routes.ts#L121) |

### 2.3 Request Flows

**Task Creation (Doctor):**
1. `POST /api/tasks` → `protect` → `authorize('DOCTOR')` → `taskValidation` → `validate` → `createTask` controller
2. Controller parses body, calls `TaskService.createTask(user, data)`
3. Service: `getDoctorOrThrow(userId)` → find course → `ensureDoctorAssignedToCourse()` (checks ScheduleSlot) → `validateCourseScope()` → `prisma.task.create()` → `notifyStudentsInCourse()` → return
4. Controller responds 201

**Student Submission:**
1. `POST /api/tasks/:id/submit` → `protect` → `authorize('STUDENT')` → `functionalIdValidation` → `validate` → `submitTask` controller
2. Controller parses body, calls `TaskService.submitTask(user, taskId, data)`
3. Service: `getStudentOrThrow(userId)` → find task (filters `isDeleted`) → check enrollment → `validateCourseScope()` → check existing submission via `findUnique(taskId_studentId)` → `prisma.taskSubmission.create()` → return
4. Controller catches Prisma P2002 as fallback → responds 201

**Doctor Grading:**
1. `PUT /api/tasks/:id/submissions/:sid/grade` → `protect` → `authorize(...)` → validation (`score >= 0`, `feedback optional`) → `validate` → `gradeSubmission` controller
2. Controller parses body, calls `TaskService.gradeSubmission(user, sid, score, feedback, req)`
3. Service: find submission (includes task+course) → check `isDeleted` → if DOCTOR: `getDoctorOrThrow` + check `task.doctorId === doctor.id` → `validateCourseScope()` → validate score (NaN, negative, exceeds maxScore) → `prisma.taskSubmission.update()` → `auditLog('UPDATE_GRADE', 'TaskSubmission', submissionId, req)` → return
4. Frontend: `SubmissionRow.handleSave()` ([SubmissionsGradingModal.tsx L148–167](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/components/tasks/SubmissionsGradingModal.tsx#L148-L167)) calls `taskService.gradeSubmission(taskId, submission.id, { score, feedback })` → API call to `PUT /tasks/:id/submissions/:sid/grade`

---

## 3. Verified Working (Code-Traced)

| Feature | Evidence |
|---------|----------|
| **Task CRUD** | Create: [task.service.ts L83–131](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L83-L131). Update: [L235–295](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L235-L295). Delete (soft/force): [L297–345](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L297-L345). |
| **Soft-delete filtering** | Every read query uses `NOT: { isDeleted: true }` — `getTasks` [L151](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L151), `updateTask` [L246](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L246), `deleteTask` [L303](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L303), `submitTask` [L355](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L355), `gradeSubmission` checks `task.isDeleted` explicitly at [L411](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L411), `getTaskSubmissions` [L466](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L466), `getMySubmission` [L750](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L750). **All 7 read paths covered.** |
| **Duplicate submission prevention** | Application-level check via `findUnique(taskId_studentId)` [L375–382](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L375-L382) + DB-level unique constraint [schema.prisma L421](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L421) + controller P2002 catch [task.controller.ts L98–109](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/controllers/task.controller.ts#L98-L109). Double protection. |
| **Max-score validation** | [task.service.ts L426–437](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L426-L437): NaN check, negative check, exceeds-maxScore check. Also validated at route level: `body('score').isFloat({ min: 0 })` [task.routes.ts L88](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/task.routes.ts#L88). |
| **IDOR fix — gradeSubmission** | [task.service.ts L415–422](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L415-L422): If DOCTOR role, loads doctor record and checks `task.doctorId !== doctor.id` → throws AuthorizationError. |
| **IDOR fix — getTaskSubmissions** | [task.service.ts L475–482](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L475-L482): Same pattern — DOCTOR check on `taskObj.doctorId !== doctor.id`. |
| **Feedback field end-to-end** | Schema: [L417](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L417). Service writes it: [L443](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L443). Frontend displays to student: [TasksList.tsx L335–339](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/tasks/TasksList.tsx#L335-L339) — shows feedback with MessageSquare icon when score is present. Doctor can enter it: [SubmissionsGradingModal.tsx L277–288](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/components/tasks/SubmissionsGradingModal.tsx#L277-L288). |
| **Grading UI wired to endpoint** | `SubmissionRow.handleSave` at [SubmissionsGradingModal.tsx L148–167](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/components/tasks/SubmissionsGradingModal.tsx#L148-L167) calls `taskService.gradeSubmission(taskId, row.submission.id, { score, feedback })`. Frontend service at [task.service.ts L60–67](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/services/task.service.ts#L60-L67) maps this to `api.put('/tasks/${id}/submissions/${submissionId}/grade', data)`. This matches the route `PUT /:id/submissions/:sid/grade` at [task.routes.ts L82–93](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/task.routes.ts#L82-L93). **Fully traced click → API call → route → controller → service.** |
| **Audit log correct ID** | [task.service.ts L448](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L448): `auditLog('UPDATE_GRADE', 'TaskSubmission', String(submissionId), reqSource)` — uses `submissionId` parameter, which is the correct submission ID (not task ID). |
| **Pagination on getTaskSubmissions** | Full server-side pagination with `skip/take` at DB level: [task.service.ts L491–494](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L491-L494). Default 25 per page, max 100. Returns `{ rows, pagination: { page, limit, totalCount, totalPages }, summary }`. |
| **Enrollment check on submit** | [task.service.ts L362–371](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L362-L371): Student must have `status: 'ENROLLED'` enrollment in the task's course. |
| **Student can only see own submission** | `getMySubmission` uses `findUnique` with compound key `taskId_studentId` where `studentId` is derived from `userId` — no way to specify another student's ID ([task.service.ts L746–785](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L746-L785)). |
| **Notifications on task create/deadline change** | Create: [task.service.ts L123–128](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L123-L128). Deadline extension: [L272–292](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L272-L292) — only notifies if new date > old date (extension, not reduction). |

---

## 4. Issues Found

### High

#### H1. `@ts-nocheck` in frontend `task.service.ts`
- **File:** [task.service.ts L1](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/services/task.service.ts#L1)
- **Description:** `// @ts-nocheck` disables all TypeScript checking for the frontend API client. This is the bridge between every UI action and the backend.
- **Why it matters:** Type errors (wrong parameter types, missing fields) will not be caught at build time. For example, sending `score: "5"` instead of `score: 5` would silently pass.
- **Suggested fix:** Remove the directive. The file's types are simple (API wrappers around `apiRequest`), so fixing any resulting TS errors should be trivial.

#### H2. `DEPARTMENT_ADMIN` missing from frontend route `allowedRoles`
- **File:** [App.tsx L531–537](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/App.tsx#L531-L537)
- **Description:** The `ProtectedRoute` for `/tasks` allows `['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT', 'COLLEGE_ADMIN']` but does **not** include `'DEPARTMENT_ADMIN'`. However, every backend task endpoint (update, delete, grade, view submissions) explicitly authorizes `DEPARTMENT_ADMIN`.
- **Why it matters:** A department admin can use the API directly but cannot navigate to the tasks page in the UI — they'd get a 403/redirect from the frontend guard.
- **Suggested fix:** Add `'DEPARTMENT_ADMIN'` to the `allowedRoles` array.

### Medium

#### M1. Hardcoded Arabic strings in `TasksList.tsx`
- **File:** [TasksList.tsx L696](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/tasks/TasksList.tsx#L696): `رابط الملف / الإجابة (File URL)` — submission file URL label
- **File:** [TasksList.tsx L779](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/tasks/TasksList.tsx#L779): `تسليم(ات) موجود(ة)` — delete confirmation submission count
- **Why it matters:** These strings will always display in Arabic even when the UI is set to English.
- **Suggested fix:** Replace with `t('tasks.fileUrlLabel')` and `t('tasks.existingSubmissions', { count: ... })` and add corresponding keys to both `ar.json` and `en.json`.

#### M2. Hardcoded English strings in `TasksList.tsx`
- **File:** [TasksList.tsx L818](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/tasks/TasksList.tsx#L818): `Syncing assignments...` — loading indicator text
- **File:** [TasksList.tsx L888](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/tasks/TasksList.tsx#L888): `Points` — card label
- **File:** [TasksList.tsx L901](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/tasks/TasksList.tsx#L901): `Course` — card label
- **Why it matters:** These display in English even in Arabic mode.
- **Suggested fix:** Replace with `t()` calls referencing existing or new i18n keys (e.g., `t('tasks.maxPoints')` already exists for "Points").

#### M3. `getTasks` list endpoint returns all tasks unpaginated
- **File:** [task.service.ts L222–230](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L222-L230)
- **Description:** `getTasks()` uses `findMany` with no `skip`/`take` — returns every matching task. While tasks per doctor are typically modest, this lacks the safety net that `getTaskSubmissions` has.
- **Why it matters:** If a system has hundreds of courses with many tasks per course, a SUPER_ADMIN or ADMIN listing all tasks would get an unbounded response.
- **Suggested fix:** Add optional `page`/`limit` parameters with defaults (e.g., 50).

#### M4. `isTaskOwner` check in frontend is unreliable
- **File:** [TasksList.tsx L170–177](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/tasks/TasksList.tsx#L170-L177)
- **Description:** The logic `String(task.doctor?.userId || task.doctorId || '') === String(user.id)` compares a doctor's `userId` against the current user's `id`, which is conceptually correct. However, the `getTasks` API response includes `doctor: { firstName, lastName }` but does NOT include `doctor.userId` — only the top-level `task.doctorId` (the Doctor record ID, not the User ID). So `task.doctor?.userId` is always `undefined`, and the comparison falls through to `String(task.doctorId) === String(user.id)`, which compares a Doctor ID to a User ID — these are different values.
- **Why it matters:** The Edit/Delete buttons may show or hide incorrectly for doctors. The backend still enforces ownership correctly, so this is a UI display bug only — no security impact.
- **Suggested fix:** Either include `doctor.userId` in the `getTasks` response, or compare `task.doctorId` against `user.doctor?.id` (which is available on the auth context).

### Low

#### L1. No audit log on task create/update/delete
- **Description:** `auditLog` is called only in `gradeSubmission` ([task.service.ts L447–449](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L447-L449)). Creating, updating, or deleting a task does not produce an audit trail.
- **Why it matters:** For regulatory or academic integrity purposes, knowing who created/modified/deleted an assignment is valuable.
- **Suggested fix:** Add `auditLog('CREATE_TASK', ...)`, `auditLog('UPDATE_TASK', ...)`, and `auditLog('DELETE_TASK', ...)` calls in the respective service methods.

#### L2. Zod validation messages in frontend are English-only
- **File:** [TasksList.tsx L37–41](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/tasks/TasksList.tsx#L37-L41): `'Title is required'`, `'Description is required'`, `'Course is required'`, etc.
- **File:** [TasksList.tsx L46](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/tasks/TasksList.tsx#L46): `'Must be a valid URL'`, `'File URL is required'`
- **Why it matters:** Form validation errors always appear in English regardless of the UI language.
- **Suggested fix:** Use `t()` inside a Zod `refine` or use a localized error map.

#### L3. Due date timezone handling uses raw `new Date()`
- **Description:** All due-date comparisons use `new Date()` — e.g., [task.service.ts L150](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L150), [L584](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L584), [functional.validation.ts L28](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/validations/functional.validation.ts#L28). The server uses the system timezone (likely UTC if deployed to cloud).
- **Why it matters:** The attendance system explicitly uses `Africa/Cairo` via `date-fns-tz`. Tasks don't, which could create inconsistency — a task due at "midnight Egypt time" might be calculated as 10 PM or 2 AM depending on server TZ.
- **Suggested fix:** Align with the attendance system's `Africa/Cairo` convention, or store/compare all dates in UTC consistently.

---

## 5. Status of Previously Reported Issues

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 1 | IDOR on `gradeSubmission` | ✅ **Fixed** | Doctor ownership check at [task.service.ts L415–422](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L415-L422) |
| 2 | IDOR on `getTaskSubmissions` | ✅ **Fixed** | Doctor ownership check at [task.service.ts L475–482](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L475-L482) |
| 3 | `TaskSubmission(taskId, studentId)` unique constraint | ✅ **Fixed** | Schema: [L421](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L421). Migration: [20260802030500](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/migrations/20260802030500_add_tasksubmission_unique_task_student/migration.sql) with `CREATE UNIQUE INDEX`. Application-level pre-check: [task.service.ts L375–382](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L375-L382). |
| 4 | Max-score validation on grading | ✅ **Fixed** | Service: [L426–437](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L426-L437). Route: [L88](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/task.routes.ts#L88). |
| 5 | Grading audit log wrong-ID bug | ✅ **Fixed** | [task.service.ts L448](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L448) uses `String(submissionId)` — the correct submission ID. |
| 6 | Grading UI wired up | ✅ **Fixed** | Full trace: click handler → [SubmissionsGradingModal.tsx L148–167](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/components/tasks/SubmissionsGradingModal.tsx#L148-L167) → [task.service.ts L60–67](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/services/task.service.ts#L60-L67) → `PUT /tasks/:id/submissions/:sid/grade` |
| 7 | Soft-delete correctness | ✅ **Fixed** | All 7 read paths filter out deleted tasks (see Section 3 table). `gradeSubmission` additionally checks `task.isDeleted` explicitly. |
| 8 | `feedback` field displayed to student | ✅ **Fixed** | Schema [L417](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L417), displayed at [TasksList.tsx L335–339](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/tasks/TasksList.tsx#L335-L339), enterable by doctor at [SubmissionsGradingModal.tsx L277–288](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/components/tasks/SubmissionsGradingModal.tsx#L277-L288). |
| 9 | `@ts-nocheck` removed from `task.controller.ts` | ✅ **Fixed** (controller) / ⚠️ **Present elsewhere** | `task.controller.ts` — clean. `task.service.ts` (backend) — clean. BUT `task.service.ts` (frontend) has `@ts-nocheck` at [line 1](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/services/task.service.ts#L1). `SubmissionsGradingModal.tsx` and `TasksList.tsx` — clean. |
| 10 | `task.service.ts` pattern consistency | ✅ **Fixed** | Uses static class methods like `AttendanceService`/`EnrollmentService`. Has helper methods (`getDoctorOrThrow`, `getStudentOrThrow`, `ensureDoctorAssignedToCourse`, `validateCourseScope`, `ensureCourseOwnershipOrScope`). Uses same error classes (`AuthorizationError`, `NotFoundError`, `ConflictError`, `ValidationError`). Uses `getScopeWhere` for admin scope filtering. |

---

## 6. Best-Practice Divergences

These are things that **work** but deviate from common conventions:

| Area | Current Behavior | Common Practice | Severity |
|------|------------------|-----------------|----------|
| **No rate limiting on task submit/grade** | Task routes fall under the global `apiLimiter` (2000 req/15min) at [app.ts L141–146](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/app.ts#L141-L146). No specific rate limiter on submit or grade. | Write endpoints (especially student submission) typically have tighter limits (e.g., 10/min) to prevent abuse. The attendance system has specific rate limiters per endpoint. | Medium |
| **`getTasks` returns all results** | No pagination. Returns all matching tasks via `findMany` with no `take`/`skip`. [task.service.ts L222–230](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L222-L230) | List endpoints typically support pagination. `getTaskSubmissions` already does this properly. | Medium |
| **No file upload validation** | `fileUrl` is accepted as a plain string (URL) — [task.service.ts L350](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L350). No server-side validation of the URL or its content. Frontend has `z.string().url()` validation. | If files are expected, either validate the URL domain (allowlist) or handle actual file uploads with type/size checks. Current approach offloads storage to external services (e.g., Google Drive links), which is valid but unvalidated. | Low |
| **`user: any` type throughout service** | Every service method accepts `user: any`. [task.service.ts L83](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L83), etc. | Using a typed `AuthUser` interface improves safety and documentation. This is consistent with other services in the codebase (they all use `any` too), so it's a systemic pattern, not task-specific. | Low |
| **Error response in dev mode leaks stack** | [error.middleware.ts L65–71](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/middleware/error.middleware.ts#L65-L71): Development mode sends `stack` and full `error` object. Production mode ([L74–95](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/middleware/error.middleware.ts#L74-L95)) properly hides internals. | Acceptable as long as `NODE_ENV=production` is set in deployment. If the system runs with `development` in production, stack traces leak. | Low |
| **No `updatedAt` on Task model** | Task has `createdAt` but no `updatedAt`. [schema.prisma L400](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L400) | Most models that support updates should track `updatedAt` for debugging and sorting. `CourseMaterial`, `Timetable`, `ScheduleOverride` all have `updatedAt`. | Low |
| **ADMIN role has no scope check** | The `authorize()` middleware includes `ADMIN` for update/delete/grade/submissions. `validateCourseScope()` handles `COLLEGE_ADMIN` and `DEPARTMENT_ADMIN` via `getScopeWhere`, but plain `ADMIN` without `managedCollegeId` falls through with no scope filter. | ADMIN should either be scoped or explicitly documented as having full access like SUPER_ADMIN. | Low |

---

## 7. Findings for the 4 Planned Features

### 7.1 Edit Due Date After Publish

**Current state:** The `updateTask` service method at [task.service.ts L235–295](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L235-L295) accepts `dueDate` as an optional field with **no restrictions**. There is:
- No check for whether submissions already exist
- No check for whether the task is past its original due date
- No check for whether the new due date is in the past (the creation validation at [functional.validation.ts L26–33](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/validations/functional.validation.ts#L26-L33) blocks past dates, but the update route at [task.routes.ts L65](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/task.routes.ts#L65) only validates ISO format, not past-date logic)

The frontend Edit modal at [TasksList.tsx L141–157](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/tasks/TasksList.tsx#L141-L157) pre-fills the due date and sends it to `updateTask`. The Edit button is visible on the task card at [L912–921](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/tasks/TasksList.tsx#L912-L921).

When the due date is extended, students are automatically notified at [task.service.ts L272–292](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L272-L292).

**Verdict:** Editing the due date after publishing **already works** with no restrictions. The doctor can change it to any future or past date. The only consideration is whether you *want* to add restrictions (e.g., blocking past dates on edit, or warning when submissions exist).

### 7.2 Large-Scale Submission Management (1000+ Students)

**Current state:** `getTaskSubmissions` is **already designed for scalability**:
- Server-side pagination: `skip`/`take` at DB level, default 25 per page, max 100 ([task.service.ts L491–494](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L491-L494))
- Search by student name/ID: server-side via Prisma `contains` ([L503–508](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L503-L508))
- Filter by status: ALL, SUBMITTED, GRADED, UNGRADED, LATE, NOT_SUBMITTED ([L461](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L461))
- Filter by student year ([L462](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L462))
- Summary counts computed separately (totalEnrolled, submitted, graded, ungraded, late, notSubmitted) ([L515–519](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L515-L519))
- Frontend pagination controls: [SubmissionsGradingModal.tsx L557–590](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/components/tasks/SubmissionsGradingModal.tsx#L557-L590)
- Per-page options: 25, 50, 100 ([L86](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/components/tasks/SubmissionsGradingModal.tsx#L86))
- Debounced search input ([L97–104](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/components/tasks/SubmissionsGradingModal.tsx#L97-L104))

**Potential bottleneck at 1000+:**
- The "ALL" and "NOT_SUBMITTED" status paths use a LEFT JOIN approach: fetch all enrollments first, then fetch submissions for the page's students. The orphan detection ([L609–613](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L609-L613)) fetches ALL enrollment studentIds to build the exclusion set. At 1000+ students, this query (`findMany` on all enrollments just for IDs) is lightweight but could be optimized.
- The `lateRawPromise` at [L520–523](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L520-L523) fetches ALL submissions' `submittedAt` for the late count calculation — this loads all submission dates into memory. At 1000+ this is fine; at 10,000+ it could be optimized to a COUNT query with a WHERE clause.
- The rendering itself is bounded (max 100 per page), so the frontend won't struggle.

**Verdict:** The system is well-prepared for 1000 students. No breaking point expected until significantly larger scale (10,000+). Minor optimization opportunities exist but are not urgent.

### 7.3 Main List Page Sorting/Filtering

**Current state of the TasksList page:**

**Sorting options available** (synced to URL query params):
- Due Date ascending/descending
- Created At ascending/descending (default: descending)
- Submissions Count ascending/descending

**Filtering options available:**
- Course dropdown (doctors only, all courses shown)
- Status: Active (not yet due) / Overdue (past due)
- Due Date range (from/to date pickers)
- Text search (title and description, server-side `contains` insensitive)
- Clear all filters button

**What's currently missing for a more "professional" experience:**
- No pagination on the main list (all tasks rendered as cards)
- No "table view" option — only card grid layout
- No bulk actions (e.g., bulk delete, bulk export)
- No per-task submission progress indicator on the card itself (doctor sees submission count but not a progress bar)
- Student view has no course filter dropdown
- No "My Tasks" vs "All Tasks" toggle for admins

**Frontend code:** [TasksList.tsx L435–531](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/tasks/TasksList.tsx#L435-L531) for the filter bar, [L811–956](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/pages/tasks/TasksList.tsx#L811-L956) for the card grid rendering.

### 7.4 Academic Year (Student 1st–4th Year)

**Where student academic year is stored:**

1. **`Student.year`**: [schema.prisma L164](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L164) — `year Int @default(1)`. This is the primary field representing the student's current academic year (1, 2, 3, 4).

2. **`StudentGroup.year`**: [schema.prisma L614](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L614) — `year Int @default(1)`. Student groups are organized by year within a department.

3. **`Course.year`**: [schema.prisma L322](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L322) — `year Int @default(1)`. Each course has an assigned year level.

4. **`Timetable.academicYear`**: [schema.prisma L430](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L430) — represents the study level for timetable organization.

5. **`RegistrationRequest.year`**: [schema.prisma L140](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L140) — year specified during registration.

**How year is currently used in the task system:**
- `getTaskSubmissions` already accepts a `studentYear` filter parameter ([task.service.ts L462](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L462)) and filters submissions by `student.year` ([L510–512](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L510-L512)).
- The grading modal defaults the year filter to the **course's year** ([SubmissionsGradingModal.tsx L342](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/university-app/src/components/tasks/SubmissionsGradingModal.tsx#L342): `setStudentYear(task.course?.year ?? 'ALL')`).
- The response includes `defaultCourseYear` ([task.service.ts L686](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L686)).
- `Student.year` is available in auth context ([auth.middleware.ts L59](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/middleware/auth.middleware.ts#L59)) and in scope utils ([scope.utils.ts L92, L103](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/utils/scope.utils.ts#L92)).
- `Student` is indexed on `[departmentId, year]` ([schema.prisma L187](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/prisma/schema.prisma#L187)).

**How year could factor into task organization:**
- A task is already tied to a course (`Task.courseId`), and each course has a year (`Course.year`). So tasks are implicitly organized by year through their course.
- Students viewing tasks already see only tasks for courses they're enrolled in, which are scoped by year through enrollment.
- The `getTasks` query for students filters by enrollment ([task.service.ts L182–189](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/services/task.service.ts#L182-L189)), not by year directly. Adding a year filter would be straightforward via the existing `Course.year` field.
- The main list page does NOT currently have a "year" filter — only the submissions modal has one.

**Summary:** The year infrastructure is well-established. `Student.year`, `Course.year`, and `StudentGroup.year` are all available. The submission view already uses year filtering. Adding year filtering to the main task list would be a small addition.

---

## 8. Needs Manual Testing

| Item | What to Verify | How |
|------|---------------|-----|
| **Migration applied to live DB** | Confirm the unique constraint `TaskSubmission_taskId_studentId_key` actually exists in the live database, not just in `schema.prisma` and migration files. | Run: `SELECT indexname FROM pg_indexes WHERE tablename = 'TaskSubmission' AND indexname = 'TaskSubmission_taskId_studentId_key';` — should return one row. |
| **Soft-delete columns in live DB** | Confirm `Task.isDeleted` and `Task.deletedAt` columns exist in the live database. | Run: `SELECT column_name FROM information_schema.columns WHERE table_name = 'Task' AND column_name IN ('isDeleted', 'deletedAt');` — should return 2 rows. |
| **`feedback` column in live DB** | Confirm `TaskSubmission.feedback` column exists. | Run: `SELECT column_name FROM information_schema.columns WHERE table_name = 'TaskSubmission' AND column_name = 'feedback';` — should return 1 row. |
| **Race condition on double-submit** | Test what happens when a student clicks submit twice rapidly. The application-level check + unique constraint should handle it, but verify the user gets a friendly error, not a 500. | Log in as a student, find an unsubmitted task, use browser DevTools Network throttling (Slow 3G), click Submit rapidly twice. Expect: first succeeds (201), second fails with 409 "already submitted". |
| **Edit due date via UI** | Confirm the Edit button opens the modal with the due date pre-filled and allows changing it. | Log in as a doctor, click Edit on any task, change the due date, save. Verify the task updates and students get notified (if extended). |
| **Feedback display to student** | After a doctor grades with feedback, confirm the student sees the feedback text on their task card. | Grade a submission with feedback text, then log in as that student and check the task card. |
| **DEPARTMENT_ADMIN access** | Currently, DEPARTMENT_ADMIN cannot reach `/tasks` in the frontend due to the missing role in `allowedRoles`. Manually navigate to `/dashboard/tasks` as a DEPARTMENT_ADMIN to confirm it's blocked. | Log in as a DEPARTMENT_ADMIN, navigate to tasks page URL directly. |

---

## 9. Open Questions

1. **Should editing a task's due date be restricted after submissions exist?** Currently there's no restriction — a doctor can change the due date even after students have submitted. This could retroactively mark submissions as "late" or "on time." Is this intentional?

2. **Should students be allowed to update/re-submit?** Currently, once a student submits, they cannot re-submit — the unique constraint and application check prevent it. There's no "update submission" feature. Is this the intended behavior, or should students be able to revise before the deadline?

3. **What should the `ADMIN` role's task access scope be?** Currently, a plain `ADMIN` (without `managedCollegeId`) passes through scope checks with no filtering — effectively having full access like `SUPER_ADMIN`. Is this intentional?

4. **What does "academic year factoring into task organization" mean?** The system already ties tasks to courses (which have a year), and students only see tasks for their enrolled courses. Should year be an explicit filter on the main task list page? Should doctors be able to create tasks targeted at specific years independently of courses?

5. **Should the `fileUrl` field support actual file uploads?** Currently it accepts a URL string (e.g., Google Drive link). The system has file upload infrastructure (`upload.middleware.ts`, `materialUpload.middleware.ts`) used for course materials. Should task submissions support direct file uploads to the server?

---

*End of audit. All claims backed by file/line references. Items marked "needs manual testing" could not be verified through static code analysis alone.*
