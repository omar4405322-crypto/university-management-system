-- DropForeignKey
ALTER TABLE "AbsenceExemptionPeriod" DROP CONSTRAINT "AbsenceExemptionPeriod_createdById_fkey";

-- DropForeignKey
ALTER TABLE "ScheduleChangeRequest" DROP CONSTRAINT "ScheduleChangeRequest_requesterId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduleChangeRequest" DROP CONSTRAINT "ScheduleChangeRequest_resolvedById_fkey";

-- DropForeignKey
ALTER TABLE "ScheduleOverride" DROP CONSTRAINT "ScheduleOverride_createdBy_fkey";

-- AlterTable
ALTER TABLE "AbsenceExemptionPeriod" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "actorEmail" TEXT;

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');

-- AlterTable
ALTER TABLE "ScheduleChangeRequest" ALTER COLUMN "requesterId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ScheduleOverride" ALTER COLUMN "createdBy" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ScheduleOverride" ADD CONSTRAINT "ScheduleOverride_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceExemptionPeriod" ADD CONSTRAINT "AbsenceExemptionPeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChangeRequest" ADD CONSTRAINT "ScheduleChangeRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChangeRequest" ADD CONSTRAINT "ScheduleChangeRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
