-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "customAbsenceThreshold" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "AbsenceExemptionPeriod" (
    "id" SERIAL NOT NULL,
    "enrollmentId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbsenceExemptionPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AbsenceExemptionPeriod_enrollmentId_idx" ON "AbsenceExemptionPeriod"("enrollmentId");

-- CreateIndex
CREATE INDEX "AbsenceExemptionPeriod_startDate_endDate_idx" ON "AbsenceExemptionPeriod"("startDate", "endDate");

-- AddForeignKey
ALTER TABLE "AbsenceExemptionPeriod" ADD CONSTRAINT "AbsenceExemptionPeriod_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceExemptionPeriod" ADD CONSTRAINT "AbsenceExemptionPeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
