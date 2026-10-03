import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const requireTools = createRequire(path.join(root, 'scratch/video-production/package.json'));
const { chromium } = requireTools('playwright-core');
const ffmpeg = requireTools('ffmpeg-static');
const sharp = createRequire(path.join(root, 'artifacts/university-app/package.json'))('sharp');
const output = path.join(root, 'artifacts/video/ai-orb-interactive-3d-study');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'light' });
const page = await context.newPage();
const errors = [];
const apiRequests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()); });
const origin = process.env.MOTION_PREVIEW_ORIGIN || 'http://localhost:5173';
let encoder;
try {
  await page.goto(`${origin}/motion-preview-3d/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.motion3d?.ready && window.motion3d.states().length === 5);
  // Motion checks exclude buffer size: entering film layout legitimately resizes it.
  const states = () => page.evaluate(() => window.motion3d.states().map(({ size, ...motion }) => motion));
  const initial = await states();
  assert.ok(initial.every(state => state.geometry === 'SphereGeometry'));
  await page.waitForTimeout(180);
  assert.notDeepEqual(await states(), initial, 'Live 3D material and ring rotation must advance');
  await page.getByRole('button', { name: 'Pause motion' }).click();
  const paused = await states();
  await page.waitForTimeout(180);
  assert.deepEqual(await states(), paused, 'Pause freezes the scene');
  await page.screenshot({ path: path.join(output, 'preview-page.png'), fullPage: true });
  await page.getByRole('button', { name: 'Resume motion' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile must not overflow');
  await page.screenshot({ path: path.join(output, 'preview-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.motion3d.frame(1));
  const still = await states();
  await page.evaluate(() => window.motion3d.frame(8));
  assert.deepEqual(await states(), still, 'Reduced motion freezes all geometry');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const scene of ['1', '2', '3', 'comparison', 'final', 'interactive']) {
    await page.evaluate(scene => window.motion3d.frame(5.5, scene), scene);
    await page.screenshot({ path: path.join(output, `${scene}.png`) });
  }
  const orb = page.locator('[data-card="3"] .orb3d');
  const face = async () => {
    const box = await orb.boundingBox();
    return page.screenshot({ clip: { x: box.x + box.width * .24, y: box.y + box.height * .24, width: box.width * .52, height: box.height * .52 } });
  };
  await page.evaluate(() => window.motion3d.frame(0, '3'));
  const before = await sharp(await face()).removeAlpha().raw().toBuffer();
  await page.evaluate(() => window.motion3d.frame(9, '3'));
  const after = await sharp(await face()).removeAlpha().raw().toBuffer();
  let change = 0;
  for (let i = 0; i < before.length; i++) change += Math.abs(before[i] - after[i]);
  const meanPixelChange = change / before.length;
  assert.ok(meanPixelChange > 1, 'The central surface itself must visibly change');
  const capTransform = await orb.locator('.cap-layer').evaluate(cap => cap.style.transform);
  assert.ok(!capTransform.includes('rotate'), 'The cap must remain upright');
  assert.deepEqual(errors, [], 'No browser or shader errors');
  assert.deepEqual(apiRequests, [], 'No production API traffic');
  await writeFile(path.join(output, 'verification.json'), JSON.stringify({ passed: true, geometry: 'real sphere mesh', internalDepthSamples: 6,
    liveMotion: true, pause: true, reducedMotion: 'static', mobile: '390x844', meanCentralPixelChange: meanPixelChange,
    stableCap: true, errors, apiRequests }, null, 2));
  console.log(`Browser passed; central surface pixel change: ${meanPixelChange.toFixed(2)}.`);
  if (!process.argv.includes('--verify-only')) {
    // Start capture from a clean live scene, then advance physics at exact frame times.
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.motion3d?.ready && window.motion3d.states().length === 5);
    await page.evaluate(() => {
      const cursor = document.createElement('div');
      cursor.className = 'demo-cursor';
      cursor.innerHTML = '<svg viewBox="0 0 28 32" fill="white" stroke="currentColor" stroke-width="1.7"><path d="M9 17V6a2 2 0 014 0v9-3a2 2 0 014 0v4-2a2 2 0 014 0v4-1a2 2 0 014 0v6c0 6-4 8-10 8-3 0-5-2-7-5l-5-6a2 2 0 013-3l3 3z"/></svg>';
      cursor.hidden = true;
      cursor.style.visibility = 'hidden';
      document.body.append(cursor);
      const note = document.createElement('p');
      note.id = 'demo-note';
      note.style.cssText = 'position:fixed;bottom:40px;left:0;right:0;text-align:center;font-size:20px;color:#43591e;pointer-events:none';
      document.body.append(note);
      document.addEventListener('pointermove', event => { cursor.style.left = `${event.clientX - 10}px`; cursor.style.top = `${event.clientY - 8}px`; });
      document.addEventListener('pointerdown', () => cursor.classList.add('grabbing'));
      document.addEventListener('pointerup', () => cursor.classList.remove('grabbing'));
    });
    let pointerCenter;
    const mp4 = path.join(output, 'ai-orb-interactive-3d-study.mp4');
    encoder = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', '30', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
    let encoderErrors = '';
    encoder.stderr.on('data', chunk => { encoderErrors += chunk; });
    const done = once(encoder, 'close');
    for (let i = 0; i < 900; i++) {
      const t = i / 30;
      const scene = t < 2 ? 'title' : t < 5 ? '1' : t < 8 ? '2' : t < 11 ? '3' : t < 14 ? 'comparison' : 'interactive';
      await page.evaluate(({ t, scene }) => window.motion3d.frame(t, scene), { t, scene });
      if (i === 420) {
        await page.evaluate(() => { const cursor = document.querySelector('.demo-cursor'); cursor.hidden = false; cursor.style.visibility = 'visible'; });
        const box = await page.getByRole('button', { name: 'Interactive 3D orb', exact: true }).boundingBox();
        pointerCenter = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await page.mouse.move(pointerCenter.x + 100, pointerCenter.y + 70);
      }
      if (i >= 420) {
        const note = t < 15 ? 'Grab the sphere' : t < 15.8 ? 'Horizontal drag' : t < 19 ? 'Release · damped inertia · idle resumes'
          : t < 19.8 ? 'Vertical drag' : t < 23 ? 'Depth remains spatial as motion settles' : t < 25 ? 'Cap follows the curved surface'
          : t < 27 ? 'R · smooth reset' : 'Camera-facing identity · idle rotation resumes';
        await page.evaluate(note => { document.getElementById('demo-note').textContent = note; }, note);
      }
      if (i === 449) await page.mouse.move(pointerCenter.x, pointerCenter.y);
      if (i === 450) await page.mouse.down();
      if (i > 450 && i < 474) await page.mouse.move(pointerCenter.x - (i - 450) * 4, pointerCenter.y);
      if (i === 474) await page.mouse.up();
      if (i === 569) await page.mouse.move(pointerCenter.x, pointerCenter.y);
      if (i === 570) await page.mouse.down();
      if (i > 570 && i < 594) await page.mouse.move(pointerCenter.x, pointerCenter.y - (i - 570) * 3.5);
      if (i === 594) await page.mouse.up();
      if (i === 690) {
        await page.getByRole('radio', { name: 'Cap follows sphere' }).check();
        await page.getByRole('button', { name: 'Interactive 3D orb', exact: true }).focus();
        await page.keyboard.press('r');
      }
      if (i === 719) await page.mouse.move(pointerCenter.x, pointerCenter.y);
      if (i === 720) await page.mouse.down();
      if (i > 720 && i < 738) await page.mouse.move(pointerCenter.x + (i - 720) * 6, pointerCenter.y + (i - 720));
      if (i === 738) await page.mouse.up();
      if (i === 750) {
        await page.getByRole('button', { name: 'Interactive 3D orb', exact: true }).focus();
        await page.keyboard.press('r');
        await page.mouse.move(pointerCenter.x + 210, pointerCenter.y + 170);
      }
      if (i === 810) await page.getByRole('radio', { name: 'Cap faces camera' }).check();
      const jpeg = await page.screenshot({ type: 'jpeg', quality: 96 });
      if ([465, 580, 732, 768, 880].includes(i)) await writeFile(path.join(output, `interaction-frame-${i}.jpg`), jpeg);
      if (!encoder.stdin.write(jpeg)) await once(encoder.stdin, 'drain');
      if (i % 150 === 0) console.log(`Captured ${i}/900`);
    }
    encoder.stdin.end();
    assert.equal((await done)[0], 0, encoderErrors);
    encoder = undefined;
    console.log(`MP4: ${mp4}`);
    const webm = path.join(output, 'ai-orb-interaction.webm');
    const convert = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-ss', '14', '-i', mp4, '-t', '16', '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '28', webm]);
    convert.stderr.on('data', chunk => process.stderr.write(chunk));
    assert.equal((await once(convert, 'close'))[0], 0);
    const verify = spawn(ffmpeg, ['-i', mp4, '-f', 'null', '-']);
    let metadata = '';
    verify.stderr.on('data', chunk => { metadata += chunk; });
    assert.equal((await once(verify, 'close'))[0], 0);
    assert.match(metadata, /1920x1080/);
    assert.match(metadata, /30 fps/);
    assert.match(metadata, /Duration: 00:00:30\.00/);
    await writeFile(path.join(output, 'video-verification.txt'), metadata);
    console.log(`WebM: ${webm}. MP4 fully decoded: 1920x1080, 30fps, 30s.`);
  }
} finally {
  if (encoder) encoder.kill();
  await context.close();
  await browser.close();
}
