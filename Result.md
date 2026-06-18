# Migration Result Log

## Completed Files
| File | tsc | Tests | Runtime | Commit |
|------|-----|-------|---------|--------|
| auth.controller.ts | PASS | 60/60 | PENDING | PENDING |

## Potential Pre-Existing Issues (FIXED)
### Issue #1 — getRequests (Fallback Bug)
- Location: `backend/src/controllers/auth.controller.ts` in `getRequests` function
- Description: Fallback logic that returns broader permissions than expected. If the requesting user is a `COLLEGE_ADMIN` or `DEPARTMENT_ADMIN` but their corresponding `doctor` or `departmentId` profiles do not exist, the `where` condition remained empty (`{}`), inadvertently returning **ALL** requests.
- Resolution: User approved immediate fix. Added `AuthorizationError` to block the fallback gracefully.

## Behavior Changes (separately committed, explicitly approved)
- `fix(controllers): secure getRequests fallback in auth.controller`
