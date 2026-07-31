-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "doctorId" INTEGER;

-- AlterTable
ALTER TABLE "CourseSection" ADD COLUMN     "timetableId" INTEGER;

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSection" ADD CONSTRAINT "CourseSection_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "Timetable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
