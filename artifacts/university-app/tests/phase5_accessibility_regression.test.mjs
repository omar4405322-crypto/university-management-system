import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appSrc = path.resolve(__dirname, '../src');

test('PHASE 5 ACCESSIBILITY REGRESSION SUITE (WCAG 2.2 AA)', async (t) => {
  await t.test('A11Y-01: Skip to main content link and target landmark', () => {
    const appShellPath = path.join(appSrc, 'components/layout/AppShell.tsx');
    const content = fs.readFileSync(appShellPath, 'utf8');

    assert.match(content, /href="#main-content"/, 'AppShell must render skip to main content link');
    assert.match(content, /id="main-content"/, 'AppShell main landmark must have id="main-content"');
    assert.match(content, /tabIndex=\{-1\}/, 'Main landmark must be focusable via tabIndex={-1}');
    assert.match(content, /focus:not-sr-only/, 'Skip link must become visible on focus');
  });

  await t.test('A11Y-02: Global visible focus indicators and prefers-reduced-motion in CSS', () => {
    const cssPath = path.join(appSrc, 'index.css');
    const content = fs.readFileSync(cssPath, 'utf8');

    assert.match(content, /:focus-visible/, 'index.css must define global :focus-visible style');
    assert.match(content, /outline-offset:/, 'focus-visible must define outline-offset');
    assert.match(content, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'prefers-reduced-motion override must exist');
  });

  await t.test('A11Y-03: Sidebar navigation landmark, Escape handler, and accessible items', () => {
    const sidebarPath = path.join(appSrc, 'components/layout/Sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf8');

    assert.match(content, /id="app-sidebar"/, 'Sidebar aside must have id="app-sidebar"');
    assert.match(content, /<nav\s+aria-label=/, 'Sidebar must contain semantic <nav> landmark');
    assert.match(content, /e\.key === 'Escape'/, 'Sidebar mobile drawer must listen to Escape key');
    assert.match(content, /aria-hidden="true"/, 'Sidebar backdrop must have aria-hidden="true"');
    assert.match(content, /aria-label=\{t\(item\.title\)\}/, 'SidebarItem must provide accessible name when collapsed');
  });

  await t.test('A11Y-04: Header accessibility, menu semantics, controls, and Escape behavior', () => {
    const headerPath = path.join(appSrc, 'components/layout/Header.tsx');
    const content = fs.readFileSync(headerPath, 'utf8');

    assert.match(content, /aria-expanded=\{isSidebarOpen\}/, 'Mobile menu toggle must declare aria-expanded state');
    assert.match(content, /aria-controls="app-sidebar"/, 'Mobile menu toggle must point to app-sidebar');
    assert.match(content, /role="region"/, 'Notifications panel must have role="region" or role="dialog"');
    assert.match(content, /id="notifications-panel"/, 'Notifications panel must have matching id');
    assert.match(content, /role="menu"/, 'User profile dropdown must have role="menu"');
    assert.match(content, /role="menuitem"/, 'User profile items must have role="menuitem"');
    assert.match(content, /event\.key === 'Escape'/, 'Header must dismiss open dropdowns on Escape key');
  });

  await t.test('A11Y-05: GlobalSearch dialog role, modal attributes, and accessible buttons', () => {
    const searchPath = path.join(appSrc, 'components/layout/GlobalSearch.tsx');
    const content = fs.readFileSync(searchPath, 'utf8');

    assert.match(content, /role="dialog"/, 'Search modal must have role="dialog"');
    assert.match(content, /aria-modal="true"/, 'Search modal must have aria-modal="true"');
    assert.match(content, /aria-label=\{t\('search\.placeholder'\)\}/, 'Search modal and inputs must have accessible names');
  });

  await t.test('A11Y-06: Form accessibility in Register.tsx (id, htmlFor, aria-invalid, aria-describedby)', () => {
    const registerPath = path.join(appSrc, 'pages/Register.tsx');
    const content = fs.readFileSync(registerPath, 'utf8');

    assert.match(content, /<main\s+className=/, 'Register page must wrap content in <main> landmark');
    assert.match(content, /htmlFor="reg-first-name"/, 'First name label must have matching htmlFor');
    assert.match(content, /id="reg-first-name"/, 'First name input must have matching id');
    assert.match(content, /htmlFor="reg-email"/, 'Email label must have matching htmlFor');
    assert.match(content, /id="reg-email"/, 'Email input must have matching id');
    assert.match(content, /htmlFor="reg-college"/, 'College label must have matching htmlFor');
    assert.match(content, /id="reg-college"/, 'College select must have matching id');
    assert.match(content, /htmlFor="reg-department"/, 'Department label must have matching htmlFor');
    assert.match(content, /id="reg-department"/, 'Department select must have matching id');
    assert.match(content, /aria-invalid=\{!!errors\./, 'Form inputs must declare aria-invalid on error');
    assert.match(content, /aria-describedby=/, 'Form inputs must associate error descriptions via aria-describedby');
    assert.match(content, /min-w-\[44px\]\s+min-h-\[44px\]/, 'Password reveal toggle must satisfy WCAG 2.5.5/2.5.8 touch target size');
  });

  await t.test('A11Y-07: Table accessibility (accessible select-all and row selection checkboxes)', () => {
    const tables = [
      'pages/students/StudentsList.tsx',
      'pages/courses/CoursesList.tsx',
      'pages/doctors/DoctorsList.tsx',
      'pages/teaching-assistants/TeachingAssistantsList.tsx',
      'pages/registration/AdminsList.tsx',
    ];

    for (const relPath of tables) {
      const fullPath = path.join(appSrc, relPath);
      const content = fs.readFileSync(fullPath, 'utf8');

      assert.match(content, /aria-label=/, `${relPath} header checkbox must define aria-label`);
      assert.match(content, /sr-only/, `${relPath} header must contain sr-only accessible name`);
      assert.match(content, /handleSelectOne/, `${relPath} must have row selection handler`);
    }
  });

  await t.test('A11Y-08: Heading hierarchy preservation in StatCard', () => {
    const cardPath = path.join(appSrc, 'components/ui/card.tsx');
    const content = fs.readFileSync(cardPath, 'utf8');

    // Value should not be rendered as an arbitrary h3 that breaks heading levels
    assert.doesNotMatch(content, /<h3[^>]*>[\s\n]*\{value\}[\s\n]*<\/h3>/, 'StatCard value must not be an h3 tag breaking heading outline');
    assert.match(content, /<span[^>]*font-mono[^>]*>[\s\n]*\{value\}[\s\n]*<\/span>/, 'StatCard value must use semantic span with font-mono display');
  });

  await t.test('A11Y-09: Color contrast tokens in Login and Auth forms', () => {
    const loginPath = path.join(appSrc, 'pages/Login.tsx');
    const content = fs.readFileSync(loginPath, 'utf8');

    assert.match(content, /<main\s+className=/, 'Login page must wrap content in <main> landmark');
    assert.match(content, /text-brand-primary-700/, 'Login link must use WCAG AA compliant 700 tone on light surfaces (>= 4.5:1)');
    assert.match(content, /min-w-\[44px\]\s+min-h-\[44px\]/, 'Login password toggle must satisfy 44x44px target size');
  });
});
