-- Migration: 20261018030000_wp3_3b1_ta_approval_cascade_fk
-- Description: Drop and re-add foreign key constraints on TACrossDepartmentApproval (teachingAssistantId and courseId) as ON DELETE CASCADE

-- Drop existing foreign key constraints
ALTER TABLE "TACrossDepartmentApproval" DROP CONSTRAINT IF EXISTS "TACrossDepartmentApproval_teachingAssistantId_fkey";
ALTER TABLE "TACrossDepartmentApproval" DROP CONSTRAINT IF EXISTS "TACrossDepartmentApproval_courseId_fkey";

-- Re-add foreign key constraints with ON DELETE CASCADE
ALTER TABLE "TACrossDepartmentApproval" ADD CONSTRAINT "TACrossDepartmentApproval_teachingAssistantId_fkey" FOREIGN KEY ("teachingAssistantId") REFERENCES "TeachingAssistant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TACrossDepartmentApproval" ADD CONSTRAINT "TACrossDepartmentApproval_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
