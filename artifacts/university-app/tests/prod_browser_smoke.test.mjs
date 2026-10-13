import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

test('Production Browser Smoke: built SPA bundle renders landing/login view cleanly without console crashes', async () => {
  const app = await serveBuiltApp();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];

  try {
    const { context, page } = await mockSessionPage(browser, { role: null });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(app.origin, { waitUntil: 'networkidle' });

    const title = await page.title();
    console.log(`[BROWSER SMOKE] Loaded page with title: "${title}"`);
    assert.ok(title.length > 0, 'Page title must not be empty');

    const rootElement = await page.$('#root');
    assert.ok(rootElement, '#root element must exist in DOM');

    assert.deepEqual(errors, [], 'Must have zero unhandled client-side runtime errors on production boot');
    console.log('✅ Browser smoke check passed: 0 runtime errors, DOM mounted cleanly.');

    await context.close();
  } finally {
    await browser.close();
    await app.close();
  }
});
