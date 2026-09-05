import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { AppError } from '../src/utils/appError';
import {
  isDeclaredMaterialMimeAllowed,
  setMaterialDownloadHeaders,
  verifyMaterialFileSignature,
} from '../src/middleware/materialUpload.middleware';
import materialUpload from '../src/middleware/materialUpload.middleware';

async function runMaterialUploadSecurityTests() {
  assert.equal(isDeclaredMaterialMimeAllowed('application/pdf'), true);
  assert.equal(isDeclaredMaterialMimeAllowed('image/png'), true);
  assert.equal(isDeclaredMaterialMimeAllowed('text/html'), false);
  assert.equal(isDeclaredMaterialMimeAllowed('application/javascript'), false);

  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'material-security-'));
  try {
    const pngPath = path.join(tempDirectory, 'valid.png');
    await writeFile(
      pngPath,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
        'base64'
      )
    );
    assert.equal(
      await verifyMaterialFileSignature(pngPath, 'lecture.png'),
      'image/png'
    );
    await assert.rejects(
      verifyMaterialFileSignature(pngPath, 'lecture.pdf'),
      (error: unknown) => error instanceof AppError && error.statusCode === 400
    );

    const spoofedPdfPath = path.join(tempDirectory, 'spoofed.pdf');
    await writeFile(spoofedPdfPath, '<html><script>alert(1)</script></html>');
    await assert.rejects(
      verifyMaterialFileSignature(spoofedPdfPath, 'lecture.pdf'),
      (error: unknown) => error instanceof AppError && error.statusCode === 400
    );

    const truncatedArchivePath = path.join(tempDirectory, 'spoofed.docx');
    await writeFile(truncatedArchivePath, Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    await assert.rejects(
      verifyMaterialFileSignature(truncatedArchivePath, 'lecture.docx'),
      (error: unknown) => error instanceof AppError && error.statusCode === 400
    );
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }

  const headers = new Map<string, string>();
  setMaterialDownloadHeaders({
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return this;
    },
  } as any);
  assert.equal(headers.get('content-disposition'), 'attachment');
  assert.equal(headers.get('x-content-type-options'), 'nosniff');

  const uploadDirectory = path.join(process.cwd(), 'uploads', 'materials');
  const beforeFiles = new Set(await readdir(uploadDirectory));
  const app = express();
  app.post('/upload', materialUpload.single('file'), (request, response) => {
    response.json({
      path: request.file?.path,
      mimetype: request.file?.mimetype,
    });
  });
  app.use((error: any, _request: any, response: any, _next: any) => {
    response.status(error.statusCode || 500).json({ message: error.message });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const endpoint = `http://127.0.0.1:${address.port}/upload`;

  let acceptedPath: string | undefined;
  try {
    const spoofedForm = new FormData();
    spoofedForm.append(
      'file',
      new Blob(['<script>alert(1)</script>'], { type: 'application/pdf' }),
      'spoofed.pdf'
    );
    const spoofedResponse = await fetch(endpoint, {
      method: 'POST',
      body: spoofedForm,
    });
    assert.equal(spoofedResponse.status, 400);
    assert.deepEqual(new Set(await readdir(uploadDirectory)), beforeFiles);

    const validForm = new FormData();
    validForm.append(
      'file',
      new Blob([
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
          'base64'
        ),
      ], { type: 'image/png' }),
      'lecture.png'
    );
    const validResponse = await fetch(endpoint, {
      method: 'POST',
      body: validForm,
    });
    assert.equal(validResponse.status, 200);
    const accepted = await validResponse.json() as {
      path?: string;
      mimetype?: string;
    };
    assert.equal(accepted.mimetype, 'image/png');
    acceptedPath = accepted.path;
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve()))
    );
    if (acceptedPath) {
      const resolvedUploadDirectory = path.resolve(uploadDirectory);
      const resolvedAcceptedPath = path.resolve(acceptedPath);
      assert.equal(path.dirname(resolvedAcceptedPath), resolvedUploadDirectory);
      await unlink(resolvedAcceptedPath);
    }
  }
}

await runMaterialUploadSecurityTests();
console.log('Material upload security checks passed');
