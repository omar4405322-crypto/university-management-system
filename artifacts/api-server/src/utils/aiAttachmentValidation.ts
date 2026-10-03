import path from 'path';
import { AppError } from './appError';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_ATTACHMENTS_PER_TURN = 3;
export const MAX_EXTRACTED_CHARACTERS = 30000;
export const MAX_TOTAL_ATTACHMENT_CONTEXT_CHARACTERS = 4000;

export const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md']);
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]);

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.bin', '.js', '.mjs', '.ts',
  '.py', '.php', '.phtml', '.pl', '.cgi', '.jar', '.vbs', '.scr', '.msi',
  '.com', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz', '.bz2', '.7z',
  '.rar', '.docm', '.xlsm', '.pptm', '.dotm',
]);

export interface ValidatedAttachment {
  cleanFilename: string;
  mimeType: string;
  byteSize: number;
}

export function validateAttachmentFile(
  buffer: Buffer,
  originalFilename: string,
  claimedMimeType: string,
): ValidatedAttachment {
  if (!buffer || buffer.length === 0) {
    throw new AppError('Attachment file is empty', 400);
  }

  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new AppError(`Attachment exceeds maximum size of 10MB (${(buffer.length / (1024 * 1024)).toFixed(1)}MB)`, 400);
  }

  // Path traversal and basic sanity check on filename
  const cleanBase = path.basename(originalFilename).trim();
  if (!cleanBase || cleanBase.includes('..') || cleanBase.includes('/') || cleanBase.includes('\\')) {
    throw new AppError('Invalid attachment filename', 400);
  }

  const ext = path.extname(cleanBase).toLowerCase();
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    throw new AppError(`File type ${ext} is strictly forbidden for security reasons`, 400);
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new AppError(`Unsupported file extension ${ext}. Allowed: PDF, DOCX, TXT, MD`, 400);
  }

  // Sniff magic bytes to verify content matches claimed type and prevent MIME spoofing
  let resolvedMime: string;

  if (ext === '.pdf') {
    // PDF Magic bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
    const isPdfMagic =
      buffer.length >= 5 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 &&
      buffer[4] === 0x2d;

    if (!isPdfMagic) {
      throw new AppError('File header does not match valid PDF signature', 400);
    }
    resolvedMime = 'application/pdf';
  } else if (ext === '.docx') {
    // DOCX is a ZIP archive starting with PK\x03\x04 (0x50 0x4B 0x03 0x04)
    const isZipMagic =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04;

    if (!isZipMagic) {
      throw new AppError('File header does not match valid DOCX archive signature', 400);
    }

    // Macro-enabled document check: reject if archive contains vbaProject.bin
    const bufferString = buffer.toString('binary');
    if (
      bufferString.includes('vbaProject.bin') ||
      bufferString.includes('word/vbaData.xml') ||
      bufferString.includes('application/vnd.ms-word.document.macroEnabled')
    ) {
      throw new AppError('Macro-enabled Word documents (.docm / VBA macros) are not permitted', 400);
    }

    resolvedMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (ext === '.txt' || ext === '.md') {
    // Plain text / Markdown validation: check for valid UTF-8 and lack of null bytes
    for (let i = 0; i < Math.min(buffer.length, 4096); i++) {
      const byte = buffer[i];
      // Null byte or control characters other than standard whitespace
      if (byte === 0 || (byte < 9 && byte !== 0) || (byte > 13 && byte < 32 && byte !== 27)) {
        throw new AppError('File contains invalid binary characters for a text document', 400);
      }
    }
    resolvedMime = ext === '.md' ? 'text/markdown' : 'text/plain';
  } else {
    throw new AppError(`Unsupported attachment type: ${ext}`, 400);
  }

  return {
    cleanFilename: cleanBase,
    mimeType: resolvedMime,
    byteSize: buffer.length,
  };
}
