import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const sidebarPath = new URL('../src/components/layout/Sidebar.tsx', import.meta.url);
const appPath = new URL('../src/App.tsx', import.meta.url);
const enJsonPath = new URL('../src/i18n/en.json', import.meta.url);
const arJsonPath = new URL('../src/i18n/ar.json', import.meta.url);

test('Academic Calendar nav config, route match, and i18n keys', () => {
  const sidebar = readFileSync(sidebarPath, 'utf8');
  const app = readFileSync(appPath, 'utf8');
  const en = JSON.parse(readFileSync(enJsonPath, 'utf8'));
  const ar = JSON.parse(readFileSync(arJsonPath, 'utf8'));

  // 1. App.tsx route check
  assert.ok(
    app.includes('path="academic-terms"') || app.includes("path='academic-terms'"),
    'App.tsx must define route path "academic-terms"'
  );

  // 2. Sidebar contains the academic-terms navigation item inside nav.academic
  assert.ok(
    sidebar.includes("path: '/academic-terms'") || sidebar.includes('path: "/academic-terms"'),
    'Sidebar.tsx must contain path: "/academic-terms"'
  );
  assert.ok(
    sidebar.includes("title: 'nav.academicCalendar'") || sidebar.includes('title: "nav.academicCalendar"'),
    'Sidebar.tsx must use title key "nav.academicCalendar"'
  );
  assert.ok(
    sidebar.includes("roles: ['SUPER_ADMIN']") || sidebar.includes('roles: ["SUPER_ADMIN"]'),
    'Sidebar.tsx item must restrict visibility to SUPER_ADMIN only'
  );

  // 3. i18n keys exist
  assert.equal(
    en.nav?.academicCalendar,
    'Academic Calendar',
    'en.json nav.academicCalendar must be "Academic Calendar"'
  );
  assert.equal(
    ar.nav?.academicCalendar,
    'التقويم الأكاديمي',
    'ar.json nav.academicCalendar must be "التقويم الأكاديمي"'
  );
});
