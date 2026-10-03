import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';

// Reuse tools already present in this workspace. No package or lockfile changes.
const root = path.resolve(import.meta.dirname, '../../..');
const requireTool = createRequire(path.join(root, 'scratch/video-production/package.json'));
const { chromium } = requireTool('playwright-core');
const ffmpeg = requireTool('ffmpeg-static');
const output = path.join(root, 'artifacts/video/ai-orb-motion-study-v2');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'light' });
const page = await context.newPage();
const errors = [];
const apiRequests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()); });
const origin = process.env.MOTION_PREVIEW_ORIGIN || 'http://localhost:5173';
try {
  await page.goto(`${origin}/motion-preview/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.motionStudy?.ready && document.querySelectorAll('.front-particles').length === 5);
  await page.screenshot({ path: path.join(output, 'preview-page.png'), fullPage: true });
  assert.equal(await page.locator('.comparison article').count(), 4);
  assert.equal(await page.locator('.welcome .orb-study').count(), 1);
  const transforms = () => page.locator('[data-card="A"] svg:has(ellipse) circle').evaluateAll(nodes => nodes.map(n => n.style.transform));
  const initial = await transforms();
  const layers = () => page.locator('[data-card="A"] .rotating-orbit, [data-card="A"] .orb-surface, [data-card="A"] .orb-specular').evaluateAll(nodes => nodes.map(n => n.style.transform));
  const initialLayers = await layers();
  await page.waitForTimeout(150);
  assert.notDeepEqual(await transforms(), initial, 'Live particles must move');
  const movingLayers = await layers();
  initialLayers.forEach((layer, i) => assert.notEqual(movingLayers[i], layer, 'Every ring and surface layer must move independently'));
  assert.equal(await page.locator('[data-card="A"] .orb-core > svg').evaluate(icon => getComputedStyle(icon).transform), 'none', 'Cap must not rotate');
  await page.getByRole('button', { name: 'Pause motion' }).click();
  const paused = await transforms();
  const pausedLayers = await layers();
  await page.waitForTimeout(150);
  assert.deepEqual(await transforms(), paused, 'Pause must stop motion');
  assert.deepEqual(await layers(), pausedLayers, 'Pause must stop ring and surface motion');
  await page.getByRole('button', { name: 'Resume motion' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile preview must not overflow');
  await page.screenshot({ path: path.join(output, 'preview-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.motionStudy.frame(1));
  const reduced = await transforms();
  const reducedLayers = await layers();
  await page.evaluate(() => window.motionStudy.frame(12));
  assert.deepEqual(await transforms(), reduced, 'Reduced motion must remain static');
  assert.deepEqual(await layers(), reducedLayers, 'Reduced motion must stop all three layers');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // Classic particles must remain on their actual rotating ellipse, including at later times.
  for (const time of [0, 7.25, 25.5]) {
    await page.evaluate(time => window.motionStudy.frame(time), time);
    const residuals = await page.locator('[data-card="A"] svg:has(ellipse)').evaluate(svg => {
      const rings = Array.from(svg.querySelectorAll('ellipse'));
      return Array.from(svg.querySelectorAll('circle')).map((circle, i) => {
        const center = new DOMPoint(Number(circle.getAttribute('cx')), Number(circle.getAttribute('cy'))).matrixTransform(circle.getCTM());
        const local = center.matrixTransform(rings[i % 2].getCTM().inverse());
        const ring = rings[i % 2];
        return Math.abs(((local.x - 110) / Number(ring.getAttribute('rx'))) ** 2 + ((local.y - 110) / Number(ring.getAttribute('ry'))) ** 2 - 1);
      });
    });
    assert.ok(residuals.every(error => error < .002), 'A particles must follow the rotating SVG ellipses');
  }
  for (const scene of ['A', 'B', 'C', 'D', 'comparison']) {
    await page.evaluate(scene => window.motionStudy.frame(3.25, scene), scene);
    await page.screenshot({ path: path.join(output, `${scene}.png`) });
  }
  assert.deepEqual(errors, [], 'No browser errors');
  assert.deepEqual(apiRequests, [], 'Prototype must not call production APIs');
  await writeFile(path.join(output, 'verification.json'), JSON.stringify({
    passed: true, viewport: '1920x1080', mobile: '390x844', reducedMotion: 'static',
    liveMotion: true, threeIndependentMotionLayers: true, stableCap: true, pathAlignment: true, pause: true, browserErrors: errors, apiRequests,
    artwork: 'Production AiAssistantAvatar reused; two original ellipses and five original beads',
  }, null, 2));
  console.log('Browser verification passed; comparison screenshots saved.');
  if (process.argv.includes('--verify-only')) process.exitCode = 0;
  else {
    const mp4 = path.join(output, 'ai-orb-motion-study.mp4');
    const encoder = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', '30', '-i', 'pipe:0',
      '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
    let encoderErrors = '';
    encoder.stderr.on('data', chunk => { encoderErrors += chunk; });
    const done = once(encoder, 'close');
    const frames = 900;
    for (let i = 0; i < frames; i++) {
      const t = i / 30;
      const scene = t < 2 ? 'title' : t < 7 ? 'A' : t < 12 ? 'B' : t < 17 ? 'C' : t < 24 ? 'D' : 'comparison';
      await page.evaluate(({ t, scene }) => window.motionStudy.frame(t, scene), { t, scene });
      const data = await page.screenshot({ type: 'jpeg', quality: 96 });
      if (!encoder.stdin.write(data)) await once(encoder.stdin, 'drain');
      if (i % 150 === 0) console.log(`Captured ${i}/${frames} frames`);
    }
    encoder.stdin.end();
    const [code] = await done;
    assert.equal(code, 0, encoderErrors);
    console.log(`MP4 complete: ${mp4}`);
    const webm = path.join(output, 'ai-orb-motion-comparison.webm');
    const converter = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-ss', '24', '-i', mp4, '-t', '6', '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '28', webm]);
    converter.stderr.on('data', chunk => process.stderr.write(chunk));
    assert.equal((await once(converter, 'close'))[0], 0, 'WebM encoding failed');
    // Decode every frame to verify the final file, including dimensions/fps/duration metadata.
    const verifier = spawn(ffmpeg, ['-i', mp4, '-f', 'null', '-']);
    let metadata = '';
    verifier.stderr.on('data', chunk => { metadata += chunk; });
    assert.equal((await once(verifier, 'close'))[0], 0, 'MP4 decode failed');
    assert.match(metadata, /1920x1080/);
    assert.match(metadata, /30 fps/);
    assert.match(metadata, /Duration: 00:00:30\.00/);
    await writeFile(path.join(output, 'video-verification.txt'), metadata);
    console.log(`WebM complete: ${webm}; MP4 verified: 1920x1080, 30fps, 30 seconds.`);
  }
} finally { await context.close(); await browser.close(); }
