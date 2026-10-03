import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';
// Run canonical-browser checks in one worker so Vite's optimizer is not shared
// by competing temporary servers during the full parallel suite.
import './helpers/orb-brand.mjs';
const requireApp = createRequire(new URL('../package.json', import.meta.url));
const sharp = requireApp('sharp');
const { createServer: createViteServer } = await import(pathToFileURL(requireApp.resolve('vite')).href);

// Serve the real canonical entry locally so the suite needs no running dev server.
test('AI hero matches canonical 3D pixels and drag/keyboard behavior at the same scale', { timeout: 60000 }, async () => {
  const app = await serveBuiltApp();
  const preview = await createViteServer({ configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false }, logLevel: 'error' });
  await preview.listen();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const canonical = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await canonical.goto(`${preview.resolvedUrls.local[0]}motion-preview-3d/`);
    await canonical.waitForFunction(() => window.motion3d?.states().length === 5);
    const reference = canonical.locator('.interactive-stage .orb3d');
    await reference.evaluate(el => { el.style.width = '192px'; });
    await reference.scrollIntoViewIfNeeded();
    await canonical.waitForFunction(() => window.motion3d.states().find(state => state.interactive)?.size === 192);
    const { page } = await mockSessionPage(browser);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${app.origin}/ai-assistant`);
    const hero = page.getByTestId('ai-hero-model');
    await page.waitForFunction(() => document.querySelector('[data-testid="ai-hero-model"]')?.dataset.ready === 'true');
    assert.equal(await hero.getAttribute('data-orb-source'), 'interactive-3d-orb');
    assert.equal(await hero.locator('canvas').count(), 1);
    await page.waitForTimeout(350);
    assert.equal(await page.getByTestId('ai-hero-fallback-decorations').evaluate(el => getComputedStyle(el).opacity), '0', 'one set of rings/particles');
    const pixels = async container => {
      const data = await container.locator('canvas').evaluate(canvas => canvas.toDataURL());
      return sharp(Buffer.from(data.split(',')[1], 'base64')).raw().toBuffer();
    };
    const compare = async label => {
      const a = await pixels(reference);
      const b = await pixels(hero);
      assert.equal(a.length, b.length);
      let difference = 0;
      for (let i = 0; i < a.length; i++) difference += Math.abs(a[i] - b[i]);
      assert.ok(difference / a.length < .1, `${label}: identical canonical renderer output (${difference / a.length})`);
    };
    await compare('initial material, lighting, geometry, rings and particles');
    const drag = async (targetPage, button) => {
      const box = await button.boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await targetPage.mouse.move(x, y);
      await targetPage.mouse.down();
      await targetPage.mouse.move(x + 24, y - 17);
      await targetPage.mouse.up();
    };
    const referenceHit = reference.getByRole('button', { name: 'Interactive 3D orb' });
    const heroHit = hero.getByRole('button', { name: 'Interactive 3D orb' });
    await drag(canonical, referenceHit);
    await drag(page, heroHit);
    await compare('same pointer rotation and depth/parallax');
    for (const key of ['ArrowLeft', 'ArrowUp', 'q', 'e', 'Space']) {
      await referenceHit.focus();
      await canonical.keyboard.press(key);
      await heroHit.focus();
      await page.keyboard.press(key);
      await compare(`same ${key} control`);
    }
  } finally { await browser.close(); await preview.close(); await app.close(); }
});
