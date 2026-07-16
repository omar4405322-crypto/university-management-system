/*
  Warnings:

  - You are about to drop the column `doctorId` on the `Course` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_doctorId_fkey";

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "doctorId";

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');
