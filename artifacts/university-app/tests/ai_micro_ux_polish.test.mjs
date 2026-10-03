import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('FINAL MICRO UX POLISH — Frontend Contract & Component Suite', async (t) => {
  const pagePath = path.resolve(__dirname, '../src/pages/ai/AiAssistantPage.tsx');
  const pageSource = fs.readFileSync(pagePath, 'utf8');

  const messageContentPath = path.resolve(__dirname, '../src/components/ai/AiMessageContent.tsx');
  const messageContentSource = fs.readFileSync(messageContentPath, 'utf8');

  const appPath = path.resolve(__dirname, '../src/App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf8');

  const arPath = path.resolve(__dirname, '../src/i18n/ar.json');
  const enPath = path.resolve(__dirname, '../src/i18n/en.json');
  const arDict = JSON.parse(fs.readFileSync(arPath, 'utf8'));
  const enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));

  // ── 1. Removed Redundant Header Controls ──
  await t.test('1. "مقيد بالصلاحيات" (scopeBadge) and "مسح المحادثة" (clear) are removed from header controls', () => {
    const headerMatch = pageSource.match(/<header[\s\S]*?<\/header>/);
    const headerContent = headerMatch ? headerMatch[0] : '';
    assert.ok(!headerContent.includes("t('aiAssistant.scopeBadge')"), 'Header must not render scopeBadge ("مقيد بالصلاحيات")');
    assert.ok(!headerContent.includes("t('aiAssistant.clear')"), 'Header must not render clear button ("مسح المحادثة")');
  });

  // ── 2. Primary Discoverable History / Conversations Control in Header ──
  await t.test('2. Primary discoverable History control appears in header controls with "المحادثات" label and History icon', () => {
    assert.ok(pageSource.includes('data-testid="ai-history-header-toggle"'), 'Header must contain data-testid="ai-history-header-toggle"');
    assert.ok(pageSource.includes("<History size={14}"), 'Header history control must use History icon');
    assert.ok(pageSource.includes("t('aiAssistant.history')"), 'Header history control must use canonical history translation key');
    assert.equal(arDict.aiAssistant.history, 'المحادثات', 'Canonical Arabic translation for history must be "المحادثات"');
    assert.equal(enDict.aiAssistant.history, 'Conversations', 'Canonical English translation for history must be "Conversations"');
    assert.ok(pageSource.includes('onClick={toggleHistory}'), 'Header history button must call toggleHistory');
  });

  // ── 3. Composer Rounded Pill / Capsule Aesthetic ──
  await t.test('3. Composer has noticeably rounded-full pill/capsule outer shell and rounded-full actions', () => {
    assert.ok(pageSource.includes('rounded-full border border-slate-200/90'), 'Composer shell must have rounded-full capsule styling');
    assert.ok(pageSource.includes('className="seamless-input flex-1 min-h-[38px] max-h-[140px] resize-none bg-transparent'), 'Inner textarea must have no nested border');
    assert.ok(pageSource.includes('focus-within:border-brand-primary-500 focus-within:ring-2'), 'Composer must preserve focus-within highlight');
    assert.ok(pageSource.includes('rounded-full bg-brand-primary-500 hover:bg-brand-primary-600'), 'Send button must be rounded-full');
  });

  // ── 4. User Message Bubble Uses Canonical Brand Primary 500 ──
  await t.test('4. User message bubble uses canonical brand-primary-500 with high-contrast text', () => {
    // Transcript user bubble
    assert.ok(
      pageSource.includes('bg-brand-primary-500 dark:bg-brand-primary-500') &&
      (pageSource.includes('text-brand-navy-950') || pageSource.includes('text-slate-950')),
      'User message bubble must use bg-brand-primary-500 with text-brand-navy-950 font-semibold for WCAG AAA contrast'
    );
    assert.ok(
      pageSource.includes('border-brand-primary-600/30'),
      'User message bubble must have brand-primary-600 border'
    );
    // Pending question bubble
    assert.ok(
      pageSource.includes('border-brand-primary-600/30 bg-brand-primary-500 dark:bg-brand-primary-500'),
      'Pending question bubble must also use canonical brand green'
    );
  });

  // ── 5. Canonical Student Route Verification ──
  await t.test('5. Canonical student profile route is /students/:id guarded by students.view capability', () => {
    assert.ok(appSource.includes('path="students/:id"'), 'Application routing must have canonical students/:id route');
    assert.ok(appSource.includes('capability="students.view"'), 'Canonical student route must be protected by students.view capability');
  });

  // ── 6. StudentResultCard Navigation Logic & Safety Guard ──
  await t.test('6. StudentResultCard navigates to canonical route ONLY when safe integer ID is present and user is authorized', () => {
    assert.ok(messageContentSource.includes("hasCapability(user?.role, 'students.view')"), 'Must verify students.view capability');
    assert.ok(messageContentSource.includes('navigate(`/students/${student.id}`)'), 'Must navigate to existing canonical /students/:id route');
    assert.ok(messageContentSource.includes('data-navigable={isNavigable ? \'true\' : \'false\'}'), 'Must expose data-navigable attribute');
    assert.ok(messageContentSource.includes("role={isNavigable ? 'button' : undefined}"), 'Must set role="button" only when navigable');
    assert.ok(messageContentSource.includes("tabIndex={isNavigable ? 0 : undefined}"), 'Must set tabIndex=0 only when navigable');
  });

  // ── 7. StudentResultCard Keyboard Accessibility (Enter & Space) ──
  await t.test('7. StudentResultCard supports Enter and Space keyboard activation', () => {
    assert.ok(messageContentSource.includes("e.key === 'Enter' || e.key === ' '"), 'Must handle Enter and Space keys for activation');
    assert.ok(messageContentSource.includes('e.preventDefault()'), 'Must prevent default scrolling on Space key');
  });

  // ── 8. RTL / LTR Directional Indicator ──
  await t.test('8. Navigation indicator supports both RTL and LTR orientations', () => {
    assert.ok(messageContentSource.includes('data-testid="student-card-nav-indicator"'), 'Must render student-card-nav-indicator when navigable');
    assert.ok(messageContentSource.includes('rtl:rotate-0 ltr:rotate-180'), 'Chevron indicator must mirror between RTL (Arabic) and LTR (English)');
  });
});
