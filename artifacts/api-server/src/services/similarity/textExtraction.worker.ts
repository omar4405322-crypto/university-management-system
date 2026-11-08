import { parentPort, workerData } from 'node:worker_threads';
import { Buffer } from 'node:buffer';
import zlib from 'node:zlib';
import mammoth from 'mammoth';
import { extractText as extractPdfText } from 'unpdf';

interface WorkerInput {
  buffer: ArrayBuffer | Uint8Array;
  extension: string;
  maxZipEntries?: number;
  maxZipUncompressedBytes?: number;
}

type WorkerResponse =
  | { status: 'OK'; text: string }
  | { status: 'UNSUPPORTED' }
  | { status: 'FAILED'; reason: 'CORRUPT' | 'EMPTY' | 'ARCHIVE_TOO_LARGE' };

type ZipRealSizeCheckResult =
  | { ok: true }
  | { ok: false; reason: 'ARCHIVE_TOO_LARGE' | 'CORRUPT' };

function validateDocxRealInflateSize(
  buffer: Buffer,
  maxZipEntries: number = 1000,
  maxZipUncompressedBytes: number = 52428800
): ZipRealSizeCheckResult {
  if (buffer.length < 22) {
    return { ok: false, reason: 'CORRUPT' };
  }

  // 1. Search backwards for End of Central Directory Record signature (0x06054b50)
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
    return { ok: false, reason: 'CORRUPT' };
  }

  const totalEntries = buffer.readUInt16LE(eocdPos + 10);
  const cdSize = buffer.readUInt32LE(eocdPos + 12);
  const cdOffset = buffer.readUInt32LE(eocdPos + 16);

  if (totalEntries > maxZipEntries) {
    return { ok: false, reason: 'ARCHIVE_TOO_LARGE' };
  }

  if (cdOffset + cdSize > eocdPos || cdOffset >= buffer.length) {
    return { ok: false, reason: 'CORRUPT' };
  }

  let curr = cdOffset;
  let entriesCount = 0;
  let totalRealInflatedBytes = 0;

  while (curr < cdOffset + cdSize) {
    if (curr + 46 > cdOffset + cdSize || curr + 46 > buffer.length) {
      return { ok: false, reason: 'CORRUPT' };
    }

    const sig = buffer.readUInt32LE(curr);
    if (sig !== 0x02014b50) {
      return { ok: false, reason: 'CORRUPT' };
    }

    const method = buffer.readUInt16LE(curr + 10);
    const compressedSize = buffer.readUInt32LE(curr + 20);
    const fileNameLength = buffer.readUInt16LE(curr + 28);
    const extraLength = buffer.readUInt16LE(curr + 30);
    const commentLength = buffer.readUInt16LE(curr + 32);
    const localHeaderOffset = buffer.readUInt32LE(curr + 42);

    const entryTotalLength = 46 + fileNameLength + extraLength + commentLength;
    if (curr + entryTotalLength > cdOffset + cdSize || curr + entryTotalLength > buffer.length) {
      return { ok: false, reason: 'CORRUPT' };
    }

    // Read and validate Local Header
    if (localHeaderOffset + 30 > buffer.length || localHeaderOffset < 0) {
      return { ok: false, reason: 'CORRUPT' };
    }

    const localSig = buffer.readUInt32LE(localHeaderOffset);
    if (localSig !== 0x04034b50) {
      return { ok: false, reason: 'CORRUPT' };
    }

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);

    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    if (dataStart > buffer.length) {
      return { ok: false, reason: 'CORRUPT' };
    }

    const remainingBudget = maxZipUncompressedBytes - totalRealInflatedBytes;
    if (remainingBudget < 0) {
      return { ok: false, reason: 'ARCHIVE_TOO_LARGE' };
    }

    let entryRealSize = 0;

    if (method === 0) {
      // Stored: real size = central compressed size, bounds-checked against the buffer
      if (dataStart + compressedSize > buffer.length) {
        return { ok: false, reason: 'CORRUPT' };
      }
      entryRealSize = compressedSize;
      if (entryRealSize > remainingBudget) {
        return { ok: false, reason: 'ARCHIVE_TOO_LARGE' };
      }
    } else if (method === 8) {
      // Deflate: measure real inflated size via zlib.inflateRawSync
      try {
        const decompressed = zlib.inflateRawSync(buffer.subarray(dataStart), {
          maxOutputLength: remainingBudget,
        });
        entryRealSize = decompressed.length;
      } catch (err) {
        if (err && typeof err === 'object' && (err as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') {
          return { ok: false, reason: 'ARCHIVE_TOO_LARGE' };
        }
        return { ok: false, reason: 'CORRUPT' };
      }
    } else {
      // Any other compression method = CORRUPT
      return { ok: false, reason: 'CORRUPT' };
    }

    totalRealInflatedBytes += entryRealSize;
    if (totalRealInflatedBytes > maxZipUncompressedBytes) {
      return { ok: false, reason: 'ARCHIVE_TOO_LARGE' };
    }

    entriesCount++;
    if (entriesCount > maxZipEntries) {
      return { ok: false, reason: 'ARCHIVE_TOO_LARGE' };
    }

    curr += entryTotalLength;
  }

  if (entriesCount !== totalEntries || curr !== cdOffset + cdSize) {
    return { ok: false, reason: 'CORRUPT' };
  }

  return { ok: true };
}

async function processExtraction(input: WorkerInput): Promise<WorkerResponse> {
  const { buffer, extension } = input;
  const ext = String(extension || '').toLowerCase().replace(/^\./, '').trim();
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const nodeBuf = Buffer.from(uint8.buffer, uint8.byteOffset, uint8.byteLength);

  if (ext === 'txt') {
    if (uint8.includes(0)) {
      return { status: 'FAILED', reason: 'CORRUPT' };
    }
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const text = decoder.decode(uint8);
      if (text.includes('\0')) {
        return { status: 'FAILED', reason: 'CORRUPT' };
      }
      if (text.length === 0) {
        return { status: 'FAILED', reason: 'EMPTY' };
      }
      return { status: 'OK', text };
    } catch {
      return { status: 'FAILED', reason: 'CORRUPT' };
    }
  }

  if (ext === 'docx') {
    const realSizeCheck = validateDocxRealInflateSize(
      nodeBuf,
      input.maxZipEntries,
      input.maxZipUncompressedBytes
    );
    if (!realSizeCheck.ok) {
      return { status: 'FAILED', reason: realSizeCheck.reason };
    }

    try {
      const result = await mammoth.extractRawText({ buffer: nodeBuf });
      const text = result?.value ?? '';
      if (text.length === 0) {
        return { status: 'FAILED', reason: 'EMPTY' };
      }
      return { status: 'OK', text };
    } catch {
      return { status: 'FAILED', reason: 'CORRUPT' };
    }
  }

  if (ext === 'pdf') {
    try {
      const result = await extractPdfText(uint8, { mergePages: true });
      const rawText = Array.isArray(result?.text) ? result.text.join('\n') : String(result?.text ?? '');
      if (rawText.length === 0) {
        return { status: 'FAILED', reason: 'EMPTY' };
      }
      return { status: 'OK', text: rawText };
    } catch {
      return { status: 'FAILED', reason: 'CORRUPT' };
    }
  }

  return { status: 'UNSUPPORTED' };
}

async function handleInput(payload: unknown): Promise<void> {
  if (!parentPort || !payload || typeof payload !== 'object') {
    return;
  }
  const input = payload as WorkerInput;
  try {
    const response = await processExtraction(input);
    parentPort.postMessage(response);
  } catch {
    parentPort.postMessage({ status: 'FAILED', reason: 'CORRUPT' });
  }
}

// Support invocation via workerData upon thread creation
if (workerData && typeof workerData === 'object' && 'buffer' in workerData) {
  handleInput(workerData).catch(() => {
    parentPort?.postMessage({ status: 'FAILED', reason: 'CORRUPT' });
  });
}

// Support invocation via message passing
if (parentPort) {
  parentPort.on('message', (msg: unknown) => {
    handleInput(msg).catch(() => {
      parentPort?.postMessage({ status: 'FAILED', reason: 'CORRUPT' });
    });
  });
}
