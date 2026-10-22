-- CreateEnum
CREATE TYPE "GradeComponentSource" AS ENUM ('AUTO_QUIZ', 'AUTO_ATTENDANCE', 'MANUAL');

-- CreateEnum
CREATE TYPE "GradeEntryStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "AttendanceSession" ADD COLUMN "sessionPoints" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN "finalPointsEarned" DOUBLE PRECISION,
ADD COLUMN "finalPointsMax" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "CourseGradeStructure" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "termId" INTEGER NOT NULL,
    "passMark" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseGradeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseGradeComponent" (
    "id" SERIAL NOT NULL,
    "structureId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "maxPoints" DOUBLE PRECISION NOT NULL,
    "source" "GradeComponentSource" NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseGradeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseGradeEntry" (
    "id" SERIAL NOT NULL,
    "enrollmentId" INTEGER NOT NULL,
    "componentId" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "status" "GradeEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "draftedById" INTEGER,
    "draftedAt" TIMESTAMP(3),
    "publishedById" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseGradeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseGradeStructure_courseId_idx" ON "CourseGradeStructure"("courseId");
CREATE INDEX "CourseGradeStructure_termId_idx" ON "CourseGradeStructure"("termId");
CREATE UNIQUE INDEX "CourseGradeStructure_courseId_termId_key" ON "CourseGradeStructure"("courseId", "termId");

-- CreateIndex
CREATE INDEX "CourseGradeComponent_structureId_idx" ON "CourseGradeComponent"("structureId");
CREATE UNIQUE INDEX "CourseGradeComponent_structureId_name_key" ON "CourseGradeComponent"("structureId", "name");

-- CreateIndex
CREATE INDEX "CourseGradeEntry_enrollmentId_idx" ON "CourseGradeEntry"("enrollmentId");
CREATE INDEX "CourseGradeEntry_componentId_idx" ON "CourseGradeEntry"("componentId");
CREATE INDEX "CourseGradeEntry_status_idx" ON "CourseGradeEntry"("status");
CREATE UNIQUE INDEX "CourseGradeEntry_enrollmentId_componentId_key" ON "CourseGradeEntry"("enrollmentId", "componentId");

-- AddForeignKey (Restrict)
ALTER TABLE "CourseGradeStructure" ADD CONSTRAINT "CourseGradeStructure_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseGradeStructure" ADD CONSTRAINT "CourseGradeStructure_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Restrict)
ALTER TABLE "CourseGradeComponent" ADD CONSTRAINT "CourseGradeComponent_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "CourseGradeStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Restrict)
ALTER TABLE "CourseGradeEntry" ADD CONSTRAINT "CourseGradeEntry_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseGradeEntry" ADD CONSTRAINT "CourseGradeEntry_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "CourseGradeComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseGradeEntry" ADD CONSTRAINT "CourseGradeEntry_draftedById_fkey" FOREIGN KEY ("draftedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseGradeEntry" ADD CONSTRAINT "CourseGradeEntry_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check Constraints (Amendment A3)
ALTER TABLE "CourseGradeComponent" ADD CONSTRAINT "CourseGradeComponent_maxPoints_check"
  CHECK ("maxPoints" > 0 AND "maxPoints" != 'NaN'::double precision AND "maxPoints" != 'Infinity'::double precision AND "maxPoints" != '-Infinity'::double precision);

ALTER TABLE "CourseGradeStructure" ADD CONSTRAINT "CourseGradeStructure_passMark_check"
  CHECK ("passMark" IS NULL OR ("passMark" >= 0 AND "passMark" != 'NaN'::double precision AND "passMark" != 'Infinity'::double precision AND "passMark" != '-Infinity'::double precision));

ALTER TABLE "CourseGradeEntry" ADD CONSTRAINT "CourseGradeEntry_absence_score_check"
  CHECK (("isAbsent" = TRUE AND "score" IS NULL) OR ("isAbsent" = FALSE AND "score" IS NOT NULL));

ALTER TABLE "CourseGradeEntry" ADD CONSTRAINT "CourseGradeEntry_score_check"
  CHECK ("score" IS NULL OR ("score" >= 0 AND "score" != 'NaN'::double precision AND "score" != 'Infinity'::double precision AND "score" != '-Infinity'::double precision));
