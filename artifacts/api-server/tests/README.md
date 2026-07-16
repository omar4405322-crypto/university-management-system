# Integration Tests

## `integration_test.mjs`

Self-contained integration test suite for the University Management System API.

### Prerequisites

- API server running on `http://localhost:5000`
- PostgreSQL accessible (credentials from `.env`)
- Node.js ≥ 18

### How to run

```bash
# From the api-server directory:
node tests/integration_test.mjs
```

> **Tip:** If you see sequence collision errors on fresh data, the test handles them internally. If you hit PostgreSQL sequence drift after manual DB changes, reset with:
> `SELECT setval(pg_get_serial_sequence('"ModelName"', 'id'), MAX(id)) FROM "ModelName";`

### What it tests (13 scenarios)

| ID | Scenario |
|----|----------|
| A | IDOR: student can only see their own attendance (userId ≠ studentId verified) |
| B1 | IDOR: doctor blocked from `recordAttendance` on another doctor's course → 403 |
| B2 | IDOR: doctor blocked from `getCourseAttendance` on another doctor's course → 403 |
| C | Duplicate attendance: two POSTs same student/course/date → upsert, 1 DB row |
| D | Excused absence excluded from percentage denominator (formula: `(P + L×0.5) / (total - E)`) |
| E1 | Auto-block: enrollment → BLOCKED when absence rate exceeds policy threshold |
| E2 | Admin unblock via `POST /attendance/unblock/:enrollmentId` |
| F1 | Override frees original room: new slot in base-slot room succeeds when active override moved it |
| F2 | Override occupies new room: new slot in overridden room rejected with 409 |
| G | Race condition: concurrent `Promise.all` bookings → exactly 1 succeeds, 1 rejected (409) |
| H1 | Doctor creates schedule change request for their own section → 201 |
| H2 | Doctor blocked from requesting change for another doctor's section → 403 |
| H3 | Admin approves request → slot created atomically, request.status = APPROVED |

### Data isolation

All test data uses prefix patterns:
- Users: `test_*@test.com`
- Courses: `__TC*` course codes

Cleanup runs before **and** after every test run — the DB is restored to a clean state automatically.
