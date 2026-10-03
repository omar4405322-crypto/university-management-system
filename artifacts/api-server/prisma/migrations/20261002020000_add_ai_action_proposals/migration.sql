-- CreateEnum
CREATE TYPE "AIActionStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'EXECUTING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'EXPIRED', 'STALE');

-- CreateTable
CREATE TABLE "AIActionProposal" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "conversationId" TEXT,
    "sourceUserMessageId" TEXT,
    "idempotencyKey" TEXT,
    "actionType" TEXT NOT NULL,
    "normalizedPayload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "humanReadableSummary" TEXT NOT NULL,
    "humanReadableSummaryAr" TEXT,
    "previewData" JSONB NOT NULL,
    "status" "AIActionStatus" NOT NULL DEFAULT 'PROPOSED',
    "failureCode" TEXT,
    "failureReason" TEXT,
    "executionResult" JSONB,
    "targetEntityId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),

    CONSTRAINT "AIActionProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIActionProposal_idempotencyKey_key" ON "AIActionProposal"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AIActionProposal_userId_status_idx" ON "AIActionProposal"("userId", "status");

-- CreateIndex
CREATE INDEX "AIActionProposal_conversationId_idx" ON "AIActionProposal"("conversationId");

-- CreateIndex
CREATE INDEX "AIActionProposal_payloadHash_userId_status_idx" ON "AIActionProposal"("payloadHash", "userId", "status");

-- CreateIndex
CREATE INDEX "AIActionProposal_expiresAt_idx" ON "AIActionProposal"("expiresAt");

-- AddForeignKey
ALTER TABLE "AIActionProposal" ADD CONSTRAINT "AIActionProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIActionProposal" ADD CONSTRAINT "AIActionProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
