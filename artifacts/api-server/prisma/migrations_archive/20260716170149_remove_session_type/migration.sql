/*
  Warnings:

  - You are about to drop the column `sessionType` on the `ScheduleSlot` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');

-- AlterTable
ALTER TABLE "ScheduleSlot" DROP COLUMN "sessionType";

-- DropEnum
DROP TYPE "SessionType";
