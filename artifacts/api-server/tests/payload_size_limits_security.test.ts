import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import globalErrorHandler from '../src/middleware/error.middleware';
import materialUpload from '../src/middleware/materialUpload.middleware';
import upload from '../src/middleware/upload.middleware';

async function withServer(
  app: express.Express,
  run: (endpoint: string) => Promise<void>
): Promise<void> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve()))
    );
  }
}

async function rejectsOversizedJsonInProduction(): Promise<void> {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    const app = express();
    app.use(express.json({ limit: '1kb' }));
    app.post('/json', (_request, response) => response.sendStatus(204));
    app.use(globalErrorHandler);

    await withServer(app, async endpoint => {
      const response = await fetch(`${endpoint}/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: 'x'.repeat(1_025) }),
      });
      assert.equal(response.status, 413);
    });
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
}

async function rejectsOversizedProfileUpload(): Promise<void> {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';

  try {
    const app = express();
    app.post('/profile', upload.single('profilePicture'), (_request, response) =>
      response.sendStatus(204)
    );
    app.use(globalErrorHandler);

    await withServer(app, async endpoint => {
      const form = new FormData();
      form.append(
        'profilePicture',
        new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: 'image/png' }),
        'oversized.png'
      );
      const response = await fetch(`${endpoint}/profile`, { method: 'POST', body: form });
      assert.equal(response.status, 413);
    });
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
}

async function rejectsOversizedMaterialUpload(): Promise<void> {
  const uploadDirectory = path.join(process.cwd(), 'uploads', 'materials');
  const app = express();
  app.post('/material', materialUpload.single('file'), (_request, response) =>
    response.sendStatus(204)
  );
  app.use(globalErrorHandler);

  await withServer(app, async endpoint => {
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(50 * 1024 * 1024 + 1)], { type: 'video/matroska' }),
      'oversized.mkv'
    );
    const response = await fetch(`${endpoint}/material`, { method: 'POST', body: form });
    assert.equal(response.status, 413);
  });

  const filesAfter = await readdir(uploadDirectory);
  assert.equal(
    filesAfter.some((file) => file.includes('oversized')),
    false,
    'Oversized upload must never persist to disk'
  );
}

await rejectsOversizedJsonInProduction();
await rejectsOversizedProfileUpload();
await rejectsOversizedMaterialUpload();
console.log('Payload size limit security checks passed');
