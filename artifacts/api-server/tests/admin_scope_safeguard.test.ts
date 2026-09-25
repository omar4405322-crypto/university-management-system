import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import express, { Request, Response, NextFunction } from 'express';
import { adminCreateValidation } from '../src/validations/admin.validation';
import validate from '../src/middleware/validate.middleware';
import { createAdmin } from '../src/controllers/user.controller';

const prisma = new PrismaClient();

describe('Unscoped ADMIN Deletion and Safeguard Tests', () => {
  it('1. Verifies no unscoped ADMIN or admin@university.com row exists in the database', async () => {
    const unscopedAdmins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        collegeId: null,
        managedCollegeId: null,
        departmentId: null,
        managedDepartmentId: null,
      },
    });
    assert.equal(unscopedAdmins.length, 0, 'Expected 0 unscoped ADMIN users');

    const adminPlaceholder = await prisma.user.findUnique({
      where: { email: 'admin@university.com' },
    });
    assert.equal(adminPlaceholder, null, 'Expected admin@university.com to not exist');
  });

  it('2. Verifies database CHECK constraint rejects inserting an unscoped ADMIN row', async () => {
    let errorThrown: any = null;
    try {
      // Direct raw query to test PostgreSQL constraint admin_must_have_scope
      await prisma.$executeRaw`
        INSERT INTO "User" ("email", "password", "role")
        VALUES ('raw_unscoped_admin@test.com', 'HashedPassword123!', 'ADMIN');
      `;
    } catch (err: any) {
      errorThrown = err;
    }

    assert.ok(errorThrown, 'Expected DB to reject unscoped ADMIN insert');
    assert.match(
      errorThrown.message,
      /admin_must_have_scope/,
      'Expected DB check constraint admin_must_have_scope failure'
    );
  });

  it('3. Verifies validation layer rejects creating an unscoped ADMIN', async () => {
    const app = express();
    app.use(express.json());
    app.post(
      '/test-create-admin',
      adminCreateValidation,
      validate,
      (_req: Request, res: Response) => {
        res.status(201).json({ success: true });
      }
    );

    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/test-create-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'new_unscoped@test.com',
          password: 'Password123!',
          firstName: 'Unscoped',
          lastName: 'Admin',
          role: 'ADMIN',
          // no college or department
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 422);
      assert.ok(
        JSON.stringify(body).includes('ADMIN') ||
        JSON.stringify(body).includes('college') ||
        JSON.stringify(body).includes('department'),
        'Expected validation error mentioning ADMIN scope'
      );
    } finally {
      server.close();
    }
  });

  it('4. Verifies controller layer rejects creating an unscoped ADMIN even if validation is bypassed', async () => {
    const app = express();
    app.use(express.json());
    // Attach mock user
    app.use((req: any, _res: any, next: any) => {
      req.user = { id: 1, email: 'super@test.com', role: 'SUPER_ADMIN' };
      next();
    });
    // Call createAdmin directly without express-validator
    app.post('/test-controller-admin', createAdmin);
    // Error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message,
      });
    });

    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/test-controller-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'bypassed_unscoped@test.com',
          password: 'Password123!',
          firstName: 'Bypass',
          lastName: 'Admin',
          role: 'ADMIN',
          // no college or department
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 422);
      assert.match(body.message, /ADMIN-role accounts must have an assigned college or department/);
    } finally {
      server.close();
    }
  });
});
