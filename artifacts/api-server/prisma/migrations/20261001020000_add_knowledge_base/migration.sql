-- CreateEnum
CREATE TYPE "KnowledgeDocumentType" AS ENUM ('BYLAW', 'REGULATION', 'HANDBOOK', 'POLICY', 'PROCEDURE', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentScope" AS ENUM ('GLOBAL', 'COLLEGE', 'DEPARTMENT');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'REQUIRES_OCR', 'FAILED');

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT,
    "documentType" "KnowledgeDocumentType" NOT NULL DEFAULT 'REGULATION',
    "scope" "KnowledgeDocumentScope" NOT NULL DEFAULT 'GLOBAL',
    "collegeId" INTEGER,
    "departmentId" INTEGER,
    "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activeVersionId" TEXT,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "versionTag" TEXT,
    "originalFilename" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "uploadedById" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStatus" "KnowledgeProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "chunkCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KnowledgeDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "pageNumber" INTEGER,
    "sectionTitle" TEXT,
    "articleNumber" TEXT,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "embedding" JSONB,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessageCitation" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "chunkId" TEXT,
    "documentTitle" TEXT NOT NULL,
    "documentTitleAr" TEXT,
    "version" INTEGER,
    "pageNumber" INTEGER,
    "sectionTitle" TEXT,
    "articleNumber" TEXT,
    "quote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessageCitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_activeVersionId_key" ON "KnowledgeDocument"("activeVersionId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_scope_status_idx" ON "KnowledgeDocument"("scope", "status");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_collegeId_idx" ON "KnowledgeDocument"("collegeId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_departmentId_idx" ON "KnowledgeDocument"("departmentId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_documentType_idx" ON "KnowledgeDocument"("documentType");

-- CreateIndex
CREATE INDEX "KnowledgeDocumentVersion_fileHash_idx" ON "KnowledgeDocumentVersion"("fileHash");

-- CreateIndex
CREATE INDEX "KnowledgeDocumentVersion_processingStatus_idx" ON "KnowledgeDocumentVersion"("processingStatus");

-- CreateIndex
CREATE INDEX "KnowledgeDocumentVersion_effectiveDate_idx" ON "KnowledgeDocumentVersion"("effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocumentVersion_documentId_version_key" ON "KnowledgeDocumentVersion"("documentId", "version");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_documentVersionId_chunkIndex_idx" ON "KnowledgeChunk"("documentVersionId", "chunkIndex");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_documentId_idx" ON "KnowledgeChunk"("documentId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_pageNumber_idx" ON "KnowledgeChunk"("pageNumber");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_content_search_idx" ON "KnowledgeChunk" USING gin (to_tsvector('simple', "content"));

-- CreateIndex
CREATE INDEX "AIMessageCitation_messageId_idx" ON "AIMessageCitation"("messageId");

-- CreateIndex
CREATE INDEX "AIMessageCitation_documentVersionId_idx" ON "AIMessageCitation"("documentVersionId");

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "KnowledgeDocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocumentVersion" ADD CONSTRAINT "KnowledgeDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocumentVersion" ADD CONSTRAINT "KnowledgeDocumentVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "KnowledgeDocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessageCitation" ADD CONSTRAINT "AIMessageCitation_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AIMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessageCitation" ADD CONSTRAINT "AIMessageCitation_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "KnowledgeDocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessageCitation" ADD CONSTRAINT "AIMessageCitation_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "KnowledgeChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
