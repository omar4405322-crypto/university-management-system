import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

describe('PHASE 8 — Institutional Typography & Design System Verification (10/10)', () => {
  const indexCss = fs.readFileSync(path.join(appRoot, 'src', 'index.css'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(appRoot, 'index.html'), 'utf8');

  test('1. Font Architecture: All required font family tokens and comprehensive fallbacks exist in @theme', () => {
    assert.ok(indexCss.includes('--font-sans:'), 'Missing --font-sans definition');
    assert.ok(indexCss.includes('--font-sans-ar:'), 'Missing --font-sans-ar definition');
    assert.ok(indexCss.includes('--font-sans-en:'), 'Missing --font-sans-en definition');
    assert.ok(indexCss.includes('--font-heading:'), 'Missing --font-heading definition');
    assert.ok(indexCss.includes('--font-display:'), 'Missing --font-display definition');
    assert.ok(indexCss.includes('--font-mono:'), 'Missing --font-mono definition');
    assert.ok(indexCss.includes('--font-arabic:'), 'Missing --font-arabic definition');

    // Verify fallbacks include system fonts
    assert.ok(indexCss.includes('-apple-system') || indexCss.includes('BlinkMacSystemFont') || indexCss.includes('Segoe UI'), 'Missing system fallback stacks');
    assert.ok(indexCss.includes('IBM Plex Sans'), 'Missing primary Latin font');
    assert.ok(indexCss.includes('IBM Plex Sans Arabic'), 'Missing primary Arabic UI font');
    assert.ok(indexCss.includes('Cairo'), 'Missing primary display/heading font');
    assert.ok(indexCss.includes('IBM Plex Mono'), 'Missing primary monospace font');
  });

  test('2. Font Loading: index.html preloads and imports full weight spectrum with display=swap', () => {
    assert.ok(indexHtml.includes('Cairo:wght@600;700;800;900'), 'Cairo must include weights 600..900 for semibold to black headings');
    assert.ok(indexHtml.includes('IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700'), 'IBM Plex Sans must include weights 400..700 with italics');
    assert.ok(indexHtml.includes('IBM+Plex+Sans+Arabic:wght@400;500;600;700'), 'IBM Plex Sans Arabic must include weights 400..700');
    assert.ok(indexHtml.includes('IBM+Plex+Mono:wght@400;500;600;700'), 'IBM Plex Mono must include weights 400..700');
    assert.ok(indexHtml.includes('display=swap'), 'Google Font link must declare display=swap for high performance');
    assert.ok(indexHtml.includes('rel="preload"'), 'Primary font stylesheet must have preload link');
  });

  test('3. Arabic Typography Protection: RTL letter-spacing is neutralized to prevent broken cursive ligatures', () => {
    assert.ok(indexCss.includes('[dir="rtl"]') || indexCss.includes('html[dir="rtl"]'), 'Missing RTL typography rules');
    assert.ok(indexCss.includes('letter-spacing: normal !important'), 'Arabic text must neutralize Latin tracking overrides');
    assert.ok(indexCss.includes('/* === Arabic Typography & RTL Protective System === */'), 'Arabic typography protective system must be declared');
  });

  test('4. Arabic Line-Height Safety: RTL headings and interactive badges have sufficient vertical breathing room', () => {
    assert.ok(indexCss.includes('[dir="rtl"] h1') || indexCss.includes('[dir="rtl"] .heading-display'), 'Missing RTL heading line-height rules');
    assert.ok(indexCss.includes('[dir="rtl"] button') || indexCss.includes('[dir="rtl"] .badge'), 'Missing RTL button/badge line-height safety rules');
  });

  test('5. Tabular Numerals: Tabular nums utility is declared with OpenType features', () => {
    assert.ok(indexCss.includes('.tabular-nums'), 'Missing .tabular-nums utility class');
    assert.ok(indexCss.includes('font-variant-numeric: tabular-nums') || indexCss.includes('tnum'), 'Tabular nums must specify font-variant-numeric or tnum');
  });

  test('6. UI Primitives: CardTitle and StatCard use healthy line heights and tabular numerals for numbers/currencies', () => {
    const cardContent = fs.readFileSync(path.join(appRoot, 'src', 'components', 'ui', 'card.tsx'), 'utf8');
    assert.ok(cardContent.includes('tabular-nums'), 'StatCard must utilize tabular-nums for numeric metrics');
    assert.ok(cardContent.includes('font-mono tabular-nums'), 'StatCard must include font-mono tabular-nums');
    assert.ok(!cardContent.includes('font-semibold leading-none tracking-tight'), 'CardTitle must not use leading-none');
  });

  test('7. UI Primitives: Badge uses leading-normal to protect Arabic diacritics', () => {
    const badgeContent = fs.readFileSync(path.join(appRoot, 'src', 'components', 'ui', 'badge.tsx'), 'utf8');
    assert.ok(badgeContent.includes('leading-normal'), 'Badge must use leading-normal rather than leading-none');
  });

  test('8. UI Primitives: ChartTooltip value includes tabular-nums', () => {
    const chartTooltipContent = fs.readFileSync(path.join(appRoot, 'src', 'components', 'ui', 'ChartTooltip.tsx'), 'utf8');
    assert.ok(chartTooltipContent.includes('tabular-nums'), 'ChartTooltip value must use tabular-nums');
  });

  test('9. Layout: Header user role label protects Arabic tracking', () => {
    const headerContent = fs.readFileSync(path.join(appRoot, 'src', 'components', 'layout', 'Header.tsx'), 'utf8');
    assert.ok(!headerContent.includes('tracking-tighter transition-colors'), 'Header role label must not use unconditional tracking-tighter on Arabic text');
  });

  test('10. Pages: Login page dynamically resolves font family based on active locale', () => {
    const loginContent = fs.readFileSync(path.join(appRoot, 'src', 'pages', 'Login.tsx'), 'utf8');
    assert.ok(!loginContent.includes('font-arabic select-none flex flex-col'), 'Login root container must use font-sans for dynamic locale font resolution');
  });

  test('11. Visual Equivalence: Translated Arabic text is never forced into font-mono', () => {
    const landingContent = fs.readFileSync(path.join(appRoot, 'src', 'pages', 'LandingPage.tsx'), 'utf8');
    assert.ok(!landingContent.includes('verifiedBadge') || !landingContent.includes('font-mono">\n                    {t(\'landing.attendance.verifiedBadge\')}'), 'LandingPage verified badge must not force translated text into font-mono');

    const absenceModalContent = fs.readFileSync(path.join(appRoot, 'src', 'pages', 'students', 'ManageAbsenceModal.tsx'), 'utf8');
    assert.ok(absenceModalContent.includes('tabular-nums'), 'ManageAbsenceModal threshold must use tabular-nums for numeric percentage while preserving standard font for label');
  });

  test('12. Academic Metrics: StudentTranscriptView applies tabular numerals on GPA and Credit Hours', () => {
    const transcriptContent = fs.readFileSync(path.join(appRoot, 'src', 'pages', 'records', 'components', 'StudentTranscriptView.tsx'), 'utf8');
    assert.ok(transcriptContent.includes('tabular-nums'), 'StudentTranscriptView must format GPA and credits with tabular-nums');
  });
});
