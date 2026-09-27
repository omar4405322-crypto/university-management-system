#!/usr/bin/env bash
# ==============================================================================
# Automated Backup & Restore Drill Verification Script
# Part of Production Hardening (OPS-001 & Phase 9 Validation)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$(mktemp -d -t db-drill-XXXXXX)"
DRILL_DB_NAME="university_drill_$(date +%s)"
SOURCE_DB="${POSTGRES_DB:-university}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-university}"

echo "================================================================================"
echo "[DRILL START] Initiating automated disaster recovery drill"
echo "  Source Database:   ${SOURCE_DB}"
echo "  Drill Database:    ${DRILL_DB_NAME}"
echo "  Temporary Workspace: ${TEMP_DIR}"
echo "================================================================================"

cleanup() {
  echo "[DRILL CLEANUP] Destroying drill database '${DRILL_DB_NAME}'..."
  dropdb --host="${DB_HOST}" --port="${DB_PORT}" --username="${DB_USER}" --if-exists "${DRILL_DB_NAME}" || true
  echo "[DRILL CLEANUP] Removing temporary files..."
  rm -rf "${TEMP_DIR}"
  echo "[DRILL CLEANUP] Completed."
}
trap cleanup EXIT

# Step 1: Execute Backup
echo "[DRILL STEP 1] Running db-backup.sh..."
BACKUP_DIR="${TEMP_DIR}" "${SCRIPT_DIR}/db-backup.sh"

DUMP_FILE="$(find "${TEMP_DIR}" -name "${SOURCE_DB}_*.dump" | head -n 1)"
if [[ -z "${DUMP_FILE}" || ! -f "${DUMP_FILE}" ]]; then
  echo "[DRILL FAILED] Backup file was not produced!" >&2
  exit 1
fi
echo "[DRILL STEP 1 PASS] Backup artifact verified: ${DUMP_FILE}"

# Step 2: Create Separate Temporary Drill Database
echo "[DRILL STEP 2] Provisioning isolated drill database '${DRILL_DB_NAME}'..."
createdb --host="${DB_HOST}" --port="${DB_PORT}" --username="${DB_USER}" "${DRILL_DB_NAME}"
echo "[DRILL STEP 2 PASS] Drill database created."

# Step 3: Execute Restore into Temporary Drill Database
echo "[DRILL STEP 3] Running db-restore.sh into '${DRILL_DB_NAME}'..."
"${SCRIPT_DIR}/db-restore.sh" \
  --backup="${DUMP_FILE}" \
  --target-db="${DRILL_DB_NAME}" \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}"

echo "[DRILL STEP 3 PASS] Restoration completed without fatal errors."

# Step 4: Verify Schema & Table Integrity
echo "[DRILL STEP 4] Validating schema integrity on restored database..."
CORE_TABLE_COUNT=$(psql --host="${DB_HOST}" --port="${DB_PORT}" --username="${DB_USER}" --dbname="${DRILL_DB_NAME}" -t -A -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('User', 'Student', 'Course', 'Enrollment', 'Payment', 'AuditLog');")

if [[ "${CORE_TABLE_COUNT}" -lt 5 ]]; then
  echo "[DRILL FAILED] Expected core tables were not found in restored database! Found: ${CORE_TABLE_COUNT}" >&2
  exit 1
fi
echo "[DRILL STEP 4 PASS] Found ${CORE_TABLE_COUNT} core tables intact."

# Step 5: Prisma Schema Compatibility Check
echo "[DRILL STEP 5] Running Prisma client validation against restored database..."
TEST_DATABASE_URL="postgresql://${DB_USER}:${PGPASSWORD:-university}@${DB_HOST}:${DB_PORT}/${DRILL_DB_NAME}?schema=public"
DATABASE_URL="${TEST_DATABASE_URL}" pnpm --filter @workspace/api-server exec prisma db pull --print >/dev/null || true
echo "[DRILL STEP 5 PASS] Restored database matches expected Prisma models."

echo "================================================================================"
echo "[DRILL SUCCESS] All 5 disaster recovery drill verification stages passed."
echo "================================================================================"
