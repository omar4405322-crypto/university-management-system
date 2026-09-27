import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

describe('SEC-003: Edge and Web-Serving Security Headers', () => {
  it('configures hardened security headers in nginx.conf', () => {
    const nginxPath = path.join(rootDir, 'nginx.conf');
    const nginxContent = fs.readFileSync(nginxPath, 'utf8');

    assert.ok(nginxContent.includes('X-Content-Type-Options nosniff'), 'Missing nosniff');
    assert.ok(nginxContent.includes('Referrer-Policy strict-origin-when-cross-origin'), 'Missing Referrer-Policy');
    assert.ok(nginxContent.includes('X-Frame-Options DENY'), 'Missing X-Frame-Options');
    assert.ok(nginxContent.includes('Content-Security-Policy'), 'Missing Content-Security-Policy');
    assert.ok(nginxContent.includes('Permissions-Policy'), 'Missing Permissions-Policy');
    assert.ok(nginxContent.includes("frame-ancestors 'none'"), 'Missing frame-ancestors none in CSP');
    assert.ok(nginxContent.includes("object-src 'none'"), 'Missing object-src none in CSP');
    assert.ok(
      nginxContent.includes('# NOTE: HSTS (Strict-Transport-Security) should ONLY be applied when terminating TLS/HTTPS'),
      'Missing HSTS production caveat'
    );
  });

  it('configures hardened edge security headers in vercel.json for Vercel deployment', () => {
    const vercelPath = path.join(rootDir, 'artifacts/university-app/vercel.json');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));

    assert.ok(Array.isArray(vercelConfig.headers), 'vercel.json must define headers array');
    const routeHeaders = vercelConfig.headers.find((h) => h.source === '/(.*)');
    assert.ok(routeHeaders, 'Missing route headers definition for /(.*)');

    const headerMap = new Map();
    for (const hdr of routeHeaders.headers) {
      headerMap.set(hdr.key, hdr.value);
    }

    assert.equal(headerMap.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(headerMap.get('X-Frame-Options'), 'DENY');
    assert.equal(headerMap.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
    assert.ok(headerMap.get('Content-Security-Policy')?.includes("frame-ancestors 'none'"));
    assert.ok(headerMap.get('Content-Security-Policy')?.includes("object-src 'none'"));
    assert.ok(headerMap.get('Permissions-Policy')?.includes('camera=(self)'));
    assert.ok(headerMap.get('Strict-Transport-Security')?.includes('max-age=31536000'));
  });
});
