import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('AI ASSISTANT REAL BROWSER FULLSCREEN MODE — Contract & Runtime Suite', async (t) => {
  const pagePath = path.resolve(__dirname, '../src/pages/ai/AiAssistantPage.tsx');
  const pageSource = fs.readFileSync(pagePath, 'utf8');

  const cssPath = path.resolve(__dirname, '../src/index.css');
  const cssSource = fs.readFileSync(cssPath, 'utf8');

  const arPath = path.resolve(__dirname, '../src/i18n/ar.json');
  const enPath = path.resolve(__dirname, '../src/i18n/en.json');
  const arDict = JSON.parse(fs.readFileSync(arPath, 'utf8'));
  const enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));

  // ── 1. Localization Contract: i18n keys for fullscreen ──
  await t.test('1. Localization dictionaries define matching Arabic and English fullscreen keys', () => {
    assert.equal(arDict.aiAssistant?.fullscreen, 'ملء الشاشة');
    assert.equal(arDict.aiAssistant?.exitFullscreen, 'الخروج من ملء الشاشة');
    assert.ok(arDict.aiAssistant?.fullscreenError, 'Arabic fullscreen error key must exist');

    assert.equal(enDict.aiAssistant?.fullscreen, 'Fullscreen');
    assert.equal(enDict.aiAssistant?.exitFullscreen, 'Exit fullscreen');
    assert.ok(enDict.aiAssistant?.fullscreenError, 'English fullscreen error key must exist');
  });

  // ── 2. Source Contract: Native Fullscreen API used on Workspace Root ──
  await t.test('2. Source binds requestFullscreen to AI workspace root and tracks fullscreenchange', () => {
    // Must target workspace root element
    assert.ok(pageSource.includes('data-testid="ai-workspace-root"'), 'Must have ai-workspace-root test ID');
    assert.ok(pageSource.includes('data-testid="ai-fullscreen-toggle"'), 'Must have ai-fullscreen-toggle test ID');

    // Must use real browser Fullscreen API
    assert.ok(pageSource.includes('requestFullscreen'), 'Must call requestFullscreen');
    assert.ok(pageSource.includes('exitFullscreen'), 'Must call exitFullscreen');
    assert.ok(pageSource.includes('fullscreenchange'), 'Must listen to fullscreenchange event');
    assert.ok(pageSource.includes('fullscreenerror'), 'Must listen to fullscreenerror event');

    // Must NOT simulate with fixed inset-0 hacks alone
    assert.ok(!pageSource.includes('setIsFullscreen(true); // fake'), 'Must not fake fullscreen state');
  });

  // ── 3. Source Contract: CSS :fullscreen rules present ──
  await t.test('3. index.css contains :fullscreen styles for .ai-workspace-root and theme support', () => {
    assert.ok(cssSource.includes('.ai-workspace-root:fullscreen'), 'Must contain .ai-workspace-root:fullscreen');
    assert.ok(cssSource.includes('background-color'), 'Must specify background-color in :fullscreen');
  });

  // ── 4. Runtime Browser Contract: Welcome State Fullscreen & Draft Preservation ──
  await t.test('4. Browser Runtime: Fullscreen button click triggers requestFullscreen, synchronizes UI, and preserves draft', async () => {
    let app;
    let browser;
    try {
      app = await serveBuiltApp();
      browser = await chromium.launch({ channel: 'msedge', headless: true });
      const { page, context } = await mockSessionPage(browser, { role: 'SUPER_ADMIN', language: 'en' });

      // Mock AI conversation list
      await page.route('**/api/ai/**', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/ai/conversations')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { conversations: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
            }),
          });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
      });

      await page.goto(`${app.origin}/ai-assistant`);
      await page.waitForSelector('[data-testid="ai-workspace-root"]', { timeout: 15000 });

      // Verify fullscreen toggle button is rendered on desktop viewport
      const toggleBtn = page.locator('[data-testid="ai-fullscreen-toggle"]');
      await toggleBtn.waitFor({ state: 'visible', timeout: 5000 });

      // Initial state: not fullscreen
      const initialAria = await toggleBtn.getAttribute('aria-label');
      assert.equal(initialAria, 'Fullscreen');
      const initialPressed = await toggleBtn.getAttribute('aria-pressed');
      assert.equal(initialPressed, 'false');

      const root = page.locator('[data-testid="ai-workspace-root"]');
      assert.equal(await root.getAttribute('data-fullscreen'), 'false');

      // Install Fullscreen API spies and mock in the page
      await page.evaluate(() => {
        window.__fsCalls = { request: 0, exit: 0, target: null };
        const rootEl = document.querySelector('[data-testid="ai-workspace-root"]');
        if (rootEl) {
          rootEl.requestFullscreen = async function () {
            window.__fsCalls.request++;
            window.__fsCalls.target = this;
            Object.defineProperty(document, 'fullscreenElement', {
              configurable: true,
              get: () => rootEl,
            });
            document.dispatchEvent(new Event('fullscreenchange'));
          };
        }
        document.exitFullscreen = async function () {
          window.__fsCalls.exit++;
          Object.defineProperty(document, 'fullscreenElement', {
            configurable: true,
            get: () => null,
          });
          document.dispatchEvent(new Event('fullscreenchange'));
        };
      });

      // Type unsent draft into composer
      const composer = page.locator('#ai-assistant-message');
      await composer.fill('Draft message for testing fullscreen persistence');

      // Click fullscreen toggle button
      await toggleBtn.click();

      // Verify requestFullscreen was called on the AI workspace root
      const fsCalls = await page.evaluate(() => window.__fsCalls);
      assert.equal(fsCalls.request, 1, 'requestFullscreen must be invoked on click');

      // Wait for UI to update to fullscreen
      await page.waitForFunction(() => {
        const btn = document.querySelector('[data-testid="ai-fullscreen-toggle"]');
        return btn?.getAttribute('aria-pressed') === 'true';
      }, { timeout: 5000 });

      // In fullscreen: verify button aria-label updated to Exit fullscreen
      const fsAria = await toggleBtn.getAttribute('aria-label');
      assert.equal(fsAria, 'Exit fullscreen');
      assert.equal(await root.getAttribute('data-fullscreen'), 'true');

      // Draft must survive entering fullscreen
      assert.equal(await composer.inputValue(), 'Draft message for testing fullscreen persistence');

      // Now click exit fullscreen
      await toggleBtn.click();

      // Wait for UI to update back to normal
      await page.waitForFunction(() => {
        const btn = document.querySelector('[data-testid="ai-fullscreen-toggle"]');
        return btn?.getAttribute('aria-pressed') === 'false';
      }, { timeout: 5000 });

      const finalFsCalls = await page.evaluate(() => window.__fsCalls);
      assert.equal(finalFsCalls.exit, 1, 'exitFullscreen must be invoked on exit click');

      // Verify button returned to normal
      assert.equal(await toggleBtn.getAttribute('aria-label'), 'Fullscreen');
      assert.equal(await root.getAttribute('data-fullscreen'), 'false');

      // Draft must survive exiting fullscreen
      assert.equal(await composer.inputValue(), 'Draft message for testing fullscreen persistence');

      // Verify external exit synchronization (e.g. Escape or browser controls)
      await toggleBtn.click();
      await page.waitForFunction(() => document.querySelector('[data-testid="ai-fullscreen-toggle"]')?.getAttribute('aria-pressed') === 'true');

      // Simulate external exit by setting document.fullscreenElement to null and firing fullscreenchange
      await page.evaluate(() => {
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          get: () => null,
        });
        document.dispatchEvent(new Event('fullscreenchange'));
      });

      await page.waitForFunction(() => document.querySelector('[data-testid="ai-fullscreen-toggle"]')?.getAttribute('aria-pressed') === 'false');
      assert.equal(await toggleBtn.getAttribute('aria-label'), 'Fullscreen');
      assert.equal(await root.getAttribute('data-fullscreen'), 'false');

      await context.close();
    } finally {
      if (browser) await browser.close();
      if (app) await app.close();
    }
  });

  // ── 5. Runtime Browser Contract: Active Conversation, History, and Streaming in Fullscreen ──
  await t.test('5. Browser Runtime: Active conversation, history sidebar, and streaming survive fullscreen toggle', async () => {
    let app;
    let browser;
    try {
      app = await serveBuiltApp();
      browser = await chromium.launch({ channel: 'msedge', headless: true });
      const { page, context } = await mockSessionPage(browser, { role: 'SUPER_ADMIN', language: 'en' });

      let releaseStream;
      let streamHoldPromise = new Promise((resolve) => { releaseStream = resolve; });

      // Mock AI conversation list & messages
      await page.route('**/api/ai/**', async (route) => {
        const url = new URL(route.request().url());
        const method = route.request().method();

        if (url.pathname.endsWith('/ai/conversations') && method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                conversations: [
                  { id: 'conv-test-1', title: 'Test University Chat', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isPinned: false },
                ],
                pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
              },
            }),
          });
          return;
        }

        if (url.pathname.endsWith('/ai/conversations') && method === 'POST') {
          await streamHoldPromise;
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                conversation: { id: 'conv-test-1', title: 'Student Info Query', createdAt: new Date().toISOString() },
                reply: 'Here are the student details: Student Ahmed Ali, GPA 3.85.',
              },
            }),
          });
          return;
        }

        if (url.pathname.includes('/ai/conversations/conv-test-1') && method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                conversation: { id: 'conv-test-1', title: 'Student Info Query', createdAt: new Date().toISOString() },
                messages: [
                  { id: 'm1', role: 'user', content: 'What is the student record?', createdAt: new Date().toISOString() },
                  { id: 'm2', role: 'assistant', content: 'Student Record for Omar: Major Computer Science, GPA 3.90.', createdAt: new Date().toISOString() },
                ],
              },
            }),
          });
          return;
        }

        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
      });

      await page.goto(`${app.origin}/ai-assistant`);
      await page.waitForSelector('[data-testid="ai-workspace-root"]', { timeout: 15000 });

      // Install Fullscreen API spies
      await page.evaluate(() => {
        const rootEl = document.querySelector('[data-testid="ai-workspace-root"]');
        if (rootEl) {
          rootEl.requestFullscreen = async function () {
            Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => rootEl });
            document.dispatchEvent(new Event('fullscreenchange'));
          };
        }
        document.exitFullscreen = async function () {
          Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => null });
          document.dispatchEvent(new Event('fullscreenchange'));
        };
      });

      // Type message and click send to trigger in-flight streaming
      const composer = page.locator('#ai-assistant-message');
      await composer.fill('Show me student profile');

      const sendBtn = page.locator('form button[type="submit"]');
      await sendBtn.click();

      // Verify streaming/thinking indicator appears
      const stopBtn = page.locator('button:has-text("Stop generation"), button[aria-label*="Stop"]');
      await stopBtn.waitFor({ state: 'visible', timeout: 5000 });

      // Enter fullscreen while streaming
      const toggleBtn = page.locator('[data-testid="ai-fullscreen-toggle"]');
      await toggleBtn.click();

      // UI updates to fullscreen
      await page.waitForFunction(() => document.querySelector('[data-testid="ai-fullscreen-toggle"]')?.getAttribute('aria-pressed') === 'true');

      // Stop button must STILL be visible in fullscreen (generation uninterrupted)
      assert.ok(await stopBtn.isVisible(), 'Stop button must remain visible during streaming in fullscreen');

      // Release stream
      releaseStream();

      // Wait for reply to appear in transcript
      await page.waitForFunction(() => document.body.innerText.includes('Here are the student details'), { timeout: 10000 });

      // Verify transcript has user message and assistant reply in fullscreen
      const textContent = await page.locator('[data-testid="ai-workspace-root"]').innerText();
      assert.ok(textContent.includes('Show me student profile'), 'User message must be present');
      assert.ok(textContent.includes('Here are the student details'), 'Assistant reply must be present');

      // Exit fullscreen
      await toggleBtn.click();
      await page.waitForFunction(() => document.querySelector('[data-testid="ai-fullscreen-toggle"]')?.getAttribute('aria-pressed') === 'false');

      // Transcript content must still be intact after exiting fullscreen
      const textAfterExit = await page.locator('[data-testid="ai-workspace-root"]').innerText();
      assert.ok(textAfterExit.includes('Show me student profile'));
      assert.ok(textAfterExit.includes('Here are the student details'));

      // Test history sidebar toggle in fullscreen
      await toggleBtn.click();
      await page.waitForFunction(() => document.querySelector('[data-testid="ai-fullscreen-toggle"]')?.getAttribute('aria-pressed') === 'true');

      const historyToggle = page.locator('[data-testid="ai-history-header-toggle"]');
      await historyToggle.click();
      // History drawer is functional
      const historyPanel = page.locator('#ai-history-panel');
      await historyPanel.waitFor({ state: 'visible', timeout: 3000 });

      await context.close();
    } finally {
      if (browser) await browser.close();
      if (app) await app.close();
    }
  });

  // ── 6. Runtime Browser Contract: Arabic Localization ──
  await t.test('6. Browser Runtime: Arabic language displays correct localized fullscreen labels', async () => {
    let app;
    let browser;
    try {
      app = await serveBuiltApp();
      browser = await chromium.launch({ channel: 'msedge', headless: true });
      const { page, context } = await mockSessionPage(browser, { role: 'SUPER_ADMIN', language: 'ar' });

      await page.route('**/api/ai/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { conversations: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } } }),
        });
      });

      await page.goto(`${app.origin}/ai-assistant`);
      await page.waitForSelector('[data-testid="ai-workspace-root"]', { timeout: 15000 });

      const toggleBtn = page.locator('[data-testid="ai-fullscreen-toggle"]');
      await toggleBtn.waitFor({ state: 'visible', timeout: 5000 });

      // Normal mode in Arabic
      assert.equal(await toggleBtn.getAttribute('aria-label'), 'ملء الشاشة');

      // Install spy
      await page.evaluate(() => {
        const rootEl = document.querySelector('[data-testid="ai-workspace-root"]');
        if (rootEl) {
          rootEl.requestFullscreen = async function () {
            Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => rootEl });
            document.dispatchEvent(new Event('fullscreenchange'));
          };
        }
      });

      await toggleBtn.click();
      await page.waitForFunction(() => document.querySelector('[data-testid="ai-fullscreen-toggle"]')?.getAttribute('aria-pressed') === 'true');

      // Fullscreen mode in Arabic
      assert.equal(await toggleBtn.getAttribute('aria-label'), 'الخروج من ملء الشاشة');

      await context.close();
    } finally {
      if (browser) await browser.close();
      if (app) await app.close();
    }
  });

  // ── 7. Runtime Browser Contract: Responsive Screen Size Policy ──
  await t.test('7. Browser Runtime: Fullscreen button is visible on desktop/tablet and hidden on mobile phones', async () => {
    let app;
    let browser;
    try {
      app = await serveBuiltApp();
      browser = await chromium.launch({ channel: 'msedge', headless: true });

      // Desktop: 1920x1080
      const desktop = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const dPage = await desktop.newPage();
      await dPage.addInitScript(() => { localStorage.setItem('language', 'en'); });
      await dPage.route('**/api/**', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/auth/refresh')) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { accessToken: 'mock', user: { id: '1', role: 'SUPER_ADMIN' } } }) });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { conversations: [] } }) });
      });
      await dPage.goto(`${app.origin}/ai-assistant`);
      await dPage.waitForSelector('[data-testid="ai-fullscreen-toggle"]', { timeout: 10000 });
      assert.ok(await dPage.locator('[data-testid="ai-fullscreen-toggle"]').isVisible(), 'Visible on 1920x1080');
      await desktop.close();

      // Mobile phone: 390x844
      const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const mPage = await mobile.newPage();
      await mPage.addInitScript(() => { localStorage.setItem('language', 'en'); });
      await mPage.route('**/api/**', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/auth/refresh')) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { accessToken: 'mock', user: { id: '1', role: 'SUPER_ADMIN' } } }) });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { conversations: [] } }) });
      });
      await mPage.goto(`${app.origin}/ai-assistant`);
      await mPage.waitForSelector('[data-testid="ai-workspace-root"]', { timeout: 10000 });
      assert.ok(!(await mPage.locator('[data-testid="ai-fullscreen-toggle"]').isVisible()), 'Hidden on 390x844 mobile');
      await mobile.close();
    } finally {
      if (browser) await browser.close();
      if (app) await app.close();
    }
  });
});
