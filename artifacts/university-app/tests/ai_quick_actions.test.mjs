import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('SMART PERSONALIZED QUICK ACTIONS — Frontend Contract & Adaptive Layout Suite', async (t) => {
  const pagePath = path.resolve(__dirname, '../src/pages/ai/AiAssistantPage.tsx');
  const pageSource = fs.readFileSync(pagePath, 'utf8');

  const servicePath = path.resolve(__dirname, '../src/services/ai.service.ts');
  const serviceSource = fs.readFileSync(servicePath, 'utf8');

  const arPath = path.resolve(__dirname, '../src/i18n/ar.json');
  const enPath = path.resolve(__dirname, '../src/i18n/en.json');
  const arDict = JSON.parse(fs.readFileSync(arPath, 'utf8'));
  const enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));

  // ── 1. Fixed starter cards are no longer authoritative ──
  await t.test('1. Fixed 4 starter cards are replaced by dynamic personalized quick actions from fetchQuickActions()', () => {
    assert.ok(serviceSource.includes('export async function fetchQuickActions'));
    assert.ok(serviceSource.includes("'/ai/quick-actions'"));
    assert.ok(pageSource.includes('fetchQuickActions()'));
    assert.ok(pageSource.includes('setPersonalizedShortcuts(actions.slice(0, 4))'));
    assert.ok(pageSource.includes('cardsToRender'));
  });

  // ── 2. Adaptive Layouts for 1, 2, 3, 4 Cards ──
  await t.test('2. Adaptive layout logic provides clean CSS classes for 1, 2, 3, and 4 cards without empty placeholders', () => {
    assert.ok(pageSource.includes('getAdaptiveGridClass'));
    // 1 card: centered single-card presentation
    assert.ok(pageSource.includes('max-w-md'));
    // 2 cards: 2-column grid
    assert.ok(pageSource.includes('sm:grid-cols-2'));
    // 3 cards: 3-column grid
    assert.ok(pageSource.includes('sm:grid-cols-3'));
    // No artificial dummy cards or placeholder slots
    assert.doesNotMatch(pageSource, /<div[^>]*className="[^"]*placeholder[^"]*"[^>]*>/i);
  });

  // ── 3. Bounded maximum 4 cards ──
  await t.test('3. cardsToRender strictly enforces a ceiling of 4 cards', () => {
    assert.ok(pageSource.includes('personalizedShortcuts.slice(0, 4)'));
  });

  // ── 4. Card click triggers standard submission flow ──
  await t.test('4. Quick action card click reuses existing chooseStarter flow and conversation pipeline', () => {
    assert.ok(pageSource.includes('onClick={() => chooseStarter(card.promptKey, promptToUse)}'));
    assert.ok(pageSource.includes('chooseStarter'));
  });

  // ── 5. Welcome-only behavior ──
  await t.test('5. Quick actions section is rendered only in empty conversation state, not active transcript', () => {
    assert.ok(pageSource.includes('entries.length === 0 && !isSending ?'));
  });

  // ── 6. Fullscreen compatibility ──
  await t.test('6. Fullscreen button and workspace remain intact and accessible with personalized cards', () => {
    assert.ok(pageSource.includes('data-testid="ai-fullscreen-toggle"'));
    assert.ok(pageSource.includes('handleToggleFullscreen'));
  });

  // ── 7. Arabic and English localized shortcuts header ──
  await t.test('7. Translation dictionaries contain localized "shortcuts" header', () => {
    assert.equal(arDict.aiAssistant.shortcuts, 'اختصاراتك');
    assert.equal(enDict.aiAssistant.shortcuts, 'Your shortcuts');
    assert.ok(pageSource.includes("t('aiAssistant.shortcuts'"));
  });

  // ── 8. Resilient failure fallback ──
  await t.test('8. Service or API failure falls back safely to 1 role-appropriate fallback card', () => {
    assert.ok(pageSource.includes('fallbackCard'));
    assert.ok(pageSource.includes('return [fallbackCard];'));
  });

  // ── 9. Zero private prompt leakage ──
  await t.test('9. Quick actions contract does not store or expose raw user prompt text or private prompt arguments', () => {
    // QuickActionItem contract check in service
    assert.ok(serviceSource.includes('key: string;'));
    assert.ok(serviceSource.includes('title: string;'));
    assert.ok(serviceSource.includes('prompt: string;'));
    assert.doesNotMatch(serviceSource, /rawPrompt|userQuery|inputHistory/);
  });
});
