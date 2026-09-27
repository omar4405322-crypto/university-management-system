# Operations & Runbooks Index

This document serves as the master operations index for deploying, monitoring, and maintaining the University Management System in production.

---

## 1. Operational Documentation Directory

| Domain | Runbook / Document | Description |
| :--- | :--- | :--- |
| **Production Deployment** | [DEPLOYMENT.md](../DEPLOYMENT.md) | Multi-container Docker Compose setup, environment configuration, and startup verification. |
| **Backup & Restore** | [BACKUP-RESTORE.md](operations/BACKUP-RESTORE.md) | PostgreSQL logical backups, media assets archiving, and drill verification scripts. |
| **Disaster Recovery** | [DISASTER-RECOVERY.md](operations/DISASTER-RECOVERY.md) | Complete site recovery, recovery time objectives (RTO), and recovery point objectives (RPO). |
| **Rollback Runbook** | [ROLLBACK.md](operations/ROLLBACK.md) | Zero-downtime application rollback and defensive database migration rollback. |
| **Observability & Metrics** | [OPERATIONAL-OBSERVABILITY.md](../OPERATIONAL-OBSERVABILITY.md) | Prometheus metrics catalog, Winston structured logging, Sentry tracing, and alert policies. |
| **Environment Configuration** | [ENVIRONMENT.md](ENVIRONMENT.md) | Complete specification of required, secret, and optional environment variables. |
| **Troubleshooting Runbook** | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Step-by-step diagnostic and resolution procedures for active system incidents. |

---

## 2. Health & Readiness Probes

The API exposes dedicated health and readiness probe endpoints:

### 2.1 Liveness Probe (`GET /api/health` or `/api/healthz`)
- **Status:** Returns `200 OK` with JSON status payload if the Node.js event loop and Express process are operational.
- **Usage:** Configured in container orchestrators (Docker, Kubernetes) to detect process deadlocks or fatal crashes.
- **Log Suppression:** Successful 200 responses on this endpoint are omitted from production HTTP logs to avoid log volume saturation.

### 2.2 Readiness Probe (`GET /api/ready`)
- **Status:** Returns `200 OK` only when critical dependencies are verified:
  1. PostgreSQL connection query succeeds (`prisma.$queryRaw\`SELECT 1\``).
  2. Redis ping response succeeds (`redis.ping() === 'PONG'`).
- **Failure:** Returns `503 Service Unavailable` if either PostgreSQL or Redis is unreachable.
- **Usage:** Configured on reverse proxies and load balancers to withhold traffic from starting or degraded instances.

---

## 3. Operational Automation Scripts

All production operations are automated via scripts located in [`scripts/operations/`](../scripts/operations/):

```sh
# Database backup (creates timestamped tarball with SHA-256 checksum)
./scripts/operations/db-backup.sh

# Database restore with safety confirmation
./scripts/operations/db-restore.sh /path/to/backup.sql.gz

# Media uploads backup
./scripts/operations/media-backup.sh

# Run end-to-end automated backup and restore drill verification
./scripts/operations/verify-restore-drill.sh
```

Ensure all operational scripts have executable permissions (`chmod +x scripts/operations/*.sh`) prior to executing in production.
