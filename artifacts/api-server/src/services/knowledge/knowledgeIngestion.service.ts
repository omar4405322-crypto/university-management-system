import prisma from '../../utils/prismaClient';
import logger from '../../utils/logger';
import { extractDocumentContent } from './knowledgeExtractor.service';
import { chunkDocumentPages } from './knowledgeChunker.service';

export async function processDocumentVersion(versionId: string): Promise<void> {
  const version = await prisma.knowledgeDocumentVersion.findUnique({
    where: { id: versionId },
    include: { document: true },
  });

  if (!version) {
    logger.warn('[KnowledgeIngestion] version not found', { versionId });
    return;
  }

  // Mark PROCESSING
  await prisma.knowledgeDocumentVersion.update({
    where: { id: versionId },
    data: { processingStatus: 'PROCESSING', processingError: null },
  });

  try {
    const extraction = await extractDocumentContent(version.fileUrl, version.mimeType);

    if (extraction.isScannedOrTextless) {
      await prisma.knowledgeDocumentVersion.update({
        where: { id: versionId },
        data: {
          processingStatus: 'REQUIRES_OCR',
          processingError: 'Document appears to be a scanned or textless PDF. Reliable OCR processing is required.',
          chunkCount: 0,
        },
      });
      logger.info('[KnowledgeIngestion] Scanned PDF detected, marked REQUIRES_OCR', { versionId });
      return;
    }

    const generatedChunks = chunkDocumentPages(extraction.pages);

    // Save chunks in a transaction
    await prisma.$transaction(async (tx) => {
      // Clear any prior chunks for this version (e.g. if re-processing)
      await tx.knowledgeChunk.deleteMany({
        where: { documentVersionId: versionId },
      });

      if (generatedChunks.length > 0) {
        await tx.knowledgeChunk.createMany({
          data: generatedChunks.map((c) => ({
            documentId: version.documentId,
            documentVersionId: versionId,
            chunkIndex: c.chunkIndex,
            pageNumber: c.pageNumber,
            sectionTitle: c.sectionTitle,
            articleNumber: c.articleNumber,
            content: c.content,
            tokenCount: c.tokenCount,
          })),
        });
      }

      await tx.knowledgeDocumentVersion.update({
        where: { id: versionId },
        data: {
          processingStatus: 'READY',
          chunkCount: generatedChunks.length,
          processingError: null,
        },
      });

      // If document has no activeVersionId, automatically set this ready version as active
      if (!version.document.activeVersionId) {
        await tx.knowledgeDocument.update({
          where: { id: version.documentId },
          data: { activeVersionId: versionId },
        });
      }
    });

    logger.info('[KnowledgeIngestion] Processed document version successfully', {
      versionId,
      documentId: version.documentId,
      chunkCount: generatedChunks.length,
    });
  } catch (err: any) {
    const errorMessage = err?.message || 'Unknown processing error';
    logger.error('[KnowledgeIngestion] Document processing failed', { versionId, error: errorMessage });
    await prisma.knowledgeDocumentVersion.update({
      where: { id: versionId },
      data: {
        processingStatus: 'FAILED',
        processingError: errorMessage.slice(0, 500),
      },
    });
  }
}
