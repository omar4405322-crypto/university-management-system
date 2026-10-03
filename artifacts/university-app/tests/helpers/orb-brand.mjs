import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
const requireApp = createRequire(new URL('../../package.json', import.meta.url));
const sharp = requireApp('sharp');
const { createServer } = await import(pathToFileURL(requireApp.resolve('vite')).href);

test('shared orb keeps green depth at every angle and its logo follows the surface', { timeout: 60000 }, async t => {
  const server = await createServer({ configFile: fileURLToPath(new URL('../../vite.config.ts', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await page.goto(`${server.resolvedUrls.local[0]}motion-preview-3d/`);
    const orb = page.locator('.interactive-stage .orb3d');
    await page.waitForFunction(() => window.motion3d?.states().length === 5);
    await orb.evaluate(el => { el.style.width = '192px'; });
    await orb.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.motion3d.states().find(state => state.interactive).size === 192);
    const button = orb.getByRole('button', { name: 'Interactive 3D orb' });
    const pixels = async () => {
      // The motion-preview clock freezes the same frame at every sampled orientation.
      await page.evaluate(() => window.motion3d.frame(0, 'interactive'));
      const url = await orb.locator('canvas').evaluate(canvas => canvas.toDataURL());
      return sharp(Buffer.from(url.split(',')[1], 'base64')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    };
    await t.test('sphere stays green without a black hemisphere', async () => {
      await button.focus();
      for (let angle = 0; angle < 8; angle++) {
        const { data, info } = await pixels();
        const navy = new Uint8Array(info.width * info.height);
        // Find the foreground navy stroke/beads, then exclude its antialiased edge.
        for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
          const offset = (y * info.width + x) * 4;
          const [r, g, b, a] = data.subarray(offset, offset + 4);
          if (a > 50 && r < 100 && g < 130 && b > r && g > r + 4) navy[y * info.width + x] = 1;
        }
        let sphere = 0, dark = 0, green = 0;
        for (let y = 4; y < info.height - 4; y++) for (let x = 4; x < info.width - 4; x++) {
          const offset = (y * info.width + x) * 4;
          const [r, g, b, a] = data.subarray(offset, offset + 4);
          if (Math.hypot(x - info.width / 2, y - info.height / 2) > info.width * .25 || a < 250) continue;
          let foreground = false;
          for (let dy = -4; dy <= 4 && !foreground; dy++) for (let dx = -4; dx <= 4; dx++) {
            if (navy[(y + dy) * info.width + x + dx]) { foreground = true; break; }
          }
          if (foreground) continue;
          sphere++;
          if (g < 100) dark++;
          if (g > r * 1.1 && g > b * 1.5) green++;
        }
        assert.ok(sphere > 1000, 'sphere sample contains enough opaque pixels');
        assert.ok(dark / sphere < .01, `angle ${angle}: green shadow floor, no black side (${dark / sphere})`);
        assert.ok(green / sphere > .85, `angle ${angle}: dominant green identity`);
        for (let step = 0; step < 9; step++) await page.keyboard.press('ArrowRight');
      }
    });
    await t.test('orbit retains exact university green and navy', async () => {
      const source = await readFile(new URL('../../src/components/ai/interactive-orb/renderer.js', import.meta.url), 'utf8');
      assert.match(source, /new THREE.LineDashedMaterial\(\{ color: palette.green/);
      assert.match(source, /new THREE.LineBasicMaterial\(\{ color: palette.navy/);
      const palette = await orb.evaluate(el => {
        const style = getComputedStyle(el);
        return [style.getPropertyValue('--color-brand-primary-500').trim(), style.getPropertyValue('--color-brand-navy-500').trim()];
      });
      assert.deepEqual(palette.map(color => color.toLowerCase()), ['#8bb83c', '#132231']);
      const { data, info } = await pixels();
      let navyPixels = 0;
      for (let i = 0; i < data.length; i += info.channels) {
        const [r, g, b, a] = data.subarray(i, i + 4);
        if (a > 50 && r < 45 && g < 65 && b > r + 5 && g > r + 5) navyPixels++;
      }
      assert.ok(navyPixels > 10, 'navy orbit remains visible in the rendered composition');
    });
    await t.test('logo is a projected surface mesh that rotates and is depth occluded', async () => {
      assert.equal(await page.evaluate(() => window.motion3d.states().find(state => state.interactive).capMode), 'surface');
      assert.equal(await orb.locator('.cap-layer').evaluate(el => getComputedStyle(el).visibility), 'hidden', 'no fixed overlay');
      // Freeze a known clock before reset, independent of browser startup time.
      await page.evaluate(() => window.motion3d.frame(0, 'interactive'));
      await button.press('r');
      await page.evaluate(() => window.motion3d.frame(1, 'interactive'));
      const whiteLogo = async () => {
        const { data, info } = await pixels();
        let count = 0, xTotal = 0;
        for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
          const i = (y * info.width + x) * 4;
          const [r, g, b, a] = data.subarray(i, i + 4);
          if (a > 240 && Math.min(r, g, b) > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 15) { count++; xTotal += x; }
        }
        return { count, x: xTotal / count };
      };
      const before = await whiteLogo();
      assert.ok(before.count > 20, 'readable logo drawn inside WebGL canvas');
      for (let step = 0; step < 5; step++) await button.press('ArrowRight');
      const turned = await whiteLogo();
      assert.ok(Math.abs(turned.x - before.x) > 10, 'logo travels with sphere rotation');
      for (let step = 0; step < 30; step++) await button.press('ArrowRight');
      assert.ok((await whiteLogo()).count < before.count * .25, 'sphere hides logo when rotated to the back');
    });
  } finally { await browser.close(); await server.close(); }
});
