# Database Restore Procedure

This document outlines the steps to restore the University Management System database from a backup file.

## Prerequisites
- PostgreSQL installed and `psql` utility available.
- Access to the backup `.sql` file.
- `DATABASE_URL` environment variable pointing to the target database.

## Step-by-Step Restore

### 1. Identify the Backup File
Backups are located in the `./backups` directory or on S3 if configured.
Files are named: `ums_backup_YYYYMMDD_HHMMSS.sql`

### 2. Prepare the Target Database
If you are restoring to a fresh database, ensure it is created first:
```bash
createdb ums_prod
```

### 3. Run the Restore Command
Use `psql` to execute the SQL commands in the backup file:

**Using DATABASE_URL:**
```bash
psql $DATABASE_URL < ./backups/ums_backup_20260608_120000.sql
```

**Using explicit credentials:**
```bash
psql -h localhost -U postgres -d ums_prod < ./backups/ums_backup_20260608_120000.sql
```

### 4. Verify the Restore
Check the database tables and counts to ensure data integrity:
```bash
psql $DATABASE_URL -c "SELECT count(*) FROM \"User\";"
```

## Troubleshooting
- **Permission Denied:** Ensure the user in `DATABASE_URL` has superuser or owner permissions on the database.
- **Table Already Exists:** If restoring to an existing database, you may need to drop the schema first:
  ```sql
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  ```
