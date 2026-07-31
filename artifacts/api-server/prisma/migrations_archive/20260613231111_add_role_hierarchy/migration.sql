-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "managedDepartmentId" INTEGER;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managedDepartmentId_fkey" FOREIGN KEY ("managedDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
