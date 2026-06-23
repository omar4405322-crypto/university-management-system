---
name: Prisma v6 cascades and sequences
description: Which models need explicit onDelete:Cascade and the doctor_id_seq pre-requirement.
---

## Rule
Prisma v6 requires explicit `onDelete: Cascade` on FK relations — it does NOT default to cascade. Child models that must be explicitly set: `Attendance`, `Payment`, `QuizSubmission`, `TaskSubmission`.

**Why:** Without cascades, deleting a Student or Course leaves orphan rows and causes FK constraint violations.

**How to apply:** In `schema.prisma`, every `@relation` on those child models pointing to Student or Course must include `onDelete: Cascade`.

## Sequences
The `doctor_id_seq` PostgreSQL sequence must exist before `prisma db push` on a fresh DB. Run:
```sql
CREATE SEQUENCE IF NOT EXISTS doctor_id_seq;
```
This is in `artifacts/api-server/prisma/setup-sequences.sql`. Use `pnpm --filter @workspace/db run db:setup` before `db:push`.
