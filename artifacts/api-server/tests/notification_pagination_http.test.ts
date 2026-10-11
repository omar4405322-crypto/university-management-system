import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { generateAccessToken } from '../src/utils/jwt.utils';
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { MAX_PAGE_SIZE } from '../src/utils/requestLimits';

test('HTTP Notification Pagination: Real HTTP pagination cap (100), limit clamp, and unreadCount', async () => {
  const runSuffix = `notif_http_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let testUserId: number | undefined;

  try {
    // 1. Create isolated test user with unique email
    const user = await prisma.user.create({
      data: {
        email: `${runSuffix}@university.test`,
        password: 'hashed-password-fixture',
        role: 'STUDENT',
        isActive: true,
      },
    });
    testUserId = user.id;

    const token = generateAccessToken(user.id, user.tokenVersion || 0);

    // 2. Seed exactly 105 notifications (75 unread, 30 read)
    // Proves default cap of 100 and unreadCount calculation exceeding a single page
    const TOTAL_NOTIFICATIONS = 105;
    const UNREAD_COUNT = 75;
    const notificationFixtures = Array.from({ length: TOTAL_NOTIFICATIONS }, (_, idx) => ({
      userId: user.id,
      title: `Notice ${idx + 1}`,
      message: `${runSuffix} notification item ${idx + 1}`,
      isRead: idx >= UNREAD_COUNT, // first 75 unread (false), remaining 30 read (true)
    }));

    // Ensure sequence is past any pre-existing hardcoded test IDs (e.g. 8840 from atomicity test)
    await prisma.$executeRawUnsafe('SELECT setval(\'"Notification_id_seq"\', (SELECT COALESCE(max(id), 0) FROM "Notification"))');

    await prisma.notification.createMany({
      data: notificationFixtures,
    });

    // 3. Test default cap (no limit query param): returns default MAX_PAGE_SIZE (100) items
    const resDefault = await fetch(`${baseUrl}/notifications`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(resDefault.status, 200, `Default GET notifications must return 200, got ${resDefault.status}`);
    const jsonDefault = await resDefault.json();
    assert.equal(jsonDefault.success, true);
    assert.equal(
      jsonDefault.data.length,
      MAX_PAGE_SIZE,
      `Default page must return exactly ${MAX_PAGE_SIZE} notifications out of ${TOTAL_NOTIFICATIONS} fixtures`,
    );
    assert.equal(
      jsonDefault.unreadCount,
      UNREAD_COUNT,
      `Top-level additive unreadCount must equal total unread (${UNREAD_COUNT}), not page length (${MAX_PAGE_SIZE})`,
    );

    // 4. Test explicit valid page size: ?limit=50
    const resLimit50 = await fetch(`${baseUrl}/notifications?limit=50`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(resLimit50.status, 200, `GET with limit=50 must return 200, got ${resLimit50.status}`);
    const jsonLimit50 = await resLimit50.json();
    assert.equal(jsonLimit50.success, true);
    assert.equal(jsonLimit50.data.length, 50, 'Must return exactly 50 items when limit=50');
    assert.equal(
      jsonLimit50.unreadCount,
      UNREAD_COUNT,
      `unreadCount must remain total unread count (${UNREAD_COUNT}) regardless of page size`,
    );

    // 5. Test clamp with ?limit=999: requestLimits.middleware clamps to MAX_PAGE_SIZE (100)
    const resClamped = await fetch(`${baseUrl}/notifications?limit=999`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(resClamped.status, 200, `GET with limit=999 must return 200, got ${resClamped.status}`);
    const jsonClamped = await resClamped.json();
    assert.equal(jsonClamped.success, true);
    assert.equal(
      jsonClamped.data.length,
      MAX_PAGE_SIZE,
      `Must clamp take to exactly MAX_PAGE_SIZE (${MAX_PAGE_SIZE}) when limit > ${MAX_PAGE_SIZE}`,
    );
    assert.equal(
      jsonClamped.unreadCount,
      UNREAD_COUNT,
      `unreadCount must remain total unread count (${UNREAD_COUNT})`,
    );

    // 6. Test boundary validation on invalid non-numeric limit ?limit=invalid_string -> HTTP 422
    const resInvalid = await fetch(`${baseUrl}/notifications?limit=invalid_string`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(
      resInvalid.status,
      422,
      `GET with non-integer limit must return 422 ValidationError, got ${resInvalid.status}`,
    );
    const jsonInvalid = await resInvalid.json();
    assert.equal(jsonInvalid.success, false);
    assert.ok(
      jsonInvalid.message.includes('limit must be a positive integer'),
      `Expected pagination bounds message, got: ${jsonInvalid.message}`,
    );
  } finally {
    // Teardown HTTP server
    await new Promise<void>((resolve) => server.close(() => resolve()));

    // Strict cleanup of isolated test data
    if (testUserId) {
      await prisma.notification.deleteMany({ where: { userId: testUserId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => {});
    }
  }
});
