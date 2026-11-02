import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { fileTypeFromBuffer } from 'file-type';
import { AppError } from '../utils/appError';
import logger from '../utils/logger';

export const TASK_SUBMISSION_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB ceiling

export const ALLOWED_TASK_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'zip',
  'rar',
  '7z',
  'png',
  'jpg',
  'jpeg',
  'webp',
]);

/**
 * Safely resolves and validates a target storage path within an allowed base directory.
 * Uses path.resolve + path.relative to reject sibling prefixes (e.g. tasks-evil),
 * parent traversal ('..'), empty paths, and absolute escape paths.
 */
export function resolveSafeTaskSubmissionStoragePath(
  baseDir: string,
  targetPath: string
): string | null {
  if (!baseDir || !targetPath || typeof baseDir !== 'string' || typeof targetPath !== 'string') {
    return null;
  }
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  const rel = path.relative(resolvedBase, resolvedTarget);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  return resolvedTarget;
}

/**
 * Clean up an uploaded task file from disk on any rejection/error.
 */
export function cleanupTaskFile(filePath: string | undefined | null): void {
  if (!filePath) return;
  try {
    const allowedDir = path.resolve(process.cwd(), 'uploads/tasks');
    const safePath = resolveSafeTaskSubmissionStoragePath(allowedDir, filePath);
    if (safePath && fs.existsSync(safePath)) {
      fs.unlinkSync(safePath);
    }
  } catch {
    // Ignore error if file does not exist or was already removed
  }
}

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: TASK_SUBMISSION_MAX_FILE_SIZE,
  },
});

/**
 * Task submission upload middleware with layered defenses:
 * 1. 25MB hard ceiling (TASK_SUBMISSION_MAX_FILE_SIZE)
 * 2. Extension allowlist matching
 * 3. Double extension and null byte rejection
 * 4. Magic-byte signature matching
 * 5. Sanitized original name and server-generated storage key
 * 6. Server-side computed SHA-256 hash
 * 7. Zero-orphan cleanup on any rejection
 */
export const taskSubmissionUpload = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    // Pass through non-multipart requests (e.g. application/json link submissions)
    return next();
  }

  memoryUpload.single('file')(req, res, async (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new AppError(
            `File size exceeds maximum allowed limit of ${TASK_SUBMISSION_MAX_FILE_SIZE / (1024 * 1024)}MB`,
            400
          )
        );
      }
      return next(new AppError(err.message || 'File upload error', 400));
    }

    if (!req.file) {
      // No file provided in multipart form, pass through to let controller/service validate
      return next();
    }

    try {
      const originalName = req.file.originalname || '';

      // Reject null bytes
      if (originalName.includes('\0') || originalName.includes('%00')) {
        return next(new AppError('Filename contains invalid characters', 400));
      }

      // Reject double extensions
      const nameParts = originalName.split('.');
      if (nameParts.length > 2) {
        return next(
          new AppError(
            'Double file extensions are not allowed for security reasons',
            400
          )
        );
      }
      if (nameParts.length < 2) {
        return next(new AppError('File must have an extension', 400));
      }

      const ext = nameParts[nameParts.length - 1].toLowerCase();
      if (!ALLOWED_TASK_EXTENSIONS.has(ext)) {
        return next(
          new AppError(
            `File extension .${ext} is not allowed. Allowed extensions: ${Array.from(ALLOWED_TASK_EXTENSIONS).join(', ')}`,
            400
          )
        );
      }

      // Check for executable binaries (MZ header)
      if (
        req.file.buffer.length >= 2 &&
        req.file.buffer[0] === 0x4d &&
        req.file.buffer[1] === 0x5a
      ) {
        return next(
          new AppError('Executable files (.exe) are strictly prohibited', 400)
        );
      }

      // Magic-byte inspection
      const detected = await fileTypeFromBuffer(req.file.buffer);

      if (ext === 'pdf') {
        const isPdfMagic =
          req.file.buffer.length >= 4 &&
          req.file.buffer[0] === 0x25 &&
          req.file.buffer[1] === 0x50 &&
          req.file.buffer[2] === 0x44 &&
          req.file.buffer[3] === 0x46; // %PDF
        if (!isPdfMagic && detected?.ext !== 'pdf') {
          return next(
            new AppError('File content does not match .pdf extension', 400)
          );
        }
      } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
        const normExt = ext === 'jpeg' ? 'jpg' : ext;
        const normDetected = detected?.ext === 'jpeg' ? 'jpg' : detected?.ext;
        if (!detected || normDetected !== normExt) {
          return next(
            new AppError(
              `File content does not match .${ext} image extension`,
              400
            )
          );
        }
      } else if (['docx', 'xlsx', 'pptx', 'zip'].includes(ext)) {
        const isZipMagic =
          req.file.buffer.length >= 4 &&
          req.file.buffer[0] === 0x50 &&
          req.file.buffer[1] === 0x4b; // PK
        if (!isZipMagic && detected?.ext !== 'zip' && detected?.ext !== ext) {
          return next(
            new AppError(
              `File content does not match .${ext} archive/document extension`,
              400
            )
          );
        }
      } else if (ext === 'rar') {
        if (detected?.ext !== 'rar') {
          return next(
            new AppError('File content does not match .rar extension', 400)
          );
        }
      } else if (ext === '7z') {
        if (detected?.ext !== '7z') {
          return next(
            new AppError('File content does not match .7z extension', 400)
          );
        }
      } else if (['doc', 'xls', 'ppt'].includes(ext)) {
        const isCfb =
          req.file.buffer.length >= 4 &&
          req.file.buffer[0] === 0xd0 &&
          req.file.buffer[1] === 0xcf;
        if (!isCfb && detected?.ext !== ext && detected?.mime !== 'application/x-cfb') {
          return next(
            new AppError(
              `File content does not match .${ext} document extension`,
              400
            )
          );
        }
      } else if (ext === 'txt') {
        if (req.file.buffer.includes(0) || detected !== undefined) {
          return next(
            new AppError('File content is not valid plain text', 400)
          );
        }
      }

      // Compute SHA-256 hex hash server-side
      const fileHash = crypto
        .createHash('sha256')
        .update(req.file.buffer)
        .digest('hex');

      // Server-generated storage key
      const sanitizedBase = nameParts[0]
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 50);
      const storageKey = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${sanitizedBase}.${ext}`;

      const uploadDir = path.resolve(process.cwd(), 'uploads/tasks');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const destinationPath = path.join(uploadDir, storageKey);
      await fs.promises.writeFile(destinationPath, req.file.buffer);

      // Populate req.file fields matching multer diskStorage interface
      req.file.filename = storageKey;
      req.file.path = destinationPath;
      req.file.destination = uploadDir;
      (req.file as any).storageKey = storageKey;
      (req.file as any).fileHash = fileHash;
      (req.file as any).detectedType =
        detected?.mime || (ext === 'txt' ? 'text/plain' : req.file.mimetype);

      next();
    } catch (validationErr) {
      next(validationErr);
    }
  });
};
