import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { restoreSuperAdmin } from '../scripts/restoreSuperAdmin';

const localEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/university_db',
  SUPER_ADMIN_PASSWORD: 'RestoredAdmin123!',
};

describe('restoreSuperAdmin', () => {
  it('refuses production and non-local databases', async () => {
    const unusedClient = { user: { findUnique: async () => null, upsert: async () => assert.fail() } };
    await assert.rejects(
      restoreSuperAdmin({ ...localEnv, NODE_ENV: 'production' }, unusedClient),
      /production/
    );
    await assert.rejects(
      restoreSuperAdmin(
        { ...localEnv, DATABASE_URL: 'postgresql://user:password@railway.example:5432/prod' },
        unusedClient
      ),
      /non-local/
    );
  });

  it('upserts the fixed SuperAdmin account with a bcrypt password and restores active state', async () => {
    let upsertArgs: any;
    const client = {
      user: {
        findUnique: async () => ({ twoFactorEnabled: true, twoFactorSecret: null }),
        upsert: async (args: any) => {
          upsertArgs = args;
          return { id: 193, email: 'superadmin@university.com', role: 'SUPER_ADMIN' };
        },
      },
    };

    const user = await restoreSuperAdmin(localEnv, client);

    assert.equal(user.email, 'superadmin@university.com');
    assert.deepEqual(upsertArgs.where, { email: 'superadmin@university.com' });
    assert.equal(upsertArgs.update.role, 'SUPER_ADMIN');
    assert.equal(upsertArgs.update.adminRole, null);
    assert.equal(upsertArgs.update.isActive, true);
    assert.equal(upsertArgs.update.deactivatedAt, null);
    assert.deepEqual(upsertArgs.update.tokenVersion, { increment: 1 });
    assert.equal(upsertArgs.update.twoFactorEnabled, false);
    assert.equal(upsertArgs.update.twoFactorSecret, null);
    assert.equal(await bcrypt.compare(localEnv.SUPER_ADMIN_PASSWORD, upsertArgs.update.password), true);
  });
});
