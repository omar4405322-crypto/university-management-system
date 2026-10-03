-- CreateEnum
CREATE TYPE "AIMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AIMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIConversation_userId_updatedAt_idx" ON "AIConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AIConversation_userId_archivedAt_idx" ON "AIConversation"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_sequence_idx" ON "AIMessage"("conversationId", "sequence");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON "AIMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
