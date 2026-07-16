# Task: Close Remaining Gaps and Verify Full Compliance with the Original Spec

You reported "All 9 fixes are applied," but the verification step is still marked `[/]` (in progress), not `[x]`. Do not mark this task complete yet. Before doing anything else, answer the questions in Part A below directly in your response — do not guess or silently decide on my behalf. Then proceed to Part B.

---

## Part A — Questions I need answered (do not proceed to fixes until you've answered these)

1. **`sessionType` vs `slotType`**: You said the edit accidentally replaced the `sessionType` selector with `slotType` in `ScheduleModal.tsx`, and you "added `sessionType` back as a separate row" so both now exist. Before I accept that:
   - What does `sessionType` actually represent in the current schema/form — is it a different concept from `slotType` (Lecture/Section/Lab), or is it a leftover field from the old `CourseSection` system that should have been removed in Phase 1?
   - If it's a leftover, list every place `sessionType` is still referenced (schema, controller, frontend) so we can decide whether to remove it.
   - If it's genuinely a separate concept, explain what it controls and why both fields need to coexist on the same slot.

2. **Breadcrumb depth**: The `parentGroup` include you added to `user.controller.ts` — is it a fixed-depth nested `include` (e.g. one or two levels hardcoded), or does it actually walk an arbitrary-depth tree? Groups can nest arbitrarily (`A → A1 → A1a → ...`). Show me the actual Prisma query and confirm how many levels deep it resolves. If it's fixed-depth, propose a fix (recursive query, raw SQL, or iterative lookups) and implement it.

3. **Dangling section references**: You found two pre-existing dangling references during typecheck:
   - `AttendancePage.tsx:86` — `setSelectedSectionId` is undefined
   - `SlotModal.tsx:69` — `Property 'sections' does not exist on type 'Course'`

   These are exactly the kind of leftover Phase 1 was supposed to eliminate ("Grep the entire repo... do not leave any dangling import, unused type, or dead API call"). Were these missed during the original Phase 1 pass, or did they get reintroduced later? Either way — fix both now. Show me the diff for each.

---

## Part B — Full re-verification against the original Phase 5 checklist

The original task had a full validation checklist that is broader than the 9 bugs you just fixed. Go through **every item below** and report pass/fail with evidence (file/line, command output, or test result) for each — not just a summary:

- [ ] Auto-dividing a 600-student department into 4 groups produces 4 roughly-equal groups named A–D, alphabetically correct.
- [ ] Auto-dividing by `maxGroupSize` computes the group count correctly and the last group holds the remainder.
- [ ] Splitting group A into 3 subgroups only moves A's direct members, leaves B/C/D untouched, and A itself ends up with zero direct members.
- [ ] Splitting/deleting a group with zero dependent schedule slots does **not** ask for confirmation.
- [ ] Splitting/deleting a group with dependent schedule slots returns `requiresConfirmation: true` and makes no changes until confirmed.
- [ ] A new student whose name falls between two leaf groups' ranges is inserted into the correct one.
- [ ] A new student whose name falls before the first range or after the last range is attached to the correct boundary group, and that group's range is extended.
- [ ] `computeAttendees` on a root group returns every student under all descendants; on a leaf group it returns just its direct members.
- [ ] **No remaining references anywhere in the codebase** to `CourseSection`, `SectionGroupMapping`, `StudentSectionOverride`, `sections.routes`, `sections.controller`, `SectionManagement`, `getSectionGroups`, `addSectionOverride`. Run a fresh repo-wide grep for each string individually and paste the results (should be empty, or only in migration history / changelog files).
- [ ] Full **typecheck** passes on both `api-server` and `university-app` with zero errors.
- [ ] Full **lint** passes on both projects with zero errors.
- [ ] Full **build** succeeds on both projects.

For the three items involving actual data behavior (auto-divide, split, attendee computation, alphabetical edge insertion), don't just eyeball the code — run them (via a test script, seed + manual API call, or existing test suite) and paste actual output, not just "looks correct."

---

## Part C — Explicit re-check of the 9 fixes you already made

For each of the 9 fixes, paste the actual diff (not a description) so I can review it directly:

1. Missing `X` import in `GroupManagement.tsx`
2. Frontend API URL mismatch in `studentGroups.service.ts`
3. Auto-divide modal toggle (only one of `numberOfGroups`/`maxGroupSize` sent)
4. Split modal toggle (same one-of constraint)
5. `requiresConfirmation` handling in frontend — confirm it shows the affected slots and re-submits with `confirmed: true`, and that it does **not** silently retry without showing the warning
6. `slotType` selector in `ScheduleModal.tsx` (pending resolution of Question 1 above)
7. Group breadcrumb in profile (pending resolution of Question 2 above)
8. Seed file schema fix
9. Tree rendering property names in `GroupManagement.tsx`

---

## Rules

- Do not mark anything `[x]` in `task.md` until you have both the evidence and, where relevant, my confirmation on Questions 1–3.
- If you find any further ambiguity or a decision not covered by the original spec or this prompt, **stop and flag it** — list what you found and your proposed options — rather than picking one silently.
- Once Parts A–C are complete, give me a final summary table: checklist item → pass/fail → evidence reference. This is the only thing that should determine whether the task is actually done.
