import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const tasksListSrc = readFileSync(
  new URL('../src/pages/tasks/TasksList.tsx', import.meta.url),
  'utf8'
);

const tasksCardsSrc = readFileSync(
  new URL('../src/pages/tasks/components/TasksCards.tsx', import.meta.url),
  'utf8'
);

const tasksTableSrc = readFileSync(
  new URL('../src/pages/tasks/components/TasksTable.tsx', import.meta.url),
  'utf8'
);

test('T4 MAJOR: TasksList does NOT treat TEACHING_ASSISTANT as task manager', () => {
  // Ensure TEACHING_ASSISTANT is excluded from canManageTasks / isDoctor manage role
  assert.doesNotMatch(
    tasksListSrc,
    /isDoctor\s*=[^;]*?TEACHING_ASSISTANT/,
    'TasksList must not treat TEACHING_ASSISTANT as doctor/manager'
  );
  assert.match(
    tasksListSrc,
    /canManageTasks\s*=[^;]*?(DOCTOR|SUPER_ADMIN)/,
    'TasksList must define explicit canManageTasks for authorized staff'
  );
  assert.doesNotMatch(
    tasksListSrc,
    /canManageTasks\s*=[^;]*?TEACHING_ASSISTANT/,
    'canManageTasks must exclude TEACHING_ASSISTANT'
  );
});

test('T4 MAJOR: Create Assignment button is guarded against TA', () => {
  // Header create button must be guarded by canManageTasks
  assert.match(
    tasksListSrc,
    /canManageTasks\s*&&\s*\([\s\S]*?setShowCreateModal\(true\)/,
    'Create Assignment button must be guarded by canManageTasks'
  );

  // Empty state action must be guarded against TA
  assert.match(
    tasksListSrc,
    /canManageTasks\s*\?[\s\S]*?setShowCreateModal\(true\)[\s\S]*?: undefined/,
    'Empty state create action must be undefined for non-managers'
  );
});

test('T4 MAJOR: TasksCards and TasksTable hide Edit, Delete, and Grade for TA', () => {
  // TasksCards should conditionally render edit/delete only for managers
  assert.match(
    tasksCardsSrc,
    /canManageTasks\s*(&&|\?)/,
    'TasksCards must conditionally guard edit and delete actions with canManageTasks'
  );

  // TasksTable should conditionally render edit/delete only for managers
  assert.match(
    tasksTableSrc,
    /canManageTasks\s*(&&|\?)/,
    'TasksTable must conditionally guard edit and delete actions with canManageTasks'
  );

  // Grade action must be guarded by canGrade / backend route guards
  assert.match(
    tasksCardsSrc,
    /canGrade\s*(&&|\?)/,
    'TasksCards must conditionally guard grade action with canGrade'
  );
  assert.match(
    tasksTableSrc,
    /canGrade\s*(&&|\?)/,
    'TasksTable must conditionally guard grade action with canGrade'
  );
});
