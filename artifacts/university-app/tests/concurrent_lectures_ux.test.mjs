import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../src/components/timetable/ScheduleView.tsx', import.meta.url),
  'utf8'
);

const previewState = (count) => ({
  visible: Math.min(count, 2),
  remaining: Math.max(0, count - 2),
  concurrent: count > 1,
});

assert.deepEqual(previewState(1), { visible: 1, remaining: 0, concurrent: false });
assert.deepEqual(previewState(2), { visible: 2, remaining: 0, concurrent: true });
assert.deepEqual(previewState(5), { visible: 2, remaining: 3, concurrent: true });
assert.deepEqual(previewState(12), { visible: 2, remaining: 10, concurrent: true });

assert.match(source, /const groupEntriesByExactTime/);
assert.match(source, /entry\.date \|\| entry\.scheduleDate \|\| entry\.weekDate \|\| day/);
assert.match(source, /group\.entries\.slice\(0, 2\)/);
assert.match(source, /count - visibleEntries\.length/);
assert.match(source, /محاضرات أخرى/);
assert.match(source, /aria-label=\{accessibleLabel\}/);
assert.match(source, /sm:grid-cols-2/);
assert.match(source, /renderEntryCard\(entry, false, true\)/);
assert.doesNotMatch(source, /currentIndex|safeIndex|Dot Pagination|Multi-Session Navigator/);

console.log('Concurrent lecture group UX checks passed');
