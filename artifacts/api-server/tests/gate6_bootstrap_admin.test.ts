import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { bootstrapInitialSuperAdmin } from '../scripts/bootstrapAdmin';

describe('Fix Gate 6: AB2 Initial Super Admin Bootstrap Suite', () => {
  const TEST_ADMIN_EMAIL = 'test.bootstrap.admin@university.internal';
  const TEST_ADMIN_PASS = 'SecureAdminPassword2026!';
  const CONFIRM_TOKEN = 'CREATE_INITIAL_SUPER_ADMIN';

  // Cleanup helper
  async function cleanup() {
    await prisma.user.deleteMany({
      where: { email: TEST_ADMIN_EMAIL },
    });
  }

  beforeEach(async () => {
    await cleanup();
  });

  it('fails closed when required environment variables are missing', async () => {
    await assert.rejects(
      async () => {
        await bootstrapInitialSuperAdmin({});
      },
      {
        message: /BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD environment variables are required/,
      }
    );
  });

  it('fails closed when confirmation token is incorrect or missing', async () => {
    await assert.rejects(
      async () => {
        await bootstrapInitialSuperAdmin({
          BOOTSTRAP_ADMIN_EMAIL: TEST_ADMIN_EMAIL,
          BOOTSTRAP_ADMIN_PASSWORD: TEST_ADMIN_PASS,
          BOOTSTRAP_ADMIN_CONFIRM: 'WRONG_TOKEN',
        });
      },
      {
        message: /BOOTSTRAP_ADMIN_CONFIRM must be set exactly to/,
      }
    );
  });

  it('fails closed on weak password input', async () => {
    await assert.rejects(
      async () => {
        await bootstrapInitialSuperAdmin({
          BOOTSTRAP_ADMIN_EMAIL: TEST_ADMIN_EMAIL,
          BOOTSTRAP_ADMIN_PASSWORD: 'weak',
          BOOTSTRAP_ADMIN_CONFIRM: CONFIRM_TOKEN,
        });
      },
      {
        message: /Invalid password:/,
      }
    );
  });

  it('fails closed on invalid email format', async () => {
    await assert.rejects(
      async () => {
        await bootstrapInitialSuperAdmin({
          BOOTSTRAP_ADMIN_EMAIL: 'not-an-email',
          BOOTSTRAP_ADMIN_PASSWORD: TEST_ADMIN_PASS,
          BOOTSTRAP_ADMIN_CONFIRM: CONFIRM_TOKEN,
        });
      },
      {
        message: /Invalid email format/,
      }
    );
  });

  it('creates initial SUPER_ADMIN with properly hashed password and active status', async () => {
    // Ensure no SUPER_ADMIN exists in test scope
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });

    if (existingSuperAdmin) {
      // If db already has super admin from previous tests, test idempotency rejection directly
      await assert.rejects(
        async () => {
          await bootstrapInitialSuperAdmin({
            BOOTSTRAP_ADMIN_EMAIL: TEST_ADMIN_EMAIL,
            BOOTSTRAP_ADMIN_PASSWORD: TEST_ADMIN_PASS,
            BOOTSTRAP_ADMIN_CONFIRM: CONFIRM_TOKEN,
          });
        },
        {
          message: /A SUPER_ADMIN already exists. Bootstrap aborted./,
        }
      );
    } else {
      // Otherwise perform creation and verify
      const result = await bootstrapInitialSuperAdmin({
        BOOTSTRAP_ADMIN_EMAIL: TEST_ADMIN_EMAIL,
        BOOTSTRAP_ADMIN_PASSWORD: TEST_ADMIN_PASS,
        BOOTSTRAP_ADMIN_CONFIRM: CONFIRM_TOKEN,
      });

      assert.equal(result.success, true);
      assert.equal(result.user?.email, TEST_ADMIN_EMAIL);
      assert.equal(result.user?.role, 'SUPER_ADMIN');

      const persisted = await prisma.user.findUnique({
        where: { email: TEST_ADMIN_EMAIL },
      });

      assert.ok(persisted, 'User must be persisted in database');
      assert.equal(persisted?.role, 'SUPER_ADMIN');
      assert.equal(persisted?.isActive, true);
      assert.notEqual(persisted?.password, TEST_ADMIN_PASS, 'Plaintext password must never be stored');

      const isMatch = await bcrypt.compare(TEST_ADMIN_PASS, persisted!.password);
      assert.equal(isMatch, true, 'Stored hash must verify against password using bcrypt');

      // Verify authorization shape parity
      assert.equal(persisted?.role, 'SUPER_ADMIN');
      assert.equal(persisted?.isActive, true);
      assert.equal(persisted?.adminRole, null); // Super admin does not require restricted adminRole metadata

      // Idempotency: Second execution must be rejected
      await assert.rejects(
        async () => {
          await bootstrapInitialSuperAdmin({
            BOOTSTRAP_ADMIN_EMAIL: 'another.admin@university.internal',
            BOOTSTRAP_ADMIN_PASSWORD: TEST_ADMIN_PASS,
            BOOTSTRAP_ADMIN_CONFIRM: CONFIRM_TOKEN,
          });
        },
        {
          message: /A SUPER_ADMIN already exists. Bootstrap aborted./,
        }
      );

      // Clean up created record
      await prisma.user.delete({ where: { id: persisted!.id } });
    }
  });

  it('proves public /api/auth/register rejects privilege escalation to SUPER_ADMIN, ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN', async () => {
    const { default: app } = await import('../src/app');
    const privilegedRoles = [
      'SUPER_ADMIN',
      'ADMIN',
      'COLLEGE_ADMIN',
      'DEPARTMENT_ADMIN',
      'DOCTOR',
      'TEACHING_ASSISTANT',
    ];

    // Start ephemeral local test listener on free port
    const server = await new Promise<import('http').Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const addr = server.address() as import('net').AddressInfo;
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    try {
      for (const role of privilegedRoles) {
        const targetEmail = `exploit_${role.toLowerCase()}@university.internal`;

        // Dispatch real HTTP POST request to public registration endpoint
        const response = await fetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: targetEmail,
            password: 'StrongPassword123!',
            firstName: 'Attacker',
            lastName: 'User',
            role,
          }),
        });

        const status = response.status;
        const body = (await response.json()) as any;

        // Public registration must reject non-student role requests with 400 (controller rejection) or 422 (validation rejection)
        assert.ok(
          status === 400 || status === 422,
          `Registration with privileged role ${role} must be rejected (got HTTP ${status})`
        );

        // Assert database invariant: No User record is persisted for the privileged role
        const persistedUser = await prisma.user.findUnique({
          where: { email: targetEmail },
        });
        assert.equal(persistedUser, null, `No user record must be created for requested role ${role}`);
      }
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
