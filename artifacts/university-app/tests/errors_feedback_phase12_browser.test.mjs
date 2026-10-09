/**
 * Phase 12 — Errors & Feedback Browser Regression Suite.
 *
 * Runs against the production bundle with Playwright to verify:
 * 1. Error state renders role="alert" with retry affordance on API 500 failure (no deceptive empty state).
 * 2. 429 Rate limiting surfaces retry-after message.
 * 3. OfflineBanner announces network drop via role="alert" assertive live region and dismisses on reconnect.
 * 4. Genuine empty data renders empty state without triggering error alerts.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

test('Phase 12 Browser: API 500 failure renders accessible ErrorState with retry button', { timeout: 60000 }, async () => {
  const app = await serveBuiltApp();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const { page, context } = await mockSessionPage(browser, { role: 'SUPER_ADMIN', language: 'en' });
    await page.route('**/api/colleges/manage**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Internal Server Error' }),
      });
    });

    await page.goto(`${app.origin}/colleges`, { waitUntil: 'domcontentloaded' });

    const alert = page.locator('[role="alert"]').first();
    await alert.waitFor({ state: 'visible', timeout: 8000 });

    assert.ok(await alert.isVisible(), 'Error alert must be visible on 500 error');
    assert.equal(await alert.getAttribute('role'), 'alert');
    assert.ok(['assertive', 'polite'].includes(await alert.getAttribute('aria-live')));

    const retryBtn = alert.locator('button');
    assert.ok((await retryBtn.count()) >= 1, 'Error state must have retry button');

    // Confirm deceptive empty state is NOT present
    const emptyCount = await page.locator('[data-testid="empty-state"]').count();
    assert.equal(emptyCount, 0, 'Must not render empty state when error occurs');

    await context.close();
  } finally {
    await browser.close();
    await app.close();
  }
});

test('Phase 12 Browser: 429 rate-limiting displays retry hint and alert', { timeout: 60000 }, async () => {
  const app = await serveBuiltApp();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const { page, context } = await mockSessionPage(browser, { role: 'SUPER_ADMIN', language: 'en' });
    await page.route('**/api/colleges/manage**', async (route) => {
      await route.fulfill({
        status: 429,
        headers: { 'retry-after': '30' },
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Too many requests. Please wait 30 seconds.' }),
      });
    });

    await page.goto(`${app.origin}/colleges`, { waitUntil: 'domcontentloaded' });

    const alert = page.locator('[role="alert"]').first();
    await alert.waitFor({ state: 'visible', timeout: 8000 });
    assert.ok(await alert.isVisible());

    const alertText = await alert.innerText();
    assert.match(alertText, /(30|seconds|rate|requests|wait|كثيرة|ثانية)/i, 'Alert text must include rate limit / retry hint');

    await context.close();
  } finally {
    await browser.close();
    await app.close();
  }
});

test('Phase 12 Browser: OfflineBanner activates on network drop and clears on reconnect', { timeout: 60000 }, async () => {
  const app = await serveBuiltApp();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const { page, context } = await mockSessionPage(browser, { role: 'SUPER_ADMIN', language: 'en' });
    await page.goto(`${app.origin}/colleges`, { waitUntil: 'domcontentloaded' });

    // Trigger offline event
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    const offlineBanner = page.locator('aside[role="alert"]');
    await offlineBanner.waitFor({ state: 'visible', timeout: 5000 });

    assert.ok(await offlineBanner.isVisible(), 'Offline banner should be visible when offline');
    assert.equal(await offlineBanner.getAttribute('role'), 'alert');
    assert.equal(await offlineBanner.getAttribute('aria-live'), 'assertive');

    // Trigger online event
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(500);
    assert.equal(await offlineBanner.isVisible(), false, 'Offline banner should dismiss when back online');

    await context.close();
  } finally {
    await browser.close();
    await app.close();
  }
});

test('Phase 12 Browser: Genuine empty data renders empty state without error alert', { timeout: 60000 }, async () => {
  const app = await serveBuiltApp();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const { page, context } = await mockSessionPage(browser, { role: 'SUPER_ADMIN', language: 'en' });
    await page.route('**/api/colleges/manage**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [], pagination: { total: 0, page: 1, totalPages: 1 } }),
      });
    });

    await page.goto(`${app.origin}/colleges`, { waitUntil: 'domcontentloaded' });

    const emptyElem = page.locator('[data-testid="empty-state"], h2, h3, p').filter({
      hasText: /(No |لا توجد|لا يوجد|Zero|Empty|Nothing)/i,
    }).first();
    await emptyElem.waitFor({ state: 'visible', timeout: 8000 });
    assert.ok(await emptyElem.isVisible(), 'Empty state must be visible for empty list');

    const errorAlerts = page.locator('[role="alert"]').filter({ hasText: /error|failed|خطأ/i });
    assert.equal(await errorAlerts.count(), 0, 'No error alert should be rendered for genuine empty data');

    await context.close();
  } finally {
    await browser.close();
    await app.close();
  }
});
