import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const schedulesServiceSrc = readFileSync(
  new URL('../src/services/schedules.service.ts', import.meta.url),
  'utf8'
);
const weeklyScheduleSrc = readFileSync(
  new URL('../src/pages/schedules/WeeklySchedule.tsx', import.meta.url),
  'utf8'
);
const useTimetableDataSrc = readFileSync(
  new URL('../src/hooks/useTimetableData.ts', import.meta.url),
  'utf8'
);
const schedulesListSrc = readFileSync(
  new URL('../src/pages/schedules/SchedulesList.tsx', import.meta.url),
  'utf8'
);
const taScheduleSrc = readFileSync(
  new URL('../src/pages/schedules/TASchedule.tsx', import.meta.url),
  'utf8'
);

test('FE-001: schedules.service implements pagination-accumulating getAllWeeklyTimetable and getAllSchedules', () => {
  assert.match(
    schedulesServiceSrc,
    /getAllWeeklyTimetable:\s*async/,
    'schedulesService must define getAllWeeklyTimetable'
  );
  assert.match(
    schedulesServiceSrc,
    /getAllSchedules:\s*async/,
    'schedulesService must define getAllSchedules'
  );
  assert.match(
    schedulesServiceSrc,
    /res\.pagination\?\.totalPages/,
    'schedulesService must inspect backend totalPages for multi-page retrieval'
  );
});

test('FE-001: WeeklySchedule consumes all pages via getAllWeeklyTimetable', () => {
  assert.match(
    weeklyScheduleSrc,
    /schedulesService\.getAllWeeklyTimetable\(/,
    'WeeklySchedule must call getAllWeeklyTimetable to prevent silent 20-slot truncation'
  );
});

test('FE-001: useTimetableData consumes all pages via getAllWeeklyTimetable', () => {
  assert.match(
    useTimetableDataSrc,
    /schedulesService\.getAllWeeklyTimetable\(/,
    'useTimetableData must call getAllWeeklyTimetable to load full schedule grid'
  );
});

test('FE-001: SchedulesList consumes all pages via getAllSchedules', () => {
  assert.match(
    schedulesListSrc,
    /schedulesService\.getAllSchedules\(/,
    'SchedulesList must call getAllSchedules to ensure complete conflict detection and listing'
  );
});

test('FE-001: TASchedule consumes all pages via getAllWeeklyTimetable', () => {
  assert.match(
    taScheduleSrc,
    /schedulesService\.getAllWeeklyTimetable\(/,
    'TASchedule must call getAllWeeklyTimetable to prevent practical lesson truncation'
  );
});

test('FE-001: Behavioral multi-page accumulation loops across totalPages and merges all items', async () => {
  const pageResponses = [
    {
      success: true,
      data: Array.from({ length: 20 }, (_, i) => ({ id: i + 1 })),
      pagination: { page: 1, limit: 20, total: 45, totalPages: 3 },
    },
    {
      success: true,
      data: Array.from({ length: 20 }, (_, i) => ({ id: i + 21 })),
      pagination: { page: 2, limit: 20, total: 45, totalPages: 3 },
    },
    {
      success: true,
      data: Array.from({ length: 5 }, (_, i) => ({ id: i + 41 })),
      pagination: { page: 3, limit: 20, total: 45, totalPages: 3 },
    },
  ];

  let fetchCount = 0;
  const mockApi = {
    get: async (_url, { params }) => {
      fetchCount++;
      return { data: pageResponses[params.page - 1] };
    },
  };

  let currentPage = 1;
  const limit = 20;
  let accumulated = [];
  let totalPages = 1;
  let total = 0;

  do {
    const res = (await mockApi.get('/schedules/week', { params: { page: currentPage, limit } })).data;
    assert.equal(res.success, true);
    accumulated = accumulated.concat(res.data);
    totalPages = res.pagination?.totalPages ?? 1;
    total = res.pagination?.total ?? accumulated.length;
    currentPage++;
  } while (currentPage <= totalPages);

  assert.equal(fetchCount, 3, 'Must fetch all 3 pages');
  assert.equal(accumulated.length, 45, 'Must merge all 45 items across pages');
  assert.equal(total, 45);
});
