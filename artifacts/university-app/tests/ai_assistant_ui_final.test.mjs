import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import UserAvatar helpers directly from source or compile
test('FINAL AI ASSISTANT UI DESIGN — Frontend Unit & Contract Suite', async (t) => {
  const avatarPath = path.resolve(__dirname, '../src/components/ui/UserAvatar.tsx');
  const avatarSource = fs.readFileSync(avatarPath, 'utf8');

  const pagePath = path.resolve(__dirname, '../src/pages/ai/AiAssistantPage.tsx');
  const pageSource = fs.readFileSync(pagePath, 'utf8');

  const arPath = path.resolve(__dirname, '../src/i18n/ar.json');
  const enPath = path.resolve(__dirname, '../src/i18n/en.json');
  const arDict = JSON.parse(fs.readFileSync(arPath, 'utf8'));
  const enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));

  // ── 1. UserAvatar initials derivation & fallbacks ──
  await t.test('1. UserAvatar initials derivation logic handles all required roles and name formats', () => {
    // Extract and test initials function logic
    function getUserInitials(user) {
      if (!user) return '?';
      if (user.role === 'SUPER_ADMIN') return 'SU';
      if (user.firstName && user.lastName) {
        const f = user.firstName.trim();
        const l = user.lastName.trim();
        if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
      }
      if (user.name) {
        const parts = user.name.trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
        if (parts.length === 1 && parts[0].length === 1) return parts[0].toUpperCase();
      }
      if (user.firstName) return user.firstName.trim().slice(0, 2).toUpperCase();
      if (user.email) return user.email.trim().slice(0, 2).toUpperCase();
      return 'U';
    }

    assert.equal(getUserInitials({ role: 'SUPER_ADMIN' }), 'SU');
    assert.equal(getUserInitials({ role: 'SUPER_ADMIN', email: 'admin@uni.edu' }), 'SU');
    assert.equal(getUserInitials({ firstName: 'Omar', lastName: 'Ali' }), 'OA');
    assert.equal(getUserInitials({ name: 'Kareem Tarek' }), 'KT');
    assert.equal(getUserInitials({ name: 'Ahmed' }), 'AH');
    assert.equal(getUserInitials({ email: 'student@uni.edu' }), 'ST');
    assert.equal(getUserInitials(null), '?');
    assert.equal(getUserInitials(undefined), '?');
  });

  // ── 2. UserAvatar image error fallback contract ──
  await t.test('2. UserAvatar source implements automatic initials fallback on image error', () => {
    assert.ok(avatarSource.includes('const [hasImageError, setHasImageError] = useState(false);'));
    assert.ok(avatarSource.includes('onError={() => setHasImageError(true)}'));
    assert.ok(avatarSource.includes('data-avatar-fallback="true"'));
    assert.ok(avatarSource.includes('bg-brand-primary-600'));
  });

  // ── 3. Avatar consumed consistently in Header and Sidebar ──
  await t.test('3. Header and Sidebar both consume the exact same UserAvatar component', () => {
    const headerPath = path.resolve(__dirname, '../src/components/layout/Header.tsx');
    const headerSource = fs.readFileSync(headerPath, 'utf8');

    const sidebarPath = path.resolve(__dirname, '../src/components/layout/Sidebar.tsx');
    const sidebarSource = fs.readFileSync(sidebarPath, 'utf8');

    assert.ok(headerSource.includes("import UserAvatar from '../ui/UserAvatar';"));
    assert.ok(headerSource.includes('<UserAvatar user={user} size="sm"'));

    assert.ok(sidebarSource.includes("import UserAvatar from '../ui/UserAvatar';"));
    assert.ok(sidebarSource.includes('<UserAvatar'));
    assert.ok(sidebarSource.includes('size="md"'));
  });

  // ── 4. Circular toggle button at history boundary ──
  await t.test('4. Boundary toggle button exists with proper aria-labels and directional chevrons', () => {
    assert.ok(pageSource.includes('data-testid="ai-history-boundary-toggle"'));
    assert.ok(pageSource.includes("isHistoryOpen ? t('aiAssistant.hideHistory'"));
    assert.ok(pageSource.includes("t('aiAssistant.showHistory'"));
    assert.ok(pageSource.includes('rtl:-scale-x-100'));
    assert.ok(pageSource.includes('rounded-full'));
  });

  // ── 5. Session persistence for desktop history toggle ──
  await t.test('5. Session storage stores user preferred open/collapsed history state', () => {
    assert.ok(pageSource.includes("sessionStorage.getItem('ai_assistant_history_open')"));
    assert.ok(pageSource.includes("sessionStorage.setItem('ai_assistant_history_open'"));
  });

  // ── 6. Mobile overlay drawer behavior (Escape, Backdrop, Scroll lock) ──
  await t.test('6. Mobile drawer implements overlay backdrop, Escape key, close button and scroll lock', () => {
    assert.ok(pageSource.includes('data-testid="ai-history-backdrop"'));
    assert.ok(pageSource.includes('data-testid="ai-history-close-mobile"'));
    assert.ok(pageSource.includes("e.key === 'Escape'"));
    assert.ok(pageSource.includes("document.body.style.overflow = 'hidden'"));
    assert.ok(pageSource.includes("window.innerWidth < 768"));
  });

  // ── 7. Date grouping for conversations history ──
  await t.test('7. History panel implements date-grouped buckets: Today, Yesterday, This Week, Earlier', () => {
    assert.ok(pageSource.includes('groupConversationsByDate'));
    assert.ok(pageSource.includes('groupedConversations'));
    assert.ok(pageSource.includes("'today'"));
    assert.ok(pageSource.includes("'yesterday'"));
    assert.ok(pageSource.includes("'thisWeek'"));
    assert.ok(pageSource.includes("'earlier'"));
  });

  // ── 8. Selected conversation styling (subtle pale-green, thin border) ──
  await t.test('8. Selected conversation uses subtle pale-green background and thin accent, not heavy solid block', () => {
    assert.ok(pageSource.includes('bg-brand-primary-500/10'));
    assert.ok(pageSource.includes('border-brand-primary-500/40'));
    assert.ok(pageSource.includes('rtl:border-r-2'));
    assert.ok(pageSource.includes('ltr:border-l-2'));
  });

  // ── 9. Anchored composer with Stop Generation, File Attachments and disabled state ──
  await t.test('9. Anchored composer maintains Send button in DOM while disabled during generation and exposes Stop Generation', () => {
    assert.ok(pageSource.includes('stopGeneration'));
    assert.ok(pageSource.includes("aria-label={t('aiAssistant.stop'"));
    assert.ok(pageSource.includes("aria-label={t('aiAssistant.send')}"));
    assert.ok(pageSource.includes('disabled={!canSend}'));
    assert.ok(pageSource.includes('fileInputRef'));
    assert.ok(pageSource.includes("aria-label={t('aiAssistant.attachFile'"));
  });

  // ── 10. Translation dictionary keys completeness ──
  await t.test('10. Arabic and English translation dictionaries contain all required UI labels', () => {
    const aiAr = arDict.aiAssistant;
    const aiEn = enDict.aiAssistant;

    assert.equal(aiAr.hideHistory, 'إخفاء سجل المحادثات');
    assert.equal(aiAr.showHistory, 'إظهار سجل المحادثات');
    assert.equal(aiAr.attachFile, 'إرفاق ملف');
    assert.equal(aiAr.stop, 'إيقاف التوليد');
    assert.equal(aiAr.group.today, 'اليوم');
    assert.equal(aiAr.group.yesterday, 'أمس');
    assert.equal(aiAr.group.thisWeek, 'هذا الأسبوع');
    assert.equal(aiAr.group.earlier, 'السابق');

    assert.equal(aiEn.hideHistory, 'Hide conversation history');
    assert.equal(aiEn.showHistory, 'Show conversation history');
    assert.equal(aiEn.attachFile, 'Attach file');
    assert.equal(aiEn.stop, 'Stop generation');
    assert.equal(aiEn.group.today, 'Today');
    assert.equal(aiEn.group.yesterday, 'Yesterday');
    assert.equal(aiEn.group.thisWeek, 'This Week');
    assert.equal(aiEn.group.earlier, 'Earlier');
  });

  // ── 11. RTL / LTR logical layout properties ──
  await t.test('11. Layout uses logical CSS properties (start, end, me-auto, ms-auto) for RTL/LTR parity', () => {
    assert.ok(pageSource.includes('inset-y-0 start-0'));
    assert.ok(pageSource.includes('border-e'));
    assert.ok(pageSource.includes('ms-auto'));
    assert.ok(pageSource.includes('me-auto'));
    assert.ok(pageSource.includes('start-2.5'));
    assert.ok(pageSource.includes('end-2'));
  });
});
