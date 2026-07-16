-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('LECTURE', 'LAB', 'TUTORIAL', 'SEMINAR');

-- CreateTable
CREATE TABLE "StudentGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,

    CONSTRAINT "StudentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSection" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "doctorId" INTEGER NOT NULL,

    CONSTRAINT "CourseSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionGroupMapping" (
    "id" SERIAL NOT NULL,
    "courseSectionId" INTEGER NOT NULL,
    "studentGroupId" INTEGER NOT NULL,

    CONSTRAINT "SectionGroupMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSectionOverride" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "courseSectionId" INTEGER NOT NULL,

    CONSTRAINT "StudentSectionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleSlot" (
    "id" SERIAL NOT NULL,
    "courseSectionId" INTEGER NOT NULL,
    "timetableId" INTEGER,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT,
    "sessionType" "SessionType" NOT NULL DEFAULT 'LECTURE',
    "teachingAssistantId" TEXT,

    CONSTRAINT "ScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- DATA MIGRATION SCRIPT START

-- 1. Create Default Groups for every existing Department
INSERT INTO "StudentGroup" ("name", "departmentId")
SELECT DISTINCT 'Default Group', "departmentId" FROM "Student" WHERE "departmentId" IS NOT NULL;

-- 2. Assign all existing students to their department's Default Group
ALTER TABLE "Student" ADD COLUMN "studentGroupId" INTEGER;

UPDATE "Student"
SET "studentGroupId" = sg."id"
FROM "StudentGroup" sg
WHERE "Student"."departmentId" = sg."departmentId" AND sg."name" = 'Default Group';

-- 3. Create a single "Section A" for every existing Course carrying over the doctorId
-- (Fall back to a dummy doctor or first available doctor if course has no doctorId, though usually all courses have one)
-- To ensure NOT NULL, we skip courses without doctorId for now (or assign a default). The user said "every section has a valid doctor".
INSERT INTO "CourseSection" ("courseId", "name", "doctorId")
SELECT "id", 'Section A', "doctorId" FROM "Course" WHERE "doctorId" IS NOT NULL;

-- 4. Create SectionGroupMapping linking the "Default Group" to "Section A"
INSERT INTO "SectionGroupMapping" ("courseSectionId", "studentGroupId")
SELECT cs."id", sg."id"
FROM "CourseSection" cs
JOIN "Course" c ON cs."courseId" = c."id"
JOIN "StudentGroup" sg ON sg."departmentId" = c."departmentId";

-- 5. Convert Schedules to ScheduleSlots
INSERT INTO "ScheduleSlot" ("courseSectionId", "timetableId", "dayOfWeek", "startTime", "endTime", "room", "sessionType")
SELECT cs."id", s."timetableId", s."dayOfWeek", s."startTime", s."endTime", s."room", 'LECTURE'
FROM "Schedule" s
JOIN "CourseSection" cs ON s."courseId" = cs."courseId";

-- DATA MIGRATION SCRIPT END

-- DropForeignKey
ALTER TABLE "DoctorTA" DROP CONSTRAINT "DoctorTA_doctorId_fkey";
ALTER TABLE "DoctorTA" DROP CONSTRAINT "DoctorTA_teachingAssistantId_fkey";
ALTER TABLE "Schedule" DROP CONSTRAINT "Schedule_courseId_fkey";
ALTER TABLE "Schedule" DROP CONSTRAINT "Schedule_timetableId_fkey";

-- DropIndex
DROP INDEX "Course_doctorId_idx";

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "doctorId";
ALTER TABLE "Timetable" DROP COLUMN "scheduleData";

-- DropTable
DROP TABLE "DoctorTA";
DROP TABLE "Schedule";

-- CreateIndex
CREATE UNIQUE INDEX "SectionGroupMapping_courseSectionId_studentGroupId_key" ON "SectionGroupMapping"("courseSectionId", "studentGroupId");
CREATE UNIQUE INDEX "StudentSectionOverride_studentId_courseId_key" ON "StudentSectionOverride"("studentId", "courseId");
CREATE INDEX "ScheduleSlot_courseSectionId_idx" ON "ScheduleSlot"("courseSectionId");
CREATE INDEX "ScheduleSlot_timetableId_idx" ON "ScheduleSlot"("timetableId");
CREATE INDEX "ScheduleSlot_teachingAssistantId_idx" ON "ScheduleSlot"("teachingAssistantId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_studentGroupId_fkey" FOREIGN KEY ("studentGroupId") REFERENCES "StudentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentGroup" ADD CONSTRAINT "StudentGroup_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseSection" ADD CONSTRAINT "CourseSection_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseSection" ADD CONSTRAINT "CourseSection_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SectionGroupMapping" ADD CONSTRAINT "SectionGroupMapping_courseSectionId_fkey" FOREIGN KEY ("courseSectionId") REFERENCES "CourseSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionGroupMapping" ADD CONSTRAINT "SectionGroupMapping_studentGroupId_fkey" FOREIGN KEY ("studentGroupId") REFERENCES "StudentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentSectionOverride" ADD CONSTRAINT "StudentSectionOverride_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentSectionOverride" ADD CONSTRAINT "StudentSectionOverride_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentSectionOverride" ADD CONSTRAINT "StudentSectionOverride_courseSectionId_fkey" FOREIGN KEY ("courseSectionId") REFERENCES "CourseSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_courseSectionId_fkey" FOREIGN KEY ("courseSectionId") REFERENCES "CourseSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "Timetable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_teachingAssistantId_fkey" FOREIGN KEY ("teachingAssistantId") REFERENCES "TeachingAssistant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
