# Disaster Recovery (DR) Plan & Incident Response Runbook

**Classification:** Internal Production Operations Guide  
**Governing Finding:** [OPS-001] (High Severity)  
**Last Updated:** 2026-09-17  

---

## 1. Disaster Recovery Overview

This document outlines the end-to-end procedures for restoring the University Management System in the event of catastrophic infrastructure loss, severe data corruption, or total datacenter failure.

* **Target RPO (Data Loss Window):** < 1 Hour
* **Target RTO (Total Outage Duration):** < 30 Minutes

---

## 2. Disaster Recovery Scenarios & Execution Playbooks

### Scenario 1: Total Host Server Failure (Hardware Destruction / Host Loss)

When the host machine running the Docker stack is permanently destroyed:

1. **Provision New Compute Node:**
   * OS: Ubuntu 22.04 LTS or Debian 12
   * Install Docker Engine & Docker Compose (v2.20+)
   * Ensure ports 80/443 are open to ingress reverse proxy.

2. **Retrieve Authoritative Secrets & Configuration:**
   * Retrieve production `deploy.env` from encrypted secrets manager (e.g. AWS Secrets Manager / Vault):
     - `POSTGRES_PASSWORD`
     - `JWT_SECRET`
     - `ENCRYPTION_KEY`
     - `PUBLIC_ORIGIN`

3. **Deploy Codebase:**
   ```bash
   git clone <REPOSITORY_URL> /opt/university-system
   cd /opt/university-system
   cp /secure/retrieved/deploy.env .
   ```

4. **Retrieve Latest Off-Host Backups:**
   ```bash
   mkdir -p /var/backups/university/{db,media}
   
   # Download latest encrypted backups from remote object storage:
   aws s3 cp s3://institution-university-backups/db/latest.dump /var/backups/university/db/
   aws s3 cp s3://institution-university-backups/db/latest.dump.sha256 /var/backups/university/db/
   aws s3 cp s3://institution-university-backups/media/latest.tar.gz /var/backups/university/media/
   ```

5. **Bootstrap Database & Restore Relational State:**
   ```bash
   # Start DB container only
   docker compose --env-file deploy.env up -d db
   
   # Wait for PostgreSQL healthcheck to report healthy
   docker compose --env-file deploy.env ps db
   
   # Execute restore
   docker compose --env-file deploy.env exec -T db pg_restore \
     -U "${POSTGRES_USER:-university}" \
     -d "${POSTGRES_DB:-university}" \
     --clean --if-exists --no-owner --no-privileges \
     < /var/backups/university/db/latest.dump
   ```

6. **Restore Persistent Media Files:**
   ```bash
   # Extract media into docker volume or uploads directory
   tar -xzf /var/backups/university/media/latest.tar.gz -C ./
   ```

7. **Launch Full Stack & Run Schema Migration Check:**
   ```bash
   docker compose --env-file deploy.env up -d
   
   # Confirm migration status
   docker compose --env-file deploy.env exec api npx prisma migrate status
   ```

8. **Execute Smoke Tests:**
   * Verify `/api/healthz` returns `{"status":"ok"}`.
   * Log in with test administrative credentials.
   * Verify student record and course schedules load correctly.

---

### Scenario 2: Severe Data Corruption or Accidental Table Dropping

When the database engine remains running, but critical tables were accidentally altered or truncated:

1. **Immediately Freeze Ingress Traffic (Maintenance Mode):**
   ```bash
   # Stop API to prevent user writes to corrupted state
   docker compose --env-file deploy.env stop api
   ```

2. **Snapshot Corrupted State (Forensics & Salvage):**
   Before touching the database, take a raw copy of the current state:
   ```bash
   ./scripts/operations/db-backup.sh
   mv /var/backups/university/db/*_latest.dump /var/backups/university/db/forensic_corrupted_snapshot.dump
   ```

3. **Restore to Staging First:**
   Follow Section 4 of `docs/operations/BACKUP-RESTORE.md` to restore the last clean backup into a temporary database (`university_salvage`) and confirm table contents.

4. **Restore to Production:**
   ```bash
   ./scripts/operations/db-restore.sh \
     --backup=/var/backups/university/db/university_last_known_good.dump \
     --target-db=university \
     --force-production
   ```

5. **Restart Application & Re-open Traffic:**
   ```bash
   docker compose --env-file deploy.env start api
   ```

---

## 3. Post-Disaster Audit & Incident Sign-Off

Before declaring incident resolution:
1. Verify database record counts against historical metrics.
2. Confirm Redis has reconnected and rate limiters are active.
3. Review `AuditLog` table entries leading up to the incident.
4. Notify institution administration and technical leadership.
