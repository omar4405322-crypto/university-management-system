import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { fileTypeFromBuffer } from 'file-type';
import { AppError } from '../utils/appError';
import logger from '../utils/logger';

type CloudinaryConfig = {
  cloud_name: string;
  api_key: string;
  api_secret: string;
};

const getCloudinaryConfig = (): CloudinaryConfig | null => {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();

  return cloud_name && api_key && api_secret
    ? { cloud_name, api_key, api_secret }
    : null;
};

export const isCloudinaryConfigured = (): boolean =>
  getCloudinaryConfig() !== null;

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

const getCloudinaryUpload = (config: CloudinaryConfig): multer.Multer => {
  const currentKey = `${config.cloud_name}:${config.api_key}:${config.api_secret}`;
  if (!cachedCloudinaryUpload || cachedCloudinaryKey !== currentKey) {
    cachedCloudinaryKey = currentKey;
    cloudinary.config(config);

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
 * Upload middleware for user profile pictures with layered defenses:
 * 1. Cloudinary remains the only production upload store when configured.
 * 2. Without Cloudinary, uploaded bytes are validated but discarded in production
 *    so the controller can keep the user's existing/default avatar.
 * 3. Magic-byte inspection & safe server-generated extension on local-disk path (in dev).
 */
const upload = {
  single(fieldName: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const isProd =
        process.env.NODE_ENV?.trim().toLowerCase() === 'production';
      const cloudinaryConfig = getCloudinaryConfig();

      // 1. Cloudinary path if configured
      if (cloudinaryConfig) {
        const cloudinaryUploader = getCloudinaryUpload(cloudinaryConfig);
        cloudinaryUploader.single(fieldName)(req, res, next);
        return;
      }

      // 2. Validate in memory before either default-avatar fallback (production)
      // or hardened local-disk persistence (development).
      memoryUpload.single(fieldName)(req, res, async (err: any) => {
        if (err) {
          if (req.file?.path) {
            try {
              await fs.promises.unlink(req.file.path);
            } catch {
              // Ignore error if file does not exist or was already removed
            }
          }
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

          if (isProd) {
            logger.warn(
              '[STORAGE] Cloudinary credentials missing: keeping the existing/default profile avatar'
            );
            res.locals.profilePictureFallback = true;
            req.file = undefined;
            next();
            return;
          }

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
