import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import { MAX_ATTACHMENT_BYTES } from '../utils/aiAttachmentValidation';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ATTACHMENT_BYTES,
    files: 1,
  },
});

export const handleAiAttachmentUpload = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('Attachment exceeds maximum size of 10MB', 400));
        }
        return next(new AppError(`Upload error: ${err.message}`, 400));
      }
      return next(err as Error);
    }
    if (!req.file) {
      return next(new AppError('No attachment file provided in request', 400));
    }
    next();
  });
};
