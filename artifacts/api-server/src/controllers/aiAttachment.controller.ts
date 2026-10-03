import type { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { AppError } from '../utils/appError';
import * as aiAttachmentService from '../services/aiAttachment.service';
import { getAiAttachmentStorage } from '../services/aiAttachmentStorage.service';

export const uploadAiAttachmentController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const conversationId = String(req.params.id);

  if (!req.file) {
    throw new AppError('File is required', 400);
  }

  const result = await aiAttachmentService.uploadConversationAttachment(
    userId,
    conversationId,
    req.file,
  );

  return res.status(201).json({
    success: true,
    data: {
      attachment: result,
    },
  });
});

export const listAiAttachmentsController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const conversationId = String(req.params.id);

  const attachments = await aiAttachmentService.listConversationAttachments(userId, conversationId);
  return res.json({
    success: true,
    data: {
      attachments,
    },
  });
});

export const getAiAttachmentController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const conversationId = String(req.params.id);
  const attachmentId = String(req.params.attachmentId);

  const attachment = await aiAttachmentService.getConversationAttachment(userId, conversationId, attachmentId);
  return res.json({
    success: true,
    data: {
      attachment: {
        id: attachment.id,
        originalFilename: attachment.originalFilename,
        mimeType: attachment.mimeType,
        byteSize: attachment.byteSize,
        fileHash: attachment.fileHash,
        processingStatus: attachment.processingStatus,
        pageCount: attachment.pageCount,
        errorMessage: attachment.errorMessage,
        createdAt: attachment.createdAt,
      },
    },
  });
});

export const downloadAiAttachmentController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const conversationId = String(req.params.id);
  const attachmentId = String(req.params.attachmentId);

  const attachment = await aiAttachmentService.getConversationAttachment(userId, conversationId, attachmentId);
  const storage = getAiAttachmentStorage();
  const fileBuffer = await storage.read(attachment.storageKey);

  const safeName = attachment.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.send(fileBuffer);
});

export const deleteAiAttachmentController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const conversationId = String(req.params.id);
  const attachmentId = String(req.params.attachmentId);

  await aiAttachmentService.deleteConversationAttachment(userId, conversationId, attachmentId);
  return res.json({
    success: true,
    message: 'Attachment deleted',
  });
});
