import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// W3C WCAG 2.1 & 2.2 Relative Luminance Formula
function parseHex(hex) {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

function channelToLinear(c255) {
  const srgb = c255 / 255;
  if (srgb <= 0.04045) {
    return srgb / 12.92;
  }
  return Math.pow((srgb + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex);
  const rLin = channelToLinear(r);
  const gLin = channelToLinear(g);
  const bLin = channelToLinear(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function blendColors(fgHex, bgHex, alpha) {
  const [fgR, fgG, fgB] = parseHex(fgHex);
  const [bgR, bgG, bgB] = parseHex(bgHex);
  const r = Math.round(fgR * alpha + bgR * (1 - alpha));
  const g = Math.round(fgG * alpha + bgG * (1 - alpha));
  const b = Math.round(fgB * alpha + bgB * (1 - alpha));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Parser to extract scoped CSS custom properties without hardcoding
function extractScopeVariables(css, scopeSelectorPattern) {
  const match = css.match(new RegExp(`${scopeSelectorPattern}\\s*\\{([^}]+)\\}`, 's'));
  if (!match) {
    throw new Error(`Scope ${scopeSelectorPattern} not found in stylesheet`);
  }
  const block = match[1];
  const vars = {};
  const varRegex = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let varMatch;
  while ((varMatch = varRegex.exec(block)) !== null) {
    vars[varMatch[1]] = varMatch[2].trim();
  }
  return vars;
}

test('P4-01A: Light mode error-text meets WCAG 1.4.3 (>= 4.5:1) on white, canvas, and blended alert surfaces', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const rootVars = extractScopeVariables(css, ':root');

  const lightErrorText = rootVars['--error-text'];
  const lightBgCard = rootVars['--brand-bg-card'];
  const lightBgPage = rootVars['--brand-bg-page'];
  const lightErrorBase = rootVars['--error'];

  assert.ok(lightErrorText, ':root must define --error-text');
  assert.ok(lightBgCard, ':root must define --brand-bg-card');
  assert.ok(lightBgPage, ':root must define --brand-bg-page');
  assert.ok(lightErrorBase, ':root must define --error');

  // Compute 10% alpha error surface over card and canvas
  const bgError10OnWhite = blendColors(lightErrorBase, '#FFFFFF', 0.1);
  const bgError10OnCard = blendColors(lightErrorBase, lightBgCard, 0.1);
  const bgError10OnCanvas = blendColors(lightErrorBase, lightBgPage, 0.1);

  // Calculate contrast ratios using extracted production tokens
  const ratioOnWhite = contrastRatio(lightErrorText, '#FFFFFF');
  const ratioOnCard = contrastRatio(lightErrorText, lightBgCard);
  const ratioOnCanvas = contrastRatio(lightErrorText, lightBgPage);
  const ratioOnError10White = contrastRatio(lightErrorText, bgError10OnWhite);
  const ratioOnError10Card = contrastRatio(lightErrorText, bgError10OnCard);
  const ratioOnError10Canvas = contrastRatio(lightErrorText, bgError10OnCanvas);

  assert.ok(
    ratioOnWhite >= 4.5,
    `Light error text (${lightErrorText}) on #FFFFFF must be >= 4.5:1, got ${ratioOnWhite.toFixed(2)}:1`
  );
  assert.ok(
    ratioOnCard >= 4.5,
    `Light error text (${lightErrorText}) on card (${lightBgCard}) must be >= 4.5:1, got ${ratioOnCard.toFixed(2)}:1`
  );
  assert.ok(
    ratioOnCanvas >= 4.5,
    `Light error text (${lightErrorText}) on canvas (${lightBgPage}) must be >= 4.5:1, got ${ratioOnCanvas.toFixed(2)}:1`
  );
  assert.ok(
    ratioOnError10White >= 4.5,
    `Light error text (${lightErrorText}) on bg-error/10 over white (${bgError10OnWhite}) must be >= 4.5:1, got ${ratioOnError10White.toFixed(2)}:1`
  );
  assert.ok(
    ratioOnError10Card >= 4.5,
    `Light error text (${lightErrorText}) on bg-error/10 over card (${bgError10OnCard}) must be >= 4.5:1, got ${ratioOnError10Card.toFixed(2)}:1`
  );
  assert.ok(
    ratioOnError10Canvas >= 4.5,
    `Light error text (${lightErrorText}) on bg-error/10 over canvas (${bgError10OnCanvas}) must be >= 4.5:1, got ${ratioOnError10Canvas.toFixed(2)}:1`
  );
});

test('P4-01B: Light inverse white normal text on production error-strong interactive surface satisfies WCAG 1.4.3 (>= 4.5:1)', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  // Verify --color-error-strong is exposed under @theme
  assert.match(
    css,
    /--color-error-strong:\s*var\(--error-strong\);/,
    'index.css must declare --color-error-strong in @theme'
  );

  const rootVars = extractScopeVariables(css, ':root');
  const lightStrong = rootVars['--error-strong'];
  assert.ok(lightStrong, ':root must define --error-strong');

  const white = '#FFFFFF';
  const ratioLight = contrastRatio(white, lightStrong);

  assert.ok(
    ratioLight >= 4.5,
    `White text on light error-strong surface (${lightStrong}) must be >= 4.5:1, got ${ratioLight.toFixed(2)}:1`
  );
});

test('P4-01C: Dark mode error-text meets WCAG 1.4.3 (>= 4.5:1) on dark canvas and dark alert surfaces', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const darkVars = extractScopeVariables(css, '\\.dark');

  const darkErrorText = darkVars['--error-text'];
  const darkBgCard = darkVars['--brand-bg-card'];
  const darkBgPage = darkVars['--brand-bg-page'];
  const darkErrorBase = darkVars['--error'];

  assert.ok(darkErrorText, '.dark must define --error-text');
  assert.ok(darkBgCard, '.dark must define --brand-bg-card');
  assert.ok(darkBgPage, '.dark must define --brand-bg-page');
  assert.ok(darkErrorBase, '.dark must define --error');

  const darkAlertOnPage = blendColors(darkErrorBase, darkBgPage, 0.1);
  const darkAlertOnCard = blendColors(darkErrorBase, darkBgCard, 0.1);

  const ratioOnDarkCanvas = contrastRatio(darkErrorText, darkBgPage);
  const ratioOnDarkCard = contrastRatio(darkErrorText, darkBgCard);
  const ratioOnDarkAlertCanvas = contrastRatio(darkErrorText, darkAlertOnPage);
  const ratioOnDarkAlertCard = contrastRatio(darkErrorText, darkAlertOnCard);

  assert.ok(
    ratioOnDarkCanvas >= 4.5,
    `Dark error text (${darkErrorText}) on dark canvas (${darkBgPage}) must be >= 4.5:1, got ${ratioOnDarkCanvas.toFixed(2)}:1`
  );
  assert.ok(
    ratioOnDarkCard >= 4.5,
    `Dark error text (${darkErrorText}) on dark card (${darkBgCard}) must be >= 4.5:1, got ${ratioOnDarkCard.toFixed(2)}:1`
  );
  assert.ok(
    ratioOnDarkAlertCanvas >= 4.5,
    `Dark error text (${darkErrorText}) on dark alert over canvas (${darkAlertOnPage}) must be >= 4.5:1, got ${ratioOnDarkAlertCanvas.toFixed(2)}:1`
  );
  assert.ok(
    ratioOnDarkAlertCard >= 4.5,
    `Dark error text (${darkErrorText}) on dark alert over card (${darkAlertOnCard}) must be >= 4.5:1, got ${ratioOnDarkAlertCard.toFixed(2)}:1`
  );
});

test('P4-01D: Dark inverse white normal text on production error-strong interactive surface satisfies WCAG 1.4.3 (>= 4.5:1)', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const darkVars = extractScopeVariables(css, '\\.dark');

  const darkStrong = darkVars['--error-strong'];
  assert.ok(darkStrong, '.dark must define --error-strong');

  const white = '#FFFFFF';
  const ratioDark = contrastRatio(white, darkStrong);

  assert.ok(
    ratioDark >= 4.5,
    `White text on dark error-strong surface (${darkStrong}) must be >= 4.5:1, got ${ratioDark.toFixed(2)}:1`
  );
});

test('P4-01E: Affected production components actually reference text-error-text or bg-error-strong', async () => {
  const [
    resetPasswordModal,
    editProfileModal,
    takeQuiz,
    quizSubmissionsModal,
    badge,
    header,
    button,
    courseModal,
    editCourseModal,
  ] = await Promise.all([
    readFile(new URL('../src/components/ui/ResetPasswordModal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/profile/EditProfileModal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/quizzes/TakeQuiz.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/quizzes/QuizSubmissionsModal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ui/badge.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/layout/Header.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ui/button.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/courses/CourseModal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/courses/EditCourseModal.tsx', import.meta.url), 'utf8'),
  ]);

  // Verify consumers reference text-error-text
  assert.match(
    resetPasswordModal,
    /text-error-text/,
    'ResetPasswordModal must reference text-error-text'
  );
  assert.match(
    editProfileModal,
    /text-error-text/,
    'EditProfileModal must reference text-error-text'
  );
  assert.match(
    takeQuiz,
    /text-error-text/,
    'TakeQuiz must reference text-error-text'
  );
  assert.match(
    quizSubmissionsModal,
    /text-error-text/,
    'QuizSubmissionsModal must reference text-error-text'
  );
  assert.match(
    badge,
    /text-error-text/,
    'badge.tsx destructive variant must reference text-error-text'
  );
  assert.match(
    header,
    /text-error-text/,
    'Header logout item must reference text-error-text'
  );

  // Verify consumers reference bg-error-strong
  assert.match(
    header,
    /hover:bg-error-strong/,
    'Header logout item must reference hover:bg-error-strong'
  );
  assert.match(
    button,
    /bg-error-strong/,
    'button.tsx destructive variant must reference bg-error-strong'
  );
  assert.match(
    takeQuiz,
    /bg-error-strong/,
    'TakeQuiz timer must reference bg-error-strong'
  );
  assert.match(
    courseModal,
    /bg-error-strong/,
    'CourseModal error banner must reference bg-error-strong'
  );
  assert.match(
    editCourseModal,
    /bg-error-strong/,
    'EditCourseModal toast must reference bg-error-strong'
  );
});
