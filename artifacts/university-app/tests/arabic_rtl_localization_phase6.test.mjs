import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('Phase 6 — Arabic & RTL Localization Verification Suite', () => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const appRoot = path.resolve(currentDir, '..');
  const arJsonPath = path.join(appRoot, 'src/i18n/ar.json');
  const enJsonPath = path.join(appRoot, 'src/i18n/en.json');

  test('1. Translation Dictionary Completeness & 100% Key Symmetry', () => {
    assert.ok(fs.existsSync(arJsonPath), 'ar.json must exist');
    assert.ok(fs.existsSync(enJsonPath), 'en.json must exist');

    const ar = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));
    const en = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));

    function getKeys(obj, prefix = '') {
      let keys = [];
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          keys = keys.concat(getKeys(v, fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys;
    }

    const arKeys = new Set(getKeys(ar));
    const enKeys = new Set(getKeys(en));

    const missingInAr = [...enKeys].filter((k) => !arKeys.has(k));
    const missingInEn = [...arKeys].filter((k) => !enKeys.has(k));

    assert.deepStrictEqual(missingInAr, [], `Keys missing in ar.json: ${missingInAr.join(', ')}`);
    assert.deepStrictEqual(missingInEn, [], `Keys missing in en.json: ${missingInEn.join(', ')}`);

    // Ensure no empty string values
    for (const key of arKeys) {
      const parts = key.split('.');
      let val = ar;
      for (const p of parts) val = val[p];
      assert.ok(typeof val === 'string' && val.trim().length > 0, `Empty translation in ar.json for key: ${key}`);
    }
  });

  test('2. Directional Icons & Chevron Rotation in RTL', () => {
    // Breadcrumb Separator
    const breadcrumbPath = path.join(appRoot, 'src/components/ui/breadcrumb.tsx');
    const breadcrumbCode = fs.readFileSync(breadcrumbPath, 'utf8');
    assert.ok(
      breadcrumbCode.includes('rtl:rotate-180') || breadcrumbCode.includes('rotate-180'),
      'BreadcrumbSeparator must rotate chevron in RTL'
    );

    // Carousel arrows
    const carouselPath = path.join(appRoot, 'src/components/ui/carousel.tsx');
    const carouselCode = fs.readFileSync(carouselPath, 'utf8');
    assert.ok(carouselCode.includes('rtl:rotate-180'), 'Carousel Previous/Next icons must rotate in RTL');
    assert.ok(carouselCode.includes('-start-12'), 'Carousel Previous must use logical -start-12');
    assert.ok(carouselCode.includes('-end-12'), 'Carousel Next must use logical -end-12');

    // Pagination arrows
    const paginationPath = path.join(appRoot, 'src/components/ui/pagination.tsx');
    const paginationCode = fs.readFileSync(paginationPath, 'utf8');
    assert.ok(paginationCode.includes('rtl:rotate-180'), 'Pagination chevron icons must rotate in RTL');
  });

  test('3. Bidi Isolation for Sensitive Mixed Content (Emails, Course Codes, Numbers)', () => {
    // MaskedEmail bidi isolation
    const maskedEmailPath = path.join(appRoot, 'src/components/MaskedEmail.tsx');
    const maskedEmailCode = fs.readFileSync(maskedEmailPath, 'utf8');
    assert.ok(maskedEmailCode.includes('<bdi>'), 'MaskedEmail must wrap email address in <bdi> tag');
    assert.ok(maskedEmailCode.includes('dir="ltr"'), 'MaskedEmail must have dir="ltr" text container');

    // TakeQuiz score bidi isolation
    const takeQuizPath = path.join(appRoot, 'src/pages/quizzes/TakeQuiz.tsx');
    const takeQuizCode = fs.readFileSync(takeQuizPath, 'utf8');
    assert.ok(takeQuizCode.includes('<bdi>'), 'TakeQuiz must isolate score numbers and time left with <bdi>');
  });

  test('4. Modal & Form Localization without Hardcoded English Leakage', () => {
    // EditProfileModal
    const editProfilePath = path.join(appRoot, 'src/pages/profile/EditProfileModal.tsx');
    const editProfileCode = fs.readFileSync(editProfilePath, 'utf8');
    assert.ok(editProfileCode.includes('useTranslation'), 'EditProfileModal must use i18n useTranslation hook');
    assert.ok(editProfileCode.includes('ps-12 pe-4'), 'EditProfileModal must use logical padding ps-12 pe-4');
    assert.ok(editProfileCode.includes('start-4'), 'EditProfileModal must use logical start-4 for icons');

    // CreateQuiz
    const createQuizPath = path.join(appRoot, 'src/pages/quizzes/CreateQuiz.tsx');
    const createQuizCode = fs.readFileSync(createQuizPath, 'utf8');
    assert.ok(createQuizCode.includes('useTranslation'), 'CreateQuiz must use useTranslation hook');
    assert.ok(!createQuizCode.includes('Question Details'), 'CreateQuiz must not have hardcoded Question Details');

    // EditCourseModal
    const editCoursePath = path.join(appRoot, 'src/pages/courses/EditCourseModal.tsx');
    const editCourseCode = fs.readFileSync(editCoursePath, 'utf8');
    assert.ok(editCourseCode.includes('useTranslation'), 'EditCourseModal must use useTranslation hook');
    assert.ok(editCourseCode.includes("t('courses.editCourseTitle'"), 'EditCourseModal must localize editCourseTitle');

    // ResetPasswordModal
    const resetPasswordPath = path.join(appRoot, 'src/components/ui/ResetPasswordModal.tsx');
    const resetPasswordCode = fs.readFileSync(resetPasswordPath, 'utf8');
    assert.ok(resetPasswordCode.includes('useTranslation'), 'ResetPasswordModal must use useTranslation hook');
    assert.ok(resetPasswordCode.includes('<bdi>'), 'ResetPasswordModal must isolate target user name with <bdi>');
  });

  test('5. Global Search and Keyboard Shortcut Localization', () => {
    const globalSearchPath = path.join(appRoot, 'src/components/layout/GlobalSearch.tsx');
    const globalSearchCode = fs.readFileSync(globalSearchPath, 'utf8');
    assert.ok(globalSearchCode.includes("t('search.toNavigate'"), 'GlobalSearch must localize toNavigate keyboard hint');
    assert.ok(globalSearchCode.includes("t('search.toSelect'"), 'GlobalSearch must localize toSelect keyboard hint');
  });
});
