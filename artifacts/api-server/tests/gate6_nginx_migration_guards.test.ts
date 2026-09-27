import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

describe('Fix Gate 6: I1/S1 & M2 Regression Guards', () => {
  it('I1/S1: nginx.conf explicitly defines client_max_body_size >= 50MB + overhead', () => {
    const nginxConfPath = path.join(rootDir, 'nginx.conf');
    assert.ok(fs.existsSync(nginxConfPath), 'nginx.conf must exist');

    const content = fs.readFileSync(nginxConfPath, 'utf8');
    const match = content.match(/client_max_body_size\s+([0-9]+)([kmg]?);/i);

    assert.ok(match, 'nginx.conf must contain an explicit client_max_body_size directive');

    const num = parseInt(match[1], 10);
    const unit = (match[2] || 'm').toLowerCase();

    let bytes = num;
    if (unit === 'k') bytes = num * 1024;
    else if (unit === 'm') bytes = num * 1024 * 1024;
    else if (unit === 'g') bytes = num * 1024 * 1024 * 1024;

    const applicationMaterialLimitBytes = 50 * 1024 * 1024;
    assert.ok(
      bytes >= applicationMaterialLimitBytes,
      `Configured Nginx body size (${bytes} bytes) must be >= application material limit (${applicationMaterialLimitBytes} bytes)`
    );
  });

  it('I1/S1: Multer profile and material upload limits remain preserved at 2MB and 50MB', () => {
    const profileUploadPath = path.join(
      rootDir,
      'artifacts/api-server/src/middleware/upload.middleware.ts'
    );
    const materialUploadPath = path.join(
      rootDir,
      'artifacts/api-server/src/middleware/materialUpload.middleware.ts'
    );

    assert.ok(fs.existsSync(profileUploadPath), 'upload.middleware.ts must exist');
    assert.ok(fs.existsSync(materialUploadPath), 'materialUpload.middleware.ts must exist');

    const profileContent = fs.readFileSync(profileUploadPath, 'utf8');
    const materialContent = fs.readFileSync(materialUploadPath, 'utf8');

    // 2 * 1024 * 1024 or equivalent
    assert.ok(
      profileContent.includes('2 * 1024 * 1024') || profileContent.includes('2097152'),
      'Profile upload must enforce 2MB limit'
    );

    // 50 * 1024 * 1024 or equivalent
    assert.ok(
      materialContent.includes('50 * 1024 * 1024') || materialContent.includes('52428800'),
      'Material upload must enforce 50MB limit'
    );
  });

  it('M2: Canonical DEPLOYMENT.md contains explicit single-instance and rolling migration protocols', () => {
    const deploymentDocPath = path.join(rootDir, 'DEPLOYMENT.md');
    assert.ok(fs.existsSync(deploymentDocPath), 'DEPLOYMENT.md must exist');

    const content = fs.readFileSync(deploymentDocPath, 'utf8');

    assert.ok(content.includes('Single-Instance Deployment'), 'Must document single-instance migration flow');
    assert.ok(content.includes('Expand / Contract'), 'Must document expand/contract rolling migration requirements');
    assert.ok(content.includes('DROP TABLE'), 'Must warn against destructive schema drops during rolling updates');
    assert.ok(content.includes('ROLLBACK.md') || content.includes('db-backup.sh'), 'Must reference backup/recovery procedures');
  });
});
