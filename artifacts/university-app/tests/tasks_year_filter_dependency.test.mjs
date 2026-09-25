import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const tasksListSrc = readFileSync(
  new URL('../src/pages/tasks/TasksList.tsx', import.meta.url),
  'utf8'
);

test('BUG-4: TasksList extracts yearParam from searchParams', () => {
  assert.match(
    tasksListSrc,
    /const\s+yearParam\s*=\s*searchParams\.get\(["']year["']\)/,
    'TasksList must read yearParam from URL search params'
  );
});

test('BUG-4: TasksList sends year in getTasks query params', () => {
  assert.match(
    tasksListSrc,
    /if\s*\(\s*yearParam\s*\)\s*params\.year\s*=\s*Number\(yearParam\)/,
    'TasksList must pass numeric year to taskService.getTasks'
  );
});

test('BUG-4: fetchTasks includes yearParam in its useCallback dependency array', () => {
  // Locate fetchTasks definition and its dependency array
  const fetchTasksMatch = tasksListSrc.match(
    /const\s+fetchTasks\s*=\s*useCallback\([\s\S]*?\},\s*\[([\s\S]*?)\]\s*\)/
  );
  assert.ok(fetchTasksMatch, 'fetchTasks must be wrapped in useCallback');
  const dependencies = fetchTasksMatch[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  assert.ok(
    dependencies.includes('yearParam'),
    `fetchTasks dependency array must include yearParam to re-fetch on year filter change. Found: ${dependencies.join(', ')}`
  );
});
