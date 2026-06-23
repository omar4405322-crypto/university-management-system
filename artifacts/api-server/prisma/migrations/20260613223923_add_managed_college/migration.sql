/*
  Warnings:

  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_managedCollegeId_fkey";

-- DropIndex
DROP INDEX "Attendance_studentId_courseId_date_key";

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managedCollegeId_fkey" FOREIGN KEY ("managedCollegeId") REFERENCES "College"("id") ON DELETE SET NULL ON UPDATE CASCADE;
