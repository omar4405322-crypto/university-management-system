import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

describe('PHASE 9 — Institutional Navigation Architecture & Quality Verification (10/10)', () => {
  const readSrc = (subpath) => fs.readFileSync(path.join(appRoot, 'src', subpath), 'utf8');

  test('1. Breadcrumb Component Contract: WAI-ARIA breadcrumb standard with aria-current="page"', () => {
    const breadcrumbSrc = readSrc(path.join('components', 'ui', 'Breadcrumbs.tsx'));
    assert.ok(breadcrumbSrc.includes('aria-label="breadcrumb"'), 'Breadcrumbs must declare aria-label="breadcrumb" on nav');
    assert.ok(breadcrumbSrc.includes('aria-current={isLast ? "page" : undefined}'), 'Breadcrumbs must mark active current page with aria-current="page"');
    assert.ok(breadcrumbSrc.includes('Link'), 'Breadcrumbs must render Link for non-active ancestor pages');
  });

  test('2. Student Detail Route: Breadcrumb hierarchy and back button present', () => {
    const studentDetailsSrc = readSrc(path.join('pages', 'students', 'StudentDetails.tsx'));
    assert.ok(studentDetailsSrc.includes('import Breadcrumbs'), 'StudentDetails must import Breadcrumbs');
    assert.ok(studentDetailsSrc.includes('<Breadcrumbs items={breadcrumbItems} />'), 'StudentDetails must render Breadcrumbs');
    assert.ok(studentDetailsSrc.includes('breadcrumbItems'), 'StudentDetails must construct breadcrumbItems with student name');
    assert.ok(studentDetailsSrc.includes('Back to Students List') || studentDetailsSrc.includes('navigate(\'/students\')'), 'StudentDetails must provide back navigation button');
  });

  test('3. Doctor Detail Route: Breadcrumb hierarchy and back button present', () => {
    const doctorDetailsSrc = readSrc(path.join('pages', 'doctors', 'DoctorDetails.tsx'));
    assert.ok(doctorDetailsSrc.includes('import Breadcrumbs'), 'DoctorDetails must import Breadcrumbs');
    assert.ok(doctorDetailsSrc.includes('<Breadcrumbs items={breadcrumbItems} />'), 'DoctorDetails must render Breadcrumbs');
    assert.ok(doctorDetailsSrc.includes('breadcrumbItems'), 'DoctorDetails must construct breadcrumbItems with doctor name');
    assert.ok(doctorDetailsSrc.includes('Back to Doctors List') || doctorDetailsSrc.includes('navigate(\'/doctors\')'), 'DoctorDetails must provide back navigation button');
  });

  test('4. Teaching Assistant Detail Route: Breadcrumb hierarchy and back button present', () => {
    const taDetailsSrc = readSrc(path.join('pages', 'teaching-assistants', 'TeachingAssistantDetails.tsx'));
    assert.ok(taDetailsSrc.includes('import Breadcrumbs'), 'TeachingAssistantDetails must import Breadcrumbs');
    assert.ok(taDetailsSrc.includes('<Breadcrumbs items={breadcrumbItems} />'), 'TeachingAssistantDetails must render Breadcrumbs');
    assert.ok(taDetailsSrc.includes('breadcrumbItems'), 'TeachingAssistantDetails must construct breadcrumbItems with TA name');
    assert.ok(taDetailsSrc.includes('Back to Teaching Assistants') || taDetailsSrc.includes('navigate(\'/teaching-assistants\')'), 'TeachingAssistantDetails must provide back navigation button');
  });

  test('5. Other Core Detail Routes: Course, College, and Department breadcrumbs verified', () => {
    const courseDetailsSrc = readSrc(path.join('pages', 'courses', 'CourseDetails.tsx'));
    assert.ok(courseDetailsSrc.includes('<Breadcrumbs items={breadcrumbItems} />'), 'CourseDetails must render Breadcrumbs');

    const collegeDetailsSrc = readSrc(path.join('pages', 'colleges', 'CollegeDetails.tsx'));
    assert.ok(collegeDetailsSrc.includes('<Breadcrumbs items={breadcrumbItems} />'), 'CollegeDetails must render Breadcrumbs');

    const deptDetailsSrc = readSrc(path.join('pages', 'departments', 'DepartmentDetails.tsx'));
    assert.ok(deptDetailsSrc.includes('<Breadcrumbs items={breadcrumbItems} />'), 'DepartmentDetails must render Breadcrumbs');
  });

  test('6. Dead-End Prevention: StudentStatisticsPage provides return navigation affordance', () => {
    const statsSrc = readSrc(path.join('pages', 'statistics', 'StudentStatisticsPage.tsx'));
    assert.ok(statsSrc.includes('useNavigate'), 'StudentStatisticsPage must use useNavigate');
    assert.ok(statsSrc.includes('Back to Student Profile') || statsSrc.includes('العودة لملف الطالب'), 'StudentStatisticsPage must have return link when viewed in advisor mode or per-student route');
  });

  test('7. Dead-End Prevention: DegreeAudit provides safe back navigation with fallback', () => {
    const degreeAuditSrc = readSrc(path.join('pages', 'degree-audit', 'DegreeAudit.tsx'));
    assert.ok(degreeAuditSrc.includes('useNavigate'), 'DegreeAudit must use useNavigate');
    assert.ok(degreeAuditSrc.includes('handleBack'), 'DegreeAudit must implement safe handleBack');
    assert.ok(degreeAuditSrc.includes("navigate('/record')"), 'DegreeAudit must fall back to /record');
  });

  test('8. Tab Accessibility: StudentDetails declares WAI-ARIA tablist, tab, tabpanel, and keyboard navigation', () => {
    const studentDetailsSrc = readSrc(path.join('pages', 'students', 'StudentDetails.tsx'));
    assert.ok(studentDetailsSrc.includes('role="tablist"'), 'StudentDetails tabs container must have role="tablist"');
    assert.ok(studentDetailsSrc.includes('role="tab"'), 'StudentDetails tabs must have role="tab"');
    assert.ok(studentDetailsSrc.includes('aria-selected='), 'StudentDetails tabs must declare aria-selected');
    assert.ok(studentDetailsSrc.includes('aria-controls='), 'StudentDetails tabs must declare aria-controls');
    assert.ok(studentDetailsSrc.includes('role="tabpanel"'), 'StudentDetails tab panels must have role="tabpanel"');
    assert.ok(studentDetailsSrc.includes('useTabListKeyboard'), 'StudentDetails must use shared tab keyboard navigation');
    assert.ok(studentDetailsSrc.includes('onKeyDown='), 'StudentDetails tablist must handle onKeyDown');
  });

  test('9. Tab Accessibility: DoctorDetails declares WAI-ARIA tablist, tab, tabpanel, and keyboard navigation', () => {
    const doctorDetailsSrc = readSrc(path.join('pages', 'doctors', 'DoctorDetails.tsx'));
    assert.ok(doctorDetailsSrc.includes('role="tablist"'), 'DoctorDetails tabs container must have role="tablist"');
    assert.ok(doctorDetailsSrc.includes('role="tab"'), 'DoctorDetails tabs must have role="tab"');
    assert.ok(doctorDetailsSrc.includes('aria-selected='), 'DoctorDetails tabs must declare aria-selected');
    assert.ok(doctorDetailsSrc.includes('aria-controls='), 'DoctorDetails tabs must declare aria-controls');
    assert.ok(doctorDetailsSrc.includes('role="tabpanel"'), 'DoctorDetails tab panels must have role="tabpanel"');
    assert.ok(doctorDetailsSrc.includes('useTabListKeyboard'), 'DoctorDetails must use shared tab keyboard navigation');
    assert.ok(doctorDetailsSrc.includes('onKeyDown='), 'DoctorDetails tablist must handle onKeyDown');
  });

  test('10. Tab Accessibility: TeachingAssistantDetails declares WAI-ARIA tablist, tab, tabpanel, and keyboard navigation', () => {
    const taDetailsSrc = readSrc(path.join('pages', 'teaching-assistants', 'TeachingAssistantDetails.tsx'));
    assert.ok(taDetailsSrc.includes('role="tablist"'), 'TeachingAssistantDetails tabs container must have role="tablist"');
    assert.ok(taDetailsSrc.includes('role="tab"'), 'TeachingAssistantDetails tabs must have role="tab"');
    assert.ok(taDetailsSrc.includes('aria-selected='), 'TeachingAssistantDetails tabs must declare aria-selected');
    assert.ok(taDetailsSrc.includes('aria-controls='), 'TeachingAssistantDetails tabs must declare aria-controls');
    assert.ok(taDetailsSrc.includes('role="tabpanel"'), 'TeachingAssistantDetails tab panels must have role="tabpanel"');
    assert.ok(taDetailsSrc.includes('useTabListKeyboard'), 'TeachingAssistantDetails must use shared tab keyboard navigation');
    assert.ok(taDetailsSrc.includes('onKeyDown='), 'TeachingAssistantDetails tablist must handle onKeyDown');
  });

  test('11. Tab Accessibility: SettingsPage segmented tabs declare WAI-ARIA tablist, tab, tabpanel, and keyboard navigation', () => {
    const settingsSrc = readSrc(path.join('pages', 'settings', 'SettingsPage.tsx'));
    assert.ok(settingsSrc.includes('role="tablist"'), 'SettingsPage tabs container must have role="tablist"');
    assert.ok(settingsSrc.includes('role="tab"'), 'SettingsPage tabs must have role="tab"');
    assert.ok(settingsSrc.includes('aria-selected={isSelected}'), 'SettingsPage tabs must declare aria-selected');
    assert.ok(settingsSrc.includes('aria-controls='), 'SettingsPage tabs must declare aria-controls');
    assert.ok(settingsSrc.includes('role="tabpanel"'), 'SettingsPage tab panels must have role="tabpanel"');
    assert.ok(settingsSrc.includes('useTabListKeyboard'), 'SettingsPage must use shared tab keyboard navigation');
    assert.ok(settingsSrc.includes('onKeyDown='), 'SettingsPage tablist must handle onKeyDown');
  });

  test('12. Active Route & Nested Group Expansion: Sidebar auto-expands on nested detail routes', () => {
    const sidebarSrc = readSrc(path.join('components', 'layout', 'Sidebar.tsx'));
    assert.ok(
      sidebarSrc.includes("location.pathname.startsWith(item.path + '/')"),
      'Sidebar must maintain group expansion on nested routes (e.g. /students/123 -> group open)'
    );
    assert.ok(sidebarSrc.includes('aria-label={t(\'nav.mainNav\''), 'Sidebar must declare aria-label on navigation landmark');
    assert.ok(sidebarSrc.includes('toggleSidebar'), 'Sidebar must support collapsible state toggle');
  });

  test('13. Header & Mobile Navigation: Accessibility attributes and dialog dismiss controls', () => {
    const headerSrc = readSrc(path.join('components', 'layout', 'Header.tsx'));
    assert.ok(headerSrc.includes('aria-expanded={isSidebarOpen}'), 'Mobile menu toggle must declare aria-expanded');
    assert.ok(headerSrc.includes('aria-controls="app-sidebar"'), 'Mobile menu toggle must declare aria-controls="app-sidebar"');
    assert.ok(headerSrc.includes('aria-haspopup="menu"'), 'User avatar button must declare aria-haspopup="menu"');
    assert.ok(headerSrc.includes('role="menu"'), 'User dropdown must declare role="menu"');
    assert.ok(headerSrc.includes('role="menuitem"'), 'User dropdown items must declare role="menuitem"');
  });
});
