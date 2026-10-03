import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '../../utils/appError';
import logger from '../../utils/logger';

export interface StoreKnowledgeFileInput {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  fileHash: string;
  subfolder?: string;
}

export interface StoredKnowledgeFileResult {
  storageKey: string;
  publicUrl?: string;
}

export interface IKnowledgeFileStorage {
  store(input: StoreKnowledgeFileInput): Promise<StoredKnowledgeFileResult>;
  read(storageKey: string): Promise<Buffer>;
  exists(storageKey: string): Promise<boolean>;
  delete(storageKey: string): Promise<void>;
  resolveLocalPath(storageKey: string): string | null;
}

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), 'uploads/knowledge');

function sanitizeFilename(original: string): string {
  const ext = path.extname(original).toLowerCase();
  const base = path.basename(original, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
  return `${base}${ext}`;
}

/**
 * Local filesystem implementation for development and testing.
 * Uses normalized platform-independent storage keys (never absolute Windows paths).
 */
export class LocalKnowledgeFileStorage implements IKnowledgeFileStorage {
  private baseDir: string;

  constructor(baseDir = LOCAL_STORAGE_DIR) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  resolveLocalPath(storageKey: string): string | null {
    if (!storageKey) return null;
    // Strip leading "knowledge/" prefix if present
    const cleanKey = storageKey.replace(/^knowledge\//, '');
    const resolved = path.resolve(this.baseDir, cleanKey);
    // Path traversal defense: resolved path must start with baseDir
    if (!resolved.startsWith(this.baseDir)) {
      throw new AppError('Invalid storage path traversal attempt', 400);
    }
    return resolved;
  }

  async store(input: StoreKnowledgeFileInput): Promise<StoredKnowledgeFileResult> {
    const safeName = sanitizeFilename(input.originalFilename);
    const subfolder = input.subfolder || 'versions';
    const relativeKey = `knowledge/${subfolder}/${input.fileHash}_${safeName}`;
    const cleanKey = `${subfolder}/${input.fileHash}_${safeName}`;
    const targetDir = path.join(this.baseDir, subfolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(this.baseDir, cleanKey);
    await fs.promises.writeFile(targetPath, input.buffer);

    logger.debug('[KnowledgeStorage] Stored file locally', { storageKey: relativeKey, bytes: input.buffer.length });
    return {
      storageKey: relativeKey,
    };
  }

  async read(storageKey: string): Promise<Buffer> {
    // If legacy absolute path was passed, check if it exists safely
    if (path.isAbsolute(storageKey) && fs.existsSync(storageKey)) {
      return fs.promises.readFile(storageKey);
    }

    const resolved = this.resolveLocalPath(storageKey);
    if (!resolved || !fs.existsSync(resolved)) {
      throw new AppError(`Knowledge document file not found in storage: ${storageKey}`, 404);
    }
    return fs.promises.readFile(resolved);
  }

  async exists(storageKey: string): Promise<boolean> {
    if (path.isAbsolute(storageKey)) {
      return fs.existsSync(storageKey);
    }
    const resolved = this.resolveLocalPath(storageKey);
    return Boolean(resolved && fs.existsSync(resolved));
  }

  async delete(storageKey: string): Promise<void> {
    try {
      const resolved = path.isAbsolute(storageKey) ? storageKey : this.resolveLocalPath(storageKey);
      if (resolved && fs.existsSync(resolved)) {
        await fs.promises.unlink(resolved);
        logger.debug('[KnowledgeStorage] Deleted file from local storage', { storageKey });
      }
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        logger.warn('[KnowledgeStorage] Error deleting local file', { storageKey, error: err.message });
      }
    }
  }
}

/**
 * Cloudinary durable storage provider for raw official documents.
 */
export class CloudinaryKnowledgeFileStorage implements IKnowledgeFileStorage {
  resolveLocalPath(_storageKey: string): string | null {
    return null;
  }

  async store(input: StoreKnowledgeFileInput): Promise<StoredKnowledgeFileResult> {
    const subfolder = input.subfolder || 'versions';
    const publicId = `university-management/knowledge/${subfolder}/${input.fileHash}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          public_id: publicId,
          overwrite: true,
        },
        (error, result) => {
          if (error || !result) {
            logger.error('[KnowledgeStorage] Cloudinary raw upload failed', { error });
            return reject(new AppError('Failed to store document in durable cloud storage', 502));
          }
          resolve({
            storageKey: result.public_id,
            publicUrl: result.secure_url,
          });
        }
      );
      uploadStream.end(input.buffer);
    });
  }

  async read(storageKey: string): Promise<Buffer> {
    const url = cloudinary.url(storageKey, { resource_type: 'raw', secure: true });
    const response = await fetch(url);
    if (!response.ok) {
      throw new AppError(`Failed to retrieve file from durable cloud storage (${response.status})`, 404);
    }
    const arrayBuf = await response.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      const result = await cloudinary.api.resource(storageKey, { resource_type: 'raw' });
      return Boolean(result);
    } catch {
      return false;
    }
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(storageKey, { resource_type: 'raw' });
      logger.info('[KnowledgeStorage] Deleted file from Cloudinary', { storageKey });
    } catch (err: any) {
      logger.warn('[KnowledgeStorage] Cloudinary file deletion error', { storageKey, error: err.message });
    }
  }
}

/**
 * Fail-closed storage provider for production environments where
 * no durable cloud/object storage has been configured.
 * Prevents silently persisting official university documents on ephemeral container disks.
 */
export class FailClosedProductionStorage implements IKnowledgeFileStorage {
  resolveLocalPath(_storageKey: string): string | null {
    return null;
  }

  async store(_input: StoreKnowledgeFileInput): Promise<StoredKnowledgeFileResult> {
    throw new AppError(
      'Durable document storage is not configured for production environment. Official university documents cannot be stored on ephemeral disks.',
      500
    );
  }

  async read(storageKey: string): Promise<Buffer> {
    throw new AppError(`Cannot read ${storageKey}: Durable storage is not configured.`, 500);
  }

  async exists(_storageKey: string): Promise<boolean> {
    return false;
  }

  async delete(_storageKey: string): Promise<void> {}
}

let storageInstance: IKnowledgeFileStorage | null = null;

export function getKnowledgeStorage(): IKnowledgeFileStorage {
  if (storageInstance) return storageInstance;

  const isProd = process.env.NODE_ENV?.trim().toLowerCase() === 'production';
  const hasCloudinary = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
    process.env.CLOUDINARY_API_KEY?.trim() &&
    process.env.CLOUDINARY_API_SECRET?.trim()
  );

  if (hasCloudinary) {
    logger.info('[KnowledgeStorage] Initialized Cloudinary durable storage provider');
    storageInstance = new CloudinaryKnowledgeFileStorage();
  } else if (isProd) {
    logger.warn('[KnowledgeStorage] Production detected without durable cloud storage. Failing closed on uploads.');
    storageInstance = new FailClosedProductionStorage();
  } else {
    logger.info('[KnowledgeStorage] Initialized local disk storage provider for development/test');
    storageInstance = new LocalKnowledgeFileStorage();
  }

  return storageInstance;
}

export function setKnowledgeStorageForTesting(storage: IKnowledgeFileStorage | null): void {
  storageInstance = storage;
}
