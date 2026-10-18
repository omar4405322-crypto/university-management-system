/**
 * Phase 12 — Errors & Feedback Static Regression Contracts.
 *
 * Validates structural guarantees introduced in Phase 12:
 * 1. Computed directory walk verifying all relevant surfaces are covered.
 * 2. Empty-state error masking prevention across all list surfaces.
 * 3. ErrorState and ErrorBoundary live-region accessibility.
 * 4. ToastContext WCAG live-region semantics, hover/focus pauses, and dismiss controls.
 * 5. Inline form field error association (aria-invalid, aria-describedby, role="alert").
 * 6. API error normalization, 429 Retry-After parsing, and 401 refresh loop prevention.
 * 7. i18n symmetry and absence of dummy key fallbacks.
 * 8. OfflineBanner network event listeners and role="alert" announcement.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_SRC = resolve(__dirname, '../src');
const src = (rel) => readFileSync(resolve(APP_SRC, rel), 'utf-8');

// Git-independent computed directory walk
function walkDir(dir) {
  let files = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files = files.concat(walkDir(fullPath));
    } else if (/\.(tsx|ts)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

const ALL_SRC_FILES = walkDir(APP_SRC);

describe('Phase 12 — Computed File Discovery & Scope Coverage', () => {
  it('computed file list is non-empty and discovers all source modules', () => {
    assert.ok(ALL_SRC_FILES.length > 50, `Expected > 50 source files, found ${ALL_SRC_FILES.length}`);
  });

  it('scans all targeted Phase 12 list pages and components', () => {
    const targetRelPaths = [
      'pages/colleges/CollegesList.tsx',
      'pages/departments/DepartmentsList.tsx',
      'pages/exams/ExamsList.tsx',
      'pages/quizzes/QuizzesList.tsx',
      'pages/tasks/TasksList.tsx',
      'pages/registration/RegistrationRequests.tsx',
      'pages/registration/AdminsList.tsx',
      'pages/finance/FinanceDashboard.tsx',
      'pages/records/StudentRecord.tsx',
      'components/ui/ErrorState.tsx',
      'components/ErrorBoundary.tsx',
      'components/common/OfflineBanner.tsx',
      'context/ToastContext.tsx',
      'services/api.ts'
    ];

    const missing = [];
    for (const rel of targetRelPaths) {
      const full = resolve(APP_SRC, rel);
      if (!ALL_SRC_FILES.includes(full)) {
        missing.push(rel);
      }
    }
    assert.deepEqual(missing, [], `Files in scope not discovered by walk: ${missing.join(', ')}`);
  });
});

describe('Phase 12 — Empty State Error Masking Prevention', () => {
  const LIST_SURFACES = [
    'pages/colleges/CollegesList.tsx',
    'pages/departments/DepartmentsList.tsx',
    'pages/exams/ExamsList.tsx',
    'pages/quizzes/QuizzesList.tsx',
    'pages/tasks/TasksList.tsx',
    'pages/registration/RegistrationRequests.tsx',
    'pages/registration/AdminsList.tsx',
    'pages/finance/FinanceDashboard.tsx',
    'pages/records/StudentRecord.tsx',
  ];

  for (const file of LIST_SURFACES) {
    it(`${file}: explicitly manages error state and renders ErrorState on failure`, () => {
      const code = src(file);
      assert.match(code, /(?:const\s+\[error,\s*setError\]\s*=\s*useState|\berror\b[\s\S]*?=\s*useDepartments)/, `${file} must declare or expose error state`);
      assert.match(code, /<ErrorState\b/, `${file} must render ErrorState component`);
      assert.match(code, /onRetry=/, `${file} must provide onRetry handler to ErrorState`);
      assert.doesNotMatch(code, /catch\s*\([^)]*\)\s*\{\s*setError\(null\)/, `${file} must not clear error on catch`);
    });
  }
});

describe('Phase 12 — Accessible Live Region & Error Components', () => {
  it('ErrorState renders role="alert" and aria-live="polite"', () => {
    const code = src('components/ui/ErrorState.tsx');
    assert.match(code, /role=["']alert["']/);
    assert.match(code, /aria-live=["']polite["']/);
  });

  it('ErrorBoundary renders role="alert" and aria-live="assertive" with localized messages', () => {
    const code = src('components/ErrorBoundary.tsx');
    assert.match(code, /role=["']alert["']/);
    assert.match(code, /aria-live=["']assertive["']/);
    assert.match(code, /i18n\.t\(['"]errors\.somethingWentWrong['"]/);
    assert.match(code, /i18n\.t\(['"]errors\.unexpectedErrorDesc['"]/);
  });

  it('OfflineBanner declares window online/offline listeners and role="alert"', () => {
    const code = src('components/common/OfflineBanner.tsx');
    assert.match(code, /window\.addEventListener\(['"]offline['"]/);
    assert.match(code, /window\.addEventListener\(['"]online['"]/);
    assert.match(code, /role=["']alert["']/);
    assert.match(code, /role=["']status["']/);
    assert.match(code, /aria-live=["']assertive["']/);
    assert.match(code, /aria-live=["']polite["']/);
  });
});

describe('Phase 12 — ToastContext WCAG & Live-Region Semantics', () => {
  it('ToastContext isolates alert role for errors and status role for success/info', () => {
    const code = src('context/ToastContext.tsx');
    assert.match(code, /role=\{isError \? ['"]alert['"] : ['"]status['"]\}/);
    assert.match(code, /aria-live=\{isError \? ['"]assertive['"] : ['"]polite['"]\}/);
  });

  it('ToastContext pauses timer on mouse enter / focus and resumes on leave / blur', () => {
    const code = src('context/ToastContext.tsx');
    assert.match(code, /onMouseEnter=\{\(\) => onPause\(toast\.id\)\}/);
    assert.match(code, /onMouseLeave=\{\(\) => onResume\(toast\.id\)\}/);
    assert.match(code, /onFocus=\{\(\) => onPause\(toast\.id\)\}/);
    assert.match(code, /onBlur=\{\(\) => onResume\(toast\.id\)\}/);
  });

  it('ToastContext handles Escape key dismiss and exposes dismiss button aria-label', () => {
    const code = src('context/ToastContext.tsx');
    assert.match(code, /e\.key === ['"]Escape['"]/);
    assert.match(code, /aria-label=\{t\(['"]common\.dismissNotification['"], ['"]Dismiss notification['"]\)\}/);
  });
});

describe('Phase 12 — Inline Form Field Error Accessibility', () => {
  const FORM_MODALS = [
    'pages/courses/CourseModal.tsx',
    'pages/finance/AddPaymentModal.tsx',
    'components/timetable/builder/Step3TimeRoom.tsx',
    'pages/schedules/TimetableModal.tsx',
  ];

  for (const file of FORM_MODALS) {
    it(`${file}: binds invalid inputs via aria-invalid, aria-describedby and role="alert"`, () => {
      const code = src(file);
      assert.match(code, /aria-invalid=\{/);
      assert.match(code, /aria-describedby=\{/);
      assert.match(code, /role=["']alert["']/);
    });
  }
});

describe('Phase 12 — API Error Normalization & Rate Limiting', () => {
  it('api.ts exports getLocalizedApiError and normalizes status, code, and retryAfter', () => {
    const code = src('services/api.ts');
    assert.match(code, /export\s+(?:const|function)\s+getLocalizedApiError/);
    assert.match(code, /parseInt\(String\(headerVal\)/);
    assert.match(code, /isNetworkError:/);
    assert.match(code, /isTimeout:/);
    assert.match(code, /isRateLimited:/);
  });

  it('api.ts prevents 401 refresh loops on auth endpoints', () => {
    const code = src('services/api.ts');
    assert.match(code, /originalRequest\?\.url\?\.includes\(['"]\/auth\/login['"]\)/);
    assert.match(code, /originalRequest\?\.url\?\.includes\(['"]\/auth\/register['"]\)/);
    assert.match(code, /originalRequest\?\.url\?\.includes\(['"]\/auth\/refresh['"]\)/);
  });
});

describe('Phase 12 — i18n Symmetry & Fallback Hygiene', () => {
  it('all errors.* keys in en.json exist symmetrically in ar.json', () => {
    const en = JSON.parse(readFileSync(resolve(APP_SRC, 'i18n/en.json'), 'utf-8'));
    const ar = JSON.parse(readFileSync(resolve(APP_SRC, 'i18n/ar.json'), 'utf-8'));

    assert.ok(en.errors, 'en.json must define errors namespace');
    assert.ok(ar.errors, 'ar.json must define errors namespace');

    const enKeys = Object.keys(en.errors).sort();
    const arKeys = Object.keys(ar.errors).sort();

    assert.deepEqual(enKeys, arKeys, 'errors namespace must be completely symmetric');
  });

  it('no literal dummy key fallback t("key", "key") in touched Phase 12 files', () => {
    const files = [
      'components/timetable/builder/Step3TimeRoom.tsx',
      'pages/finance/FinanceDashboard.tsx',
      'pages/registration/RegistrationRequests.tsx',
    ];

    for (const f of files) {
      const code = src(f);
      const matches = [...code.matchAll(/t\(\s*['"]([a-zA-Z0-9._]+)['"]\s*,\s*['"]\1['"]\s*\)/g)];
      assert.deepEqual(matches, [], `Found dummy key fallback t(k, k) in ${f}`);
    }
  });
});
