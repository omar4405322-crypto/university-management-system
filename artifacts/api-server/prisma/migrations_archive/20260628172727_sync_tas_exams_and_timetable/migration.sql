-- CreateEnum
CREATE TYPE "ExamQuestionType" AS ENUM ('MCQ', 'TRUE_FALSE', 'SHORT_ANSWER');

-- CreateEnum
CREATE TYPE "ExamSubmissionStatus" AS ENUM ('PENDING', 'GRADED');

-- CreateEnum
CREATE TYPE "ExamViolationType" AS ENUM ('TAB_SWITCH', 'BLUR', 'RIGHT_CLICK', 'COPY_PASTE', 'FULLSCREEN_EXIT');

-- CreateEnum
CREATE TYPE "TAStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'INACTIVE');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TEACHING_ASSISTANT';

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_studentId_fkey";

-- DropForeignKey
ALTER TABLE "QuizSubmission" DROP CONSTRAINT "QuizSubmission_studentId_fkey";

-- DropForeignKey
ALTER TABLE "TaskSubmission" DROP CONSTRAINT "TaskSubmission_studentId_fkey";

-- AlterTable
ALTER TABLE "College" ADD COLUMN     "descriptionAr" TEXT;

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "durationMinutes" INTEGER NOT NULL DEFAULT 120;

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "timetableId" INTEGER,
ADD COLUMN     "timetableSlotKey" TEXT;

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "type" "ExamQuestionType" NOT NULL DEFAULT 'MCQ',
    "optionA" TEXT,
    "optionB" TEXT,
    "optionC" TEXT,
    "optionD" TEXT,
    "correctAnswer" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSubmission" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ExamSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "antiCheatLogs" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "ExamSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamViolation" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "type" "ExamViolationType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" TEXT,

    CONSTRAINT "ExamViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingAssistant" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "employeeId" TEXT NOT NULL,
    "departmentId" INTEGER,
    "specialization" TEXT,
    "status" "TAStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeachingAssistant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorTA" (
    "id" TEXT NOT NULL,
    "doctorId" INTEGER NOT NULL,
    "teachingAssistantId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorTA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamQuestion_examId_idx" ON "ExamQuestion"("examId");

-- CreateIndex
CREATE INDEX "ExamSubmission_examId_studentId_idx" ON "ExamSubmission"("examId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSubmission_examId_studentId_key" ON "ExamSubmission"("examId", "studentId");

-- CreateIndex
CREATE INDEX "ExamViolation_submissionId_idx" ON "ExamViolation"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingAssistant_userId_key" ON "TeachingAssistant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingAssistant_employeeId_key" ON "TeachingAssistant"("employeeId");

-- CreateIndex
CREATE INDEX "TeachingAssistant_departmentId_idx" ON "TeachingAssistant"("departmentId");

-- CreateIndex
CREATE INDEX "DoctorTA_doctorId_idx" ON "DoctorTA"("doctorId");

-- CreateIndex
CREATE INDEX "DoctorTA_teachingAssistantId_idx" ON "DoctorTA"("teachingAssistantId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorTA_doctorId_teachingAssistantId_key" ON "DoctorTA"("doctorId", "teachingAssistantId");

-- CreateIndex
CREATE INDEX "Schedule_timetableId_idx" ON "Schedule"("timetableId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_courseId_date_key" ON "Attendance"("studentId", "courseId", "date");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSubmission" ADD CONSTRAINT "QuizSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "Timetable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubmission" ADD CONSTRAINT "ExamSubmission_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubmission" ADD CONSTRAINT "ExamSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamViolation" ADD CONSTRAINT "ExamViolation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ExamSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssistant" ADD CONSTRAINT "TeachingAssistant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssistant" ADD CONSTRAINT "TeachingAssistant_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorTA" ADD CONSTRAINT "DoctorTA_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorTA" ADD CONSTRAINT "DoctorTA_teachingAssistantId_fkey" FOREIGN KEY ("teachingAssistantId") REFERENCES "TeachingAssistant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
