# Production deployment

## Requirements

- Docker Engine with Docker Compose
- A domain with HTTPS terminated by a trusted reverse proxy or hosting platform

## Start the stack

1. Copy `deploy.env.example` to `deploy.env`.
2. Set `PUBLIC_ORIGIN` to the public HTTPS origin.
3. Replace the database password and generate independent values for `JWT_SECRET` and `ENCRYPTION_KEY`.
4. Start the application:

   ```sh
   docker compose --env-file deploy.env up -d --build
   ```

5. Confirm that all services are healthy:

   ```sh
   docker compose --env-file deploy.env ps
   ```

The site listens on `APP_PORT` (8080 by default). Database migrations run automatically before the API starts. PostgreSQL, Redis, uploaded files, and application data use persistent Docker volumes.

## Initial Super Admin Bootstrap

When launching a clean production database, the application contains no Super Admin user, and public registration cannot create administrative roles.

To create the initial Super Administrator safely:

1. Connect to the server or execution environment.
2. Read the initial bootstrap password interactively into the shell environment without terminal echo:

   ```bash
   read -r -s -p "Enter Initial Super Admin Password: " BOOTSTRAP_ADMIN_PASSWORD
   echo
   export BOOTSTRAP_ADMIN_PASSWORD
   export BOOTSTRAP_ADMIN_EMAIL="admin@institution.edu"
   export BOOTSTRAP_ADMIN_CONFIRM="CREATE_INITIAL_SUPER_ADMIN"
   ```

3. Execute the dedicated bootstrap CLI script via Docker Compose, forwarding the exported environment variables without printing them on the command line:

   ```bash
   docker compose --env-file deploy.env exec \
     -e BOOTSTRAP_ADMIN_EMAIL \
     -e BOOTSTRAP_ADMIN_PASSWORD \
     -e BOOTSTRAP_ADMIN_CONFIRM \
     api pnpm run bootstrap:admin
   ```

4. Immediately unset the credentials from your shell session:

   ```bash
   unset BOOTSTRAP_ADMIN_PASSWORD BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_CONFIRM
   ```

5. **Security Invariants & Warnings**:
   * **Single Execution**: The bootstrap script queries the database and refuses to run if any `SUPER_ADMIN` already exists.
   * **No Persistent Storage**: **NEVER** place `BOOTSTRAP_ADMIN_PASSWORD` in `deploy.env`, committed `.env` files, shell history, CI logs, or Docker Compose YAML.
   * **Subsequent Administrators**: All future administrative users must be created through the authenticated web interface by an existing Super Admin (`/api/users/admins`).

## Database Migrations & Deployment Compatibility

The repository tracks schema evolution using Prisma migrations located in `artifacts/api-server/prisma/migrations/`.

### Deployment Modes

* **Mode 1: Single-Instance Deployment (Current Default)**
  1. Complete backup readiness check (`scripts/operations/db-backup.sh`).
  2. Deploy new version (`docker compose --env-file deploy.env up -d --build`).
  3. The entrypoint executes `prisma migrate deploy` prior to starting the Node process.
  4. Verify application readiness (`/api/ready` returning 200).

* **Mode 2: Rolling / Multi-Replica Deployment (Zero-Downtime)**
  In multi-replica environments, older application containers run concurrently with newer database schemas during rolling updates.
  * **Expand / Contract Pattern**:
    1. **Expand**: Deploy non-breaking schema additions (e.g. new nullable columns, new tables).
    2. **Migrate Data**: Backfill and synchronize data in background.
    3. **Deploy App**: Roll out updated application instances reading/writing new schema.
    4. **Contract**: In a subsequent release, deprecate and remove obsolete columns/tables.
  * **Destructive Migration Warnings**:
    * **NEVER** apply migrations containing `DROP TABLE`, `DROP COLUMN`, column renames, or NOT NULL constraints without defaults during a rolling deployment.
    * Prisma does not provide automatic down-migrations. Destructive changes require either an explicit forward-fix patch or restoring from verified backups ([docs/operations/ROLLBACK.md](docs/operations/ROLLBACK.md)).

### Pre-Production Migration Checklist

Before promoting schema changes to production, verify:
- [ ] No dropped tables or columns in active use by running application instances.
- [ ] Any newly added non-nullable column includes a database-level `DEFAULT` value.
- [ ] Renames are implemented via add-column -> dual-write -> backfill -> drop-old.
- [ ] Pre-deployment database backup created and verified (`scripts/operations/db-backup.sh`).
- [ ] An explicit deployment plan is selected: **Single-Instance Maintenance Window** OR **Expand/Contract Rolling Strategy**.

## Operational Procedures & Runbooks

For production lifecycle management, refer to the following authoritative runbooks and automated scripts:

* **Backups & Restore:** [docs/operations/BACKUP-RESTORE.md](docs/operations/BACKUP-RESTORE.md)
  * Automated database backup: [`scripts/operations/db-backup.sh`](scripts/operations/db-backup.sh)
  * Defensive database restore: [`scripts/operations/db-restore.sh`](scripts/operations/db-restore.sh)
  * Media & uploads backup: [`scripts/operations/media-backup.sh`](scripts/operations/media-backup.sh)
  * Restore drill verification: [`scripts/operations/verify-restore-drill.sh`](scripts/operations/verify-restore-drill.sh)
* **Application & Database Rollback:** [docs/operations/ROLLBACK.md](docs/operations/ROLLBACK.md)
* **Disaster Recovery Plan:** [docs/operations/DISASTER-RECOVERY.md](docs/operations/DISASTER-RECOVERY.md)

## Before every release

```sh
pnpm install --frozen-lockfile --strict-peer-dependencies=false
pnpm run verify
```

Do not commit `deploy.env` or expose PostgreSQL, Redis, or the API container directly to the internet.
