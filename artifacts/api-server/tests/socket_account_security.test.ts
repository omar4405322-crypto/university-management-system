import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { deactivateUserAndRevokeSessions } from '../src/services/studentStatus.service';
import { requireActiveSocketAccount } from '../src/utils/socket';

async function runSocketAccountSecurityTests() {
  const originalTransaction = prisma.$transaction;
  const originalUserFindUnique = prisma.user.findUnique;
  let capturedSelect: unknown;
  let accountState: any = { isActive: true, tokenVersion: 3 };
  let userUpdate: unknown;
  let refreshDelete: unknown;

  try {
    (prisma.user as any).findUnique = async (args: any) => {
      capturedSelect = args.select;
      return accountState;
    };

    await requireActiveSocketAccount({ id: 8, tokenVersion: 3 });
    assert.deepEqual(capturedSelect, { tokenVersion: true, isActive: true });

    accountState = { isActive: false, tokenVersion: 3 };
    await assert.rejects(
      requireActiveSocketAccount({ id: 8, tokenVersion: 3 }),
      /Account deactivated/
    );

    accountState = { isActive: true, tokenVersion: 4 };
    await assert.rejects(
      requireActiveSocketAccount({ id: 8, tokenVersion: 3 }),
      /Token invalidated/
    );

    (prisma as any).$transaction = async (callback: (tx: any) => unknown) =>
      callback({
        user: {
          update: async (args: any) => {
            userUpdate = args;
          },
        },
        refreshToken: {
          deleteMany: async (args: any) => {
            refreshDelete = args;
          },
        },
      });

    const deactivatedAt = new Date('2026-09-05T10:00:00.000Z');
    await deactivateUserAndRevokeSessions(8, deactivatedAt);
    assert.deepEqual(userUpdate, {
      where: { id: 8 },
      data: {
        isActive: false,
        deactivatedAt,
        tokenVersion: { increment: 1 },
      },
    });
    assert.deepEqual(refreshDelete, { where: { userId: 8 } });
  } finally {
    (prisma as any).$transaction = originalTransaction;
    (prisma.user as any).findUnique = originalUserFindUnique;
  }
}

await runSocketAccountSecurityTests();
console.log('Socket account security checks passed');
