-- CreateTable
CREATE TABLE "SubmissionIntegrityPolicy" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "exactDuplicateBlock" BOOLEAN NOT NULL DEFAULT true,
    "similarityThreshold" DOUBLE PRECISION,
    "updatedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmissionIntegrityPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubmissionIntegrityPolicy_updatedById_idx" ON "SubmissionIntegrityPolicy"("updatedById");

-- AddForeignKey (Restrict)
ALTER TABLE "SubmissionIntegrityPolicy" ADD CONSTRAINT "SubmissionIntegrityPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check Constraints for SubmissionIntegrityPolicy
ALTER TABLE "SubmissionIntegrityPolicy" ADD CONSTRAINT "SubmissionIntegrityPolicy_single_row_check"
    CHECK ("id" = 1);

ALTER TABLE "SubmissionIntegrityPolicy" ADD CONSTRAINT "SubmissionIntegrityPolicy_similarityThreshold_check"
    CHECK ("similarityThreshold" IS NULL OR ("similarityThreshold" > 0 AND "similarityThreshold" <= 1 AND "similarityThreshold" != 'NaN'::double precision AND "similarityThreshold" != 'Infinity'::double precision AND "similarityThreshold" != '-Infinity'::double precision AND ROUND("similarityThreshold"::numeric, 4) = "similarityThreshold"::numeric));

-- AlterTable
ALTER TABLE "CourseMaterial" ADD COLUMN IF NOT EXISTS "fileHash" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaskSubmission_taskId_fileHash_idx" ON "TaskSubmission"("taskId", "fileHash");
