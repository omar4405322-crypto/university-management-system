import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// ─── Cloudinary configuration (shared) ───────────────────────────────────────

const isCloudinaryConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// ─── Profile upload (images only, 2 MB) ──────────────────────────────────────

let profileStorage: multer.StorageEngine;

if (isCloudinaryConfigured) {
  profileStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'university-management/profiles',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 500, height: 500, crop: 'limit' }],
    } as any,
  });
} else {
  const uploadDir = path.join(__dirname, '../../uploads/profiles');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  profileStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
  });
}

const profileFileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only .png, .jpg, .jpeg and .webp format allowed!'));
  }
};

const upload = multer({
  storage: profileStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: profileFileFilter,
});

// ─── Exam file upload (PDF, DOCX, images — up to 20 MB) ──────────────────────

let examStorage: multer.StorageEngine;

if (isCloudinaryConfigured) {
  examStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'university-management/exam-submissions',
      allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
      resource_type: 'auto',
    } as any,
  });
} else {
  const examUploadDir = path.join(__dirname, '../../uploads/exam-submissions');
  if (!fs.existsSync(examUploadDir)) fs.mkdirSync(examUploadDir, { recursive: true });

  examStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, examUploadDir),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${file.originalname}`),
  });
}

export const uploadExamFile = multer({
  storage: examStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// ─── Default export (backwards-compatible with existing routes) ───────────────
export default upload;
