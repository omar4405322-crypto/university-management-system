import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { getNotifications } from '../src/controllers/notification.controller';

async function invokeGetNotifications(req: { user: { id: number; role?: string }; query?: Record<string, any> }) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    let statusCode = 200;
    const res: any = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(body: any) {
        resolve({ status: statusCode, body });
      },
    };
    getNotifications(req as any, res as any, (err?: any) => {
      if (err) reject(err);
      else resolve({ status: statusCode, body: null });
    });
  });
}

describe('Notification Pagination & Unread Count Compatibility', () => {
  it('enforces default cap, honors ?limit=, clamps to 500, falls back on invalid limit, and returns additive unreadCount', async () => {
    const uniqueSuffix = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    let testUserId: number | undefined;

    try {
      // Create isolated test user with unique email
      const testUser = await prisma.user.create({
        data: {
          email: `${uniqueSuffix}@university.test`,
          password: 'hashed-password-fixture',
          role: 'STUDENT',
          isActive: true,
        },
      });
      testUserId = testUser.id;

      // Seed fixtures: 4 unread notifications, 2 read notifications (total 6)
      await prisma.notification.createMany({
        data: [
          { userId: testUserId, title: 'Unread 1', message: `${uniqueSuffix} 1`, isRead: false },
          { userId: testUserId, title: 'Unread 2', message: `${uniqueSuffix} 2`, isRead: false },
          { userId: testUserId, title: 'Unread 3', message: `${uniqueSuffix} 3`, isRead: false },
          { userId: testUserId, title: 'Unread 4', message: `${uniqueSuffix} 4`, isRead: false },
          { userId: testUserId, title: 'Read 1', message: `${uniqueSuffix} 5`, isRead: true },
          { userId: testUserId, title: 'Read 2', message: `${uniqueSuffix} 6`, isRead: true },
        ],
      });

      // 1. Default cap (no limit param)
      const resDefault = await invokeGetNotifications({
        user: { id: testUserId },
        query: {},
      });
      assert.equal(resDefault.status, 200);
      assert.equal(resDefault.body.success, true);
      assert.equal(resDefault.body.data.length, 6, 'Returns all fixtures within default 100 limit');
      assert.equal(resDefault.body.unreadCount, 4, 'Top-level additive unreadCount must equal exactly 4');

      // 2. ?limit= honored
      const resLimit2 = await invokeGetNotifications({
        user: { id: testUserId },
        query: { limit: '2' },
      });
      assert.equal(resLimit2.status, 200);
      assert.equal(resLimit2.body.data.length, 2, 'Must honor limit=2');
      assert.equal(resLimit2.body.unreadCount, 4, 'unreadCount remains total unread count regardless of page limit');

      // 3. Clamp at 500: test with query limit=999
      const resClamped = await invokeGetNotifications({
        user: { id: testUserId },
        query: { limit: '999' },
      });
      assert.equal(resClamped.status, 200);
      assert.equal(resClamped.body.data.length, 6);
      assert.equal(resClamped.body.unreadCount, 4);

      // Verify Prisma findMany receives take clamped at 500 when limit exceeds 500
      let capturedTake: number | undefined;
      const originalFindMany = prisma.notification.findMany;
      try {
        (prisma.notification as any).findMany = async (args: any) => {
          capturedTake = args.take;
          return originalFindMany.call(prisma.notification, args);
        };
        await invokeGetNotifications({
          user: { id: testUserId },
          query: { limit: '999' },
        });
        assert.equal(capturedTake, 500, 'Must clamp take at 500 when limit > 500');

        // 4. Invalid limit falls back to default 100
        await invokeGetNotifications({
          user: { id: testUserId },
          query: { limit: 'invalid_string' },
        });
        assert.equal(capturedTake, 100, 'Must fall back to 100 on non-numeric limit');

        await invokeGetNotifications({
          user: { id: testUserId },
          query: { limit: '-50' },
        });
        assert.equal(capturedTake, 100, 'Must fall back to 100 on negative limit');

        await invokeGetNotifications({
          user: { id: testUserId },
          query: { limit: '0' },
        });
        assert.equal(capturedTake, 100, 'Must fall back to 100 on zero limit');
      } finally {
        prisma.notification.findMany = originalFindMany;
      }
    } finally {
      // Strict cleanup in finally
      if (testUserId) {
        await prisma.notification.deleteMany({ where: { userId: testUserId } });
        await prisma.user.deleteMany({ where: { id: testUserId } });
      }
    }
  });
});
