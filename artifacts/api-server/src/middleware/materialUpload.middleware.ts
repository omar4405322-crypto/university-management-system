import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(process.cwd(), 'uploads/materials');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${safeOriginal}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow PDFs, Word, PowerPoint, Excel, Images, Text, ZIP, RAR, MP4
  const allowedExtensions = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|zip|rar|7z|png|jpg|jpeg|webp|mp4|webm|mkv)$/i;
  if (allowedExtensions.test(path.extname(file.originalname))) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file format. Allowed formats: PDF, Office docs, Zip, Images, Video (MP4/WebM).'));
  }
};

const materialUpload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max limit
  },
  fileFilter,
});

export default materialUpload;
