import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import {
  extractText,
  getActiveWorkerCount,
  ExtractTextResult,
} from '../src/services/similarity/textExtraction.runner';
import {
  SIMILARITY_WORKER_TIMEOUT_MS,
  SIMILARITY_MAX_WORKER_MEMORY_MB,
  SIMILARITY_MAX_TEXT_SIZE_BYTES,
  SIMILARITY_MAX_INPUT_BYTES,
  SIMILARITY_MAX_ZIP_ENTRIES,
  SIMILARITY_MAX_ZIP_UNCOMPRESSED_BYTES,
} from '../src/services/similarity/textExtraction.constants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesDir = path.resolve(__dirname, 'fixtures');
const loopWorkerPath = path.resolve(fixturesDir, 'loopWorker.ts');
const memWorkerPath = path.resolve(fixturesDir, 'memWorker.ts');
const throwWorkerPath = path.resolve(fixturesDir, 'throwWorker.ts');
const exitWorkerPath = path.resolve(fixturesDir, 'exitWorker.ts');
const recordingWorkerPath = path.resolve(fixturesDir, 'recordingWorker.ts');

// CRC-32 implementation
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

interface ZipEntryInput {
  name: string;
  data: Buffer;
  compress?: boolean;
  declaredUncompressedSize?: number;
}

function createZip(files: ZipEntryInput[]): Buffer {
  const localHeaders: Buffer[] = [];
  const cdHeaders: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const rawData = file.data;
    const uncompressedSize = file.declaredUncompressedSize !== undefined
      ? file.declaredUncompressedSize
      : rawData.length;
    const crc = crc32(rawData);
    const useDeflate = file.compress !== false;
    const compressedData = useDeflate ? zlib.deflateRawSync(rawData) : rawData;
    const method = useDeflate ? 8 : 0;
    const nameBuf = Buffer.from(file.name, 'utf8');

    // Local file header: 30 bytes + name
    const lfh = Buffer.alloc(30 + nameBuf.length);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(0, 10);
    lfh.writeUInt16LE(0, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(compressedData.length, 18);
    lfh.writeUInt32LE(uncompressedSize, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);
    nameBuf.copy(lfh, 30);

    localHeaders.push(lfh, compressedData);

    // Central directory header: 46 bytes + name
    const cdh = Buffer.alloc(46 + nameBuf.length);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0, 8);
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt16LE(0, 12);
    cdh.writeUInt16LE(0, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(compressedData.length, 20);
    cdh.writeUInt32LE(uncompressedSize, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(offset, 42);
    nameBuf.copy(cdh, 46);

    cdHeaders.push(cdh);
    offset += lfh.length + compressedData.length;
  }

  const cdOffset = offset;
  const cdData = Buffer.concat(cdHeaders);
  const cdSize = cdData.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, cdData, eocd]);
}

function createMinimalDocx(text: string): Buffer {
  return createZip([
    {
      name: '[Content_Types].xml',
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`),
    },
    {
      name: '_rels/.rels',
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`),
    },
    {
      name: 'word/document.xml',
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${text}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`),
    },
  ]);
}

function createMinimalPdf(text: string): Buffer {
  const streamContent = `BT\n/F1 12 Tf\n72 712 Td\n(${text}) Tj\nET`;
  const streamLength = Buffer.byteLength(streamContent, 'utf8');

  let pdf = `%PDF-1.4\n`;
  const offsets: number[] = [0];

  offsets.push(Buffer.byteLength(pdf, 'utf8'));
  pdf += `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n`;

  offsets.push(Buffer.byteLength(pdf, 'utf8'));
  pdf += `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n`;

  offsets.push(Buffer.byteLength(pdf, 'utf8'));
  pdf += `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n`;

  offsets.push(Buffer.byteLength(pdf, 'utf8'));
  pdf += `4 0 obj << /Length ${streamLength} >> stream\n${streamContent}\nendstream\nendobj\n`;

  offsets.push(Buffer.byteLength(pdf, 'utf8'));
  pdf += `5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n`;

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 6\n`;
  pdf += `0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

describe('WP5-T6b2: Bounded worker_threads text-extraction runner', () => {

  it('E1: valid txt, docx, and pdf give OK with the expected text', async () => {
    // 1. Valid TXT
    const txtBuffer = Buffer.from('UniCore Similarity Engine Part 2 TXT extraction', 'utf8');
    const txtResult = await extractText({ buffer: txtBuffer, extension: 'txt' });
    assert.equal(txtResult.status, 'OK');
    if (txtResult.status === 'OK') {
      assert.equal(txtResult.text, 'UniCore Similarity Engine Part 2 TXT extraction');
      assert.equal(txtResult.truncated, false);
    }

    // 2. Valid DOCX
    const docxBuffer = createMinimalDocx('UniCore DOCX document content');
    const docxResult = await extractText({ buffer: docxBuffer, extension: 'docx' });
    assert.equal(docxResult.status, 'OK');
    if (docxResult.status === 'OK') {
      assert.ok(docxResult.text.includes('UniCore DOCX document content'));
      assert.equal(docxResult.truncated, false);
    }

    // 3. Valid PDF
    const pdfBuffer = createMinimalPdf('UniCore PDF document content');
    const pdfResult = await extractText({ buffer: pdfBuffer, extension: 'pdf' });
    assert.equal(pdfResult.status, 'OK');
    if (pdfResult.status === 'OK') {
      assert.ok(pdfResult.text.includes('UniCore PDF document content'));
      assert.equal(pdfResult.truncated, false);
    }
  });

  it('E2: txt with NUL byte or invalid UTF-8 = FAILED CORRUPT', async () => {
    // NUL byte inside TXT
    const nulTxtBuffer = Buffer.from('hello\0world', 'utf8');
    const nulResult = await extractText({ buffer: nulTxtBuffer, extension: 'txt' });
    assert.deepEqual(nulResult, { status: 'FAILED', reason: 'CORRUPT' });

    // Invalid UTF-8 sequence
    const invalidUtf8Buffer = Buffer.from([0xff, 0xfe, 0x80, 0x81]);
    const invalidUtf8Result = await extractText({ buffer: invalidUtf8Buffer, extension: 'txt' });
    assert.deepEqual(invalidUtf8Result, { status: 'FAILED', reason: 'CORRUPT' });
  });

  it('E3: unknown extension = UNSUPPORTED', async () => {
    const buf = Buffer.from('dummy content');
    const exeResult = await extractText({ buffer: buf, extension: 'exe' });
    assert.deepEqual(exeResult, { status: 'UNSUPPORTED' });

    const pngResult = await extractText({ buffer: buf, extension: 'png' });
    assert.deepEqual(pngResult, { status: 'UNSUPPORTED' });

    const emptyExtResult = await extractText({ buffer: buf, extension: '' });
    assert.deepEqual(emptyExtResult, { status: 'UNSUPPORTED' });
  });

  it('E4: magic mismatch (txt bytes named .docx) = FAILED CORRUPT', async () => {
    const fakeDocxBuffer = Buffer.from('This is plain text pretending to be a docx file');
    const docxMismatchResult = await extractText({ buffer: fakeDocxBuffer, extension: 'docx' });
    assert.deepEqual(docxMismatchResult, { status: 'FAILED', reason: 'CORRUPT' });

    const fakePdfBuffer = Buffer.from('This is plain text pretending to be a pdf file');
    const pdfMismatchResult = await extractText({ buffer: fakePdfBuffer, extension: 'pdf' });
    assert.deepEqual(pdfMismatchResult, { status: 'FAILED', reason: 'CORRUPT' });
  });

  it('E5: zip bomb: one entry declaring more than the uncompressed limit but deflated to a few KB = FAILED ARCHIVE_TOO_LARGE and NO worker started', async () => {
    const scratchMarker = path.resolve('C:/Users/omar4/.gemini/antigravity/brain/5954ce0c-e29e-46c8-bd1c-2789a92eda6c/scratch/test_marker_e5.txt');
    try {
      if (fs.existsSync(scratchMarker)) {
        fs.unlinkSync(scratchMarker);
      }
      process.env.TEST_RECORDING_WORKER_PATH = scratchMarker;

      // Zip bomb: declares 55MB uncompressed (> SIMILARITY_MAX_ZIP_UNCOMPRESSED_BYTES = 50MB), actual small compressed payload
      const bombZip = createZip([
        {
          name: 'word/document.xml',
          data: Buffer.from('<w:document><w:body><w:p><w:t>bomb</w:t></w:p></w:body></w:document>'),
          compress: true,
          declaredUncompressedSize: SIMILARITY_MAX_ZIP_UNCOMPRESSED_BYTES + 1024,
        },
      ]);

      const res = await extractText({
        buffer: bombZip,
        extension: 'docx',
        workerFile: recordingWorkerPath,
      });

      assert.deepEqual(res, { status: 'FAILED', reason: 'ARCHIVE_TOO_LARGE' });
      assert.equal(fs.existsSync(scratchMarker), false, 'Recording worker must NOT have started');

      // Verify that recordingWorker DOES write when worker starts
      const normalTxt = Buffer.from('normal text');
      const verifyStartRes = await extractText({
        buffer: normalTxt,
        extension: 'txt',
        workerFile: recordingWorkerPath,
      });
      assert.equal(verifyStartRes.status, 'OK');
      assert.equal(fs.existsSync(scratchMarker), true, 'Recording worker confirmed to record on start');
    } finally {
      if (fs.existsSync(scratchMarker)) {
        fs.unlinkSync(scratchMarker);
      }
      delete process.env.TEST_RECORDING_WORKER_PATH;
    }
  });

  it('E6: zip with more than the entry limit = FAILED', async () => {
    // Generate ZIP with 1001 entries (> SIMILARITY_MAX_ZIP_ENTRIES = 1000)
    const entries: ZipEntryInput[] = [];
    for (let i = 0; i <= SIMILARITY_MAX_ZIP_ENTRIES; i++) {
      entries.push({
        name: `file_${i}.txt`,
        data: Buffer.from('x'),
        compress: false,
      });
    }

    const largeZip = createZip(entries);
    const res = await extractText({ buffer: largeZip, extension: 'docx' });
    assert.equal(res.status, 'FAILED');
    assert.equal(res.reason, 'ARCHIVE_TOO_LARGE');
  });

  it('E7: synchronous infinite-loop fixture worker with small timeoutMs = FAILED TIMEOUT', async () => {
    const startTime = Date.now();
    const res = await extractText({
      buffer: Buffer.from('test text'),
      extension: 'txt',
      workerFile: loopWorkerPath,
      timeoutMs: 150,
    });
    const elapsed = Date.now() - startTime;

    assert.deepEqual(res, { status: 'FAILED', reason: 'TIMEOUT' });
    assert.ok(elapsed < 10000, `Elapsed ${elapsed}ms should be well below loose 10s ceiling`);
  });

  it('E8: memory-hog fixture worker = FAILED OUT_OF_MEMORY and main process survives', async () => {
    const res = await extractText({
      buffer: Buffer.from('test text'),
      extension: 'txt',
      workerFile: memWorkerPath,
      timeoutMs: 8000,
    });

    assert.deepEqual(res, { status: 'FAILED', reason: 'OUT_OF_MEMORY' });
  });

  it('E9: crash fixture worker (throws, and process-level exit) = FAILED WORKER_CRASH', async () => {
    // 1. Throws uncaught exception
    const throwRes = await extractText({
      buffer: Buffer.from('test text'),
      extension: 'txt',
      workerFile: throwWorkerPath,
    });
    assert.deepEqual(throwRes, { status: 'FAILED', reason: 'WORKER_CRASH' });

    // 2. Process-level exit(1)
    const exitRes = await extractText({
      buffer: Buffer.from('test text'),
      extension: 'txt',
      workerFile: exitWorkerPath,
    });
    assert.deepEqual(exitRes, { status: 'FAILED', reason: 'WORKER_CRASH' });
  });

  it('E10: text above the cap is truncated with truncated=true', async () => {
    // Create text slightly above 5MB cap
    const largeString = 'A'.repeat(SIMILARITY_MAX_TEXT_SIZE_BYTES + 2048);
    const largeBuffer = Buffer.from(largeString, 'utf8');

    const res = await extractText({ buffer: largeBuffer, extension: 'txt' });
    assert.equal(res.status, 'OK');
    if (res.status === 'OK') {
      assert.equal(res.truncated, true);
      assert.equal(Buffer.byteLength(res.text, 'utf8'), SIMILARITY_MAX_TEXT_SIZE_BYTES);
    }
  });

  it('E11: results never contain a stack, a path or the input bytes (assert on whole JSON)', async () => {
    // Test OK result
    const okRes = await extractText({ buffer: Buffer.from('clean text'), extension: 'txt' });
    assert.deepEqual(Object.keys(okRes).sort(), ['status', 'text', 'truncated']);
    const okJson = JSON.stringify(okRes);
    assert.ok(!okJson.includes('stack'));
    assert.ok(!okJson.includes('path'));
    assert.ok(!okJson.includes('Error:'));

    // Test UNSUPPORTED result
    const unsuppRes = await extractText({ buffer: Buffer.from('some bytes'), extension: 'iso' });
    assert.deepEqual(Object.keys(unsuppRes), ['status']);
    const unsuppJson = JSON.stringify(unsuppRes);
    assert.ok(!unsuppJson.includes('stack'));
    assert.ok(!unsuppJson.includes('path'));

    // Test FAILED result
    const failRes = await extractText({ buffer: Buffer.from('invalid docx'), extension: 'docx' });
    assert.deepEqual(Object.keys(failRes).sort(), ['reason', 'status']);
    const failJson = JSON.stringify(failRes);
    assert.ok(!failJson.includes('stack'));
    assert.ok(!failJson.includes('path'));
    assert.ok(!failJson.includes('invalid docx'));
  });

  it('E12: after 20 sequential calls (mix of OK and failures) no worker is left alive', async () => {
    const validTxt = Buffer.from('valid txt');
    const validDocx = createMinimalDocx('valid docx');
    const corruptDocx = Buffer.from('corrupt');
    const invalidExt = 'unknown';

    for (let i = 0; i < 5; i++) {
      await extractText({ buffer: validTxt, extension: 'txt' });
      await extractText({ buffer: validDocx, extension: 'docx' });
      await extractText({ buffer: corruptDocx, extension: 'docx' });
      await extractText({ buffer: validTxt, extension: invalidExt });
    }

    assert.equal(getActiveWorkerCount(), 0, 'All workers must be terminated with 0 active workers');
  });

  it('E13: source-text test: the worker source imports none of fs, child_process, net, http, vm and has no eval or new Function', () => {
    const workerSourcePath = path.resolve(__dirname, '../src/services/similarity/textExtraction.worker.ts');
    assert.ok(fs.existsSync(workerSourcePath), 'Worker source file must exist');

    const source = fs.readFileSync(workerSourcePath, 'utf8');

    // Forbidden modules
    const forbiddenImports = ['fs', 'child_process', 'net', 'http', 'https', 'vm'];
    for (const mod of forbiddenImports) {
      const importRegex = new RegExp(`['"](?:node:)?${mod}['"]`);
      assert.equal(
        importRegex.test(source),
        false,
        `Worker source must not import module: ${mod}`
      );
    }

    // Forbidden dynamic evaluation
    assert.equal(/\beval\s*\(/.test(source), false, 'Worker source must not call eval()');
    assert.equal(/\bnew\s+Function\s*\(/.test(source), false, 'Worker source must not call new Function()');
  });

});
