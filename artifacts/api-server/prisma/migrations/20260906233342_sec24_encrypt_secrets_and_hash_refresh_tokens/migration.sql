-- Hard cutover data cleanup for SEC-24 (no live production users)

-- 1. RefreshToken: delete all existing rows since they store plaintext tokens and lack familyId
DELETE FROM "RefreshToken";

-- 2. User: disable 2FA and wipe plaintext secrets for any existing enrolled accounts
UPDATE "User" SET "twoFactorSecret" = NULL, "twoFactorEnabled" = false WHERE "twoFactorSecret" IS NOT NULL;

-- 3. AttendanceSession: delete ephemeral sessions with plaintext secretKey that would fail decryption post-cutover
DELETE FROM "AttendanceSession" WHERE "secretKey" IS NOT NULL;

/*
  Warnings:

  - Added the required column `familyId` to the `RefreshToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "doctorId" SET DEFAULT 'DOC-' || lpad(nextval('doctor_id_seq'::regclass)::text, 5, '0');

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "familyId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "RefreshToken_userId_familyId_idx" ON "RefreshToken"("userId", "familyId");
