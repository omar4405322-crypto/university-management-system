import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

describe('CONFIG-001: Request Body Limits', () => {
  const createTestApp = () => {
    const app = express();

    // Route-specific bulk endpoint allowed up to 10MB
    app.use('/api/schedules/sync-grid', express.json({ limit: '10mb' }));
    app.use('/api/attendance/manual', express.json({ limit: '10mb' }));

    // Global default 1MB for all regular JSON routes
    app.use(express.json({ limit: '1mb' }));

    // Test routes
    app.post('/api/courses', (req, res) => {
      res.status(200).json({ success: true, receivedBytes: JSON.stringify(req.body).length });
    });

    app.post('/api/schedules/sync-grid', (req, res) => {
      res.status(200).json({ success: true, receivedBytes: JSON.stringify(req.body).length });
    });

    // Global error handler for body limit
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (err.type === 'entity.too.large' || err.statusCode === 413) {
        return res.status(413).json({ success: false, message: 'Request body is too large' });
      }
      res.status(500).json({ success: false, message: err.message });
    });

    return app;
  };

  const app = createTestApp();

  const sendRequest = (
    server: http.Server,
    path: string,
    payload: object
  ): Promise<{ status: number; body: any }> => {
    return new Promise((resolve, reject) => {
      const addr = server.address() as any;
      const data = JSON.stringify(payload);
      const req = http.request(
        {
          host: '127.0.0.1',
          port: addr.port,
          path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          },
        },
        (res) => {
          let responseData = '';
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          res.on('end', () => {
            try {
              const body = JSON.parse(responseData);
              resolve({ status: res.statusCode || 500, body });
            } catch (err) {
              resolve({ status: res.statusCode || 500, body: responseData });
            }
          });
        }
      );

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  };

  it('allows standard sized JSON payloads (<1MB) on normal routes', async () => {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(true)));

    try {
      const normalPayload = { name: 'Introduction to Computer Science', code: 'CS101' };
      const res = await sendRequest(server, '/api/courses', normalPayload);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    } finally {
      server.close();
    }
  });

  it('rejects oversized JSON payloads (>1MB) on standard routes with 413', async () => {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(true)));

    try {
      // Generate ~1.2MB payload
      const largeStr = 'x'.repeat(1.2 * 1024 * 1024);
      const oversizedPayload = { data: largeStr };

      const res = await sendRequest(server, '/api/courses', oversizedPayload);

      assert.equal(res.status, 413);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Request body is too large');
    } finally {
      server.close();
    }
  });

  it('allows payloads >1MB on configured bulk endpoints (up to 10MB)', async () => {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(true)));

    try {
      // Generate ~2MB payload for bulk sync
      const mediumStr = 'y'.repeat(2 * 1024 * 1024);
      const bulkPayload = { slots: [{ courseName: 'Data Structures', payload: mediumStr }] };

      const res = await sendRequest(server, '/api/schedules/sync-grid', bulkPayload);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    } finally {
      server.close();
    }
  });

  it('rejects payloads >10MB on bulk endpoints with 413', async () => {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(true)));

    try {
      // Generate ~11MB payload
      const extremeStr = 'z'.repeat(11 * 1024 * 1024);
      const extremePayload = { slots: [{ data: extremeStr }] };

      const res = await sendRequest(server, '/api/schedules/sync-grid', extremePayload);

      assert.equal(res.status, 413);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Request body is too large');
    } finally {
      server.close();
    }
  });
});
