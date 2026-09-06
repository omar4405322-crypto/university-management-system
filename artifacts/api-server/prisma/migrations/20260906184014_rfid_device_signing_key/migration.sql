-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');

-- AlterTable
ALTER TABLE "RfidDevice" ADD COLUMN     "signingKeyEncrypted" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "secretHash" DROP NOT NULL;
