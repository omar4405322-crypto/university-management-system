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
  SIMILARITY_MAX_ZIP_ENTRIES,
  SIMILARITY_MAX_ZIP_UNCOMPRESSED_BYTES,
} from '../src/services/similarity/textExtraction.constants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

interface ZipEntryDef {
  name: string;
  data?: Buffer;
  compressedData?: Buffer;
  compress?: boolean;
  method?: number;
  declaredUncompressedSize?: number;
  declaredCompressedSize?: number;
  crc?: number;
}

function buildZipArchive(files: ZipEntryDef[]): Buffer {
  const localHeaders: Buffer[] = [];
  const cdHeaders: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const rawData = file.data ?? Buffer.alloc(0);
    const useDeflate = file.compress !== false && file.method !== 0;
    const method = file.method !== undefined ? file.method : (useDeflate ? 8 : 0);

    const compressedPayload = file.compressedData !== undefined
      ? file.compressedData
      : (method === 8 ? zlib.deflateRawSync(rawData) : rawData);

    const uncompressedSize = file.declaredUncompressedSize !== undefined
      ? file.declaredUncompressedSize
      : rawData.length;

    const compressedSize = file.declaredCompressedSize !== undefined
      ? file.declaredCompressedSize
      : compressedPayload.length;

    const entryCrc = file.crc !== undefined
      ? file.crc
      : crc32(rawData);

    const nameBuf = Buffer.from(file.name, 'utf8');

    // Local File Header (30 bytes + name)
    const lfh = Buffer.alloc(30 + nameBuf.length);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(0, 10);
    lfh.writeUInt16LE(0, 12);
    lfh.writeUInt32LE(entryCrc, 14);
    lfh.writeUInt32LE(compressedSize, 18);
    lfh.writeUInt32LE(uncompressedSize, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);
    nameBuf.copy(lfh, 30);

    localHeaders.push(lfh, compressedPayload);

    // Central Directory Header (46 bytes + name)
    const cdh = Buffer.alloc(46 + nameBuf.length);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0, 8);
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt16LE(0, 12);
    cdh.writeUInt16LE(0, 14);
    cdh.writeUInt32LE(entryCrc, 16);
    cdh.writeUInt32LE(compressedSize, 20);
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
    offset += lfh.length + compressedPayload.length;
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

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function createStandardDocx(text: string): Buffer {
  return buildZipArchive([
    { name: '[Content_Types].xml', data: Buffer.from(CONTENT_TYPES_XML, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(RELS_XML, 'utf8') },
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
</w:document>`, 'utf8'),
    },
  ]);
}

async function measureCallWithRss(
  action: () => Promise<ExtractTextResult>
): Promise<{ result: ExtractTextResult; peakRssDelta: number }> {
  const rssBefore = process.memoryUsage().rss;
  let peakRss = rssBefore;

  const timer = setInterval(() => {
    const cur = process.memoryUsage().rss;
    if (cur > peakRss) {
      peakRss = cur;
    }
  }, 50);

  try {
    const result = await action();
    const finalRss = process.memoryUsage().rss;
    if (finalRss > peakRss) {
      peakRss = finalRss;
    }
    return {
      result,
      peakRssDelta: peakRss - rssBefore,
    };
  } finally {
    clearInterval(timer);
  }
}

describe('WP5-T6b2: Real-inflate zip bomb defense (OD-133)', () => {

  it('Z1: lying-header docx (200 MiB real inflated, declared 1 KB) with consistent and inconsistent CRC = FAILED ARCHIVE_TOO_LARGE, workers=0, RSS < 150 MiB', async () => {
    // 1. Build 200 MiB real inflated payload once (< 400 MiB max allocation)
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>';
    const xmlFooter = '</w:t></w:r></w:p></w:body></w:document>';
    const headerBuf = Buffer.from(xmlHeader, 'utf8');
    const footerBuf = Buffer.from(xmlFooter, 'utf8');

    const totalUncompressedBytes = 200 * 1024 * 1024; // 200 MiB
    let rawXmlBuf: Buffer | null = Buffer.alloc(totalUncompressedBytes, 0x61); // 'a'
    headerBuf.copy(rawXmlBuf, 0);
    footerBuf.copy(rawXmlBuf, totalUncompressedBytes - footerBuf.length);

    const consistentCrc = crc32(rawXmlBuf);
    const inconsistentCrc = (consistentCrc ^ 0xdeadbeef) >>> 0;
    const deflatedPayload = zlib.deflateRawSync(rawXmlBuf);

    // Release raw 200 MiB payload immediately
    rawXmlBuf = null;
    if (typeof (globalThis as any).gc === 'function') {
      (globalThis as any).gc();
    }

    // Build Z1 Consistent CRC docx
    const consistentDocx = buildZipArchive([
      { name: '[Content_Types].xml', data: Buffer.from(CONTENT_TYPES_XML, 'utf8') },
      { name: '_rels/.rels', data: Buffer.from(RELS_XML, 'utf8') },
      {
        name: 'word/document.xml',
        compressedData: deflatedPayload,
        method: 8,
        declaredUncompressedSize: 1024,
        declaredCompressedSize: 1024,
        crc: consistentCrc,
      },
    ]);

    // Build Z1 Inconsistent CRC docx
    const inconsistentDocx = buildZipArchive([
      { name: '[Content_Types].xml', data: Buffer.from(CONTENT_TYPES_XML, 'utf8') },
      { name: '_rels/.rels', data: Buffer.from(RELS_XML, 'utf8') },
      {
        name: 'word/document.xml',
        compressedData: deflatedPayload,
        method: 8,
        declaredUncompressedSize: 1024,
        declaredCompressedSize: 1024,
        crc: inconsistentCrc,
      },
    ]);

    // Test Z1 Consistent CRC
    const consistentRun = await measureCallWithRss(async () => {
      return await extractText({ buffer: consistentDocx, extension: 'docx' });
    });

    assert.equal(consistentRun.result.status, 'FAILED');
    assert.equal((consistentRun.result as { reason?: string }).reason, 'ARCHIVE_TOO_LARGE');
    assert.equal(getActiveWorkerCount(), 0, 'No active workers after consistent bomb');
    assert.ok(
      consistentRun.peakRssDelta < 150 * 1024 * 1024,
      `Peak RSS delta (${Math.round(consistentRun.peakRssDelta / (1024 * 1024))} MiB) must remain below 150 MiB`
    );

    // Test Z1 Inconsistent CRC
    const inconsistentRun = await measureCallWithRss(async () => {
      return await extractText({ buffer: inconsistentDocx, extension: 'docx' });
    });

    assert.equal(inconsistentRun.result.status, 'FAILED');
    assert.equal((inconsistentRun.result as { reason?: string }).reason, 'ARCHIVE_TOO_LARGE');
    assert.equal(getActiveWorkerCount(), 0, 'No active workers after inconsistent bomb');
    assert.ok(
      inconsistentRun.peakRssDelta < 150 * 1024 * 1024,
      `Peak RSS delta (${Math.round(inconsistentRun.peakRssDelta / (1024 * 1024))} MiB) must remain below 150 MiB`
    );
  });

  it('Z2: three entries each really inflating to 20 MiB with declared 1 KB: total over budget = ARCHIVE_TOO_LARGE', async () => {
    // 20 MiB raw text
    const size20Mb = 20 * 1024 * 1024;
    let buf20Mb: Buffer | null = Buffer.alloc(size20Mb, 0x62); // 'b'
    const deflated20Mb = zlib.deflateRawSync(buf20Mb);
    const crc20Mb = crc32(buf20Mb);
    buf20Mb = null;

    const threeEntriesDocx = buildZipArchive([
      { name: '[Content_Types].xml', data: Buffer.from(CONTENT_TYPES_XML, 'utf8') },
      { name: '_rels/.rels', data: Buffer.from(RELS_XML, 'utf8') },
      {
        name: 'word/document.xml',
        compressedData: deflated20Mb,
        method: 8,
        declaredUncompressedSize: 1024,
        declaredCompressedSize: 1024,
        crc: crc20Mb,
      },
      {
        name: 'word/extra1.xml',
        compressedData: deflated20Mb,
        method: 8,
        declaredUncompressedSize: 1024,
        declaredCompressedSize: 1024,
        crc: crc20Mb,
      },
      {
        name: 'word/extra2.xml',
        compressedData: deflated20Mb,
        method: 8,
        declaredUncompressedSize: 1024,
        declaredCompressedSize: 1024,
        crc: crc20Mb,
      },
    ]);

    const res = await extractText({ buffer: threeEntriesDocx, extension: 'docx' });
    assert.equal(res.status, 'FAILED');
    assert.equal((res as { reason?: string }).reason, 'ARCHIVE_TOO_LARGE');
    assert.equal(getActiveWorkerCount(), 0);
  });

  it('Z3: stored entry whose central size exceeds the buffer = CORRUPT', async () => {
    const corruptStoredDocx = buildZipArchive([
      { name: '[Content_Types].xml', data: Buffer.from(CONTENT_TYPES_XML, 'utf8') },
      { name: '_rels/.rels', data: Buffer.from(RELS_XML, 'utf8') },
      {
        name: 'word/document.xml',
        data: Buffer.from('short stored content', 'utf8'),
        method: 0,
        declaredCompressedSize: 1000000, // Central size far exceeds total buffer length
        declaredUncompressedSize: 1000000,
      },
    ]);

    const res = await extractText({ buffer: corruptStoredDocx, extension: 'docx' });
    assert.deepEqual(res, { status: 'FAILED', reason: 'CORRUPT' });
    assert.equal(getActiveWorkerCount(), 0);
  });

  it('Z4: unsupported compression method = CORRUPT', async () => {
    const unsupportedMethodDocx = buildZipArchive([
      { name: '[Content_Types].xml', data: Buffer.from(CONTENT_TYPES_XML, 'utf8') },
      { name: '_rels/.rels', data: Buffer.from(RELS_XML, 'utf8') },
      {
        name: 'word/document.xml',
        data: Buffer.from('some text', 'utf8'),
        method: 9, // Deflate64 (unsupported method)
      },
    ]);

    const res = await extractText({ buffer: unsupportedMethodDocx, extension: 'docx' });
    assert.deepEqual(res, { status: 'FAILED', reason: 'CORRUPT' });
    assert.equal(getActiveWorkerCount(), 0);
  });

  it('Z5: a normal small docx (and the existing E1 file) still returns OK', async () => {
    // Normal small docx
    const docxBuf = createStandardDocx('UniCore standard small test document');
    const docxRes = await extractText({ buffer: docxBuf, extension: 'docx' });
    assert.equal(docxRes.status, 'OK');
    if (docxRes.status === 'OK') {
      assert.ok(docxRes.text.includes('UniCore standard small test document'));
      assert.equal(docxRes.truncated, false);
    }

    // Normal txt
    const txtBuf = Buffer.from('UniCore valid TXT document for Z5 test', 'utf8');
    const txtRes = await extractText({ buffer: txtBuf, extension: 'txt' });
    assert.equal(txtRes.status, 'OK');
    if (txtRes.status === 'OK') {
      assert.equal(txtRes.text, 'UniCore valid TXT document for Z5 test');
      assert.equal(txtRes.truncated, false);
    }
  });

  it('Z6: source-text test: the worker still imports only the allowed list', () => {
    const workerSourcePath = path.resolve(__dirname, '../src/services/similarity/textExtraction.worker.ts');
    assert.ok(fs.existsSync(workerSourcePath), 'Worker source file must exist');

    const source = fs.readFileSync(workerSourcePath, 'utf8');

    // Parse all import sources: `import ... from '...'` or `import '...'`
    const importRegex = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(source)) !== null) {
      imports.push(match[1]);
    }

    const allowedImports = new Set([
      'node:worker_threads',
      'worker_threads',
      'node:buffer',
      'buffer',
      'node:zlib',
      'zlib',
      'mammoth',
      'unpdf',
    ]);

    for (const imp of imports) {
      assert.ok(
        allowedImports.has(imp),
        `Unexpected import in worker: ${imp}. Allowed: ${Array.from(allowedImports).join(', ')}`
      );
    }

    // Ensure forbidden modules are strictly absent
    const forbiddenModules = ['fs', 'child_process', 'net', 'http', 'https', 'vm'];
    for (const mod of forbiddenModules) {
      const forbiddenRegex = new RegExp(`['"](?:node:)?${mod}['"]`);
      assert.equal(
        forbiddenRegex.test(source),
        false,
        `Worker source must not import forbidden module: ${mod}`
      );
    }

    // Ensure dynamic execution is absent
    assert.equal(/\beval\s*\(/.test(source), false, 'Worker source must not call eval()');
    assert.equal(/\bnew\s+Function\s*\(/.test(source), false, 'Worker source must not call new Function()');
  });

});
