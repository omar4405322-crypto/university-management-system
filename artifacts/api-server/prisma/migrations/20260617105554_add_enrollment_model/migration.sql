-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ENROLLED', 'COMPLETED', 'WITHDRAWN', 'FAILED');

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "finalGrade" DOUBLE PRECISION,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Enrollment_studentId_idx" ON "Enrollment"("studentId");
CREATE INDEX "Enrollment_courseId_idx" ON "Enrollment"("courseId");
CREATE UNIQUE INDEX "Enrollment_studentId_courseId_semester_academicYear_key" ON "Enrollment"("studentId", "courseId", "semester", "academicYear");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DATA MIGRATION: Copy existing enrollments
-- In Prisma implicit relations, A = first model alphabetically (Course), B = second (Student)
INSERT INTO "Enrollment" ("studentId", "courseId", "semester", "academicYear", "status", "enrolledAt")
SELECT "B", "A", 1, 2024, 'ENROLLED', CURRENT_TIMESTAMP
FROM "_CourseToStudent";

-- DropForeignKey
ALTER TABLE "_CourseToStudent" DROP CONSTRAINT "_CourseToStudent_A_fkey";
ALTER TABLE "_CourseToStudent" DROP CONSTRAINT "_CourseToStudent_B_fkey";

-- DropTable
DROP TABLE "_CourseToStudent";
