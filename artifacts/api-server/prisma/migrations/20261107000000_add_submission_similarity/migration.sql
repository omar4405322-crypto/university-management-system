-- CreateTable
CREATE TABLE "TaskSubmissionFingerprint" (
    "id" TEXT NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "signature" BYTEA,
    "shingleCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskSubmissionFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionSimilarityFlag" (
    "id" TEXT NOT NULL,
    "taskId" INTEGER NOT NULL,
    "submissionAId" INTEGER NOT NULL,
    "submissionBId" INTEGER NOT NULL,
    "fileHashA" TEXT NOT NULL,
    "fileHashB" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "thresholdUsed" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionSimilarityFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskSubmissionFingerprint_submissionId_key" ON "TaskSubmissionFingerprint"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionSimilarityFlag_submissionAId_submissionBId_fileHashA_fileHashB_key" ON "SubmissionSimilarityFlag"("submissionAId", "submissionBId", "fileHashA", "fileHashB");

-- CreateIndex
CREATE INDEX "SubmissionSimilarityFlag_taskId_status_idx" ON "SubmissionSimilarityFlag"("taskId", "status");

-- CreateIndex
CREATE INDEX "SubmissionSimilarityFlag_submissionBId_idx" ON "SubmissionSimilarityFlag"("submissionBId");

-- AddForeignKey
ALTER TABLE "TaskSubmissionFingerprint" ADD CONSTRAINT "TaskSubmissionFingerprint_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "TaskSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionSimilarityFlag" ADD CONSTRAINT "SubmissionSimilarityFlag_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionSimilarityFlag" ADD CONSTRAINT "SubmissionSimilarityFlag_submissionAId_fkey" FOREIGN KEY ("submissionAId") REFERENCES "TaskSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionSimilarityFlag" ADD CONSTRAINT "SubmissionSimilarityFlag_submissionBId_fkey" FOREIGN KEY ("submissionBId") REFERENCES "TaskSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionSimilarityFlag" ADD CONSTRAINT "SubmissionSimilarityFlag_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check Constraints for TaskSubmissionFingerprint
ALTER TABLE "TaskSubmissionFingerprint" ADD CONSTRAINT "TaskSubmissionFingerprint_status_check"
    CHECK ("status" IN ('READY', 'UNSUPPORTED', 'FAILED'));

ALTER TABLE "TaskSubmissionFingerprint" ADD CONSTRAINT "TaskSubmissionFingerprint_signature_ready_check"
    CHECK (("status" = 'READY' AND "signature" IS NOT NULL) OR ("status" != 'READY' AND "signature" IS NULL));

ALTER TABLE "TaskSubmissionFingerprint" ADD CONSTRAINT "TaskSubmissionFingerprint_shingleCount_check"
    CHECK ("shingleCount" >= 0);

-- Check Constraints for SubmissionSimilarityFlag
ALTER TABLE "SubmissionSimilarityFlag" ADD CONSTRAINT "SubmissionSimilarityFlag_pair_order_check"
    CHECK ("submissionAId" < "submissionBId");

ALTER TABLE "SubmissionSimilarityFlag" ADD CONSTRAINT "SubmissionSimilarityFlag_similarityScore_check"
    CHECK ("similarityScore" > 0 AND "similarityScore" <= 1 AND "similarityScore" != 'NaN'::double precision AND "similarityScore" != 'Infinity'::double precision AND "similarityScore" != '-Infinity'::double precision);

ALTER TABLE "SubmissionSimilarityFlag" ADD CONSTRAINT "SubmissionSimilarityFlag_thresholdUsed_check"
    CHECK ("thresholdUsed" > 0 AND "thresholdUsed" <= 1 AND "thresholdUsed" != 'NaN'::double precision AND "thresholdUsed" != 'Infinity'::double precision AND "thresholdUsed" != '-Infinity'::double precision);

ALTER TABLE "SubmissionSimilarityFlag" ADD CONSTRAINT "SubmissionSimilarityFlag_status_check"
    CHECK ("status" IN ('PENDING', 'CONFIRMED', 'DISMISSED'));

ALTER TABLE "SubmissionSimilarityFlag" ADD CONSTRAINT "SubmissionSimilarityFlag_review_integrity_check"
    CHECK (("status" = 'PENDING' AND "reviewedById" IS NULL AND "reviewedAt" IS NULL) OR ("status" != 'PENDING' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL));
