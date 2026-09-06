-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'PENDING_REVIEW';

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "pendingApprovedStatus" "AttendanceStatus";

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');
