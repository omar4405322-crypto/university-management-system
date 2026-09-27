# Application and Database Rollback Playbook

**Classification:** Internal Production Operations Guide  
**Governing Finding:** [OPS-001] (High Severity)  
**Last Updated:** 2026-09-17  

---

## 1. Rollback Decision Framework

A rollback decision must be made when any of the following triggers occur post-deployment:
1. **Health check failures:** API or Web container fails health probes repeatedly for > 3 minutes.
2. **Crash loops / Unhandled exceptions:** Critical routes (Auth, Attendance, Grading) return 500 errors exceeding 1% threshold.
3. **Severe data corruption / Invariant violation:** Database constraint failures or balance reconciliation mismatches.
4. **Catastrophic performance degradation:** P95 response latency exceeds 5 seconds across standard endpoints.

**Incident Roles:**
* **Incident Commander (Lead Engineer / DevOps):** Responsible for executing rollback steps.
* **Lead Architect:** Evaluates whether forward-fix or database rollback is required.

---

## 2. Case A: Application-Only Rollback (No Breaking Database Changes)

When the deployed code introduced a defect but database migrations are backwards-compatible (or no migration was executed):

### Step 2.1: Identify Previous Working Release
```bash
# Check Docker image tags or git commits
git log -n 5 --oneline
# Identify previous known good release, e.g.: fe06ca1c
PREV_COMMIT="fe06ca1c"
```

### Step 2.2: Revert Application Containers
```bash
# Option 1: Using tagged Docker images (Recommended for instant zero-rebuild rollback)
export API_IMAGE_TAG="v1.0.4"
export WEB_IMAGE_TAG="v1.0.4"
docker compose --env-file deploy.env up -d api web

# Option 2: Checking out previous git commit
git checkout ${PREV_COMMIT}
pnpm install --frozen-lockfile
docker compose --env-file deploy.env up -d --build api web
```

### Step 2.3: Verification Checklist
1. `docker compose --env-file deploy.env ps` -> All containers `healthy`.
2. `curl -f http://localhost:8080/api/healthz` -> Returns 200 OK.
3. Verify Redis connection in API logs: `[REDIS] Connected to instance`.

---

## 3. Case B: Database / Migration Rollback vs Forward-Recovery

### 3.1 The Forward-Fix Principle
**IMPORTANT:** In PostgreSQL and Prisma environments, **forward-fixing is generally safer than rolling back migrations**.
* Rolling back a migration that dropped columns or altered types irreversibly loses newly written data.
* Prisma does not automatically generate "down" migrations; attempting manual `ALTER TABLE` operations on a live production schema without testing carries severe risk of table lockouts and constraint violations.

### 3.2 Decision Tree: Down-Migration vs Forward-Fix
```text
                     Did the migration corrupt/destroy data?
                                    |
                    +---------------+---------------+
                    |                               |
                   YES                             NO
                    |                               |
        Can a forward-fix script         Can the previous app
        correct the schema/logic?        work with current DB?
                    |                               |
           +--------+--------+             +--------+--------+
           |                 |             |                 |
          YES                NO           YES                NO
           |                 |             |                 |
     [Forward-Fix]     [Restore DB    [Roll back app   [Forward-Fix
     Apply patch via    from pre-      only; leave DB   DB patch, then
     migrate deploy]   release dump]   schema intact]   roll back app]
```

### 3.3 Emergency Migration Reversion Procedure
If a database down-migration is unavoidable:
1. **Stop Application Traffic:**
   ```bash
   docker compose --env-file deploy.env stop api
   ```
2. **Execute Targeted Down-SQL Script:**
   Inspect the problematic migration in `artifacts/api-server/prisma/migrations/<timestamp>_<name>/migration.sql`.
   Draft an exact inverse script `revert_<name>.sql` and apply via `psql`:
   ```bash
   psql -h localhost -U university -d university -f revert_<name>.sql
   ```
3. **Synchronize Prisma Migration History:**
   Mark the migration as rolled back in `_prisma_migrations`:
   ```sql
   DELETE FROM "_prisma_migrations" WHERE migration_name = '<timestamp>_<name>';
   ```
4. **Deploy Compatible Application Version:**
   ```bash
   docker compose --env-file deploy.env up -d api
   ```

---

## 4. Post-Rollback Communication & RCA

1. Notify operations and stakeholder channel of completed rollback.
2. Preserve container logs and error dumps for Root Cause Analysis:
   ```bash
   docker compose --env-file deploy.env logs --tail=5000 api > incident_api_failure.log
   ```
3. Schedule post-incident blameless post-mortem within 24 hours.
