-- AlterTable
ALTER TABLE "College" ADD COLUMN     "descriptionAr" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');
