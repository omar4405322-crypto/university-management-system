-- AlterTable ScheduleSlot: add termId nullable
ALTER TABLE "ScheduleSlot" ADD COLUMN "termId" INTEGER;

-- AlterTable Timetable: add termId nullable
ALTER TABLE "Timetable" ADD COLUMN "termId" INTEGER;

-- CreateIndex for ScheduleSlot.termId
CREATE INDEX "ScheduleSlot_termId_idx" ON "ScheduleSlot"("termId");

-- CreateIndex for Timetable.termId
CREATE INDEX "Timetable_termId_idx" ON "Timetable"("termId");

-- AddForeignKey ScheduleSlot -> AcademicTerm (ON DELETE RESTRICT ON UPDATE CASCADE)
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey Timetable -> AcademicTerm (ON DELETE RESTRICT ON UPDATE CASCADE)
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum TAApprovalStatus
CREATE TYPE "TAApprovalStatus" AS ENUM ('APPROVED', 'REVOKED');

-- CreateTable TACrossDepartmentApproval
CREATE TABLE "TACrossDepartmentApproval" (
    "id" SERIAL NOT NULL,
    "teachingAssistantId" TEXT NOT NULL,
    "courseId" INTEGER NOT NULL,
    "status" "TAApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "reason" TEXT,
    "approvedByUserId" INTEGER NOT NULL,
    "revokedByUserId" INTEGER,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TACrossDepartmentApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TACrossDepartmentApproval_teachingAssistantId_courseId_key" ON "TACrossDepartmentApproval"("teachingAssistantId", "courseId");

-- CreateIndex
CREATE INDEX "TACrossDepartmentApproval_teachingAssistantId_idx" ON "TACrossDepartmentApproval"("teachingAssistantId");

-- CreateIndex
CREATE INDEX "TACrossDepartmentApproval_courseId_idx" ON "TACrossDepartmentApproval"("courseId");

-- CreateIndex
CREATE INDEX "TACrossDepartmentApproval_approvedByUserId_idx" ON "TACrossDepartmentApproval"("approvedByUserId");

-- CreateIndex
CREATE INDEX "TACrossDepartmentApproval_revokedByUserId_idx" ON "TACrossDepartmentApproval"("revokedByUserId");

-- AddForeignKey TACrossDepartmentApproval -> TeachingAssistant
ALTER TABLE "TACrossDepartmentApproval" ADD CONSTRAINT "TACrossDepartmentApproval_teachingAssistantId_fkey" FOREIGN KEY ("teachingAssistantId") REFERENCES "TeachingAssistant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey TACrossDepartmentApproval -> Course
ALTER TABLE "TACrossDepartmentApproval" ADD CONSTRAINT "TACrossDepartmentApproval_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey TACrossDepartmentApproval -> User (approvedByUserId)
ALTER TABLE "TACrossDepartmentApproval" ADD CONSTRAINT "TACrossDepartmentApproval_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey TACrossDepartmentApproval -> User (revokedByUserId)
ALTER TABLE "TACrossDepartmentApproval" ADD CONSTRAINT "TACrossDepartmentApproval_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable Room: add isActive BOOLEAN NOT NULL DEFAULT true
ALTER TABLE "Room" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
