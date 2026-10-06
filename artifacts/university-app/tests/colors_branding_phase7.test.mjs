import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('Phase 7 — Colors & Branding Verification Suite', () => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const appRoot = path.resolve(currentDir, '..');
  const indexCssPath = path.join(appRoot, 'src/index.css');
  const chartPalettePath = path.join(appRoot, 'src/constants/chartPalette.ts');
  const badgePath = path.join(appRoot, 'src/components/ui/badge.tsx');
  const buttonPath = path.join(appRoot, 'src/components/ui/button.tsx');
  const cardPath = path.join(appRoot, 'src/components/ui/card.tsx');

  test('1. Core Brand Identity & Palette Tokens in index.css', () => {
    assert.ok(fs.existsSync(indexCssPath), 'index.css must exist');
    const css = fs.readFileSync(indexCssPath, 'utf8');

    // Official brand identity colors sampled from university logo
    assert.ok(css.includes('#8BB83C'), 'Must define primary brand green (#8BB83C)');
    assert.ok(css.includes('#132231'), 'Must define brand navy (#132231)');
    assert.ok(css.includes('#D6BA34'), 'Must define brand gold (#D6BA34)');
    assert.ok(css.includes('#2F6B87'), 'Must define brand support blue (#2F6B87)');

    // Light and Dark surface tokens
    assert.ok(css.includes('--brand-bg-page: #F4F6F7'), 'Must define light page background');
    assert.ok(css.includes('--brand-bg-page: #091119'), 'Must define dark page background');
    assert.ok(css.includes('--brand-bg-card: #132231'), 'Must define dark card background');
    assert.ok(css.includes('--brand-bg-elevated: #263744'), 'Must define dark elevated background');
  });

  test('2. Centralized Chart Palette & Theme-Aware Contrast', () => {
    assert.ok(fs.existsSync(chartPalettePath), 'chartPalette.ts must exist');
    const chartCode = fs.readFileSync(chartPalettePath, 'utf8');

    assert.ok(chartCode.includes('CHART_PALETTE_LIGHT'), 'Must define light chart palette');
    assert.ok(chartCode.includes('CHART_PALETTE_DARK'), 'Must define dark chart palette');
    assert.ok(chartCode.includes('getChartTheme'), 'Must export getChartTheme helper');

    // Ensure dark palette avoids low-contrast navy collision (#132231) on dark card
    assert.ok(
      chartCode.includes('#8796A1') || chartCode.includes('#B6C0C7') || chartCode.includes('#5B95AB'),
      'Dark chart palette must use accessible high-contrast series colors'
    );
  });

  test('3. UI Primitive Token Bindings (Button, Badge, Card, StatCard)', () => {
    // Badge variants
    const badgeCode = fs.readFileSync(badgePath, 'utf8');
    assert.ok(badgeCode.includes('success:'), 'Badge must have success variant');
    assert.ok(badgeCode.includes('warning:'), 'Badge must have warning variant');
    assert.ok(badgeCode.includes('danger:'), 'Badge must have danger variant');
    assert.ok(badgeCode.includes('info:'), 'Badge must have info variant');

    // Button variants
    const buttonCode = fs.readFileSync(buttonPath, 'utf8');
    assert.ok(buttonCode.includes('brand-primary-600'), 'Button must bind to brand primary');
    assert.ok(buttonCode.includes('focus-visible:ring-brand-primary-500'), 'Button must have brand focus ring');

    // StatCard color styles
    const cardCode = fs.readFileSync(cardPath, 'utf8');
    assert.ok(cardCode.includes('border-brand-green'), 'StatCard must map green to brand token');
    assert.ok(cardCode.includes('border-brand-yellow'), 'StatCard must map yellow/amber to brand token');
  });

  test('4. No Arbitrary Hardcoded Lime/Slate Gradients in Auth Pages', () => {
    const loginPath = path.join(appRoot, 'src/pages/Login.tsx');
    const loginCode = fs.readFileSync(loginPath, 'utf8');
    assert.ok(!loginCode.includes('#84cc16'), 'Login must not use hardcoded lime #84cc16');
    assert.ok(!loginCode.includes('#65a30d'), 'Login must not use hardcoded lime #65a30d');
    assert.ok(loginCode.includes('#8BB83C') || loginCode.includes('brand-primary'), 'Login must use official brand green');
  });
});
