# Task: Replace Course Sections with a Hierarchical Student Grouping System

You are working in the "University Management System" repo. Read this whole prompt before making changes. Work through the phases in order. After each phase, run the project's typecheck/lint/build to catch dangling references before moving to the next phase.

## Context

The current "Sections Management" feature lets admins create `CourseSection` records per course, map `StudentGroup` cohorts or individual `StudentSectionOverride` records to them. This entire feature is being replaced with a new concept: **department-level hierarchical student groups**, independent of any course.

Relevant existing files to inspect first:
- `artifacts/api-server/prisma/schema.prisma`
- `artifacts/api-server/src/routes/sections.routes.ts`
- `artifacts/api-server/src/routes/studentGroups.routes.ts`
- `artifacts/api-server/src/controllers/sections.controller.ts`
- `artifacts/api-server/src/controllers/studentGroups.controller.ts`
- `artifacts/university-app/src/pages/sections/SectionManagement.tsx`

---

## Phase 1 — Remove the old system

1. In `schema.prisma`, delete these models entirely: `CourseSection`, `SectionGroupMapping`, `StudentSectionOverride`.
2. Remove every relation field on other models that pointed to the deleted models (check `Course`, `Doctor`, `Student`, `Timetable`/`ScheduleSlot`, and any other model referencing them).
3. Delete `sections.routes.ts` and `sections.controller.ts`.
4. Delete `SectionManagement.tsx` and remove its route/nav-link/import wherever it's registered (router config, sidebar menu, etc).
5. Grep the entire repo (backend and frontend) for these strings and resolve every hit: `CourseSection`, `SectionGroupMapping`, `StudentSectionOverride`, `sections.routes`, `sections.controller`, `SectionManagement`, `getSectionGroups`, `addSectionOverride`. Do not leave any dangling import, unused type, or dead API call.
6. Inspect `studentGroups.routes.ts` / `studentGroups.controller.ts`. Do **not** delete blindly — the alphabetical auto-divide logic there is close to what Phase 2 needs. Plan to rewrite/repurpose it rather than discard it.

---

## Phase 2 — New Prisma schema

Add/modify these models. Keep existing unrelated fields on `Student`/`ScheduleSlot` intact — only add what's listed.

```prisma
model StudentGroup {
  id             Int       @id @default(autoincrement())
  name           String    // e.g. "A", "A1", "A2"
  departmentId   Int
  department     Department @relation(fields: [departmentId], references: [id])
  parentGroupId  Int?
  parentGroup    StudentGroup? @relation("GroupTree", fields: [parentGroupId], references: [id])
  children       StudentGroup[] @relation("GroupTree")
  rangeStartName String    // first student name alphabetically at creation time
  rangeEndName   String    // last student name alphabetically at creation time
  createdAt      DateTime  @default(now())

  students       Student[]
  scheduleSlots  ScheduleSlot[]
}

enum SlotType {
  LECTURE
  SECTION
  LAB
}
```

On `Student`, add:
```prisma
groupId Int?
group   StudentGroup? @relation(fields: [groupId], references: [id])
```

On `ScheduleSlot` (or whatever the existing timetable-slot model is named — check the schema and use the real name), add:
```prisma
slotType SlotType
groupId  Int?
group    StudentGroup? @relation(fields: [groupId], references: [id])
```

Run the migration: `npx prisma migrate dev --name replace_sections_with_group_hierarchy`

---

## Phase 3 — Backend business logic

Build a new `studentGroups` module (routes + controller + a service file for the recursive/tree logic — keep tree math out of the controller).

### 3.1 Initial division
`POST /api/departments/:departmentId/groups/auto-divide`
Body: `{ numberOfGroups?: number, maxGroupSize?: number }` — exactly one of the two must be provided; reject with 400 if both or neither are present.

Logic:
1. If `maxGroupSize` given: `numberOfGroups = Math.ceil(activeStudentCount / maxGroupSize)`.
2. Fetch all active students in the department, sorted alphabetically by name.
3. Create `numberOfGroups` top-level `StudentGroup` rows (`parentGroupId: null`), named `A, B, C, ...` (extend past `Z` with `AA, AB...` if `numberOfGroups > 26`).
4. Distribute students evenly in alphabetical order across the groups. Set `rangeStartName`/`rangeEndName` per group from the first/last student assigned.
5. Set `groupId` on every student.
6. This replaces any existing top-level grouping for the department — if groups already exist, wrap in a transaction and require a `confirmed: true` flag (same pattern as 3.2) before wiping and recreating, since it affects every downstream group/slot.

### 3.2 Splitting a group
`POST /api/groups/:groupId/split`
Body: `{ numberOfSubgroups?: number, maxSubgroupSize?: number, confirmed?: boolean }`

Logic:
1. Same one-of validation as 3.1 for the two sizing params.
2. Check whether this group, or any descendant of it, is referenced by `ScheduleSlot.groupId`. If any are found **and** `confirmed !== true`, return `200` with `{ requiresConfirmation: true, affectedSlots: [...slot summaries...] }` and do **not** modify anything. The frontend will show a warning modal and re-call with `confirmed: true`.
3. If confirmed (or nothing was affected), proceed: fetch students whose `groupId` is currently this group's id, sort alphabetically, create child groups named `${parentName}1`, `${parentName}2`, ... with `parentGroupId` set to this group, set their `rangeStartName`/`rangeEndName`, and reassign those students' `groupId` to the new child groups.
4. The parent group row is kept (it stays in the tree as a non-leaf node) but ends up with zero direct members.

### 3.3 Deleting a group
`DELETE /api/groups/:groupId`
Same `requiresConfirmation` pattern as 3.2 if the group or its descendants are referenced by any `ScheduleSlot`. On confirmed delete, cascade-delete descendant groups and null out `groupId` on any affected students (do not delete students).

### 3.4 New student joins the department
Wherever a student is created/activated in a department that already has groups, run this after the student record exists:
1. Find all current leaf groups in that department (groups with no children, `departmentId` matches).
2. Compare the new student's name against each leaf's `rangeStartName`/`rangeEndName`; assign to the group whose range contains the name.
3. If the name falls before every range or after every range, assign to the nearest boundary group (first or last alphabetically) and extend that group's `rangeStartName`/`rangeEndName` to include the new name.
4. If the department has zero groups yet, leave `groupId: null` — the student will be picked up on the next auto-divide.

### 3.5 Computing attendees for a schedule slot
Given a `groupId`, write a recursive service function:
- If the group has children, return the union of `computeAttendees(child)` for all children.
- If it has no children (leaf), return students where `groupId` equals this group's id.

Use this wherever the app currently derives a section's roster (attendance sheets, exam rosters, etc — grep for existing usages of `CourseSection` students and redirect them through this function).

### 3.6 Tree read endpoint
`GET /api/departments/:departmentId/groups` — return the full group tree for a department (nested `children[]`), each node including `id, name, rangeStartName, rangeEndName, studentCount` (direct count, not recursive).

### 3.7 Manual override
`PUT /api/students/:studentId/group` — Body: `{ groupId: number }`. Lets an admin manually move a single student to any existing group (any level), bypassing the alphabetical logic. No confirmation flow needed here since it targets one student, not a schedule.

---

## Phase 4 — Frontend

1. Replace the deleted `SectionManagement.tsx` with a new page (name it `GroupManagement.tsx`) with a cascading filter: **College → Department only** (no Course, no doctor search — this feature is no longer course-scoped).
2. Render the department's groups as a nested tree of cards (indent children under their parent, or a collapsible tree component). Each card shows: name, direct student count, and a "Split" button.
3. "Split" button opens a modal with a toggle between **"Number of groups"** and **"Max students per group"**, a numeric input for whichever is selected, and calls `POST /api/groups/:groupId/split`. If the response has `requiresConfirmation: true`, show the affected schedule slots and a confirm button that re-submits with `confirmed: true`.
4. Same confirm-modal pattern for group deletion.
5. Top-level "Auto-divide department" action (visible once a department is selected) opens the same number/max-size toggle modal and calls `POST /api/departments/:departmentId/groups/auto-divide`.
6. Update the student profile page/component to show the student's group path as a breadcrumb (e.g. `A → A2`), derived by walking `parentGroup` up from `student.group`.
7. Update the timetable/schedule-slot creation form: add a `slotType` selector (Lecture / Section / Lab) and a group picker scoped to the relevant department, showing the full tree so the admin can pick any node (root for a lecture, a leaf for a section, etc). Wire it to save `slotType` and `groupId` on the slot.

---

## Phase 5 — Validation checklist

Before considering this done, verify all of the following manually or with tests:
- [ ] Auto-dividing a 600-student department into 4 groups produces 4 roughly-equal groups named A–D, alphabetically correct.
- [ ] Auto-dividing by `maxGroupSize` computes the group count correctly and the last group holds the remainder.
- [ ] Splitting group A into 3 subgroups only moves A's direct members, leaves B/C/D untouched, and A itself ends up with zero direct members.
- [ ] Splitting/deleting a group that has zero dependent schedule slots does **not** ask for confirmation.
- [ ] Splitting/deleting a group that has dependent schedule slots returns `requiresConfirmation: true` and makes no changes until confirmed.
- [ ] A new student whose name falls between two leaf groups' ranges is inserted into the correct one.
- [ ] A new student whose name falls before the first range or after the last range is attached to the correct boundary group and that group's range is extended.
- [ ] `computeAttendees` on a root group returns every student under all its descendants; on a leaf group it returns just its direct members.
- [ ] No remaining references anywhere in the codebase to `CourseSection`, `SectionGroupMapping`, `StudentSectionOverride`, or the old sections routes/controller/page.
- [ ] Full typecheck/lint/build passes with no errors.

---

## Notes on ambiguity

If you hit a decision not covered above (e.g. an existing feature besides attendance/exams that reads from `CourseSection`), stop and flag it rather than guessing — list what you found and how you propose to handle it before proceeding.
