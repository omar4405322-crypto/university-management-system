import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapSuperAdmin } from '../scripts/bootstrapSuperAdmin';

describe('Bootstrap Super Admin - Production Fail‑Closed', () => {
  it('should throw when NODE_ENV=production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    await assert.rejects(
      async () => {
        await bootstrapSuperAdmin();
      },
      { message: /production/ }
    );
    process.env.NODE_ENV = originalEnv;
  });

  it('successfully creates or updates deterministic test super admin persona in non-production', async () => {
    const res = await bootstrapSuperAdmin({
      NODE_ENV: 'test',
      TEST_SUPER_ADMIN_EMAIL: 'superadmin.test@university.local',
      TEST_SUPER_ADMIN_PASSWORD: 'SuperAdminTest123!',
    });
    assert.equal(res.success, true);
    assert.equal(res.admin?.email, 'superadmin.test@university.local');
    assert.equal(res.admin?.role, 'SUPER_ADMIN');
  });
});
