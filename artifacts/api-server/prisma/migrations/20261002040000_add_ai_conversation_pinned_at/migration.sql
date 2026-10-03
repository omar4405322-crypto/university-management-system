-- AlterTable
ALTER TABLE "AIConversation" ADD COLUMN "pinnedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AIConversation_userId_pinnedAt_idx" ON "AIConversation"("userId", "pinnedAt");
