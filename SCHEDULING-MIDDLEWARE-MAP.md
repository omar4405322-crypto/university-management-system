# Scheduling System Middleware Map

This document lists all route definitions in `schedules.routes.ts`, `overrides.routes.ts`, and `timetable.routes.ts`, detailing the exact middleware pipeline applied in execution order along with their full definition signatures.

---

## Global Router Mount Context

- **`schedulesRoutes`** is mounted in `app.ts` at `/api/schedules` with global middleware:
  - `protect` middleware applied via `app.use('/api/schedules', protect, schedulesRoutes)` ([app.ts:207](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/app.ts#L207))
- **`overridesRoutes`** is mounted inside `schedules.routes.ts` at `/:slotId/overrides` and `/overrides` ([schedules.routes.ts:43-44](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/schedules.routes.ts#L43-L44))
- **`timetableRoutes`** is mounted in `app.ts` at `/api/timetable` with global middleware:
  - `protect` middleware applied via `app.use('/api/timetable', protect, timetableRoutes)` ([app.ts:220](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/app.ts#L220))
  - Router-level `router.use(protect)` inside `timetable.routes.ts` ([timetable.routes.ts:6](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/routes/timetable.routes.ts#L6))

---

## Middleware Function Definitions & Signatures

| Middleware Identifier | File & Location | Full Function Signature / Line |
| :--- | :--- | :--- |
| `protect` | [auth.middleware.ts:18](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/middleware/auth.middleware.ts#L18) | `const protect = catchAsync(async (req: Request, res: Response, next: NextFunction) => { ... })` |
| `authorize(...roles)` | [auth.middleware.ts:100](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/middleware/auth.middleware.ts#L100) | `const authorize = (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => { ... }` |
| `validate` | [validate.middleware.ts:7](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/middleware/validate.middleware.ts#L7) | `const validate = (req: Request, res: Response, next: NextFunction) => { ... }` |
| `scheduleValidation` | [functional.validation.ts:63](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/validations/functional.validation.ts#L63) | `export const scheduleValidation = [ body('dayOfWeek')... ]` (express-validator array) |
| `overrideValidation` | [functional.validation.ts:87](file:///c:/Users/omar4/Desktop/University%20management%20system/artifacts/api-server/src/validations/functional.validation.ts#L87) | `export const overrideValidation = [ body('dayOfWeek')... ]` (express-validator array) |

---

## 1. Schedules Routes (`schedules.routes.ts`)

| HTTP Method | Route Endpoint | Middleware Execution Order | Detail / Arguments |
| :--- | :--- | :--- | :--- |
| **GET** | `/` | 1. `protect`<br>2. *(Controller Handler)* | Mounted via `app.ts` (`protect`) |
| **GET** | `/week` | 1. `protect`<br>2. *(Controller Handler)* | Mounted via `app.ts` (`protect`) |
| **POST** | `/` | 1. `protect`<br>2. `authorize(...)`<br>3. `scheduleValidation`<br>4. `validate`<br>5. *(Controller Handler)* | Roles: `'SUPER_ADMIN'`, `'ADMIN'`, `'COLLEGE_ADMIN'`, `'DEPARTMENT_ADMIN'`, `'DOCTOR'`, `'TEACHING_ASSISTANT'` |
| **PUT** | `/:id` | 1. `protect`<br>2. `authorize(...)`<br>3. `scheduleValidation`<br>4. `validate`<br>5. *(Controller Handler)* | Roles: `'SUPER_ADMIN'`, `'ADMIN'`, `'COLLEGE_ADMIN'`, `'DEPARTMENT_ADMIN'`, `'DOCTOR'`, `'TEACHING_ASSISTANT'` |
| **DELETE** | `/:id` | 1. `protect`<br>2. `authorize(...)`<br>3. *(Controller Handler)* | Roles: `'SUPER_ADMIN'`, `'ADMIN'`, `'COLLEGE_ADMIN'`, `'DEPARTMENT_ADMIN'`, `'DOCTOR'`, `'TEACHING_ASSISTANT'` |
| **POST** | `/sync-grid` | 1. `protect`<br>2. `authorize(...)`<br>3. *(Controller Handler)* | Roles: `'SUPER_ADMIN'`, `'ADMIN'`, `'COLLEGE_ADMIN'`, `'DEPARTMENT_ADMIN'` |
| **POST** | `/check-conflict` | 1. `protect`<br>2. *(Controller Handler)* | Mounted via `app.ts` (`protect`) |

---

## 2. Schedule Overrides Routes (`overrides.routes.ts`)

*Note: Inherits `protect` from parent mount points in `app.ts` and `schedules.routes.ts`.*

| HTTP Method | Route Endpoint | Middleware Execution Order | Detail / Arguments |
| :--- | :--- | :--- | :--- |
| **POST** | `/` | 1. `protect`<br>2. `authorize(...)`<br>3. `overrideValidation`<br>4. `validate`<br>5. *(Controller Handler)* | Roles: `'SUPER_ADMIN'`, `'ADMIN'`, `'COLLEGE_ADMIN'`, `'DEPARTMENT_ADMIN'`, `'DOCTOR'`, `'TEACHING_ASSISTANT'` |
| **GET** | `/` | 1. `protect`<br>2. `authorize(...)`<br>3. *(Controller Handler)* | Roles: `'SUPER_ADMIN'`, `'ADMIN'`, `'COLLEGE_ADMIN'`, `'DEPARTMENT_ADMIN'`, `'DOCTOR'`, `'TEACHING_ASSISTANT'`, `'STUDENT'` |
| **PATCH** | `/:overrideId` | 1. `protect`<br>2. `authorize(...)`<br>3. `overrideValidation`<br>4. `validate`<br>5. *(Controller Handler)* | Roles: `'SUPER_ADMIN'`, `'ADMIN'`, `'COLLEGE_ADMIN'`, `'DEPARTMENT_ADMIN'`, `'DOCTOR'`, `'TEACHING_ASSISTANT'` |
| **DELETE** | `/:overrideId` | 1. `protect`<br>2. `authorize(...)`<br>3. *(Controller Handler)* | Roles: `'SUPER_ADMIN'`, `'ADMIN'`, `'COLLEGE_ADMIN'`, `'DEPARTMENT_ADMIN'`, `'DOCTOR'`, `'TEACHING_ASSISTANT'` |

---

## 3. Timetable Routes (`timetable.routes.ts`)

| HTTP Method | Route Endpoint | Middleware Execution Order | Detail / Arguments |
| :--- | :--- | :--- | :--- |
| **GET** | `/` | 1. `protect`<br>2. `protect`<br>3. *(Controller Handler)* | Express app mount + router.use(protect) |
| **GET** | `/:id` | 1. `protect`<br>2. `protect`<br>3. *(Controller Handler)* | Express app mount + router.use(protect) |
| **POST** | `/` | 1. `protect`<br>2. `protect`<br>3. `authorize(...)`<br>4. *(Controller Handler)* | Roles: `'SUPER_ADMIN'`, `'ADMIN'`, `'COLLEGE_ADMIN'`, `'DEPARTMENT_ADMIN'` |
| **PUT** | `/:id` | 1. `protect`<br>2. `protect`<br>3. `authorize(...)`<br>4. *(Controller Handler)* | Roles: `'SUPER_ADMIN'`, `'ADMIN'`, `'COLLEGE_ADMIN'`, `'DEPARTMENT_ADMIN'` |
| **DELETE** | `/:id` | 1. `protect`<br>2. `protect`<br>3. `authorize(...)`<br>4. *(Controller Handler)* | Roles: `'SUPER_ADMIN'`, `'ADMIN'`, `'COLLEGE_ADMIN'`, `'DEPARTMENT_ADMIN'` |
| **PATCH** | `/:id/publish` | 1. `protect`<br>2. `protect`<br>3. `authorize(...)`<br>4. *(Controller Handler)* | Roles: `'SUPER_ADMIN'`, `'ADMIN'`, `'COLLEGE_ADMIN'`, `'DEPARTMENT_ADMIN'` |
| **PATCH** | `/:id/unpublish` | 1. `protect`<br>2. `protect`<br>3. `authorize(...)`<br>4. *(Controller Handler)* | Roles: `'SUPER_ADMIN'`, `'ADMIN'`, `'COLLEGE_ADMIN'`, `'DEPARTMENT_ADMIN'` |
