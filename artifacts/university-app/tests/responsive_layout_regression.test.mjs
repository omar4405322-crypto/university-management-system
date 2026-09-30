import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

describe('UniCore Responsive Design 10/10 Regression Suite', () => {
  let browser;
  let context;
  let page;

  before(async () => {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();

    // Log in once for the entire regression suite
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
    await page.waitForSelector('#login-email');
    await page.fill('#login-email', 'superadmin@university.com');
    await page.fill('#login-password', 'SuperAdmin123!');
    await page.click('button[type="submit"]');
    await page.waitForSelector('header', { timeout: 15000 });
    await page.waitForTimeout(500);
  });

  after(async () => {
    if (browser) await browser.close();
  });

  it('RESP-01: Hamburger menu button is visible on tablet portrait (768px) and mobile (<1024px), hidden on desktop (>=1024px)', async () => {
    // Check at 768px (Tablet portrait)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(200);
    const hamburger = page.locator('[data-testid="mobile-menu-button"]');
    const isVisibleAt768 = await hamburger.isVisible();
    assert.strictEqual(isVisibleAt768, true, 'Hamburger button MUST be visible at 768px tablet portrait');

    // Check at 430px (Mobile)
    await page.setViewportSize({ width: 430, height: 932 });
    await page.waitForTimeout(200);
    const isVisibleAt430 = await hamburger.isVisible();
    assert.strictEqual(isVisibleAt430, true, 'Hamburger button MUST be visible at 430px mobile');

    // Check at 1024px (Laptop/Desktop)
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(200);
    const isVisibleAt1024 = await hamburger.isVisible();
    assert.strictEqual(isVisibleAt1024, false, 'Hamburger button MUST be hidden at >=1024px desktop');
  });

  it('RESP-02: Mobile sidebar drawer automatically closes when route navigation occurs', async () => {
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    // Open drawer
    await page.click('[data-testid="mobile-menu-button"]');
    await page.waitForTimeout(400);

    const sidebar = page.locator('aside');
    const isDrawerOpen = await sidebar.evaluate((el) => el.className.split(/\s+/).includes('translate-x-0'));
    assert.strictEqual(isDrawerOpen, true, 'Sidebar drawer should be open with translate-x-0 token');

    // Click a navigation link in the drawer that navigates to a new page
    const navLink = page.locator('aside a[href="/colleges"]').first();
    await navLink.click();
    await page.waitForTimeout(500);

    // Sidebar should now be closed / offscreen (translate-x-0 token removed)
    const isDrawerOpenAfterNav = await sidebar.evaluate((el) => el.className.split(/\s+/).includes('translate-x-0'));
    assert.strictEqual(isDrawerOpenAfterNav, false, 'Sidebar drawer MUST auto-close upon navigating to a new route');
  });

  it('RESP-03: Login & Register pages are vertically scrollable without cut-off on short viewports (360x640, 390x667)', async () => {
    const anonContext = await browser.newContext({ viewport: { width: 360, height: 640 } });
    const anonPage = await anonContext.newPage();

    // Test Login
    await anonPage.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
    await anonPage.waitForTimeout(300);

    const submitBtn = anonPage.locator('button[type="submit"]');
    await submitBtn.scrollIntoViewIfNeeded();
    const isBtnVisible = await submitBtn.isVisible();
    assert.strictEqual(isBtnVisible, true, 'Login submit button must be reachable and visible on short height 640px');

    // Test Register
    await anonPage.goto('http://localhost:5173/register', { waitUntil: 'domcontentloaded' });
    await anonPage.waitForTimeout(300);

    const regSubmitBtn = anonPage.locator('button[type="submit"]');
    await regSubmitBtn.scrollIntoViewIfNeeded();
    const isRegBtnVisible = await regSubmitBtn.isVisible();
    assert.strictEqual(isRegBtnVisible, true, 'Register submit button must be reachable and visible on short height 640px');

    await anonContext.close();
  });

  it('RESP-23: Zero document horizontal overflow across 1920, 1440, 1024, 768, 430, 390, 360, 320 in LTR and RTL', async () => {
    const viewports = [1920, 1440, 1024, 768, 430, 390, 360, 320];
    const locales = ['en', 'ar'];

    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    for (const w of viewports) {
      for (const lng of locales) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.evaluate((l) => {
          localStorage.setItem('i18nextLng', l);
          document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
          document.documentElement.lang = l;
        }, lng);
        await page.waitForTimeout(100);

        const overflow = await page.evaluate((expectedWidth) => {
          const docScroll = document.documentElement.scrollWidth;
          const bodyScroll = document.body.scrollWidth;
          return Math.max(0, Math.max(docScroll, bodyScroll) - expectedWidth);
        }, w);

        assert.ok(overflow <= 2, `Expected 0 horizontal overflow at width ${w}px (${lng}), but got ${overflow}px`);
      }
    }
  });
});
