#!/bin/bash
# University Management System - Database Backup Script
# Usage: ./backup.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/ums_backup_${TIMESTAMP}.sql"

# Ensure backup directory exists
mkdir -p $BACKUP_DIR

echo "Starting database backup..."

# Perform pg_dump
# Note: Ensure DATABASE_URL is set in environment or provided
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set."
  exit 1
fi

pg_dump $DATABASE_URL > $BACKUP_FILE

if [ $? -eq 0 ]; then
  echo "Backup successful: $BACKUP_FILE"
  
  # Optional: Upload to S3
  if [ ! -z "$BACKUP_S3_BUCKET" ]; then
    echo "Uploading to S3..."
    aws s3 cp $BACKUP_FILE s3://$BACKUP_S3_BUCKET/backups/
    
    # Keep only last 30 days on S3
    echo "Cleaning up old backups on S3..."
    aws s3 ls s3://$BACKUP_S3_BUCKET/backups/ | sort | head -n -30 | awk '{print $4}' | xargs -I{} aws s3 rm s3://$BACKUP_S3_BUCKET/backups/{}
  fi

  # Cleanup local backups older than 7 days
  find $BACKUP_DIR -type f -name "*.sql" -mtime +7 -delete
  
  echo "Backup process completed."
else
  echo "Backup failed!"
  exit 1
fi
