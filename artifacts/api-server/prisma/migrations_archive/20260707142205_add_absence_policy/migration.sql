-- AlterEnum
ALTER TYPE "EnrollmentStatus" ADD VALUE 'BLOCKED';

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "academicYear" INTEGER,
ADD COLUMN     "semester" INTEGER;

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');

-- CreateTable
CREATE TABLE "AbsenceThresholdPolicy" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER,
    "courseId" INTEGER,
    "maxAbsencePercent" DOUBLE PRECISION NOT NULL DEFAULT 25.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbsenceThresholdPolicy_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AbsenceThresholdPolicy" ADD CONSTRAINT "AbsenceThresholdPolicy_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceThresholdPolicy" ADD CONSTRAINT "AbsenceThresholdPolicy_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
