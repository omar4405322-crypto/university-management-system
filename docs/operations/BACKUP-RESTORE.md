# Backup and Restore Operational Runbook

**Classification:** Internal Production Operations Guide  
**Governing Finding:** [OPS-001] (High Severity)  
**Last Updated:** 2026-09-17  

---

## 1. Objectives & SLA Targets

* **Recovery Point Objective (RPO):**
  * **Logical Backup Schedule:** **< 1 hour** when using hourly cron schedule (`scripts/operations/crontab.example`); **24 hours** when scheduled daily.
  * **Point-in-Time Recovery (PITR):** **< 5 minutes** when cloud-managed PostgreSQL WAL archiving / continuous backup (e.g. AWS RDS, GCP Cloud SQL, or Railway automated backups) is provisioned at the infrastructure layer.
* **Recovery Time Objective (RTO):**
  * Target: **< 30 minutes** (Automated script restoration via `scripts/operations/db-restore.sh` into cold standby or newly provisioned database).
* **Retention Policy:**
  * Daily backups retained for **14 days**.
  * Weekly backups retained for **8 weeks**.
  * Monthly archives retained for **12 months**.

---

## 2. Backup Topology & Storage Architecture

1. **PostgreSQL Database (`postgres_data`):**
   * Stored locally in `/var/backups/university/db`.
   * Formatted using `pg_dump -Fc` (PostgreSQL Custom Archive format with gzip compression level 9).
   * Accompanied by `.sha256` cryptographic checksum file.
2. **Persistent User Media (`uploads_data` volume):**
   * Located at `/app/uploads` (contains `/materials`, `/tasks`, `/profiles`).
   * Stored in `/var/backups/university/media/media_uploads_<timestamp>.tar.gz`.
   * If external storage (e.g. Cloudinary) is active, assets reside off-host; Cloudinary account backups apply.
3. **Off-Host Replication (Mandatory for True Production):**
   * Backups must be replicated off-host via secure cloud storage sync:
     ```bash
     # Example AWS S3 sync with Server-Side Encryption (SSE-KMS)
     aws s3 sync /var/backups/university/ s3://institution-university-backups/ \
       --sse aws:kms \
       --sse-kms-key-id <KMS_KEY_ARN>
     
     # Example Google Cloud Storage sync
     gsutil -m rsync -r /var/backups/university/ gs://institution-university-backups/
     ```

---

## 3. Standard Backup Execution

Run manually or schedule via host cron using the ready-to-deploy templates in [`scripts/operations/crontab.example`](../../scripts/operations/crontab.example):

```bash
# Set PostgreSQL credentials (or ensure ~/.pgpass is configured)
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_USER=university
export POSTGRES_DB=university
export PGPASSWORD="<SECURE_PASSWORD>"

# Run database backup
./scripts/operations/db-backup.sh

# Run media backup
./scripts/operations/media-backup.sh
```

---

## 4. Standard Restore Procedure

### Step 4.1: Verify Backup Archive Before Restoring
Always verify the SHA-256 integrity hash of the backup artifact:

```bash
sha256sum -c /var/backups/university/db/university_20260917_010000.dump.sha256
```

### Step 4.2: Restore to an Isolated Staging Target
**CRITICAL:** Never restore directly over production unless recovering from a catastrophic total failure. Always restore to a secondary staging database first to inspect data integrity:

```bash
# 1. Create temporary staging target
createdb -h localhost -U university university_staging_restore

# 2. Run restore script
./scripts/operations/db-restore.sh \
  --backup=/var/backups/university/db/university_20260917_010000.dump \
  --target-db=university_staging_restore \
  --host=localhost \
  --user=university

# 3. Verify core table row counts
psql -h localhost -U university -d university_staging_restore -c \
  "SELECT count(*) AS user_count FROM \"User\";"
```

### Step 4.3: In-Place Production Disaster Recovery
If production data was corrupted or destroyed and must be completely replaced:

```bash
./scripts/operations/db-restore.sh \
  --backup=/var/backups/university/db/university_20260917_010000.dump \
  --target-db=university \
  --force-production
```

---

## 5. Media Restoration

To restore uploaded media files:

```bash
tar -xzf /var/backups/university/media/media_uploads_20260917_010000.tar.gz -C ./
```

---

## 6. Verification Drill Checklist

Every quarter (or before major launches), an operator must execute:

```bash
./scripts/operations/verify-restore-drill.sh
```
This performs a full non-destructive end-to-end backup, temporary database creation, restore, row audit, and cleanup.
