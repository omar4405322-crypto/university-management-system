# Database Architecture & Migration Guidelines

This document details the database schema conventions, migration procedures, and operational guardrails for the University Management System.

---

## 1. Authoritative ORM & Schema

The system uses **PostgreSQL 16** managed exclusively through **Prisma ORM v6**.

- **Authoritative Schema File:** [`artifacts/api-server/prisma/schema.prisma`](../artifacts/api-server/prisma/schema.prisma)
- **Migration Directory:** `artifacts/api-server/prisma/migrations/`
- **Client Generation:** Run `pnpm --filter @workspace/api-server run prisma:generate` after any schema change.

---

## 2. Migration Workflow & Guardrails

### 2.1 Local Development Workflow
When adding or altering schema models in development:

```sh
# 1. Update schema.prisma
# 2. Generate and apply a new migration locally:
pnpm --filter @workspace/api-server run prisma:migrate
```

This generates a timestamped SQL migration in `artifacts/api-server/prisma/migrations/` and updates the local database.

### 2.2 Production Deployment Workflow
In staging and production environments, migrations are applied non-destructively:

```sh
pnpm --filter @workspace/api-server exec prisma migrate deploy
```

In Docker Compose deployments, this step runs automatically during container initialization prior to starting the web server.

### 2.3 Strict Operational Rule: No Destructive Schema Pushes

> [!CAUTION]
> **Prohibition on `prisma db push` in Production:**  
> `prisma db push` bypasses versioned migrations and can result in silent data loss or table truncation.  
> Never run `prisma db push` against production, staging, or shared database instances. All production schema alterations must be committed as tracked Prisma migrations.

---

## 3. Data Types & Financial Precision

### Monetary Representation
All monetary entities (tuition fees, payment amounts, student account balances) are defined as:
```prisma
amount Decimal @db.Decimal(10, 2)
```
This guarantees exact cent-level arithmetic up to 99,999,999.99, eliminating floating-point rounding errors.

### Academic Grading & Timestamps
- Grades and risk percentages use decimal or integer bounds with application-level validation.
- All timestamps default to `now()` in UTC.

---

## 4. Referential Integrity & Deletion Protection

The database schema enforces data integrity through foreign keys and defensive application guards:

1. **Destructive Deletion Guards:** Critical entities (Colleges, Departments, Users, Courses) cannot be hard-deleted if dependent active enrollments, grades, or transcripts exist.
2. **Compound Unique Constraints:** Prevent duplicate enrollments (`@@unique([studentId, courseId, semester, academicYear])`) and overlapping attendance logs.
3. **Audit Trail:** Historical attendance records, grades, and fee transactions are preserved for compliance and transcript verification.

---

## 5. Backups, Restore & Disaster Recovery

For automated backup scripts, point-in-time restore procedures, and disaster recovery runbooks, refer to:

- [Backup & Restore Runbook](operations/BACKUP-RESTORE.md)
- [Disaster Recovery Runbook](operations/DISASTER-RECOVERY.md)
- [Application & DB Rollback Runbook](operations/ROLLBACK.md)
