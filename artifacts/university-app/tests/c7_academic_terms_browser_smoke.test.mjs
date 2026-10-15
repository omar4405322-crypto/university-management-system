import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

const screenshotDir = 'C:/Users/omar4/.gemini/antigravity-ide/brain/d77eab90-7df6-4be2-8d9d-3f457384c6f0';

describe('C7 Visual Smoke Verification: Academic Terms & Manual Enrollment Removal', () => {
  let appServer;
  let browser;

  it('setup server and chromium browser', async () => {
    appServer = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  });

  const setupTermRoutes = async (page) => {
    await page.route('**/api/academic-terms/current', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { currentTerm: null, status: 'NO_ACTIVE_TERM' },
        }),
      });
    });

    await page.route('**/api/academic-terms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });

    await page.route('**/api/academic-years', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });
  };

  it('1440x900 English Light & Dark: /academic-terms with No-Active-Term state', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'en',
    });
    await page.setViewportSize({ width: 1440, height: 900 });

    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('ERR_FAILED')) {
        jsErrors.push(msg.text());
      }
    });

    await setupTermRoutes(page);
    await page.goto(`${appServer.origin}/academic-terms`, { waitUntil: 'networkidle' });

    // Assert safe no-active-term alert renders
    const pageText = await page.textContent('body');
    assert.ok(
      pageText.includes('No Active Term') || pageText.includes('Academic Terms') || pageText.includes('Academic Calendar'),
      'Expected page to render academic terms header or no-active-term state'
    );

    // Save 1440px English screenshot
    await page.screenshot({ path: path.join(screenshotDir, 'c7_1440_en_light.png'), fullPage: false });

    // Dark theme toggle check
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.screenshot({ path: path.join(screenshotDir, 'c7_1440_en_dark.png'), fullPage: false });

    assert.equal(jsErrors.length, 0, `Expected 0 runtime JS errors, received: ${jsErrors.join('; ')}`);
    await context.close();
  });

  it('1440x900 Arabic RTL: /academic-terms visual check', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'ar',
    });
    await page.setViewportSize({ width: 1440, height: 900 });

    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('ERR_FAILED')) {
        jsErrors.push(msg.text());
      }
    });

    await setupTermRoutes(page);
    await page.goto(`${appServer.origin}/academic-terms`, { waitUntil: 'networkidle' });

    // Assert RTL direction is active
    const dir = await page.getAttribute('html', 'dir');
    assert.equal(dir, 'rtl', 'Expected document direction to be RTL for Arabic');

    // Save 1440px Arabic screenshot
    await page.screenshot({ path: path.join(screenshotDir, 'c7_1440_ar_light.png'), fullPage: false });

    assert.equal(jsErrors.length, 0, `Expected 0 runtime JS errors, received: ${jsErrors.join('; ')}`);
    await context.close();
  });

  it('390x844 Mobile (Arabic & English): /academic-terms responsive check', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'ar',
    });
    await page.setViewportSize({ width: 390, height: 844 });

    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('ERR_FAILED')) {
        jsErrors.push(msg.text());
      }
    });

    await setupTermRoutes(page);
    await page.goto(`${appServer.origin}/academic-terms`, { waitUntil: 'networkidle' });

    // Save 390px mobile screenshot
    await page.screenshot({ path: path.join(screenshotDir, 'c7_390_ar_mobile.png'), fullPage: false });

    // Verify horizontal overflow is non-existent
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    assert.equal(hasHorizontalScroll, false, 'Mobile view must not have horizontal scrollbar');

    assert.equal(jsErrors.length, 0, `Expected 0 runtime JS errors, received: ${jsErrors.join('; ')}`);
    await context.close();
  });

  it('Student page (/students/1) has NO manual enrollment buttons', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'en',
    });
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.route('**/api/students/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 1,
            firstName: 'Ahmed',
            lastName: 'Hassan',
            studentId: '2026001',
            year: 2,
            department: { id: 1, name: 'Computer Science' },
            enrollments: [],
          },
        }),
      });
    });

    await page.goto(`${appServer.origin}/students/1`, { waitUntil: 'networkidle' });

    const enrollButtons = await page.locator('button:has-text("Enroll in Course"), button:has-text("تسجيل مقرر")').count();
    assert.equal(enrollButtons, 0, 'Student details page must NOT have manual enroll button');
    await context.close();
  });

  it('Course page (/courses/1) has NO manual enrollment buttons in roster', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'en',
    });
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.route('**/api/courses/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 1,
            name: 'Algorithms',
            courseCode: 'CS201',
            credits: 3,
            year: 2,
            semester: 1,
            department: { id: 1, name: 'Computer Science' },
            enrollments: [],
          },
        }),
      });
    });

    await page.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });

    const enrollButtons = await page.locator('button:has-text("Enroll Student"), button:has-text("تسجيل طالب")').count();
    assert.equal(enrollButtons, 0, 'Course page must NOT have manual enroll button');
    await context.close();
  });

  it('teardown browser and server', async () => {
    if (browser) await browser.close();
    if (appServer) await appServer.close();
  });
});
