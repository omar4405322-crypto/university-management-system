import { Worker } from 'node:worker_threads';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';

import {
  SIMILARITY_WORKER_TIMEOUT_MS,
  SIMILARITY_MAX_WORKER_MEMORY_MB,
  SIMILARITY_MAX_TEXT_SIZE_BYTES,
  SIMILARITY_MAX_INPUT_BYTES,
  SIMILARITY_MAX_ZIP_ENTRIES,
  SIMILARITY_MAX_ZIP_UNCOMPRESSED_BYTES,
} from './textExtraction.constants';

export interface ExtractTextOptions {
  buffer: Buffer | Uint8Array;
  extension: string;
  workerFile?: string;
  timeoutMs?: number;
}

export type ExtractTextFailureReason =
  | 'TIMEOUT'
  | 'OUT_OF_MEMORY'
  | 'WORKER_CRASH'
  | 'ARCHIVE_TOO_LARGE'
  | 'CORRUPT'
  | 'EMPTY';

export type ExtractTextResult =
  | { status: 'OK'; text: string; truncated: boolean }
  | { status: 'UNSUPPORTED' }
  | { status: 'FAILED'; reason: ExtractTextFailureReason };

// Internal bookkeeping for active worker count
let activeWorkers = 0;

export function getActiveWorkerCount(): number {
  return activeWorkers;
}

const SUPPORTED_EXTENSIONS = new Set(['pdf', 'docx', 'txt']);

/**
 * Resolves the path to the worker file for development (tsx) and built production bundles.
 */
export function resolveWorkerPath(customWorkerFile?: string): string {
  if (customWorkerFile) {
    return path.resolve(customWorkerFile);
  }

  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  // 1. Built production worker in the same directory (dist/)
  const distCandidate = path.resolve(currentDir, 'textExtraction.worker.mjs');
  if (fs.existsSync(distCandidate)) {
    return distCandidate;
  }

  // 2. TypeScript source worker in the same directory (development under tsx)
  const tsCandidate = path.resolve(currentDir, 'textExtraction.worker.ts');
  if (fs.existsSync(tsCandidate)) {
    return tsCandidate;
  }

  // 3. Built dist worker relative to source directory (../../dist/)
  const distRelativeCandidate = path.resolve(currentDir, '../../../../dist/textExtraction.worker.mjs');
  if (fs.existsSync(distRelativeCandidate)) {
    return distRelativeCandidate;
  }

  return tsCandidate;
}

interface ZipPreCheckResult {
  valid: boolean;
  reason?: 'CORRUPT' | 'ARCHIVE_TOO_LARGE';
}

/**
 * Hand-written ZIP End of Central Directory (EOCD) and Central Directory parser.
 * Runs before any worker is started to protect against zip bombs and corrupt archives.
 */
function preCheckZipArchive(buffer: Buffer): ZipPreCheckResult {
  if (buffer.length < 22) {
    return { valid: false, reason: 'CORRUPT' };
  }

  // Search backwards for End of Central Directory Record signature (0x06054b50)
  const minPos = Math.max(0, buffer.length - 65557);
  let eocdPos = -1;
  for (let i = buffer.length - 22; i >= minPos; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      const commentLen = buffer.readUInt16LE(i + 20);
      if (i + 22 + commentLen === buffer.length) {
        eocdPos = i;
        break;
      }
    }
  }

  if (eocdPos === -1) {
    return { valid: false, reason: 'CORRUPT' };
  }

  const totalEntries = buffer.readUInt16LE(eocdPos + 10);
  const cdSize = buffer.readUInt32LE(eocdPos + 12);
  const cdOffset = buffer.readUInt32LE(eocdPos + 16);

  if (totalEntries > SIMILARITY_MAX_ZIP_ENTRIES) {
    return { valid: false, reason: 'ARCHIVE_TOO_LARGE' };
  }

  if (cdOffset + cdSize > eocdPos || cdOffset >= buffer.length) {
    return { valid: false, reason: 'CORRUPT' };
  }

  let curr = cdOffset;
  let entriesCount = 0;
  let totalUncompressedBytes = 0;

  while (curr < cdOffset + cdSize) {
    if (curr + 46 > cdOffset + cdSize || curr + 46 > buffer.length) {
      return { valid: false, reason: 'CORRUPT' };
    }

    const sig = buffer.readUInt32LE(curr);
    if (sig !== 0x02014b50) {
      return { valid: false, reason: 'CORRUPT' };
    }

    const uncompressedSize = buffer.readUInt32LE(curr + 24);
    const fileNameLength = buffer.readUInt16LE(curr + 28);
    const extraLength = buffer.readUInt16LE(curr + 30);
    const commentLength = buffer.readUInt16LE(curr + 32);

    const entryTotalLength = 46 + fileNameLength + extraLength + commentLength;
    if (curr + entryTotalLength > cdOffset + cdSize || curr + entryTotalLength > buffer.length) {
      return { valid: false, reason: 'CORRUPT' };
    }

    totalUncompressedBytes += uncompressedSize;
    if (
      uncompressedSize > SIMILARITY_MAX_ZIP_UNCOMPRESSED_BYTES ||
      totalUncompressedBytes > SIMILARITY_MAX_ZIP_UNCOMPRESSED_BYTES
    ) {
      return { valid: false, reason: 'ARCHIVE_TOO_LARGE' };
    }

    entriesCount++;
    if (entriesCount > SIMILARITY_MAX_ZIP_ENTRIES) {
      return { valid: false, reason: 'ARCHIVE_TOO_LARGE' };
    }

    curr += entryTotalLength;
  }

  if (entriesCount !== totalEntries || curr !== cdOffset + cdSize) {
    return { valid: false, reason: 'CORRUPT' };
  }

  return { valid: true };
}

/**
 * Extracts text from an uploaded document buffer within a bounded worker thread.
 * Never throws, never logs file text, and never writes to disk.
 */
export async function extractText(options: ExtractTextOptions): Promise<ExtractTextResult> {
  try {
    const { buffer: rawInput, extension, workerFile, timeoutMs } = options;

    const ext = String(extension || '').toLowerCase().replace(/^\./, '').trim();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return { status: 'UNSUPPORTED' };
    }

    const nodeBuf = Buffer.isBuffer(rawInput)
      ? rawInput
      : Buffer.from(rawInput.buffer, rawInput.byteOffset, rawInput.byteLength);

    if (nodeBuf.length === 0) {
      return { status: 'FAILED', reason: 'EMPTY' };
    }

    if (nodeBuf.length > SIMILARITY_MAX_INPUT_BYTES) {
      return {
        status: 'FAILED',
        reason: ext === 'docx' ? 'ARCHIVE_TOO_LARGE' : 'CORRUPT',
      };
    }

    // Magic bytes verification
    if (ext === 'pdf') {
      if (
        nodeBuf.length < 5 ||
        nodeBuf[0] !== 0x25 ||
        nodeBuf[1] !== 0x50 ||
        nodeBuf[2] !== 0x44 ||
        nodeBuf[3] !== 0x46 ||
        nodeBuf[4] !== 0x2d
      ) {
        return { status: 'FAILED', reason: 'CORRUPT' };
      }
    } else if (ext === 'docx') {
      if (
        nodeBuf.length < 4 ||
        nodeBuf[0] !== 0x50 ||
        nodeBuf[1] !== 0x4b ||
        nodeBuf[2] !== 0x03 ||
        nodeBuf[3] !== 0x04
      ) {
        return { status: 'FAILED', reason: 'CORRUPT' };
      }

      // Pre-check ZIP directory before starting the worker
      const zipCheck = preCheckZipArchive(nodeBuf);
      if (!zipCheck.valid) {
        return { status: 'FAILED', reason: zipCheck.reason ?? 'CORRUPT' };
      }
    }

    const resolvedWorkerFile = resolveWorkerPath(workerFile);

    // Transferable copy of buffer
    const ab = new ArrayBuffer(nodeBuf.byteLength);
    new Uint8Array(ab).set(new Uint8Array(nodeBuf.buffer, nodeBuf.byteOffset, nodeBuf.byteLength));

    return await executeInWorker(resolvedWorkerFile, ab, ext, timeoutMs ?? SIMILARITY_WORKER_TIMEOUT_MS);
  } catch {
    return { status: 'FAILED', reason: 'CORRUPT' };
  }
}

interface WorkerMessageResponse {
  status: 'OK' | 'UNSUPPORTED' | 'FAILED';
  text?: string;
  reason?: ExtractTextFailureReason;
}

function executeInWorker(
  workerPath: string,
  buffer: ArrayBuffer,
  extension: string,
  timeoutMs: number
): Promise<ExtractTextResult> {
  return new Promise((resolve) => {
    activeWorkers++;
    let worker: Worker | null = null;
    let timer: NodeJS.Timeout | null = null;
    let settled = false;
    let failureReason: ExtractTextFailureReason = 'WORKER_CRASH';

    const finish = (result: ExtractTextResult) => {
      if (settled) return;
      settled = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (worker) {
        worker.terminate().catch(() => {});
        worker = null;
      }
      activeWorkers--;
      resolve(result);
    };

    try {
      worker = new Worker(workerPath, {
        workerData: {
          buffer,
          extension,
          maxZipEntries: SIMILARITY_MAX_ZIP_ENTRIES,
          maxZipUncompressedBytes: SIMILARITY_MAX_ZIP_UNCOMPRESSED_BYTES,
        },
        transferList: [buffer],
        resourceLimits: {
          maxOldGenerationSizeMb: SIMILARITY_MAX_WORKER_MEMORY_MB,
        },
      });

      timer = setTimeout(() => {
        failureReason = 'TIMEOUT';
        finish({ status: 'FAILED', reason: 'TIMEOUT' });
      }, timeoutMs);

      worker.on('message', (msg: unknown) => {
        const response = msg as WorkerMessageResponse;
        if (!response || typeof response !== 'object') {
          finish({ status: 'FAILED', reason: 'CORRUPT' });
          return;
        }

        if (response.status === 'OK') {
          let text = response.text ?? '';
          if (text.length === 0) {
            finish({ status: 'FAILED', reason: 'EMPTY' });
            return;
          }

          let truncated = false;
          const textByteLength = Buffer.byteLength(text, 'utf8');
          if (textByteLength > SIMILARITY_MAX_TEXT_SIZE_BYTES) {
            const truncatedBuf = Buffer.from(text, 'utf8').subarray(0, SIMILARITY_MAX_TEXT_SIZE_BYTES);
            text = new TextDecoder('utf-8', { fatal: false }).decode(truncatedBuf);
            if (text.endsWith('\uFFFD')) {
              text = text.slice(0, -1);
            }
            truncated = true;
          }

          finish({ status: 'OK', text, truncated });
        } else if (response.status === 'UNSUPPORTED') {
          finish({ status: 'UNSUPPORTED' });
        } else {
          finish({ status: 'FAILED', reason: response.reason ?? 'CORRUPT' });
        }
      });

      worker.on('error', (err: Error & { code?: string }) => {
        const errMsg = String(err?.message || '').toLowerCase();
        if (
          err?.code === 'ERR_WORKER_OUT_OF_MEMORY' ||
          errMsg.includes('out of memory') ||
          errMsg.includes('memory limit')
        ) {
          failureReason = 'OUT_OF_MEMORY';
        } else {
          failureReason = 'WORKER_CRASH';
        }
      });

      worker.on('exit', (code: number) => {
        if (!settled) {
          finish({ status: 'FAILED', reason: failureReason });
        }
      });
    } catch {
      finish({ status: 'FAILED', reason: failureReason });
    }
  });
}
