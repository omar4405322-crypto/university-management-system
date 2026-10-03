-- CreateTable
CREATE TABLE "AIConversationAttachment" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "processingStatus" "KnowledgeProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "extractedText" TEXT,
    "pageCount" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIConversationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIConversationAttachment_conversationId_userId_idx" ON "AIConversationAttachment"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "AIConversationAttachment_userId_fileHash_idx" ON "AIConversationAttachment"("userId", "fileHash");

-- CreateIndex
CREATE INDEX "AIConversationAttachment_messageId_idx" ON "AIConversationAttachment"("messageId");

-- AddForeignKey
ALTER TABLE "AIConversationAttachment" ADD CONSTRAINT "AIConversationAttachment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversationAttachment" ADD CONSTRAINT "AIConversationAttachment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversationAttachment" ADD CONSTRAINT "AIConversationAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AIMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
