/*
  Warnings:

  - You are about to drop the column `courseSectionId` on the `ScheduleChangeRequest` table. All the data in the column will be lost.
  - You are about to drop the column `courseSectionId` on the `ScheduleSlot` table. All the data in the column will be lost.
  - You are about to drop the column `studentGroupId` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the `CourseSection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SectionGroupMapping` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StudentSectionOverride` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `courseId` to the `ScheduleChangeRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `courseId` to the `ScheduleSlot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slotType` to the `ScheduleSlot` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SlotType" AS ENUM ('LECTURE', 'SECTION', 'LAB');

-- DropForeignKey
ALTER TABLE "CourseSection" DROP CONSTRAINT "CourseSection_courseId_fkey";

-- DropForeignKey
ALTER TABLE "CourseSection" DROP CONSTRAINT "CourseSection_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "CourseSection" DROP CONSTRAINT "CourseSection_timetableId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduleChangeRequest" DROP CONSTRAINT "ScheduleChangeRequest_courseSectionId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduleSlot" DROP CONSTRAINT "ScheduleSlot_courseSectionId_fkey";

-- DropForeignKey
ALTER TABLE "SectionGroupMapping" DROP CONSTRAINT "SectionGroupMapping_courseSectionId_fkey";

-- DropForeignKey
ALTER TABLE "SectionGroupMapping" DROP CONSTRAINT "SectionGroupMapping_studentGroupId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_studentGroupId_fkey";

-- DropForeignKey
ALTER TABLE "StudentSectionOverride" DROP CONSTRAINT "StudentSectionOverride_courseId_fkey";

-- DropForeignKey
ALTER TABLE "StudentSectionOverride" DROP CONSTRAINT "StudentSectionOverride_courseSectionId_fkey";

-- DropForeignKey
ALTER TABLE "StudentSectionOverride" DROP CONSTRAINT "StudentSectionOverride_studentId_fkey";

-- DropIndex
DROP INDEX "ScheduleSlot_courseSectionId_idx";

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');

-- AlterTable
ALTER TABLE "ScheduleChangeRequest" DROP COLUMN "courseSectionId",
ADD COLUMN     "courseId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ScheduleSlot" DROP COLUMN "courseSectionId",
ADD COLUMN     "courseId" INTEGER NOT NULL,
ADD COLUMN     "doctorId" INTEGER,
ADD COLUMN     "groupId" INTEGER,
ADD COLUMN     "slotType" "SlotType" NOT NULL;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "studentGroupId",
ADD COLUMN     "groupId" INTEGER;

-- AlterTable
ALTER TABLE "StudentGroup" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "parentGroupId" INTEGER,
ADD COLUMN     "rangeEndName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "rangeStartName" TEXT NOT NULL DEFAULT '';

-- DropTable
DROP TABLE "CourseSection";

-- DropTable
DROP TABLE "SectionGroupMapping";

-- DropTable
DROP TABLE "StudentSectionOverride";

-- CreateIndex
CREATE INDEX "ScheduleSlot_courseId_idx" ON "ScheduleSlot"("courseId");

-- CreateIndex
CREATE INDEX "ScheduleSlot_groupId_idx" ON "ScheduleSlot"("groupId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGroup" ADD CONSTRAINT "StudentGroup_parentGroupId_fkey" FOREIGN KEY ("parentGroupId") REFERENCES "StudentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChangeRequest" ADD CONSTRAINT "ScheduleChangeRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
