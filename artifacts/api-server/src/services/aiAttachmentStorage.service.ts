import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '../utils/appError';
import logger from '../utils/logger';

export interface StoreAttachmentInput {
  buffer: Buffer;
  userId: number;
  conversationId: string;
  originalFilename: string;
  mimeType: string;
  fileHash: string;
}

export interface StoredAttachmentResult {
  storageKey: string;
  absolutePath?: string;
  publicUrl?: string;
}

export interface IAiAttachmentStorage {
  store(input: StoreAttachmentInput): Promise<StoredAttachmentResult>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  resolveLocalPath(storageKey: string): string | null;
}

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), 'uploads/conversations');

function sanitizeFilename(original: string): string {
  const ext = path.extname(original).toLowerCase();
  const base = path.basename(original, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
  return `${base || 'attachment'}${ext}`;
}

/**
 * Local filesystem implementation for development and testing.
 */
export class LocalAiAttachmentStorage implements IAiAttachmentStorage {
  private baseDir: string;

  constructor(baseDir = LOCAL_STORAGE_DIR) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  resolveLocalPath(storageKey: string): string | null {
    if (!storageKey) return null;
    const cleanKey = storageKey.replace(/^conversations\//, '');
    const resolved = path.resolve(this.baseDir, cleanKey);
    if (!resolved.startsWith(this.baseDir)) {
      throw new AppError('Invalid storage path traversal attempt', 400);
    }
    return resolved;
  }

  async store(input: StoreAttachmentInput): Promise<StoredAttachmentResult> {
    const safeName = sanitizeFilename(input.originalFilename);
    const subfolder = path.join(String(input.userId), input.conversationId);
    const relativeKey = `conversations/${input.userId}/${input.conversationId}/${input.fileHash}_${safeName}`;
    const cleanRelativePath = path.join(String(input.userId), input.conversationId, `${input.fileHash}_${safeName}`);

    const targetDir = path.join(this.baseDir, subfolder);
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }

    const targetPath = path.join(this.baseDir, cleanRelativePath);
    if (!fs.existsSync(targetPath)) {
      await fs.promises.writeFile(targetPath, input.buffer);
    }

    logger.debug('[AiAttachmentStorage] Stored attachment locally', {
      storageKey: relativeKey,
      userId: input.userId,
      conversationId: input.conversationId,
      bytes: input.buffer.length,
    });

    return {
      storageKey: relativeKey,
      absolutePath: targetPath,
    };
  }

  async read(storageKey: string): Promise<Buffer> {
    const resolved = this.resolveLocalPath(storageKey);
    if (!resolved || !fs.existsSync(resolved)) {
      throw new AppError('Attachment file not found in storage', 404);
    }
    return fs.promises.readFile(resolved);
  }

  async delete(storageKey: string): Promise<void> {
    const resolved = this.resolveLocalPath(storageKey);
    if (resolved && fs.existsSync(resolved)) {
      await fs.promises.unlink(resolved).catch(() => {});
    }
  }
}

// Backwards compatibility alias
export const AiAttachmentStorage = LocalAiAttachmentStorage;

/**
 * Cloudinary durable storage provider for user conversation attachments.
 */
export class CloudinaryAiAttachmentStorage implements IAiAttachmentStorage {
  resolveLocalPath(_storageKey: string): string | null {
    return null;
  }

  async store(input: StoreAttachmentInput): Promise<StoredAttachmentResult> {
    const safeName = sanitizeFilename(input.originalFilename);
    const publicId = `university-management/conversations/${input.userId}/${input.conversationId}/${input.fileHash}_${safeName}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          public_id: publicId,
          overwrite: true,
        },
        (error, result) => {
          if (error || !result) {
            logger.error('[AiAttachmentStorage] Cloudinary raw upload failed', { error });
            return reject(new AppError('Failed to store attachment in durable cloud storage', 502));
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
      throw new AppError(`Failed to retrieve attachment from cloud storage (${response.status})`, 404);
    }
    const arrayBuf = await response.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(storageKey, { resource_type: 'raw' });
      logger.info('[AiAttachmentStorage] Deleted attachment from Cloudinary', { storageKey });
    } catch (err: any) {
      logger.warn('[AiAttachmentStorage] Cloudinary deletion error', { storageKey, error: err?.message });
    }
  }
}

/**
 * Fail-closed storage provider for production environments where
 * no durable cloud/object storage has been configured.
 * Prevents silently persisting attachments on ephemeral Railway container disks.
 */
export class FailClosedProductionAttachmentStorage implements IAiAttachmentStorage {
  resolveLocalPath(_storageKey: string): string | null {
    return null;
  }

  async store(_input: StoreAttachmentInput): Promise<StoredAttachmentResult> {
    throw new AppError(
      'Durable attachment storage is not configured for production environment. Conversation attachments cannot be stored on ephemeral disks.',
      500
    );
  }

  async read(storageKey: string): Promise<Buffer> {
    throw new AppError(`Cannot read ${storageKey}: Durable attachment storage is not configured.`, 500);
  }

  async delete(_storageKey: string): Promise<void> {}
}

let attachmentStorageInstance: IAiAttachmentStorage | null = null;

export function getAiAttachmentStorage(): IAiAttachmentStorage {
  if (attachmentStorageInstance) return attachmentStorageInstance;

  const isProd = process.env.NODE_ENV?.trim().toLowerCase() === 'production';
  const hasCloudinary = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
    process.env.CLOUDINARY_API_KEY?.trim() &&
    process.env.CLOUDINARY_API_SECRET?.trim()
  );

  if (hasCloudinary) {
    logger.info('[AiAttachmentStorage] Initialized Cloudinary durable storage provider');
    attachmentStorageInstance = new CloudinaryAiAttachmentStorage();
  } else if (isProd) {
    logger.warn('[AiAttachmentStorage] Production detected without durable cloud storage. Failing closed on attachment uploads.');
    attachmentStorageInstance = new FailClosedProductionAttachmentStorage();
  } else {
    logger.info('[AiAttachmentStorage] Initialized local disk storage provider for development/test');
    attachmentStorageInstance = new LocalAiAttachmentStorage();
  }

  return attachmentStorageInstance;
}

export function setAiAttachmentStorageForTesting(storage: IAiAttachmentStorage | null): void {
  attachmentStorageInstance = storage;
}
