-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExamViolationType" ADD VALUE 'MULTI_TAB';
ALTER TYPE "ExamViolationType" ADD VALUE 'LEAVE_TIMEOUT';
ALTER TYPE "ExamViolationType" ADD VALUE 'DEVTOOLS';
ALTER TYPE "ExamViolationType" ADD VALUE 'SCREENSHOT';
ALTER TYPE "ExamViolationType" ADD VALUE 'WINDOW_RESIZE';
ALTER TYPE "ExamViolationType" ADD VALUE 'LOCATION_DENIED';

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');
