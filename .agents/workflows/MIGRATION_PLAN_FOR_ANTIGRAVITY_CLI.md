# University Management System — JS→TS Migration Plan
# For: Antigravity CLI (Autonomous Execution Agent)
# Prepared from: Migration_Report.docx + project_audit_report.md + Spec_auth_controller_EN.md

---

## AGENT IDENTITY & ROLE

You are an autonomous migration agent executing a JavaScript → TypeScript conversion
for a University Management System. You will read this plan top-to-bottom, execute
every step in exact order, verify your own output after each step, and self-correct
before proceeding. You never skip steps. You never batch commits.

---

## CURRENT PROJECT STATE (as of last verified checkpoint)

### What is ALREADY DONE (DO NOT re-convert these):
- `backend/src/app.ts` + `backend/src/server.ts` — running via `tsx`, legacy .js deleted
- `backend/src/utils/` — ALL 13 files converted (swagger, cron, socket, twoFactor.utils,
  notification.utils, redis.utils, logger, jwt.utils, scope.utils, audit.utils,
  catchAsync, appError, prismaClient)
- `backend/src/middleware/` — ALL 5 files converted (error, audit, upload, validate, auth)
- `backend/src/services/` — ALL 3 files converted (user.service, timetable.service, enrollment.service)
- Test suite baseline: **60/60 passing** — this number must never drop

### What REMAINS to be done:
**Phase A — Backend (finish first):**
1. `backend/src/controllers/` (~15 files, largest remaining group)
2. `backend/src/routes/` (depends on controllers — do AFTER controllers)
3. `backend/src/validations/` (independent — do AFTER routes)
4. Backend test files: `students.test.js`, `payments.test.js`, `academic.test.js`

**Phase B — Frontend (start only after Phase A is complete and verified):**
1. `frontend/src/services/` (2 files: api.ts already exists, check others)
2. `frontend/src/context/` (AuthContext.tsx already exists, convert remaining .jsx)
3. `frontend/src/hooks/` (all custom hooks)
4. `frontend/src/utils/` (small utilities)
5. `frontend/src/types/` (interfaces — likely already .ts)
6. `frontend/src/components/` (generic UI components)
7. `frontend/src/pages/` (page-level components — largest group, do last)
8. `frontend/src/App.jsx` → `App.tsx` (entry point — absolute last)

---

## THE GOLDEN RULES (NEVER VIOLATE)

### Rule 1 — Zero Behavior Change
Converting JS to TS means: syntax change only. These MUST remain identical:
- All error messages, character for character
- All HTTP status codes (401, 403, 404, 409, 500, etc.)
- All conditional logic order
- All cookie/header extraction order
- All Redis call conditions and sequences
- All Prisma query structures
- All environment variable references (do NOT add or remove)

### Rule 2 — Flag, Never Auto-Fix Bugs
If you discover during typing:
- A type mismatch that could be a bug (e.g., `string === number`)
- A fallback that returns broader permissions than expected
- A missing null/undefined guard on critical data
- An environment variable used without existence check

→ **STOP. Do NOT fix it automatically.**
→ Write it to `Result.md` under "Potential Pre-Existing Issue — NOT FIXED"
→ Wait for user confirmation before proceeding past that file

### Rule 3 — No Auto-Bundled Changes
If you find yourself editing anything outside the file you are currently converting
(test files, configs, other source files) — STOP and ask explicitly.

### Rule 4 — Duplicate File Handling
Three duplicate pairs exist (JS+TS version of same file):
- `frontend/src/context/AuthContext.jsx` + `AuthContext.tsx` → keep .tsx, delete .jsx
- `frontend/src/services/api.js` + `api.ts` → keep .ts, delete .js
- These were NOT yet deleted — delete them only after verifying the .ts/.tsx version is complete

### Rule 5 — Frontend Dynamic Imports Stay Extensionless
In `frontend/src/App.jsx` (→ App.tsx), all `React.lazy(() => import('./pages/...'))` paths
MUST remain extensionless. Do NOT add `.tsx` or `.jsx` extensions. Vite handles resolution.

---

## THE STANDARD VERIFICATION LOOP
### (Run this after EVERY single file conversion, no exceptions)

```
STEP 1 — TYPE CHECK:
  cd backend/   (or frontend/)
  npx tsc --noEmit
  → REQUIRED: zero errors, zero warnings
  → If errors exist: fix them NOW before proceeding

STEP 2 — TEST SUITE:
  npm test
  → REQUIRED: same number passing as before this conversion
  → Backend baseline: 60/60
  → If count drops: STOP — do not proceed — diagnose and fix

STEP 3 — RUNTIME CHECK:
  npm run dev
  → REQUIRED: server/app starts without errors
  → Check the specific endpoint or component affected by this file

STEP 4 — COMMIT (only after steps 1-3 all pass):
  git add <converted_file>
  git rm <old_js_file>   (only after verification)
  git commit -m "refactor(<layer>): convert <filename>.js to TypeScript (no behavior change)"
  → If a bug was found and fixed separately: separate commit labeled "fix(<layer>): ..."
```

---

## PHASE A — BACKEND CONTROLLERS

### Pre-Conversion Inventory (do this FIRST before touching any file)
Before converting any controller, run:
```bash
ls backend/src/controllers/
```
Then for each file, determine:
1. Does it use `req.user`? (needs Express Request augmentation from auth.middleware.ts)
2. Does it call Redis directly? (needs ioredis types)
3. Does it use JWT directly? (or via jwt.utils.ts?)
4. Does it handle file uploads? (multer types needed)
5. Does it use 2FA/speakeasy?

### Controller Conversion Order (dependency-safe)
Convert in this order — leaf controllers first, auth last:

```
TIER 1 — Lowest risk (read-only, no auth complexity):
  □ department.controller.js
  □ college.controller.js
  □ course.controller.js

TIER 2 — Standard CRUD with auth scope:
  □ user.controller.js
  □ student.controller.js
  □ schedule.controller.js
  □ timetable.controller.js
  □ enrollment.controller.js
  □ transcript.controller.js

TIER 3 — Complex business logic:
  □ notification.controller.js
  □ payment.controller.js
  □ exam.controller.js
  □ quiz.controller.js

TIER 4 — Security-critical (LAST, maximum scrutiny):
  □ auth.controller.js  ← SPECIAL RULES BELOW
```

### Special Rules for auth.controller.js (HIGHEST PRIORITY FILE)
This file handles login, registration, JWT issuance, 2FA, and token refresh.
Follow the Spec exactly:

**STEP A1 — READ ONLY FIRST:**
Display the FULL content of auth.controller.js without summarizing.
List all function names present.
For each function, determine:
- Does it return a JWT or set cookies/headers?
- Does it hash or compare passwords?
- Does it read/write Redis (blacklist/session)?
- Does it call Prisma directly or via a service?
Then STOP and report findings before proceeding.

**STEP A2 — CONVERSION:**
Allowed changes only:
- `require()` → `import`
- `module.exports` → `export`
- Add parameter types, return types, Express generics
- Add interfaces for request bodies (e.g., `LoginRequestBody`)
- Use existing `req.user` augmentation from `auth.middleware.ts` — do NOT create a second copy

NOT allowed:
- Changing token extraction order
- Changing error message text
- Changing status codes
- Changing 2FA sequence
- Changing Redis call conditions
- Changing SUPER_ADMIN bypass logic

**STEP A3 — RESULT REPORTING:**
After auth.controller.ts is verified, write to `Result.md`:
```
## auth.controller.ts — Conversion Result
### Functions converted: [list]
### Behavior verification:
- tsc --noEmit: [PASS/FAIL]
- npm test: [X/X passing]
- Live login test (valid creds): [status + body shape]
- Live login test (invalid creds): [error message + status code]
### Potential Pre-Existing Issues: [list or "None found"]
### Ready for commit: [YES / NO — pending user decision]
```

---

## PHASE A — BACKEND ROUTES

Convert only AFTER all controllers are converted and verified.

```
□ auth.routes.js
□ user.routes.js
□ student.routes.js
□ department.routes.js
□ college.routes.js
□ course.routes.js
□ enrollment.routes.js
□ timetable.routes.js
□ schedule.routes.js
□ transcript.routes.js
□ notification.routes.js
□ payment.routes.js
□ exam.routes.js
□ quiz.routes.js
```

Routes are typically low-complexity — mostly `Router()` declarations calling controllers and middleware.
Types needed: `express.Router`, `RequestHandler` where applicable.

---

## PHASE A — BACKEND VALIDATIONS

Convert only AFTER routes are done.

```
□ (list all files in backend/src/validations/ — inventory first)
```

These use `express-validator`. Types come from `@types/express-validator` if not already installed.
Check: `npm list @types/express-validator` before converting.

---

## PHASE A — BACKEND TEST FILES

Convert only AFTER all production code in backend is converted.

```
□ backend/tests/students.test.js
□ backend/tests/payments.test.js
□ backend/tests/academic.test.js
□ backend/tests/helpers/ (if any)
```

**CRITICAL for test tsconfigs:**
Jest, Cypress, and Playwright define conflicting globals (`test`, `expect`, `describe`).
When adding TypeScript to backend test files:
- Verify `backend/tsconfig.json` has `"exclude": ["tests/"]` OR
- Verify backend test tsconfig uses `"types": ["jest"]` only — not Cypress or Playwright globals
- Do NOT modify frontend tsconfig when working on backend tests

---

## PHASE B — FRONTEND

Start Phase B ONLY after Phase A is 100% complete with `npx tsc --noEmit` clean.

### Frontend Foundation Check (do this before any frontend conversion)
```bash
cd frontend/
npx tsc --noEmit
```
Note the current error count. This is your baseline.
The goal: reduce to zero by end of Phase B.

### Frontend tsconfig Rules
- `frontend/tsconfig.json`: currently has `strict: false` — keep it false during migration
- Enable `strict: true` only AFTER all files are converted
- `"module": "ESNext"` and `"moduleResolution": "Bundler"` — correct for Vite, do NOT change

### Duplicate Cleanup (do this first in frontend)
```bash
# Verify .tsx version is complete and more recent:
diff frontend/src/context/AuthContext.jsx frontend/src/context/AuthContext.tsx
diff frontend/src/services/api.js frontend/src/services/api.ts

# If .tsx/.ts version is complete:
git rm frontend/src/context/AuthContext.jsx
git rm frontend/src/services/api.js
git commit -m "chore(frontend): remove duplicate JS/JSX files superseded by TS versions"
```

### Frontend Conversion Order

```
TIER 1 — Pure types and utilities (zero dependencies):
  □ frontend/src/types/*.ts     (likely already .ts — verify and complete if needed)
  □ frontend/src/utils/*.js     → .ts

TIER 2 — Services and hooks:
  □ frontend/src/services/*.js  → .ts  (api.ts already done)
  □ frontend/src/hooks/*.js     → .ts

TIER 3 — Context providers:
  □ frontend/src/context/*.jsx  → .tsx  (AuthContext.tsx already done)

TIER 4 — Components (bottom-up within component tree):
  □ frontend/src/components/ui/     (generic atoms: Button, Badge, Input, etc.)
  □ frontend/src/components/layout/ (AppShell, Header, Sidebar)
  □ frontend/src/components/        (remaining composite components)

TIER 5 — Pages (most complex, most dependencies):
  □ frontend/src/pages/*.jsx    → .tsx
  (convert one page at a time, verify after each)

TIER 6 — Entry point (absolute last):
  □ frontend/src/App.jsx        → App.tsx
  □ frontend/src/main.jsx       → main.tsx (if exists)
```

### Frontend Type Rules

For React components, use these patterns consistently:

```typescript
// Functional components
const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => { ... }
// OR (preferred in modern React):
function MyComponent({ prop1, prop2 }: Props) { ... }

// Event handlers
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => { ... }
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... }
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => { ... }

// useState with explicit type when not inferable:
const [user, setUser] = useState<User | null>(null);

// useRef:
const inputRef = useRef<HTMLInputElement>(null);
```

### React Hook Form + Zod (already in project — use existing patterns)
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
type FormData = z.infer<typeof schema>;

const { register, handleSubmit } = useForm<FormData>({ resolver: zodResolver(schema) });
```

### Axios Service Types
```typescript
// frontend/src/services/api.ts pattern
import axios, { AxiosResponse } from 'axios';

interface LoginResponse { token: string; user: User; }
export const login = (data: LoginRequest): Promise<AxiosResponse<LoginResponse>> =>
  api.post('/auth/login', data);
```

---

## PHASE B — FRONTEND VERIFICATION

After all frontend files are converted:

```bash
cd frontend/
npx tsc --noEmit     # must be zero errors
npm run build        # must complete without errors (Vite production build)
npm run dev          # must start and app must be navigable
```

Run through these manually:
- Login with valid credentials → confirm same UI behavior
- Login with invalid credentials → confirm same error display
- Navigate to at least 3 different pages → confirm no runtime errors in console

---

## FINAL PHASE — STRICT MODE ENABLEMENT

After both frontend and backend are 100% converted and verified:

### Backend
```json
// backend/tsconfig.json
{
  "compilerOptions": {
    "strict": true   // was already true — verify it stayed true throughout
  }
}
```

### Frontend
```json
// frontend/tsconfig.json
{
  "compilerOptions": {
    "strict": false  // change to true HERE — this is the only place it changes
  }
}
```

After enabling `strict: true` in frontend:
```bash
npx tsc --noEmit
```
Fix ALL errors before considering migration complete.
Common strict-mode errors to expect:
- `Object is possibly 'null'` → add null guards or `!` assertions where safe
- `Parameter implicitly has 'any' type` → add explicit types
- `Type 'X | undefined' is not assignable to type 'X'` → add defaults or guards

---

## FINAL VERIFICATION CHECKLIST

Before declaring the migration complete:

```
□ npx tsc --noEmit (backend) — zero errors
□ npx tsc --noEmit (frontend) — zero errors
□ npm test (backend) — 60/60 (or more) passing
□ npm run build (frontend) — zero errors
□ npm run dev (full stack) — server boots, app loads
□ No .js or .jsx files remain in backend/src/ (except intentional exceptions)
□ No .js or .jsx files remain in frontend/src/ (except intentional exceptions)
□ Result.md documents all potential pre-existing issues found
□ All behavior-change commits are labeled separately from conversion commits
□ Git log shows one commit per file (never batched)
```

---

## RESULT.md FORMAT (maintain this file throughout)

Create and update `Result.md` at the root as you progress:

```markdown
# Migration Result Log

## Completed Files
| File | tsc | Tests | Runtime | Commit |
|------|-----|-------|---------|--------|
| auth.controller.ts | PASS | 60/60 | PASS | abc1234 |
| ... | | | | |

## Potential Pre-Existing Issues (NOT FIXED — awaiting user decision)
### Issue #1 — [filename]
- Location: [file:line]
- Description: [what was found]
- Why not auto-fixed: [reason]
- Recommended action: [suggestion]

## Behavior Changes (separately committed, explicitly approved)
### Change #1 — [short title]
- Commit: [hash]
- Description: [what changed and why]
```

---

## KNOWN ISSUES FROM PREVIOUS MIGRATION (already fixed — do NOT re-fix)

The following bugs were already found and committed during the backend utils/services phase.
They are documented here so you do not re-flag them as new issues:

1. **notification.utils.ts** — `parseInt(departmentId)` vs raw string comparison → FIXED
2. **scope.utils.ts** — empty `{}` fallback granting unrestricted Prisma access → FIXED (now returns `{ id: -1 }`)
3. **cron.ts** — stale `courses` relation (should be `enrollments → course`) → FIXED
4. **enrollment.service.ts** — capacity count included historical records → FIXED
5. **enrollment.service.ts** — WITHDRAWN status blocked re-enrollment → FIXED

---

## START COMMAND

When you are ready to begin, run:
```bash
# Verify current state first
cd backend && npx tsc --noEmit && npm test
```
If output is: zero tsc errors + 60/60 tests → proceed to Phase A, Tier 1 controllers.
If output differs → STOP and report the discrepancy before touching any file.
