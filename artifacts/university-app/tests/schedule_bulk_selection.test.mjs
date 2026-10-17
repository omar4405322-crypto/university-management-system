import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = fileURLToPath(new URL('..', import.meta.url));

// 1. Module behavior under test
import {
  isSelectionAllowedForRole,
  toggleOne,
  toggleCurrentPage,
  isAllPageSelected,
  isSomePageSelected,
  clearSelection,
  ADMIN_SELECTION_ROLES,
} from '../src/utils/scheduleSelectionRules.ts';

test('scheduleSelectionRules: role gating for selection', () => {
  for (const role of ADMIN_SELECTION_ROLES) {
    assert.equal(isSelectionAllowedForRole(role), true, `Admin role ${role} should be allowed`);
  }

  assert.equal(isSelectionAllowedForRole('STUDENT'), false);
  assert.equal(isSelectionAllowedForRole('DOCTOR'), false);
  assert.equal(isSelectionAllowedForRole('TEACHING_ASSISTANT'), false);
  assert.equal(isSelectionAllowedForRole('UNKNOWN'), false);
  assert.equal(isSelectionAllowedForRole(''), false);
  assert.equal(isSelectionAllowedForRole(null), false);
  assert.equal(isSelectionAllowedForRole(undefined), false);
});

test('scheduleSelectionRules: toggleOne', () => {
  let selected = new Set();
  selected = toggleOne(selected, 101);
  assert.equal(selected.has(101), true);
  assert.equal(selected.size, 1);

  selected = toggleOne(selected, 102);
  assert.equal(selected.has(101), true);
  assert.equal(selected.has(102), true);
  assert.equal(selected.size, 2);

  selected = toggleOne(selected, 101);
  assert.equal(selected.has(101), false);
  assert.equal(selected.has(102), true);
  assert.equal(selected.size, 1);
});

test('scheduleSelectionRules: isAllPageSelected and isSomePageSelected', () => {
  const pageIds = [1, 2, 3, 4, 5];

  // None selected
  let selected = new Set();
  assert.equal(isAllPageSelected(selected, pageIds), false);
  assert.equal(isSomePageSelected(selected, pageIds), false);

  // Partial selected
  selected = new Set([1, 3]);
  assert.equal(isAllPageSelected(selected, pageIds), false);
  assert.equal(isSomePageSelected(selected, pageIds), true);

  // All page selected
  selected = new Set([1, 2, 3, 4, 5]);
  assert.equal(isAllPageSelected(selected, pageIds), true);
  assert.equal(isSomePageSelected(selected, pageIds), false);

  // All page selected + items from other pages
  selected = new Set([1, 2, 3, 4, 5, 99, 100]);
  assert.equal(isAllPageSelected(selected, pageIds), true);
  assert.equal(isSomePageSelected(selected, pageIds), false);

  // Empty page
  assert.equal(isAllPageSelected(selected, []), false);
  assert.equal(isSomePageSelected(selected, []), false);
});

test('scheduleSelectionRules: toggleCurrentPage selects and deselects current page preserving other selections', () => {
  const page1Ids = [1, 2, 3];
  const otherPageItem = 99;

  let selected = new Set([otherPageItem]);

  // Initially only 99 is selected. Toggling page 1 should select all of page 1 + keep 99
  selected = toggleCurrentPage(selected, page1Ids);
  assert.equal(selected.has(1), true);
  assert.equal(selected.has(2), true);
  assert.equal(selected.has(3), true);
  assert.equal(selected.has(99), true);
  assert.equal(selected.size, 4);

  // Now all of page 1 is selected. Toggling page 1 again should deselect page 1 but keep 99
  selected = toggleCurrentPage(selected, page1Ids);
  assert.equal(selected.has(1), false);
  assert.equal(selected.has(2), false);
  assert.equal(selected.has(3), false);
  assert.equal(selected.has(99), true);
  assert.equal(selected.size, 1);
});

test('scheduleSelectionRules: clearSelection resets set', () => {
  const selected = new Set([1, 2, 3]);
  const cleared = clearSelection();
  assert.equal(cleared.size, 0);
  assert.notEqual(cleared, selected);
});

test('SchedulesList and TimetableManagement: no lone select-all in filter toolbar', () => {
  const schedulesListPath = path.resolve(appDir, 'src/pages/schedules/SchedulesList.tsx');
  const timetableMgmtPath = path.resolve(appDir, 'src/pages/schedules/TimetableManagement.tsx');

  const schedulesListSrc = fs.readFileSync(schedulesListPath, 'utf8');
  const timetableMgmtSrc = fs.readFileSync(timetableMgmtPath, 'utf8');

  // Verify that inside the filter toolbar, there is no Select All button
  // Filter toolbar is identified by "3. UNIFIED COMPACT FILTER TOOLBAR" in both pages
  const schedulesToolbar = schedulesListSrc.split('3. UNIFIED COMPACT FILTER TOOLBAR')[1]?.split('{/* 3. Main Content')[0] || '';
  assert.equal(
    schedulesToolbar.includes('handleToggleSelectAll'),
    false,
    'SchedulesList compact filter toolbar must not contain handleToggleSelectAll'
  );

  const timetableToolbar = timetableMgmtSrc.split('3. UNIFIED COMPACT FILTER TOOLBAR')[1]?.split('{/* 3. Main Content')[0] || '';
  assert.equal(
    timetableToolbar.includes('handleToggleSelectAll'),
    false,
    'TimetableManagement compact filter toolbar must not contain handleToggleSelectAll'
  );
});
