import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

async function waitForMenuVisibility(page, visible) {
  await page.waitForFunction((expected) => {
    const button = document.querySelector('[data-testid="mobile-menu-button"]');
    return Boolean(button && getComputedStyle(button).display !== 'none' && button.getBoundingClientRect().width) === expected;
  }, visible);
}

async function waitForDrawer(page, open) {
  await page.waitForFunction((expected) => {
    const aside = document.querySelector('#app-sidebar');
    const button = document.querySelector('[data-testid="mobile-menu-button"]');
    if (!aside || button?.getAttribute('aria-expanded') !== String(expected)) return false;
    const rect = aside.getBoundingClientRect();
    return expected ? rect.left >= -1 && rect.right <= innerWidth + 1 : rect.right <= 1 || rect.left >= innerWidth - 1;
  }, open);
}

describe('UniCore Responsive Design 10/10 Regression Suite', () => {
  let browser;
  let app;
  let context;
  let page;

  before(async () => {
    app = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  });
  beforeEach(async () => {
    ({ context, page } = await mockSessionPage(browser));
    await page.goto(`${app.origin}/dashboard`);
    await page.locator('#app-sidebar').waitFor({ state: 'attached' });
    await page.locator('#main-content h1').waitFor();
    assert.equal(new URL(page.url()).pathname, '/dashboard', 'Layout checks must run inside the authenticated application');
  });
  afterEach(async () => { await context?.close(); });
  after(async () => { await browser?.close(); await app?.close(); });

  it('RESP-01: Hamburger menu button is visible on tablet portrait (768px) and mobile (<1024px), hidden on desktop (>=1024px)', async () => {
    const hamburger = page.locator('[data-testid="mobile-menu-button"]');
    for (const [width, height, visible] of [[768, 1024, true], [430, 932, true], [1024, 768, false]]) {
      await page.setViewportSize({ width, height });
      await waitForMenuVisibility(page, visible);
      assert.equal(await hamburger.isVisible(), visible, `Hamburger visibility at ${width}px`);
    }
  });

  it('RESP-02: Mobile sidebar drawer automatically closes when route navigation occurs', async () => {
    for (const language of ['en', 'ar']) {
      await page.evaluate((lang) => localStorage.setItem('language', lang), language);
      await page.setViewportSize({ width: 430, height: 932 });
      await page.goto(`${app.origin}/dashboard`);
      await page.locator('#main-content h1').waitFor();
      await page.waitForFunction((lang) => document.documentElement.lang === lang, language);
      await page.locator('[data-testid="mobile-menu-button"]').click();
      await waitForDrawer(page, true);
      const sidebar = page.locator('#app-sidebar');
      assert.equal(await sidebar.evaluate((el) => el.classList.contains('translate-x-0')), true, 'Sidebar drawer must open');
      await sidebar.locator('a[href="/colleges"]').first().click();
      await page.waitForURL('**/colleges');
      await waitForDrawer(page, false);
      assert.equal(await sidebar.evaluate((el) => el.classList.contains('translate-x-0')), false, 'Sidebar drawer must close after navigation');
    }
  });

  it('RESP-03: Login & Register pages are vertically scrollable without cut-off on short viewports (360x640, 390x667)', async () => {
    const anon = await mockSessionPage(browser, { role: null });
    try {
      for (const [width, height] of [[360, 640], [390, 667]]) {
        await anon.page.setViewportSize({ width, height });
        for (const route of ['login', 'register']) {
          await anon.page.goto(`${app.origin}/${route}`);
          const submit = anon.page.locator('button[type="submit"]');
          await submit.waitFor();
          await submit.scrollIntoViewIfNeeded();
          assert.equal(await submit.isVisible(), true, `${route} submit reachable at ${width}x${height}`);
          const box = await submit.boundingBox();
          assert.ok(box && box.y >= 0 && box.y + box.height <= height + 1, 'Submit fits in the visible viewport after scrolling');
        }
      }
    } finally { await anon.context.close(); }
  });

  it('RESP-23: Zero document horizontal overflow across 1920, 1440, 1024, 768, 430, 390, 360, 320 in LTR and RTL', async () => {
    for (const language of ['en', 'ar']) {
      await page.evaluate((lang) => localStorage.setItem('language', lang), language);
      await page.reload();
      await page.locator('#main-content h1').waitFor();
      await page.waitForFunction((lang) => document.documentElement.lang === lang, language);
      assert.equal(await page.locator('html').getAttribute('dir'), language === 'ar' ? 'rtl' : 'ltr');
      for (const width of [1920, 1440, 1024, 768, 430, 390, 360, 320]) {
        await page.setViewportSize({ width, height: 800 });
        const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
        assert.ok(overflow <= 2, `No horizontal overflow at ${width}px (${language}), got ${overflow}px`);
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      const sidebar = page.locator('#app-sidebar');
      const expandedWidth = (await sidebar.boundingBox()).width;
      await sidebar.getByRole('button', { name: language === 'ar' ? 'طي الشريط الجانبي' : 'Collapse sidebar', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#app-sidebar').getBoundingClientRect().width <= 81);
      assert.equal(Math.round((await sidebar.boundingBox()).width), 80);
      assert.ok(expandedWidth > 80, 'Expanded sidebar is wider than collapsed sidebar');
      const expand = sidebar.getByRole('button', { name: language === 'ar' ? 'توسيع الشريط الجانبي' : 'Expand sidebar', exact: true });
      await expand.click();
      await page.waitForFunction(() => document.querySelector('#app-sidebar').getBoundingClientRect().width >= 287);
    }
  });
});
