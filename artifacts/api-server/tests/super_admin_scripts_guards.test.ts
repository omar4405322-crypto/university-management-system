import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapSuperAdmin } from '../scripts/bootstrapSuperAdmin';
import { restoreSuperAdmin } from '../scripts/restoreSuperAdmin';

describe('Super Admin Scripts - Guard Hardening Suite', () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  describe('bootstrapSuperAdmin guards', () => {
    it('refuses non-local env.DATABASE_URL', async () => {
      process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
      await assert.rejects(
        bootstrapSuperAdmin({
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://user:pass@railway.example.com:5432/db',
          TEST_SUPER_ADMIN_PASSWORD: 'ValidPassword123!',
        }),
        /non-local/
      );
    });

    it('refuses when process.env.DATABASE_URL is non-local even if env.DATABASE_URL is local', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@railway.example.com:5432/db';
      await assert.rejects(
        bootstrapSuperAdmin({
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
          TEST_SUPER_ADMIN_PASSWORD: 'ValidPassword123!',
        }),
        /non-local|differ/
      );
    });

    it('refuses missing TEST_SUPER_ADMIN_PASSWORD', async () => {
      process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
      await assert.rejects(
        bootstrapSuperAdmin({
          NODE_ENV: 'test',
          TEST_SUPER_ADMIN_PASSWORD: '',
        }),
        /TEST_SUPER_ADMIN_PASSWORD/
      );
    });

    it('refuses short TEST_SUPER_ADMIN_PASSWORD (<12 characters)', async () => {
      process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
      await assert.rejects(
        bootstrapSuperAdmin({
          NODE_ENV: 'test',
          TEST_SUPER_ADMIN_PASSWORD: 'Short123!',
        }),
        /TEST_SUPER_ADMIN_PASSWORD|12/
      );
    });

    it('refuses unparsable DATABASE_URL', async () => {
      process.env.DATABASE_URL = 'not-a-valid-url';
      await assert.rejects(
        bootstrapSuperAdmin({
          NODE_ENV: 'test',
          TEST_SUPER_ADMIN_PASSWORD: 'ValidPassword123!',
        }),
        /non-local|unparsable|invalid/
      );
    });

    it('refuses before importing prismaClient when database target is non-local', async () => {
      // Point process.env to non-local host. If guards run before prismaClient import,
      // it throws the non-local error immediately without touching any DB client.
      process.env.DATABASE_URL = 'postgresql://u:p@remote-production.db:5432/db';
      await assert.rejects(
        bootstrapSuperAdmin({
          NODE_ENV: 'test',
          TEST_SUPER_ADMIN_PASSWORD: 'ValidPassword123!',
        }),
        /non-local/
      );
    });

    it('refuses production mode case-insensitively and with whitespace in bootstrapSuperAdmin (env)', async () => {
      await assert.rejects(
        bootstrapSuperAdmin({ NODE_ENV: 'Production' }),
        /production/
      );
      await assert.rejects(
        bootstrapSuperAdmin({ NODE_ENV: ' production ' }),
        /production/
      );
    });

    it('refuses production mode case-insensitively and with whitespace in bootstrapSuperAdmin (process.env fallback)', async () => {
      process.env.NODE_ENV = 'Production';
      await assert.rejects(
        bootstrapSuperAdmin({}),
        /production/
      );
      process.env.NODE_ENV = ' production ';
      await assert.rejects(
        bootstrapSuperAdmin({}),
        /production/
      );
    });

    it('refuses 12+ char password failing isPasswordStrong in bootstrapSuperAdmin', async () => {
      process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
      await assert.rejects(
        bootstrapSuperAdmin({
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
          TEST_SUPER_ADMIN_PASSWORD: 'alllowercasepassword',
        }),
        /Password must be at least 8 characters/
      );
    });

    it('returns result containing userId with injected client in bootstrapSuperAdmin', async () => {
      const mockClient = {
        user: {
          upsert: async () => ({ id: 42, email: 'superadmin.test@university.local', role: 'SUPER_ADMIN' }),
        },
      };
      const res = await bootstrapSuperAdmin(
        {
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
          TEST_SUPER_ADMIN_PASSWORD: 'ValidPassword123!',
        },
        mockClient as any
      );
      assert.equal(res.success, true);
      assert.equal(res.admin?.id, 42);
      assert.equal(res.admin?.userId, 42);
      assert.equal(res.admin?.email, 'superadmin.test@university.local');
      assert.equal(res.admin?.role, 'SUPER_ADMIN');
    });
  });

  describe('restoreSuperAdmin guards', () => {
    const mockClient = {
      user: {
        upsert: async () => ({ id: 1, email: 'superadmin@university.com', role: 'SUPER_ADMIN' }),
      },
    };

    it('refuses missing SUPER_ADMIN_PASSWORD', async () => {
      await assert.rejects(
        restoreSuperAdmin(
          {
            NODE_ENV: 'test',
            DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
            SUPER_ADMIN_PASSWORD: '',
          },
          mockClient
        ),
        /SUPER_ADMIN_PASSWORD/
      );
    });

    it('refuses short SUPER_ADMIN_PASSWORD (<12 characters)', async () => {
      await assert.rejects(
        restoreSuperAdmin(
          {
            NODE_ENV: 'test',
            DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
            SUPER_ADMIN_PASSWORD: 'Short123!',
          },
          mockClient
        ),
        /SUPER_ADMIN_PASSWORD|12/
      );
    });

    it('refuses unparsable DATABASE_URL', async () => {
      await assert.rejects(
        restoreSuperAdmin(
          {
            NODE_ENV: 'test',
            DATABASE_URL: 'not-valid-url',
            SUPER_ADMIN_PASSWORD: 'ValidPassword123!',
          },
          mockClient
        ),
        /non-local/
      );
    });

    it('accepts [::1] and 127.0.0.1 hosts with an injected mock client', async () => {
      const resIpv6 = await restoreSuperAdmin(
        {
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://u:p@[::1]:5432/db',
          SUPER_ADMIN_PASSWORD: 'ValidPassword123!',
        },
        mockClient
      );
      assert.equal(resIpv6.email, 'superadmin@university.com');

      const resIpv4 = await restoreSuperAdmin(
        {
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/db',
          SUPER_ADMIN_PASSWORD: 'ValidPassword123!',
        },
        mockClient
      );
      assert.equal(resIpv4.email, 'superadmin@university.com');
    });

    it('with no client injected and non-local process.env.DATABASE_URL it refuses before importing prismaClient', async () => {
      process.env.DATABASE_URL = 'postgresql://u:p@remote-production.db:5432/db';
      await assert.rejects(
        restoreSuperAdmin({
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://u:p@remote-production.db:5432/db',
          SUPER_ADMIN_PASSWORD: 'ValidPassword123!',
        }),
        /non-local/
      );
    });

    it('refuses production mode case-insensitively and with whitespace in restoreSuperAdmin', async () => {
      await assert.rejects(
        restoreSuperAdmin({ NODE_ENV: 'Production' }, mockClient),
        /production/
      );
      await assert.rejects(
        restoreSuperAdmin({ NODE_ENV: ' production ' }, mockClient),
        /production/
      );
    });

    it('refuses 12+ char password failing isPasswordStrong in restoreSuperAdmin', async () => {
      await assert.rejects(
        restoreSuperAdmin(
          {
            NODE_ENV: 'test',
            DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
            SUPER_ADMIN_PASSWORD: 'alllowercasepassword',
          },
          mockClient
        ),
        /Password must be at least 8 characters/
      );
    });

    it('preserves valid 2FA enrollment (enabled + secret) in update in restoreSuperAdmin', async () => {
      let upsertArgs: any;
      const mock2faClient = {
        user: {
          findUnique: async () => ({ twoFactorEnabled: true, twoFactorSecret: 'VALID_2FA_SECRET_KEY' }),
          upsert: async (args: any) => {
            upsertArgs = args;
            return { id: 1, email: 'superadmin@university.com', role: 'SUPER_ADMIN' };
          },
        },
      };
      await restoreSuperAdmin(
        {
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
          SUPER_ADMIN_PASSWORD: 'ValidPassword123!',
        },
        mock2faClient
      );
      assert.equal(upsertArgs.update.twoFactorEnabled, true);
      assert.equal(upsertArgs.update.twoFactorSecret, 'VALID_2FA_SECRET_KEY');
    });

    it('clears 2FA when enabled without secret in restoreSuperAdmin', async () => {
      let upsertArgs: any;
      const mockNoSecretClient = {
        user: {
          findUnique: async () => ({ twoFactorEnabled: true, twoFactorSecret: null }),
          upsert: async (args: any) => {
            upsertArgs = args;
            return { id: 1, email: 'superadmin@university.com', role: 'SUPER_ADMIN' };
          },
        },
      };
      await restoreSuperAdmin(
        {
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
          SUPER_ADMIN_PASSWORD: 'ValidPassword123!',
        },
        mockNoSecretClient
      );
      assert.equal(upsertArgs.update.twoFactorEnabled, false);
      assert.equal(upsertArgs.update.twoFactorSecret, null);
    });

    it('clears 2FA when enabled with empty secret string in restoreSuperAdmin', async () => {
      let upsertArgs: any;
      const mockEmptySecretClient = {
        user: {
          findUnique: async () => ({ twoFactorEnabled: true, twoFactorSecret: '' }),
          upsert: async (args: any) => {
            upsertArgs = args;
            return { id: 1, email: 'superadmin@university.com', role: 'SUPER_ADMIN' };
          },
        },
      };
      await restoreSuperAdmin(
        {
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
          SUPER_ADMIN_PASSWORD: 'ValidPassword123!',
        },
        mockEmptySecretClient
      );
      assert.equal(upsertArgs.update.twoFactorEnabled, false);
      assert.equal(upsertArgs.update.twoFactorSecret, null);
    });
  });
});

