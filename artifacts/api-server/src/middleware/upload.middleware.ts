import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { fileTypeFromBuffer } from 'file-type';
import { AppError } from '../utils/appError';
import logger from '../utils/logger';

/**
 * Checks if Cloudinary credentials are fully configured.
 */
export const isCloudinaryConfigured = (): boolean => {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_DETECTED_EXTS = ['jpg', 'jpeg', 'png', 'webp'];

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only .png, .jpg, .jpeg and .webp format allowed!', 400));
  }
};

let cachedCloudinaryUpload: multer.Multer | null = null;
let cachedCloudinaryKey = '';

const getCloudinaryUpload = (): multer.Multer => {
  const currentKey = `${process.env.CLOUDINARY_CLOUD_NAME}:${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`;
  if (!cachedCloudinaryUpload || cachedCloudinaryKey !== currentKey) {
    cachedCloudinaryKey = currentKey;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const storage = new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'university-management/profiles',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 500, height: 500, crop: 'limit' }],
      } as any,
    });

    cachedCloudinaryUpload = multer({
      storage: storage,
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
      },
      fileFilter: fileFilter,
    });
  }
  return cachedCloudinaryUpload;
};

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: fileFilter,
});

/**
 * Upload middleware for user profile pictures with dual defense:
 * 1. Fail-closed 503 in production if Cloudinary is not configured (no silent local-disk fallback).
 * 2. Magic-byte inspection & safe server-generated extension on local-disk path (in dev).
 */
const upload = {
  single(fieldName: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const isProd = process.env.NODE_ENV === 'production';
      const cloudinaryReady = isCloudinaryConfigured();

      // 1. Fail-closed in production if Cloudinary credentials are missing
      if (isProd && !cloudinaryReady) {
        logger.warn(
          '[STORAGE] Profile picture upload rejected: Cloudinary credentials missing in production (local disk fallback disabled)'
        );
        res.status(503).json({
          success: false,
          status: 'error',
          message: 'Profile picture storage is not configured',
        });
        return;
      }

      // 2. Cloudinary path if configured
      if (cloudinaryReady) {
        const cloudinaryUploader = getCloudinaryUpload();
        cloudinaryUploader.single(fieldName)(req, res, next);
        return;
      }

      // 3. Hardened local disk path (development / non-production)
      memoryUpload.single(fieldName)(req, res, async (err: any) => {
        if (err) {
          return next(err);
        }

        // If no file was sent, let downstream controller handle missing file validation
        if (!req.file) {
          return next();
        }

        try {
          // Magic-byte inspection using file-type
          const detected = await fileTypeFromBuffer(req.file.buffer);

          if (
            !detected ||
            !ALLOWED_MIME_TYPES.includes(detected.mime) ||
            !ALLOWED_DETECTED_EXTS.includes(detected.ext)
          ) {
            logger.warn(
              `[SECURITY] Profile upload rejected: Magic-byte mismatch (Header: ${req.file.mimetype}, Detected: ${detected?.mime || 'unknown'})`
            );
            return next(
              new AppError(
                'Invalid image file content: Magic-byte inspection failed',
                400
              )
            );
          }

          // Generate safe extension strictly from server-detected real type, never from originalname
          const safeExt = detected.ext === 'jpeg' ? 'jpg' : detected.ext;
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const safeFilename = `${req.file.fieldname}-${uniqueSuffix}.${safeExt}`;

          const uploadDir = path.join(process.cwd(), 'uploads/profiles');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          const destinationPath = path.join(uploadDir, safeFilename);
          await fs.promises.writeFile(destinationPath, req.file.buffer);

          // Populate req.file fields matching multer diskStorage interface
          req.file.filename = safeFilename;
          req.file.path = destinationPath;
          req.file.destination = uploadDir;
          req.file.mimetype = detected.mime;

          next();
        } catch (validationErr) {
          next(validationErr);
        }
      });
    };
  },
};

export default upload;
