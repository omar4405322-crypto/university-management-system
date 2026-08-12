# Scheduling System Endpoints Map

This document lists all API endpoints within the Scheduling module (`schedules`, `overrides`, and `timetable`), along with the Prisma queries they execute and the specific source of values used in their `where` filtering clauses.

---

## 1. Schedules Routes (`/api/schedules`)

| HTTP Method | Endpoint Path | Prisma Query Type & Target Model | `where` Clause Structure | Value Source for `where` Parameters |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/schedules/` | `prisma.student.findUnique`<br>`prisma.enrollment.findMany`<br>`prisma.studentGroup.findUnique`<br>`prisma.doctor.findUnique`<br>`prisma.teachingAssistant.findUnique`<br>`prisma.scheduleSlot.findMany` | `student.userId`: `req.user.id`<br>`enrollment.studentId`: `student.id`<br>`scheduleSlot.OR` (for Student): group IDs, course department/year, enrolled course IDs<br>`scheduleSlot.doctorId`: `doctorId`<br>`scheduleSlot.teachingAssistantId`: `teachingAssistantId`<br>`scheduleSlot.course`: `{ departmentId, year, semester }`<br>`scheduleSlot.timetableId`: `timetableId` | `req.user.id` (Auth token), `req.user.role`, `req.query.doctorId`, `req.query.teachingAssistantId`, `req.query.departmentId`, `req.query.year`, `req.query.semester`, `req.query.timetableId` |
| **GET** | `/api/schedules/week` | `prisma.scheduleSlot.findMany` (Alias to `getWeeklyTimetable`) | Same as `GET /api/schedules/` | Same as `GET /api/schedules/` |
| **POST** | `/api/schedules/` | `prisma.course.findUnique`<br>`prisma.doctor.findUnique`<br>`prisma.timetable.findUnique`<br>`prisma.timetable.findFirst`<br>`prisma.scheduleSlot.findFirst` (conflict checks)<br>`tx.scheduleSlot.create` | `course.id`: `courseId`<br>`doctor.userId`: `req.user.id`<br>`timetable.id`: `timetableId`<br>`timetable.findFirst`: `{ departmentId, academicYear, semester }` | `req.body.courseId`, `req.user.id` (for Doctor check), `req.body.timetableId`, fields from retrieved `course` |
| **PUT** | `/api/schedules/:id` | `prisma.scheduleSlot.findUnique`<br>`prisma.doctor.findUnique`<br>`prisma.course.findUnique`<br>`prisma.timetable.findFirst`<br>`tx.scheduleSlot.update` | `scheduleSlot.id`: `slotId`<br>`doctor.userId`: `req.user.id`<br>`course.id`: `newCourseId`<br>`timetable.findFirst`: `{ departmentId, academicYear, semester }` | `req.params.id`, `req.user.id`, `req.body.courseId`, fields from retrieved `course` |
| **DELETE** | `/api/schedules/:id` | `prisma.scheduleSlot.findUnique`<br>`prisma.doctor.findUnique`<br>`prisma.scheduleSlot.delete` | `scheduleSlot.id`: `slotId`<br>`doctor.userId`: `req.user.id` | `req.params.id`, `req.user.id` |
| **POST** | `/api/schedules/sync-grid` | `prisma.course.findFirst`<br>`prisma.doctor.findFirst`<br>`prisma.timetable.findFirst`<br>`prisma.scheduleSlot.findFirst`<br>`prisma.scheduleSlot.update` / `create` | `course.findFirst`: `{ OR: [name/courseCode contains], departmentId }`<br>`doctor.findFirst`: `{ OR: [firstName/lastName contains] }`<br>`timetable.findFirst`: `{ departmentId, academicYear, semester }`<br>`scheduleSlot.findFirst`: `{ courseId, dayOfWeek, startTime }` | `req.body.slots[*].courseName`, `req.body.slots[*].instructor`, `req.body.departmentId`, `req.body.academicYear`, `req.body.semester`, `req.body.slots[*].day`, `req.body.slots[*].startTime` |
| **POST** | `/api/schedules/check-conflict` | `prisma.scheduleSlot.findFirst` (Room)<br>`prisma.doctor.findFirst`<br>`prisma.scheduleSlot.findFirst` (Doctor)<br>`prisma.teachingAssistant.findFirst`<br>`prisma.scheduleSlot.findFirst` (TA)<br>`prisma.scheduleSlot.findFirst` (Batch) | `room`: `room`, `dayOfWeek`, `timeOverlap`, `excludeSlotId`<br>`doctorId`: `doctorId`, `dayOfWeek`, `timeOverlap`<br>`teachingAssistantId`: `teachingAssistantId`, `dayOfWeek`, `timeOverlap`<br>`course`: `{ departmentId, year, semester }`, `dayOfWeek`, `timeOverlap` | `req.body.room`, `req.body.dayOfWeek`, `req.body.startTime`, `req.body.endTime`, `req.body.excludeSlotId`, `req.body.doctorId`, `req.body.doctorName`, `req.body.teachingAssistantId`, `req.body.taName`, `req.body.departmentId`, `req.body.academicYear`, `req.body.semester` |

---

## 2. Schedule Overrides Routes (`/api/schedules/:slotId/overrides` & `/api/schedules/overrides`)

| HTTP Method | Endpoint Path | Prisma Query Type & Target Model | `where` Clause Structure | Value Source for `where` Parameters |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/schedules/:slotId/overrides` | `prisma.scheduleSlot.findUnique`<br>`prisma.doctor.findUnique`<br>`prisma.scheduleOverride.findFirst`<br>`tx.scheduleOverride.create` | `scheduleSlot.id`: `slotId`<br>`doctor.userId`: `req.user.id`<br>`scheduleOverride.findFirst`: `{ scheduleSlotId, AND: [date overlap] }` | `req.params.slotId`, `req.user.id`, `req.body.startDate`, `req.body.endDate` |
| **GET** | `/api/schedules/:slotId/overrides` | `prisma.scheduleOverride.findMany` | `scheduleOverride.scheduleSlotId`: `slotId` | `req.params.slotId` |
| **PATCH** | `/api/schedules/overrides/:overrideId`<br>*(or `/:slotId/overrides/:overrideId`)* | `prisma.scheduleOverride.findUnique`<br>`prisma.doctor.findUnique`<br>`tx.scheduleOverride.update` | `scheduleOverride.id`: `overrideId`<br>`doctor.userId`: `req.user.id` | `req.params.overrideId`, `req.user.id` |
| **DELETE** | `/api/schedules/overrides/:overrideId`<br>*(or `/:slotId/overrides/:overrideId`)* | `prisma.scheduleOverride.findUnique`<br>`prisma.doctor.findUnique`<br>`prisma.scheduleOverride.delete` | `scheduleOverride.id`: `overrideId`<br>`doctor.userId`: `req.user.id` | `req.params.overrideId`, `req.user.id` |

---

## 3. Timetable Routes (`/api/timetable`)

| HTTP Method | Endpoint Path | Prisma Query Type & Target Model | `where` Clause Structure | Value Source for `where` Parameters |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/timetable/` | `prisma.student.findUnique`<br>`prisma.timetable.findMany` | Student role: `{ departmentId, collegeId, academicYear, status: 'PUBLISHED' }`<br>Admin role: `{ collegeId, departmentId, academicYear, semester, status }` | `req.user.id` (for student lookup), student profile fields, `req.query` params, `req.user` scope (`getScopeWhere`) |
| **GET** | `/api/timetable/:id` | `prisma.timetable.findUnique` | `timetable.id`: `id` | `req.params.id` |
| **POST** | `/api/timetable/` | `prisma.timetable.findUnique`<br>`tx.timetable.create` | `collegeId_departmentId_academicYear_semester`: `{ collegeId, departmentId, academicYear, semester }` | `req.body.collegeId`, `req.body.departmentId`, `req.body.academicYear`, `req.body.semester` |
| **PUT** | `/api/timetable/:id` | `prisma.timetable.findUnique`<br>`tx.timetable.update` | `timetable.id`: `id` | `req.params.id` |
| **DELETE** | `/api/timetable/:id` | `prisma.timetable.findUnique`<br>`prisma.timetable.delete` | `timetable.id`: `id` | `req.params.id` |
| **PATCH** | `/api/timetable/:id/publish` | `tx.timetable.update` | `timetable.id`: `id` | `req.params.id` |
| **PATCH** | `/api/timetable/:id/unpublish` | `tx.timetable.update` | `timetable.id`: `id` | `req.params.id` |
