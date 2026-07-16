# Task: Final Reconciliation, Safety Checkpoint & Full Re-Verification

This session has already gone through multiple rounds of self-reported "done"/"clean" claims that turned out to be wrong (a hallucinated checklist pulling in concepts from a different task, a migration that was reported as safe while the DB was actually out of sync, a `git restore` that silently wiped uncommitted schema changes, typecheck claims made before a file was even fully written). We are not accepting narrative claims anymore. Every statement of "pass," "done," "clean," "N/A," or "fixed" in your response **must be immediately followed by the actual pasted command output or diff that proves it, in the same message**. A summary without pasted evidence will be rejected and sent back.

Work through the steps below **in order**. Do not skip ahead. Do not mark anything `[x]` in `task.md` until Step 6 is complete and I have reviewed it.

---

## Ground rules (apply to every step, no exceptions)

1. **No hedging language.** Do not write "should work," "likely," "probably," "looks correct," "will function normally." If you don't have direct evidence, write "unverified" and go get the evidence before continuing.
2. **Single source of truth for scope.** The only document defining what "done" means is the attached `cursor_implementation_prompt.md`. Do not reconstruct checklists from memory, from a different file, from any cached task log, or from any other tool/session context (e.g. anything under an IDE's internal `task-*.log`, `transcript.jsonl`, or similar). If you quote a requirement, quote it verbatim from that file and nothing else.
3. **No silent decisions.** If you hit anything the original spec doesn't explicitly cover — including semantic/data-mapping decisions, not just structural ones — stop, list what you found, list the options, and wait for my answer before proceeding.
4. **Evidence must be fresh.** Re-pasting an earlier run from this conversation is not acceptable evidence for a new claim. If a check needs re-verifying, re-run it now and paste the new output.

---

## Step 0 — Safety checkpoint (do this first, before touching any code)

A prior `git restore .` in this task silently destroyed uncommitted Phase 2 schema changes and caused several hours of downstream confusion. We are not repeating that.

1. Run `git status --porcelain` and `git status` (full) — paste both, verbatim.
2. If there are any uncommitted changes that represent real, working progress (which there almost certainly are), **create a commit now** on the current branch (or a clearly named WIP branch) before doing anything else in this task. Paste the commit hash and `git show --stat HEAD`.
3. From now on in this task, do not run any destructive git command (`restore`, `checkout -- <path>`, `clean -fd`, `reset --hard`, stash operations that discard) without first pasting `git status` and explicitly stating what will be lost if it goes wrong.

---

## Step 1 — Ground-truth snapshot

Paste the raw output of each of these, in this order, before making any further changes:

1. `git log --oneline -20`
2. `git stash list`
3. `git diff --stat HEAD`
4. `ls prisma/migrations | tail -10` (or the Windows equivalent) — confirm the migration folder sequence is clean, sequential, and has no duplicate/orphaned/partial folders left over from the earlier failed `remove_session_type` attempts.
5. `npx prisma migrate status`
6. `tsconfig.json` contents for `api-server`, and the equivalent for `university-app` — paste the `include`/`exclude`/`files` fields specifically. We need to confirm typecheck isn't silently skipping any path, since that blind spot already caused one false "clean" claim earlier in this task.

---

## Step 2 — Confirm no regression from the earlier `git restore` incident

The earlier accidental `git restore .` wiped the `StudentGroup` model at one point mid-task. Before trusting anything else, confirm the full Phase 2 schema is actually present and correct right now:

1. Paste the full current `schema.prisma` content for the `StudentGroup` model, the `SlotType` enum, and the `groupId`/`group` fields on `Student` and the schedule-slot model.
2. Confirm `sessionType` is fully absent from `schema.prisma` (not just visually — grep for it, see Step 3.2 below).
3. Confirm the migrations directory actually contains a migration that created `StudentGroup` and one that dropped `sessionType` from the DB (not just from the schema file). Paste `npx prisma migrate status` again here explicitly showing "Database schema is up to date."

---

## Step 3 — Close the specific open items from this task

For each item, paste the diff and the verification command output. Do not just describe the fix.

### 3.1 — `ActionMenu` import in `GroupManagement.tsx`
- Run `git log -p --follow -- <path-to>/GroupManagement.tsx` and identify the exact point the `ActionMenu` reference was introduced without its import. State plainly: did it exist before your earlier "our edits are clean" claim, or was it introduced by a later edit (e.g. the `sessionType`/breadcrumb changes touching that file)?
- Paste the diff that adds the missing import.
- Paste a fresh `tsc --noEmit` filtered to just this file (e.g. `| grep GroupManagement`) showing zero errors for it specifically.

### 3.2 — `sessionType` full removal
- Paste `git grep -in "sessionType"` across the **entire repo** (backend + frontend + migrations). Expected: empty, except inside historical migration `.sql` files (which are immutable history and fine to keep).
- Paste `npx prisma migrate status` confirming DB and schema are in sync (already requested in Step 1/2, but repeat here so this item is self-contained).

### 3.3 — `SEMINAR`/`TUTORIAL` → `SECTION` mapping (unresolved semantic question)
This was a judgment call you made unilaterally with a regex, not something the original spec specified. Before treating it as settled:
- Paste `git diff` for every single file this regex touched, so each substitution site can be reviewed individually.
- Confirm none of the replacements are partial-identifier matches (e.g. something like `sessionTypeahead`, `mySessionTypeHandler`) — scan the diff and state this explicitly rather than asserting it.
- State clearly: is collapsing both `SEMINAR` and `TUTORIAL` into `SECTION` actually the right semantic mapping for this app (as opposed to, say, `SEMINAR` → `LECTURE`)? If you're not certain, flag it as an open question for me instead of defending the choice — do not silently finalize a data-semantics decision that could misclassify real slots for attendance purposes.

### 3.4 — Leftover `sectionManagement` i18n keys
- Paste `git grep -n "sectionManagement"` (or the actual key prefix used) across all locale files — expected empty.
- Paste the diff of the removal.

### 3.5 — Dangling references caught by typecheck
- `AttendancePage.tsx` (`setSelectedSectionId` undefined) and `SlotModal.tsx` (`Property 'sections' does not exist on type 'Course'`).
- Paste the diff for each fix.
- Paste a fresh `tsc --noEmit` output filtered to these two filenames, showing zero errors.

### 3.6 — Category-(b) exam errors
- Re-paste the classified list of the ~40 `exams/*` errors with (a) pre-existing / (b) caused-by-this-task labels attached to each individual error (not a blanket statement).
- Paste the diff for every (b) fix applied. Do not touch (a) items — if you're tempted to "clean up while you're in there," stop and list it as a separate out-of-scope item instead.

### 3.7 — Breadcrumb depth (arbitrary-depth tree walk)
- Paste the actual current implementation (Prisma query or service function) that resolves `student.group → parentGroup → ...` for the profile breadcrumb.
- State explicitly: is this a fixed-depth nested `include` (state the exact depth it stops at) or a genuine recursive/iterative walk that works for arbitrary nesting?
- If fixed-depth: fix it now (recursive query, raw SQL parent-chain walk, or iterative lookups — your choice, but it must handle arbitrary depth) and prove it against a test chain at least 4 levels deep (e.g. `A → A1 → A1a → A1a-i`), pasting the resolved breadcrumb output for a student in the deepest group.

---

## Step 4 — Fresh re-verification against the actual original Phase 5 checklist

This is the exact, verbatim checklist from `cursor_implementation_prompt.md`. Do not add sub-phases, do not introduce concepts absent from it (there is no "Course assignment," no "Override System" — groups are department-scoped only, and `StudentSectionOverride` was deleted in Phase 1). Test against **this list and only this list**:

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

For the four data-behavior items (auto-divide ×2, split isolation, alphabetical edge insertion, computeAttendees), **re-run the validation script fresh right now** — do not reuse output from earlier in the conversation — and paste the full console output.

---

## Step 5 — Full grep + typecheck + lint + build, fresh, this message

Run each individually and paste output for each — no truncation (`Select-Object -First 80` or equivalent is not acceptable here; if output is long, paste the full error count plus the distinct list of files with errors):

- `git grep -n "CourseSection"`
- `git grep -n "SectionGroupMapping"`
- `git grep -n "StudentSectionOverride"`
- `git grep -n "sections.routes"`
- `git grep -n "sections.controller"`
- `git grep -n "SectionManagement"`
- `git grep -n "getSectionGroups"`
- `git grep -n "addSectionOverride"`
- `git grep -in "sessionType"`
- `cd artifacts/api-server && npx tsc --noEmit` (full output)
- `cd artifacts/university-app && npx tsc --noEmit` (full output)
- Confirm lint: is there an actual ESLint config (`.eslintrc*` / `eslint.config.*`) present in either project? Paste a directory listing showing presence/absence. Do not add a lint script or config unless I explicitly ask in a later message — if it's genuinely absent, report it as a separate out-of-scope item, not something to silently fix here.
- `npm run build` in both `api-server` and `university-app`, full output, confirm exit code 0 for both.

---

## Step 6 — Final sign-off table

Only after Steps 0–5 are complete with real pasted evidence, produce **one single consolidated table**: checklist item (the real list from Step 4, nothing invented) → pass/fail → evidence reference (which command/diff in this message proves it). This table is the only thing that determines whether `task.md` can be updated — do not touch `task.md` before this table exists and I've reviewed it.

---

## If you hit anything not covered above

Stop. List exactly what you found and the options you see. Wait for my answer. Do not guess, and do not treat a prior unilateral decision (like the `SEMINAR`/`TUTORIAL` mapping) as final just because you already implemented it.
