import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';
import prisma from '../../../scripts/prisma_client.mjs';

const screenshotDir = 'C:/Users/omar4/.gemini/antigravity-ide/brain/d77eab90-7df6-4be2-8d9d-3f457384c6f0';

describe('T11 Browser Verification: Super Admin Academic Calendar Navigation & Real Data View', () => {
  let appServer;
  let browser;
  let realYears = [];
  let realCurrentTerm = null;

  it('setup server, browser, and fetch real DB records', async () => {
    appServer = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });

    // Read-only real data queries
    realYears = await prisma.academicYear.findMany({
      include: { terms: { orderBy: { semesterNumber: 'asc' } } },
      orderBy: { startDate: 'desc' },
    });
    realCurrentTerm = await prisma.academicTerm.findFirst({
      where: { isCurrent: true },
      include: { academicYear: true },
    });
  });

  const setupRealDataRoutes = async (page) => {
    await page.route('**/api/academic-years', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: realYears }),
      });
    });

    await page.route('**/api/academic-terms/current', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            currentTerm: realCurrentTerm,
            status: realCurrentTerm ? 'ACTIVE' : 'NO_ACTIVE_TERM',
          },
        }),
      });
    });

    await page.route('**/api/academic-terms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: realCurrentTerm ? [realCurrentTerm] : [] }),
      });
    });
  };

  it('1440x900 English: Super Admin sees Academic Calendar nav link, clicking opens /academic-terms with active state (Light & Dark)', async () => {
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

    await setupRealDataRoutes(page);
    await page.goto(`${appServer.origin}/dashboard`, { waitUntil: 'networkidle' });

    // Verify Academic Calendar nav link is visible in sidebar
    const navLink = page.locator('aside a[href="/academic-terms"]');
    await navLink.waitFor({ state: 'visible', timeout: 5000 });
    const linkText = await navLink.innerText();
    assert.ok(linkText.includes('Academic Calendar'), `Expected link text to include 'Academic Calendar', got: ${linkText}`);

    // Click link to navigate
    await navLink.click();
    await page.waitForURL('**/academic-terms', { timeout: 5000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify active styling on nav link
    const activeClass = await navLink.getAttribute('class');
    console.log('DEBUG English activeClass:', activeClass);
    assert.ok(activeClass.includes('bg-brand-primary-500/15'), 'Active nav link must have primary background class');

    // Verify page content shows real data
    await page.locator('text=2026-2027').waitFor({ state: 'visible', timeout: 5000 });
    const pageBody = await page.textContent('body');
    assert.ok(pageBody.includes('2026-2027'), 'Page must display real Academic Year 2026-2027');
    assert.ok(pageBody.includes('Fall 2026'), 'Page must display real Term Fall 2026');

    // Light screenshot
    await page.screenshot({ path: path.join(screenshotDir, 't11_1440_en_light.png'), fullPage: false });

    // Switch to dark mode
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, 't11_1440_en_dark.png'), fullPage: false });

    assert.equal(jsErrors.length, 0, `Expected 0 console errors, got: ${jsErrors.join(', ')}`);
    await context.close();
  });

  it('1440x900 Arabic RTL: Super Admin sees التقويم الأكاديمي link, clicking opens /academic-terms with active state', async () => {
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

    await setupRealDataRoutes(page);
    await page.goto(`${appServer.origin}/dashboard`, { waitUntil: 'networkidle' });

    // Verify Arabic nav link
    const navLink = page.locator('aside a[href="/academic-terms"]');
    await navLink.waitFor({ state: 'visible', timeout: 5000 });
    const linkText = await navLink.innerText();
    assert.ok(linkText.includes('التقويم الأكاديمي'), `Expected Arabic link text, got: ${linkText}`);

    // Click link to navigate
    await navLink.click();
    await page.waitForURL('**/academic-terms', { timeout: 5000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify active styling
    const activeClass = await navLink.getAttribute('class');
    console.log('DEBUG Arabic activeClass:', activeClass);
    assert.ok(activeClass.includes('bg-brand-primary-500/15'), 'Active nav link must have primary background class in RTL');

    // Light screenshot
    await page.screenshot({ path: path.join(screenshotDir, 't11_1440_ar_light.png'), fullPage: false });

    // Dark screenshot
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, 't11_1440_ar_dark.png'), fullPage: false });

    assert.equal(jsErrors.length, 0, `Expected 0 console errors, got: ${jsErrors.join(', ')}`);
    await context.close();
  });

  it('390x844 Mobile (English & Arabic): Mobile drawer reveals Academic Calendar link and navigates cleanly', async () => {
    // English mobile
    const { context: ctxEn, page: pageEn } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'en',
    });
    await pageEn.setViewportSize({ width: 390, height: 844 });

    const jsErrorsEn = [];
    pageEn.on('pageerror', (err) => jsErrorsEn.push(err.message));
    pageEn.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('ERR_FAILED')) {
        jsErrorsEn.push(msg.text());
      }
    });

    await setupRealDataRoutes(pageEn);
    await pageEn.goto(`${appServer.origin}/dashboard`, { waitUntil: 'networkidle' });

    // Open mobile drawer
    const menuBtnEn = pageEn.locator('button[data-testid="mobile-menu-button"]');
    await menuBtnEn.click();
    await pageEn.waitForTimeout(300);

    // Verify Academic Calendar inside mobile drawer
    const drawerLinkEn = pageEn.locator('aside a[href="/academic-terms"]');
    await drawerLinkEn.waitFor({ state: 'visible', timeout: 5000 });

    // Screenshot of open mobile drawer
    await pageEn.screenshot({ path: path.join(screenshotDir, 't11_390_mobile_drawer_en.png'), fullPage: false });

    // Click to navigate
    await drawerLinkEn.click();
    await pageEn.waitForURL('**/academic-terms', { timeout: 5000 });
    await pageEn.screenshot({ path: path.join(screenshotDir, 't11_390_mobile_en.png'), fullPage: false });

    assert.equal(jsErrorsEn.length, 0, `Expected 0 console errors, got: ${jsErrorsEn.join(', ')}`);
    await ctxEn.close();

    // Arabic mobile
    const { context: ctxAr, page: pageAr } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'ar',
    });
    await pageAr.setViewportSize({ width: 390, height: 844 });

    const jsErrorsAr = [];
    pageAr.on('pageerror', (err) => jsErrorsAr.push(err.message));
    pageAr.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('ERR_FAILED')) {
        jsErrorsAr.push(msg.text());
      }
    });

    await setupRealDataRoutes(pageAr);
    await pageAr.goto(`${appServer.origin}/dashboard`, { waitUntil: 'networkidle' });

    // Open mobile drawer
    const menuBtnAr = pageAr.locator('button[data-testid="mobile-menu-button"]');
    await menuBtnAr.click();
    await pageAr.waitForTimeout(300);

    const drawerLinkAr = pageAr.locator('aside a[href="/academic-terms"]');
    await drawerLinkAr.waitFor({ state: 'visible', timeout: 5000 });
    await pageAr.screenshot({ path: path.join(screenshotDir, 't11_390_mobile_drawer_ar.png'), fullPage: false });

    // Click to navigate
    await drawerLinkAr.click();
    await pageAr.waitForURL('**/academic-terms', { timeout: 5000 });
    await pageAr.screenshot({ path: path.join(screenshotDir, 't11_390_mobile_ar.png'), fullPage: false });

    assert.equal(jsErrorsAr.length, 0, `Expected 0 console errors, got: ${jsErrorsAr.join(', ')}`);
    await ctxAr.close();
  });

  it('teardown browser and server', async () => {
    if (browser) await browser.close();
    if (appServer) await appServer.close();
  });
});
