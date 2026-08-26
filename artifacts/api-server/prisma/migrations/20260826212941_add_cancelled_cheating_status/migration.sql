-- AlterEnum
ALTER TYPE "ExamSubmissionStatus" ADD VALUE 'CANCELLED_CHEATING';

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');
