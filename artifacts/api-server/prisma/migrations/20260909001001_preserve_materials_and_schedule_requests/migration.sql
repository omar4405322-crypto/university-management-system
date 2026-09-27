-- DropForeignKey
ALTER TABLE "CourseMaterial" DROP CONSTRAINT "CourseMaterial_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "ScheduleChangeRequest" DROP CONSTRAINT "ScheduleChangeRequest_scheduleSlotId_fkey";

-- AlterTable
ALTER TABLE "CourseMaterial" ALTER COLUMN "uploadedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ScheduleChangeRequest" ADD COLUMN     "targetScheduleSlotId" INTEGER;

-- Backfill the immutable audit snapshot before changing deletion behavior.
UPDATE "ScheduleChangeRequest"
SET "targetScheduleSlotId" = "scheduleSlotId"
WHERE "scheduleSlotId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "ScheduleChangeRequest" ADD CONSTRAINT "ScheduleChangeRequest_scheduleSlotId_fkey" FOREIGN KEY ("scheduleSlotId") REFERENCES "ScheduleSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
