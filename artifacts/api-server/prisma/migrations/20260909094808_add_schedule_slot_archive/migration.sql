-- AlterTable
ALTER TABLE "ScheduleSlot" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ScheduleSlot_isArchived_idx" ON "ScheduleSlot"("isArchived");
