/*
  Warnings:

  - The values [SUPER_ADMIN,COLLEGE_ADMIN,DEPARTMENT_ADMIN] on the enum `AdminRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "TimetableStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterEnum
BEGIN;
CREATE TYPE "AdminRole_new" AS ENUM ('IT_SUPPORT', 'REGISTRAR', 'FINANCE', 'ACADEMIC_DEAN');
ALTER TABLE "User" ALTER COLUMN "adminRole" TYPE "AdminRole_new" USING ("adminRole"::text::"AdminRole_new");
ALTER TYPE "AdminRole" RENAME TO "AdminRole_old";
ALTER TYPE "AdminRole_new" RENAME TO "AdminRole";
DROP TYPE "public"."AdminRole_old";
COMMIT;

-- CreateSequence
CREATE SEQUENCE IF NOT EXISTS "doctor_id_seq";

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');

-- AlterTable
ALTER TABLE "RegistrationRequest" ADD COLUMN     "studentId" TEXT,
ADD COLUMN     "year" INTEGER;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "year" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "userEmail" TEXT,
    "userRole" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSuccessMetric" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "attendanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageQuizScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assignmentCompletionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "predictedRisk" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentSuccessMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timetable" (
    "id" SERIAL NOT NULL,
    "collegeId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduleData" JSONB,
    "fileUrl" TEXT,
    "status" "TimetableStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSuccessMetric_studentId_key" ON "StudentSuccessMetric"("studentId");

-- CreateIndex
CREATE INDEX "Attendance_courseId_date_idx" ON "Attendance"("courseId", "date");

-- CreateIndex
CREATE INDEX "Attendance_studentId_courseId_idx" ON "Attendance"("studentId", "courseId");

-- CreateIndex
CREATE INDEX "Timetable_collegeId_departmentId_idx" ON "Timetable"("collegeId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Timetable_collegeId_departmentId_academicYear_semester_key" ON "Timetable"("collegeId", "departmentId", "academicYear", "semester");

-- CreateIndex
CREATE INDEX "Course_courseCode_idx" ON "Course"("courseCode");

-- CreateIndex
CREATE INDEX "Course_departmentId_idx" ON "Course"("departmentId");

-- CreateIndex
CREATE INDEX "Course_doctorId_idx" ON "Course"("doctorId");

-- CreateIndex
CREATE INDEX "Department_collegeId_idx" ON "Department"("collegeId");

-- CreateIndex
CREATE INDEX "Doctor_doctorId_idx" ON "Doctor"("doctorId");

-- CreateIndex
CREATE INDEX "Doctor_departmentId_idx" ON "Doctor"("departmentId");

-- CreateIndex
CREATE INDEX "Exam_courseId_date_idx" ON "Exam"("courseId", "date");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Payment_studentId_status_idx" ON "Payment"("studentId", "status");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Question_quizId_idx" ON "Question"("quizId");

-- CreateIndex
CREATE INDEX "Quiz_courseId_idx" ON "Quiz"("courseId");

-- CreateIndex
CREATE INDEX "QuizSubmission_quizId_studentId_idx" ON "QuizSubmission"("quizId", "studentId");

-- CreateIndex
CREATE INDEX "RegistrationRequest_status_idx" ON "RegistrationRequest"("status");

-- CreateIndex
CREATE INDEX "RegistrationRequest_email_idx" ON "RegistrationRequest"("email");

-- CreateIndex
CREATE INDEX "Schedule_courseId_idx" ON "Schedule"("courseId");

-- CreateIndex
CREATE INDEX "Student_studentId_idx" ON "Student"("studentId");

-- CreateIndex
CREATE INDEX "Student_departmentId_year_idx" ON "Student"("departmentId", "year");

-- CreateIndex
CREATE INDEX "Student_firstName_lastName_idx" ON "Student"("firstName", "lastName");

-- CreateIndex
CREATE INDEX "Task_courseId_idx" ON "Task"("courseId");

-- CreateIndex
CREATE INDEX "TaskSubmission_taskId_studentId_idx" ON "TaskSubmission"("taskId", "studentId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSuccessMetric" ADD CONSTRAINT "StudentSuccessMetric_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
