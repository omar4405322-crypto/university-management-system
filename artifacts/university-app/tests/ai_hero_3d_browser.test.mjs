import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

test('AI hero renders 3D, retains its orb on context loss, and freezes reduced motion', { timeout: 60000 }, async () => {
  const app = await serveBuiltApp();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const { page } = await mockSessionPage(browser);
    let release;
    const loading = new Promise(resolve => { release = resolve; });
    await page.route('**/Interactive3DOrb-*.js', async route => { await loading; await route.continue(); });
    await page.goto(`${app.origin}/ai-assistant`);
    const fallback = page.getByTestId('ai-hero-orb-fallback');
    await fallback.waitFor();
    assert.equal(await fallback.evaluate(el => getComputedStyle(el).opacity), '1', 'orb visible while module loads');
    // Existing page entrance scales the whole workspace; measure after it settles.
    await page.waitForFunction(() => document.querySelector('[data-testid="ai-assistant-avatar"]').getBoundingClientRect().width === 192);
    const bounds = await page.getByTestId('ai-assistant-avatar').boundingBox();
    release();
    const model = page.getByTestId('ai-hero-model');
    await model.waitFor({ timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('[data-testid="ai-hero-model"]')?.dataset.ready === 'true');
    assert.deepEqual(await page.getByTestId('ai-assistant-avatar').boundingBox(), bounds, 'loading causes no layout shift');
    const frames = Number(await model.getAttribute('data-frame'));
    await page.waitForTimeout(200);
    assert.ok(Number(await model.getAttribute('data-frame')) > frames, 'idle animation advances');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(100);
    const hiddenFrame = await model.getAttribute('data-frame');
    await page.waitForTimeout(200);
    assert.equal(await model.getAttribute('data-frame'), hiddenFrame, 'hidden tab stops rendering');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('[data-testid="ai-hero-model"]')?.dataset.animationPaused === 'true');
    // Wait through commit + passive effects rather than assuming a fast machine.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const frozen = await model.getAttribute('data-frame');
    await page.waitForTimeout(200);
    assert.equal(await model.getAttribute('data-frame'), frozen, 'reduced motion freezes rendering');
    await model.locator('canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="ai-hero-orb-fallback"]')).opacity === '1');
    assert.ok(await fallback.isVisible(), 'approved orb recovers after context loss');
    assert.deepEqual(await page.getByTestId('ai-assistant-avatar').boundingBox(), bounds, 'fallback causes no layout shift');
  } finally {
    await browser.close();
    await app.close();
  }
});

test('AI hero keeps the approved orb when WebGL or lazy loading fails', { timeout: 60000 }, async () => {
  const app = await serveBuiltApp();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const failure of ['webgl', 'module']) {
      const { page, context } = await mockSessionPage(browser);
      if (failure === 'module') await page.route('**/Interactive3DOrb-*.js', route => route.abort());
      else await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
          return type.startsWith('webgl') ? null : getContext.call(this, type, ...args);
        };
      });
      await page.goto(`${app.origin}/ai-assistant`);
      const fallback = page.getByTestId('ai-hero-orb-fallback');
      await fallback.waitFor();
      if (failure === 'webgl') await page.getByTestId('ai-hero-model').waitFor();
      else await page.waitForTimeout(500);
      assert.equal(await fallback.evaluate(el => getComputedStyle(el).opacity), '1');
      assert.ok(await page.locator('#ai-assistant-message').isVisible(), 'page remains usable');
      await context.close();
    }
  } finally { await browser.close(); await app.close(); }
});
