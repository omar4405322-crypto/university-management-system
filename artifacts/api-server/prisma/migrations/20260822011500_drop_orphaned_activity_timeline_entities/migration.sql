-- DropTable with cascade (drops table, foreign keys, and indexes if table existed)
DROP TABLE IF EXISTS "ActivityTimelineEvent" CASCADE;

-- DropForeignKey and indexes on Task
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_closedById_fkey";
DROP INDEX IF EXISTS "Task_state_idx";

-- AlterTable Task
ALTER TABLE "Task" DROP COLUMN IF EXISTS "closedAt",
DROP COLUMN IF EXISTS "closedById",
DROP COLUMN IF EXISTS "isManuallyClosed",
DROP COLUMN IF EXISTS "startDate",
DROP COLUMN IF EXISTS "state";

-- DropEnum
DROP TYPE IF EXISTS "ActivityEntityType";
DROP TYPE IF EXISTS "ActivityEventType";
DROP TYPE IF EXISTS "AssignmentState";
DROP TYPE IF EXISTS "EventSeverity";
DROP TYPE IF EXISTS "EventVisibility";
