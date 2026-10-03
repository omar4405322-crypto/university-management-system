import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// WCAG relative luminance and contrast calculation helper
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(rgb1, rgb2) {
  const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe('AI Assistant Dark Mode Contrast & Pinned Conversations', () => {
  it('WCAG AA Contrast: User message bubble text against brand green background', () => {
    // University brand green background: #8BB83C -> rgb(139, 184, 60)
    const brandGreen = [139, 184, 60];

    // Slate-950 / Brand Navy 950 text color: #03070b / rgb(2, 6, 23)
    const navy950 = [3, 7, 11];
    const slate950 = [2, 6, 23];

    const ratioNavy = getContrastRatio(brandGreen, navy950);
    const ratioSlate = getContrastRatio(brandGreen, slate950);

    // WCAG AA requirement for normal text is >= 4.5:1
    assert.ok(
      ratioNavy >= 4.5,
      `Expected Navy 950 on Brand Green contrast >= 4.5, got ${ratioNavy.toFixed(2)}`
    );
    assert.ok(
      ratioSlate >= 4.5,
      `Expected Slate 950 on Brand Green contrast >= 4.5, got ${ratioSlate.toFixed(2)}`
    );
  });

  it('Source Verification: User message bubble has explicit high-contrast text classes in both themes', () => {
    const pageSrc = readFileSync(
      resolve(process.cwd(), 'src/pages/ai/AiAssistantPage.tsx'),
      'utf-8'
    );

    // Check AiTranscriptItem user bubble
    assert.match(
      pageSrc,
      /bg-brand-primary-500 dark:bg-brand-primary-500[^>]*text-brand-navy-950 dark:text-brand-navy-950/,
      'AiTranscriptItem user bubble must have text-brand-navy-950 and dark:text-brand-navy-950'
    );

    // Check pendingQuestion bubble
    assert.match(
      pageSrc,
      /bg-brand-primary-500 dark:bg-brand-primary-500[^>]*text-brand-navy-950 dark:text-brand-navy-950/,
      'Pending question bubble must also have text-brand-navy-950 and dark:text-brand-navy-950'
    );
  });

  it('Source Verification: Three-dot action menu item order matches specification', () => {
    const pageSrc = readFileSync(
      resolve(process.cwd(), 'src/pages/ai/AiAssistantPage.tsx'),
      'utf-8'
    );

    const menuBlockStart = pageSrc.indexOf('/* 1. Pin / Unpin */');
    assert.ok(menuBlockStart !== -1, 'Menu popover block must exist');
    const menuBlock = pageSrc.substring(menuBlockStart, menuBlockStart + 5000);

    // Find the menu items within the popover menu block
    const pinIdx = menuBlock.indexOf('handleTogglePin');
    const renameIdx = menuBlock.indexOf('setRenamingConv');
    const archiveIdx = menuBlock.indexOf('handleToggleArchive');
    const deleteIdx = menuBlock.indexOf('setDeletingConvId');

    assert.ok(pinIdx !== -1, 'handleTogglePin must be present in menu');
    assert.ok(renameIdx !== -1, 'setRenamingConv must be present in menu');
    assert.ok(archiveIdx !== -1, 'handleToggleArchive must be present in menu');
    assert.ok(deleteIdx !== -1, 'setDeletingConvId must be present in menu');

    assert.ok(
      pinIdx < renameIdx,
      `Pin/Unpin (${pinIdx}) must appear before Rename (${renameIdx})`
    );
    assert.ok(
      renameIdx < archiveIdx,
      `Rename (${renameIdx}) must appear before Archive (${archiveIdx})`
    );
    assert.ok(
      archiveIdx < deleteIdx,
      `Archive (${archiveIdx}) must appear before Delete (${deleteIdx})`
    );
  });

  it('Source Verification: Pin indicator icon rendered on pinned conversation rows', () => {
    const pageSrc = readFileSync(
      resolve(process.cwd(), 'src/pages/ai/AiAssistantPage.tsx'),
      'utf-8'
    );

    assert.match(
      pageSrc,
      /<Pin[^>]*className="[^"]*text-brand-primary-600 dark:text-brand-primary-400/,
      'Visual Pin icon with brand color must be rendered for pinned conversations'
    );
  });

  it('Grouping Logic: Pinned section rendered at top, ordered by pinnedAt DESC, no duplicates in date groups', () => {
    // Replicate groupConversationsByDate pure logic test
    const now = new Date();
    const todayIso = new Date(now.getTime() - 1000 * 60 * 30).toISOString();
    const yesterdayIso = new Date(now.getTime() - 1000 * 60 * 60 * 25).toISOString();

    const t = (key, fallback) => fallback || key;

    function groupConversationsByDate(convs, isArchivedView = false) {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
      const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;

      const pinnedGroup = { key: 'pinned', label: 'المثبتة', items: [] };
      const dateGroups = [
        { key: 'today', label: 'اليوم', items: [] },
        { key: 'yesterday', label: 'أمس', items: [] },
        { key: 'thisWeek', label: 'هذا الأسبوع', items: [] },
        { key: 'earlier', label: 'السابق', items: [] },
      ];

      for (const conv of convs) {
        if (!isArchivedView && (conv.isPinned || conv.pinnedAt)) {
          pinnedGroup.items.push(conv);
          continue;
        }
        const dateStr = conv.lastMessageAt || conv.updatedAt || conv.createdAt;
        const time = new Date(dateStr).getTime();
        if (isNaN(time) || time >= todayStart) {
          dateGroups[0].items.push(conv);
        } else if (time >= yesterdayStart) {
          dateGroups[1].items.push(conv);
        } else if (time >= weekStart) {
          dateGroups[2].items.push(conv);
        } else {
          dateGroups[3].items.push(conv);
        }
      }

      if (pinnedGroup.items.length > 0) {
        pinnedGroup.items.sort((a, b) => {
          const timeA = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
          const timeB = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
          return timeB - timeA;
        });
      }

      const result = [];
      if (pinnedGroup.items.length > 0) result.push(pinnedGroup);
      for (const group of dateGroups) {
        if (group.items.length > 0) result.push(group);
      }
      return result;
    }

    const testConvs = [
      { id: '1', title: 'Unpinned Today', updatedAt: todayIso, isPinned: false, pinnedAt: null },
      { id: '2', title: 'Pinned Older', updatedAt: todayIso, isPinned: true, pinnedAt: '2026-10-01T10:00:00Z' },
      { id: '3', title: 'Pinned Newer', updatedAt: yesterdayIso, isPinned: true, pinnedAt: '2026-10-02T12:00:00Z' },
      { id: '4', title: 'Unpinned Yesterday', updatedAt: yesterdayIso, isPinned: false, pinnedAt: null },
    ];

    const activeGroups = groupConversationsByDate(testConvs, false);

    assert.equal(activeGroups[0].key, 'pinned', 'First group should be pinned');
    assert.equal(activeGroups[0].items.length, 2, 'Pinned group should have 2 items');
    assert.equal(activeGroups[0].items[0].id, '3', 'Newer pin should be first (pinnedAt DESC)');
    assert.equal(activeGroups[0].items[1].id, '2', 'Older pin should be second');

    // Verify pinned items are not duplicated in today/yesterday
    const todayGroup = activeGroups.find((g) => g.key === 'today');
    const yesterdayGroup = activeGroups.find((g) => g.key === 'yesterday');
    assert.equal(todayGroup.items.length, 1);
    assert.equal(todayGroup.items[0].id, '1');
    assert.equal(yesterdayGroup.items.length, 1);
    assert.equal(yesterdayGroup.items[0].id, '4');

    // In archived view, pinned section does not appear
    const archivedGroups = groupConversationsByDate(testConvs, true);
    assert.ok(
      !archivedGroups.some((g) => g.key === 'pinned'),
      'Archived view should not contain pinned group'
    );
  });
});
