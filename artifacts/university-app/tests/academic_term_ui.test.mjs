import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';

const studentDetailsPath = new URL('../src/pages/students/StudentDetails.tsx', import.meta.url);
const courseRosterTabPath = new URL('../src/pages/courses/components/CourseRosterTab.tsx', import.meta.url);
const appPath = new URL('../src/App.tsx', import.meta.url);
const academicTermsListPath = new URL('../src/pages/admin/AcademicTermsList.tsx', import.meta.url);
const enJsonPath = new URL('../src/i18n/en.json', import.meta.url);
const arJsonPath = new URL('../src/i18n/ar.json', import.meta.url);

test('Manual enrollment UI triggers removed (F-06)', () => {
  const studentDetails = readFileSync(studentDetailsPath, 'utf8');
  assert.equal(
    studentDetails.includes("students.enrollCourse"),
    false,
    'StudentDetails must not render manual enroll button'
  );
  assert.equal(
    studentDetails.includes("<EnrollCourseModal"),
    false,
    'StudentDetails must not mount EnrollCourseModal'
  );

  const courseRosterTab = readFileSync(courseRosterTabPath, 'utf8');
  assert.equal(
    courseRosterTab.includes("courses.enrollStudent"),
    false,
    'CourseRosterTab must not render manual enroll student button'
  );
});

test('Super Admin Academic Terms page and route registered (T6)', () => {
  assert.ok(existsSync(academicTermsListPath), 'AcademicTermsList.tsx must exist');

  const termsListContent = readFileSync(academicTermsListPath, 'utf8');
  assert.ok(
    termsListContent.includes('noActiveTermTitle') || termsListContent.includes('No Active Term'),
    'AcademicTermsList must display safe banner when no term is active'
  );
  assert.ok(
    termsListContent.includes('handleOpenSwitchPreview') || termsListContent.includes('Activate Term'),
    'AcademicTermsList must include activate/switch term action'
  );

  const appContent = readFileSync(appPath, 'utf8');
  assert.ok(
    appContent.includes('AcademicTermsList'),
    'App.tsx must import AcademicTermsList'
  );
  assert.ok(
    appContent.includes('academic-terms'),
    'App.tsx must define academic-terms route'
  );
});

test('Bilingual translation keys present for Academic Terms', () => {
  const en = JSON.parse(readFileSync(enJsonPath, 'utf8'));
  const ar = JSON.parse(readFileSync(arJsonPath, 'utf8'));

  assert.ok(en.academicTerms, 'en.json must contain academicTerms namespace');
  assert.ok(ar.academicTerms, 'ar.json must contain academicTerms namespace');
  assert.ok(en.academicTerms.pageTitle, 'en.json must have pageTitle');
  assert.ok(ar.academicTerms.pageTitle, 'ar.json must have pageTitle');
});

test('Academic Year and Term Edit Controls & Service (M1)', () => {
  const servicePath = new URL('../src/services/academicTerm.service.ts', import.meta.url);
  const modalPath = new URL('../src/pages/admin/AcademicTermModal.tsx', import.meta.url);

  const serviceContent = readFileSync(servicePath, 'utf8');
  assert.ok(
    serviceContent.includes('updateAcademicYear:'),
    'academicTerm.service.ts must implement updateAcademicYear'
  );

  const listContent = readFileSync(academicTermsListPath, 'utf8');
  assert.ok(
    listContent.includes('handleOpenEditYear') || listContent.includes('editYear'),
    'AcademicTermsList must provide an edit button/handler for academic year'
  );
  assert.ok(
    listContent.includes('handleOpenEditTerm') || listContent.includes('editTerm'),
    'AcademicTermsList must provide an edit button/handler for academic term'
  );

  const modalContent = readFileSync(modalPath, 'utf8');
  assert.ok(
    modalContent.includes('initialData') || modalContent.includes('editData') || modalContent.includes('isEdit'),
    'AcademicTermModal must support edit mode with prefilled initial data'
  );
  assert.ok(
    modalContent.includes('updateAcademicYear'),
    'AcademicTermModal must call updateAcademicYear when editing a year'
  );
  assert.ok(
    modalContent.includes('updateAcademicTerm'),
    'AcademicTermModal must call updateAcademicTerm when editing a term'
  );

  const en = JSON.parse(readFileSync(enJsonPath, 'utf8'));
  const ar = JSON.parse(readFileSync(arJsonPath, 'utf8'));
  assert.ok(en.academicTerms.editYear, 'en.json must contain editYear');
  assert.ok(ar.academicTerms.editYear, 'ar.json must contain editYear');
  assert.ok(en.academicTerms.editTerm, 'en.json must contain editTerm');
  assert.ok(ar.academicTerms.editTerm, 'ar.json must contain editTerm');
});

