import multer from 'multer';
import type { RequestHandler, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileTypeFromFile } from 'file-type';
import { AppError } from '../utils/appError';

const uploadDir = path.join(process.cwd(), 'uploads/knowledge');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const KNOWLEDGE_FILE_SIZE_LIMIT = 20 * 1024 * 1024; // 20 MB

const binaryTypeAllowlist: Record<string, ReadonlySet<string>> = {
  'application/pdf': new Set(['.pdf']),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': new Set(['.docx']),
};

const textExtensions = new Set(['.txt', '.md', '.markdown']);

export function setKnowledgeDownloadHeaders(response: Response, filename?: string): void {
  const safeName = (filename || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
  response.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    callback(null, `${uniqueSuffix}-${safeOriginal}`);
  },
});

export function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

export async function verifyKnowledgeFile(
  filePath: string,
  originalName: string
): Promise<{ mime: string; fileHash: string; fileSize: number }> {
  const stat = await fs.promises.stat(filePath);
  if (stat.size > KNOWLEDGE_FILE_SIZE_LIMIT) {
    throw new AppError('File exceeds maximum allowed size of 20MB', 400);
  }
  if (stat.size === 0) {
    throw new AppError('Empty file cannot be processed', 400);
  }

  const extension = path.extname(originalName).toLowerCase();
  const fileHash = await computeFileSha256(filePath);

  // Text / Markdown files
  if (textExtensions.has(extension)) {
    // Read first 8KB to check for null bytes/executables
    const buffer = await fs.promises.readFile(filePath);
    for (let i = 0; i < Math.min(buffer.length, 8192); i++) {
      if (buffer[i] === 0) {
        throw new AppError('Text document contains illegal null bytes/binary content', 400);
      }
    }
    const mime = extension === '.md' || extension === '.markdown' ? 'text/markdown' : 'text/plain';
    return { mime, fileHash, fileSize: stat.size };
  }

  // Binary files: PDF / DOCX
  let detected;
  try {
    detected = await fileTypeFromFile(filePath);
  } catch {
    throw new AppError('File content could not be verified against allowed document formats', 400);
  }

  const allowedExtensions = detected ? binaryTypeAllowlist[detected.mime] : undefined;
  if (!detected || !allowedExtensions?.has(extension)) {
    throw new AppError('File content does not match an allowed official document format (PDF, DOCX, TXT, MD)', 400);
  }

  return {
    mime: detected.mime,
    fileHash,
    fileSize: stat.size,
  };
}

async function removeRejectedUpload(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fileHash?: string;
      }
    }
  }
}

const uploader = multer({
  storage,
  limits: { fileSize: KNOWLEDGE_FILE_SIZE_LIMIT },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowedExt = ext === '.pdf' || ext === '.docx' || textExtensions.has(ext);
    if (!isAllowedExt) {
      return callback(new AppError('Only official document formats (.pdf, .docx, .txt, .md) are supported', 400));
    }
    callback(null, true);
  },
});

export const knowledgeUpload = {
  single(fieldName: string): RequestHandler {
    const uploadSingle = uploader.single(fieldName);
    return (req, res, next) => {
      uploadSingle(req, res, async error => {
        if (error) {
          if (req.file?.path) {
            await removeRejectedUpload(req.file.path);
          }
          return next(error);
        }
        if (!req.file) return next();

        try {
          const verified = await verifyKnowledgeFile(req.file.path, req.file.originalname);
          req.file.mimetype = verified.mime;
          req.file.size = verified.fileSize;
          req.file.fileHash = verified.fileHash;
          next();
        } catch (verificationError) {
          try {
            await removeRejectedUpload(req.file.path);
          } catch {
            return next(new AppError('Rejected upload could not be safely removed', 500));
          }
          next(verificationError);
        }
      });
    };
  },
};

export default knowledgeUpload;
