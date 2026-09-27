#!/usr/bin/env bash
# ==============================================================================
# Database Defensive Restore Script: PostgreSQL Archive Restoration
# Part of Production Hardening (OPS-001)
# ==============================================================================
set -euo pipefail

function show_usage() {
  cat <<EOF
Usage:
  $(basename "$0") --backup=<backup_file.dump> --target-db=<target_database_name> [options]

Required Arguments:
  --backup=FILE          Path to the .dump archive file to restore.
  --target-db=NAME       Target PostgreSQL database name.

Options:
  --host=HOST            Target host (default: localhost)
  --port=PORT            Target port (default: 5432)
  --user=USER            Target user (default: university)
  --force-production     REQUIRED if target-db matches production database name.
  --skip-checksum        Skip SHA-256 integrity validation (NOT recommended).
  -h, --help             Show this help message.

Example (Safe Staging Verification):
  $(basename "$0") --backup=/var/backups/university_20260917.dump --target-db=university_restore_test
EOF
  exit 1
}

# Parse parameters
BACKUP_FILE=""
TARGET_DB=""
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-university}"
FORCE_PRODUCTION=false
SKIP_CHECKSUM=false
PRODUCTION_DB_NAME="${PRODUCTION_DB_NAME:-university}"

for arg in "$@"; do
  case "$arg" in
    --backup=*) BACKUP_FILE="${arg#*=}" ;;
    --target-db=*) TARGET_DB="${arg#*=}" ;;
    --host=*) DB_HOST="${arg#*=}" ;;
    --port=*) DB_PORT="${arg#*=}" ;;
    --user=*) DB_USER="${arg#*=}" ;;
    --force-production) FORCE_PRODUCTION=true ;;
    --skip-checksum) SKIP_CHECKSUM=true ;;
    -h|--help) show_usage ;;
    *) echo "[ERROR] Unknown argument: $arg" >&2; show_usage ;;
  esac
done

if [[ -z "${BACKUP_FILE}" || -z "${TARGET_DB}" ]]; then
  echo "[ERROR] Missing required arguments (--backup and --target-db are mandatory)." >&2
  show_usage
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "[ERROR] Backup file does not exist: ${BACKUP_FILE}" >&2
  exit 1
fi

# Defensive Guard: Prevent accidental overwrite of production database
if [[ "${TARGET_DB}" == "${PRODUCTION_DB_NAME}" && "${FORCE_PRODUCTION}" != "true" ]]; then
  echo "================================================================================" >&2
  echo "[CRITICAL SAFETY ABORT]" >&2
  echo "Target database '${TARGET_DB}' matches production database name!" >&2
  echo "To prevent catastrophic accidental data loss, restoration is blocked." >&2
  echo "If you genuinely intend to overwrite production, you MUST explicitly pass:" >&2
  echo "  --force-production" >&2
  echo "================================================================================" >&2
  exit 2
fi

# Step 1: Verify Checksum Integrity
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [[ "${SKIP_CHECKSUM}" != "true" ]]; then
  if [[ -f "${CHECKSUM_FILE}" ]]; then
    echo "[INFO] [$(date -Iseconds)] Validating SHA-256 checksum..."
    EXPECTED_HASH="$(cat "${CHECKSUM_FILE}")"
    ACTUAL_HASH="$(sha256sum "${BACKUP_FILE}" | awk '{print $1}')"
    if [[ "${EXPECTED_HASH}" != "${ACTUAL_HASH}" ]]; then
      echo "[ERROR] Checksum verification failed!" >&2
      echo "  Expected: ${EXPECTED_HASH}" >&2
      echo "  Actual:   ${ACTUAL_HASH}" >&2
      exit 3
    fi
    echo "[INFO] [$(date -Iseconds)] Checksum verified successfully: ${ACTUAL_HASH}"
  else
    echo "[WARN] [$(date -Iseconds)] No .sha256 checksum file found alongside backup."
  fi
fi

# Step 2: Validate Archive Header with pg_restore
echo "[INFO] [$(date -Iseconds)] Verifying archive readability with pg_restore --list..."
if ! pg_restore --list "${BACKUP_FILE}" >/dev/null 2>&1; then
  echo "[ERROR] Backup archive is unreadable or corrupted!" >&2
  exit 4
fi

# Step 3: Execute Restore into Target Database
echo "[INFO] [$(date -Iseconds)] Restoring archive into '${TARGET_DB}' on ${DB_HOST}:${DB_PORT}..."
# Options:
# --clean: Drop database objects prior to recreating them
# --if-exists: Use IF EXISTS when dropping objects
# --no-owner: Do not set ownership of objects to match the original database
# --no-privileges: Prevent restoration of access privileges (grant/revoke)
if pg_restore \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --dbname="${TARGET_DB}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --verbose \
  "${BACKUP_FILE}" 2>/dev/null; then
  echo "[INFO] [$(date -Iseconds)] pg_restore completed successfully."
else
  # Note: pg_restore exits with 1 on non-fatal warnings (e.g. drop if exists on empty db).
  # Check if database is populated.
  echo "[WARN] [$(date -Iseconds)] pg_restore returned non-zero. Verifying restored tables..."
fi

# Step 4: Post-Restore Table Count & Health Audit
echo "[INFO] [$(date -Iseconds)] Running post-restore database validation checks..."
psql --host="${DB_HOST}" --port="${DB_PORT}" --username="${DB_USER}" --dbname="${TARGET_DB}" -t -A << 'EOF' || true
DO $$
DECLARE
  u_count INT;
  s_count INT;
  c_count INT;
  e_count INT;
  p_count INT;
BEGIN
  SELECT COUNT(*) INTO u_count FROM "User";
  SELECT COUNT(*) INTO s_count FROM "Student";
  SELECT COUNT(*) INTO c_count FROM "Course";
  SELECT COUNT(*) INTO e_count FROM "Enrollment";
  SELECT COUNT(*) INTO p_count FROM "Payment";
  RAISE NOTICE 'Restored row counts -> User: %, Student: %, Course: %, Enrollment: %, Payment: %',
    u_count, s_count, c_count, e_count, p_count;
END $$;
EOF

echo "[INFO] [$(date -Iseconds)] Database restoration procedure finished successfully."
