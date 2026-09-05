import multer from 'multer';
import type { RequestHandler, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileTypeFromFile } from 'file-type';
import { AppError } from '../utils/appError';

const uploadDir = path.join(process.cwd(), 'uploads/materials');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const detectedTypeAllowlist: Record<string, ReadonlySet<string>> = {
  'application/pdf': new Set(['.pdf']),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': new Set(['.docx']),
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': new Set(['.pptx']),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': new Set(['.xlsx']),
  'application/x-cfb': new Set(['.doc', '.ppt', '.xls']),
  'application/zip': new Set(['.zip']),
  'application/x-rar-compressed': new Set(['.rar']),
  'application/x-7z-compressed': new Set(['.7z']),
  'image/png': new Set(['.png']),
  'image/jpeg': new Set(['.jpg', '.jpeg']),
  'image/webp': new Set(['.webp']),
  'video/mp4': new Set(['.mp4']),
  'video/webm': new Set(['.webm']),
  'video/x-matroska': new Set(['.mkv']),
};

const declaredMimeAllowlist = new Set([
  ...Object.keys(detectedTypeAllowlist),
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
]);

export const isDeclaredMaterialMimeAllowed = (mime: string): boolean =>
  declaredMimeAllowlist.has(mime.toLowerCase());

export function setMaterialDownloadHeaders(response: Response): void {
  response.setHeader('Content-Disposition', 'attachment');
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

const uploader = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!isDeclaredMaterialMimeAllowed(file.mimetype)) {
      return callback(new AppError('Unsupported material MIME type', 400));
    }
    callback(null, true);
  },
});

export async function verifyMaterialFileSignature(
  filePath: string,
  originalName: string
): Promise<string> {
  let detected;
  try {
    detected = await fileTypeFromFile(filePath);
  } catch {
    throw new AppError(
      'File content does not match an allowed material type',
      400
    );
  }
  const extension = path.extname(originalName).toLowerCase();
  const allowedExtensions = detected
    ? detectedTypeAllowlist[detected.mime]
    : undefined;

  if (!detected || !allowedExtensions?.has(extension)) {
    throw new AppError(
      'File content does not match an allowed material type',
      400
    );
  }

  return detected.mime;
}

async function removeRejectedUpload(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const materialUpload = {
  single(fieldName: string): RequestHandler {
    const uploadSingle = uploader.single(fieldName);
    return (req, res, next) => {
      uploadSingle(req, res, error => {
        if (error) return next(error);
        if (!req.file) return next();

        void verifyMaterialFileSignature(req.file.path, req.file.originalname)
          .then(detectedMime => {
            req.file!.mimetype = detectedMime;
            next();
          })
          .catch(async verificationError => {
            try {
              await removeRejectedUpload(req.file!.path);
            } catch {
              return next(
                new AppError('Rejected upload could not be safely removed', 500)
              );
            }
            next(verificationError);
          });
      });
    };
  },
};

export default materialUpload;
