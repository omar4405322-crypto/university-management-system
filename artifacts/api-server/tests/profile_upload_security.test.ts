import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import express from 'express';
import upload, { isCloudinaryConfigured } from '../src/middleware/upload.middleware';
import { generateAccessToken } from '../src/utils/jwt.utils';
import prisma from '../src/utils/prismaClient';
import globalErrorHandler from '../src/middleware/error.middleware';

// Minimal 1x1 valid image buffers for magic-byte verification
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]);

const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x80, 0xff, 0xd9
]);

const VALID_WEBP_BUFFER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x4c, 0x0e, 0x00, 0x00, 0x00, 0x2f, 0x00, 0x00, 0x00,
  0x00, 0x07, 0x00, 0x00, 0xff, 0x03, 0x88, 0x88, 0xfe, 0x07, 0x00
]);

const SPOOFED_HTML_CONTENT = '<html><head></head><body><script>alert("XSS")</script></body></html>';

async function runUploadSecurityTests() {
  console.log('--- Starting Profile Upload Security Verification Suite ---');
  const originalEnv = { ...process.env };
  const createdTestFiles: string[] = [];

  try {
    // -------------------------------------------------------------
    // Suite 1: Production Fail-Closed (Missing Cloudinary Config)
    // -------------------------------------------------------------
    console.log('\n[Suite 1] Testing production fail-closed behavior (Cloudinary missing)...');
    process.env.NODE_ENV = 'production';
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    assert.strictEqual(isCloudinaryConfigured(), false, 'Cloudinary should report not configured');

    const appProd = express();
    appProd.use(express.json());
    appProd.put('/api/users/profile/picture', upload.single('profilePicture'), (req, res) => {
      res.json({ success: true });
    });
    appProd.use(globalErrorHandler);

    const prodServer = http.createServer(appProd);
    await new Promise<void>((resolve) => prodServer.listen(0, resolve));
    const prodPort = (prodServer.address() as any).port;

    try {
      // 1.1: Spoofed HTML file upload in production should be rejected with 503
      const formData = new FormData();
      formData.append(
        'profilePicture',
        new Blob([SPOOFED_HTML_CONTENT], { type: 'image/png' }),
        'exploit.png'
      );

      const resProd = await fetch(`http://localhost:${prodPort}/api/users/profile/picture`, {
        method: 'PUT',
        body: formData,
      });

      assert.strictEqual(
        resProd.status,
        503,
        `Production missing Cloudinary must return 503, got ${resProd.status}`
      );
      const jsonProd = await resProd.json();
      assert.strictEqual(
        jsonProd.message,
        'Profile picture storage is not configured',
        'Should return explicit 503 message'
      );

      // Verify no file was created in uploads/profiles
      const profilesDir = path.join(process.cwd(), 'uploads/profiles');
      if (fs.existsSync(profilesDir)) {
        const files = fs.readdirSync(profilesDir);
        for (const file of files) {
          assert(
            !file.includes('exploit'),
            'Exploit file must never be written to disk in production'
          );
        }
      }

      console.log('✓ Suite 1 passed (Production fails closed with 503 and zero disk writes)');
    } finally {
      await new Promise<void>((resolve) => prodServer.close(() => resolve()));
    }

    // -------------------------------------------------------------
    // Suite 2: Development Mode Magic-Byte & Safe-Extension Hardening
    // -------------------------------------------------------------
    console.log('\n[Suite 2] Testing development local-disk magic-byte validation & safe extensions...');
    process.env.NODE_ENV = 'development';
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    let savedFileInfo: any = null;
    const appDev = express();
    appDev.use(express.json());
    appDev.put(
      '/api/users/profile/picture',
      upload.single('profilePicture'),
      (req, res) => {
        savedFileInfo = req.file;
        if (req.file?.path) {
          createdTestFiles.push(req.file.path);
        }
        res.json({ success: true, file: req.file });
      }
    );
    appDev.use(globalErrorHandler);

    const devServer = http.createServer(appDev);
    await new Promise<void>((resolve) => devServer.listen(0, resolve));
    const devPort = (devServer.address() as any).port;

    try {
      // 2.1: Spoofed HTML file with Content-Type: image/png (attack vector)
      console.log('  -> 2.1: Testing spoofed HTML with Content-Type: image/png');
      const spoofFormData = new FormData();
      spoofFormData.append(
        'profilePicture',
        new Blob([SPOOFED_HTML_CONTENT], { type: 'image/png' }),
        'malicious.png'
      );

      const resSpoof = await fetch(`http://localhost:${devPort}/api/users/profile/picture`, {
        method: 'PUT',
        body: spoofFormData,
      });

      assert.strictEqual(
        resSpoof.status,
        400,
        `Spoofed HTML content must be rejected with 400, got ${resSpoof.status}`
      );
      const jsonSpoof = await resSpoof.json();
      assert(
        jsonSpoof.message.includes('Magic-byte inspection failed'),
        `Expected magic-byte failure message, got: ${jsonSpoof.message}`
      );

      // 2.2: Legitimate PNG file upload
      console.log('  -> 2.2: Testing legitimate PNG upload');
      savedFileInfo = null;
      const pngFormData = new FormData();
      pngFormData.append(
        'profilePicture',
        new Blob([VALID_PNG_BUFFER], { type: 'image/png' }),
        'user-avatar.suspicious.html.png'
      );

      const resPng = await fetch(`http://localhost:${devPort}/api/users/profile/picture`, {
        method: 'PUT',
        body: pngFormData,
      });

      assert.strictEqual(resPng.status, 200, `Valid PNG must succeed with 200, got ${resPng.status}`);
      assert(savedFileInfo, 'File should be saved');
      assert(savedFileInfo.filename.endsWith('.png'), 'Saved filename must end with detected .png');
      assert(!savedFileInfo.filename.includes('html'), 'Original extension must not be preserved');
      assert(fs.existsSync(savedFileInfo.path), 'Saved file must exist on disk');

      // 2.3: Legitimate JPEG file upload
      console.log('  -> 2.3: Testing legitimate JPEG upload');
      savedFileInfo = null;
      const jpegFormData = new FormData();
      jpegFormData.append(
        'profilePicture',
        new Blob([VALID_JPEG_BUFFER], { type: 'image/jpeg' }),
        'photo.jpeg'
      );

      const resJpeg = await fetch(`http://localhost:${devPort}/api/users/profile/picture`, {
        method: 'PUT',
        body: jpegFormData,
      });

      assert.strictEqual(resJpeg.status, 200, `Valid JPEG must succeed with 200, got ${resJpeg.status}`);
      assert(savedFileInfo.filename.endsWith('.jpg'), 'Saved filename must end with detected .jpg');
      assert(fs.existsSync(savedFileInfo.path), 'Saved JPEG file must exist on disk');

      // 2.4: Legitimate WebP file upload
      console.log('  -> 2.4: Testing legitimate WebP upload');
      savedFileInfo = null;
      const webpFormData = new FormData();
      webpFormData.append(
        'profilePicture',
        new Blob([VALID_WEBP_BUFFER], { type: 'image/webp' }),
        'photo.webp'
      );

      const resWebp = await fetch(`http://localhost:${devPort}/api/users/profile/picture`, {
        method: 'PUT',
        body: webpFormData,
      });

      assert.strictEqual(resWebp.status, 200, `Valid WebP must succeed with 200, got ${resWebp.status}`);
      assert(savedFileInfo.filename.endsWith('.webp'), 'Saved filename must end with detected .webp');
      assert(fs.existsSync(savedFileInfo.path), 'Saved WebP file must exist on disk');

      console.log('✓ Suite 2 passed (Local-disk magic byte detection and safe extensions fully working)');
    } finally {
      await new Promise<void>((resolve) => devServer.close(() => resolve()));
    }

    // -------------------------------------------------------------
    // Suite 3: Cloudinary Configuration Detection
    // -------------------------------------------------------------
    console.log('\n[Suite 3] Testing Cloudinary detection logic...');
    process.env.CLOUDINARY_CLOUD_NAME = 'mock-cloud';
    process.env.CLOUDINARY_API_KEY = 'mock-key';
    process.env.CLOUDINARY_API_SECRET = 'mock-secret';

    assert.strictEqual(isCloudinaryConfigured(), true, 'isCloudinaryConfigured should return true when all 3 env vars set');

    delete process.env.CLOUDINARY_API_SECRET;
    assert.strictEqual(isCloudinaryConfigured(), false, 'isCloudinaryConfigured should return false if any env var missing');

    console.log('✓ Suite 3 passed (Cloudinary detection operates correctly)');

    console.log('\n======================================================');
    console.log('🎉 ALL PROFILE UPLOAD SECURITY TESTS PASSED');
    console.log('======================================================\n');
  } finally {
    // Cleanup any test files written to disk
    for (const filePath of createdTestFiles) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore
        }
      }
    }
    process.env = originalEnv;
  }
}

runUploadSecurityTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
