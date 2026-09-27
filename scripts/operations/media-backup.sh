#!/usr/bin/env bash
# ==============================================================================
# Persistent Media / Uploads Backup Script
# Part of Production Hardening (OPS-001)
# ==============================================================================
set -euo pipefail

UPLOADS_SOURCE_DIR="${UPLOADS_DIR:-./uploads}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/university/media}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

echo "[INFO] [$(date -Iseconds)] Starting media/uploads backup from '${UPLOADS_SOURCE_DIR}'..."

if [[ ! -d "${UPLOADS_SOURCE_DIR}" ]]; then
  echo "[WARN] [$(date -Iseconds)] Uploads directory '${UPLOADS_SOURCE_DIR}' does not exist or is empty. Creating empty placeholder..."
  mkdir -p "${UPLOADS_SOURCE_DIR}"
fi

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

ARCHIVE_FILE="${BACKUP_DIR}/media_uploads_${TIMESTAMP}.tar.gz"
CHECKSUM_FILE="${ARCHIVE_FILE}.sha256"

# Create compressed tar archive
tar -czf "${ARCHIVE_FILE}" -C "$(dirname "${UPLOADS_SOURCE_DIR}")" "$(basename "${UPLOADS_SOURCE_DIR}")"

# Compute SHA256 checksum
sha256sum "${ARCHIVE_FILE}" | awk '{print $1}' > "${CHECKSUM_FILE}"

echo "[INFO] [$(date -Iseconds)] Media backup created: ${ARCHIVE_FILE} ($(du -h "${ARCHIVE_FILE}" | cut -f1))"
echo "[INFO] [$(date -Iseconds)] Checksum: $(cat "${CHECKSUM_FILE}")"

# Prune older archives
find "${BACKUP_DIR}" -type f -name "media_uploads_*.tar.gz*" -mtime "+${RETENTION_DAYS}" -delete
echo "[INFO] [$(date -Iseconds)] Media backup process completed successfully."
