import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  hasCapability,
  getRolesForCapability,
  ROUTE_CAPABILITY_MAP,
} from '../src/config/capabilities.ts';

test('T2 MAJOR: statistics.view is restricted to the 3 admins', () => {
  const allowed = getRolesForCapability('statistics.view');
  assert.deepEqual(
    allowed.sort(),
    ['COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'].sort(),
    'statistics.view must be strictly granted to SUPER_ADMIN, COLLEGE_ADMIN, and DEPARTMENT_ADMIN'
  );

  assert.equal(hasCapability('STUDENT', 'statistics.view'), false, 'Student must not have statistics.view');
  assert.equal(hasCapability('DOCTOR', 'statistics.view'), false, 'Doctor must not have statistics.view');
  assert.equal(hasCapability('TEACHING_ASSISTANT', 'statistics.view'), false, 'TA must not have statistics.view');
});

test('T2 MAJOR: student personal statistics page has dedicated capability and route', () => {
  assert.equal(hasCapability('STUDENT', 'student_statistics.view'), true, 'Student must have student_statistics.view');
  assert.equal(ROUTE_CAPABILITY_MAP['/statistics'], 'statistics.view');
  assert.equal(ROUTE_CAPABILITY_MAP['/my-statistics'], 'student_statistics.view');
});

test('T2 MAJOR: Sidebar contains consistent routes for admin and student statistics', () => {
  const sidebarSource = readFileSync(
    new URL('../src/components/layout/Sidebar.tsx', import.meta.url),
    'utf8'
  );

  assert.match(
    sidebarSource,
    /path:\s*['"]\/statistics['"][\s\S]*?capability:\s*['"]statistics\.view['"]/,
    'Sidebar must bind /statistics to statistics.view'
  );

  assert.match(
    sidebarSource,
    /path:\s*['"]\/my-statistics['"][\s\S]*?capability:\s*['"]student_statistics\.view['"]/,
    'Sidebar must bind /my-statistics to student_statistics.view'
  );
});
