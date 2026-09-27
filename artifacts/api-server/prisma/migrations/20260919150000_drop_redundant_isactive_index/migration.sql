-- DB-002 Optimization: Drop redundant single-column index on AttendanceSession(isActive)
-- Replaced by composite index AttendanceSession(isActive, expiresAt) which covers
-- both the composite cron query and single-column isActive queries via left-prefix.
DROP INDEX IF EXISTS "AttendanceSession_isActive_idx";
