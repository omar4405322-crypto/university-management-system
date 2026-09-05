import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { setStudentAndUserActiveState } from '../src/services/studentStatus.service';

async function runStudentDeactivationSecurityTests() {
  const originalTransaction = prisma.$transaction;
  const studentUpdates: any[] = [];
  const userUpdates: any[] = [];
  const refreshDeletes: any[] = [];

  try {
    (prisma as any).$transaction = async (callback: (tx: any) => unknown) =>
      callback({
        student: {
          update: async (args: any) => {
            studentUpdates.push(args);
            return {
              id: args.where.id,
              userId: 42,
              isActive: args.data.isActive,
            };
          },
        },
        user: {
          update: async (args: any) => {
            userUpdates.push(args);
            return { id: args.where.id };
          },
        },
        refreshToken: {
          deleteMany: async (args: any) => {
            refreshDeletes.push(args);
            return { count: 2 };
          },
        },
      });

    const deactivated = await setStudentAndUserActiveState(7, 42, false);
    assert.equal(deactivated.isActive, false);
    assert.deepEqual(studentUpdates[0].where, { id: 7 });
    assert.deepEqual(studentUpdates[0].data, { isActive: false });
    assert.deepEqual(userUpdates[0], {
      where: { id: 42 },
      data: { isActive: false, tokenVersion: { increment: 1 } },
    });
    assert.deepEqual(refreshDeletes[0], { where: { userId: 42 } });

    const activated = await setStudentAndUserActiveState(7, 42, true);
    assert.equal(activated.isActive, true);
    assert.deepEqual(userUpdates[1], {
      where: { id: 42 },
      data: { isActive: true },
    });
    assert.equal(
      refreshDeletes.length,
      1,
      'Reactivation must not perform an unnecessary second revocation'
    );
  } finally {
    (prisma as any).$transaction = originalTransaction;
  }
}

await runStudentDeactivationSecurityTests();
console.log('Student deactivation security checks passed');
