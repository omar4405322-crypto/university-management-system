#!/usr/bin/env bash
# ==============================================================================
# Database Backup Script: PostgreSQL Logical Backup
# Part of Production Hardening (OPS-001)
# ==============================================================================
set -euo pipefail

# Configuration with secure defaults (override via environment variables)
BACKUP_DIR="${BACKUP_DIR:-/var/backups/university/db}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

# Database connection credentials (never log these)
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-university}"
DB_NAME="${POSTGRES_DB:-university}"
# Note: PGPASSWORD should be provided via environment or ~/.pgpass

echo "[INFO] [$(date -Iseconds)] Starting PostgreSQL backup for database '${DB_NAME}'..."

# Ensure target directory exists with restricted permissions (owner-only)
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.dump"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

# Execute pg_dump using PostgreSQL custom archive format (-Fc) with maximum compression (-Z 9)
# Custom format supports selective restore, table exclusion, and parallel restore.
if pg_dump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --format=custom \
  --compress=9 \
  --blobs \
  --verbose \
  --file="${BACKUP_FILE}" \
  "${DB_NAME}" 2>/dev/null; then
  echo "[INFO] [$(date -Iseconds)] Database dump completed successfully: ${BACKUP_FILE}"
else
  echo "[ERROR] [$(date -Iseconds)] pg_dump failed with non-zero exit code" >&2
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# Verify archive integrity using pg_restore header list inspection
echo "[INFO] [$(date -Iseconds)] Verifying archive readability with pg_restore..."
if ! pg_restore --list "${BACKUP_FILE}" >/dev/null 2>&1; then
  echo "[ERROR] [$(date -Iseconds)] Backup archive corruption detected! Failed header inspection." >&2
  rm -f "${BACKUP_FILE}"
  exit 2
fi

# Compute SHA-256 checksum for cryptographic verification during restore
echo "[INFO] [$(date -Iseconds)] Calculating SHA-256 checksum..."
sha256sum "${BACKUP_FILE}" | awk '{print $1}' > "${CHECKSUM_FILE}"
echo "[INFO] [$(date -Iseconds)] SHA-256 checksum: $(cat "${CHECKSUM_FILE}")"

# Prune older backups beyond retention window
echo "[INFO] [$(date -Iseconds)] Pruning backups older than ${RETENTION_DAYS} days in ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -type f -name "${DB_NAME}_*.dump*" -mtime "+${RETENTION_DAYS}" -delete

echo "[INFO] [$(date -Iseconds)] Backup process completed successfully."
echo "[INFO] File: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"
