/**
 * Phase 10 — Forms regression contracts.
 *
 * These are STATIC source contracts (parsed, not class-string matches). They guard the
 * structural guarantees introduced in Phase 10. Runtime behaviours (focus order, loading
 * state, RTL layout, dependent-field reset in a live DOM) are verified in the live browser
 * audit and are intentionally NOT claimed as proven by this file.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_SRC = resolve(__dirname, '../src');
const src = (rel) => readFileSync(resolve(APP_SRC, rel), 'utf-8');

const FORM_FILES = [
  'pages/Login.tsx',
  'pages/Register.tsx',
  'pages/students/AddStudentModal.tsx',
  'pages/students/EditStudentModal.tsx',
  'pages/doctors/AddDoctorModal.tsx',
  'pages/doctors/EditDoctorModal.tsx',
  'pages/teaching-assistants/AddTAModal.tsx',
  'pages/teaching-assistants/EditTAModal.tsx',
  'pages/departments/AddDepartmentModal.tsx',
  'pages/departments/EditDepartmentModal.tsx',
  'pages/courses/AddCourseModal.tsx',
  'pages/courses/EditCourseModal.tsx',
  'pages/profile/EditProfileModal.tsx',
  'pages/quizzes/CreateQuiz.tsx',
  'pages/exams/CreateExam.tsx',
  'pages/tasks/components/TaskModal.tsx',
  'pages/tasks/components/TaskSubmitModal.tsx',
];

// Static literal ids only (dynamic template ids like id={`q-${i}`} are matched by prefix).
function labelTargets(code) {
  return [...code.matchAll(/htmlFor=(?:"([^"]+)"|\{`([^`]+)`\})/g)].map((m) => m[1] ?? m[2]);
}
function hasId(code, target) {
  if (target.includes('${')) {
    const prefix = target.split('${')[0];
    return new RegExp('id=\\{`' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(code);
  }
  return code.includes(`id="${target}"`) || code.includes(`id='${target}'`);
}

describe('Phase 10 — label ↔ control linkage', () => {
  for (const file of FORM_FILES) {
    it(`${file}: every label htmlFor resolves to a control id in the same component`, () => {
      const code = src(file);
      const targets = labelTargets(code);
      assert.ok(targets.length > 0, 'form must use htmlFor-linked labels');
      const orphans = targets.filter((t) => !hasId(code, t));
      assert.deepEqual(orphans, [], `orphan label targets: ${orphans.join(', ')}`);
    });
  }
});

describe('Phase 10 — validation error association', () => {
  for (const file of FORM_FILES.filter((f) => !f.includes('TaskSubmit'))) {
    it(`${file}: invalid state is exposed via aria-invalid and aria-describedby`, () => {
      const code = src(file);
      assert.match(code, /aria-invalid['"]?\s*[=:]/);
      assert.match(code, /aria-describedby['"]?\s*[=:]/);
    });
  }

  it('every aria-describedby error id has a rendered element with the same id', () => {
    for (const file of FORM_FILES) {
      const code = src(file);
      const ids = [...code.matchAll(/errors?\.[\w.]+\s*\?\s*'([\w-]+)'\s*:\s*undefined/g)].map((m) => m[1]);
      for (const id of ids) {
        assert.ok(code.includes(`id="${id}"`), `${file}: describedby target #${id} is never rendered`);
      }
    }
  });
});

describe('Phase 10 — required-field semantics', () => {
  for (const file of FORM_FILES) {
    it(`${file}: required controls are programmatically marked`, () => {
      const code = src(file);
      assert.match(code, /aria-required="true"|\brequired\b/);
    });
  }
});

describe('Phase 10 — password policy aligned with backend', () => {
  // Authoritative backend policy: artifacts/api-server/src/utils/passwordPolicy.ts
  const backendPath = resolve(__dirname, '../../api-server/src/utils/passwordPolicy.ts');
  const backend = readFileSync(backendPath, 'utf-8');
  it('backend policy is min 8 + upper + lower + digit', () => {
    assert.match(backend, /PASSWORD_MIN_LENGTH = 8/);
    assert.match(backend, /\/\[A-Z\]\//);
    assert.match(backend, /\/\[a-z\]\//);
    assert.match(backend, /\/\\d\//);
  });

  const PASSWORD_FILES = [
    'pages/Register.tsx',
    'pages/students/AddStudentModal.tsx',
    'pages/doctors/AddDoctorModal.tsx',
    'pages/teaching-assistants/AddTAModal.tsx',
    'pages/profile/EditProfileModal.tsx',
  ];
  for (const file of PASSWORD_FILES) {
    it(`${file}: client enforces every backend password rule`, () => {
      const code = src(file);
      assert.match(code, /min\(8|length\s*>=\s*8/, 'min length 8');
      assert.match(code, /\[A-Z\]/, 'uppercase');
      assert.match(code, /\[a-z\]/, 'lowercase');
      assert.match(code, /\\d|\[0-9\]/, 'digit');
    });
  }
});

describe('Phase 10 — autocomplete / inputMode contracts', () => {
  it('Login uses email + current-password tokens', () => {
    const code = src('pages/Login.tsx');
    assert.match(code, /autoComplete="(email|username)"/);
    assert.match(code, /autoComplete="current-password"/);
  });
  it('account creation passwords use new-password', () => {
    for (const f of ['pages/Register.tsx', 'pages/students/AddStudentModal.tsx']) {
      assert.match(src(f), /autoComplete="new-password"/, f);
    }
  });
  it('phone inputs are type=tel with inputMode=tel and autoComplete=tel', () => {
    for (const f of ['pages/Register.tsx', 'pages/students/AddStudentModal.tsx', 'pages/profile/EditProfileModal.tsx']) {
      const code = src(f);
      assert.match(code, /type="tel"/, f);
      assert.match(code, /inputMode="tel"/, f);
      assert.match(code, /autoComplete="tel"/, f);
    }
  });
  it('public registration phone input is LTR-isolated for Arabic', () => {
    const code = src('pages/Register.tsx');
    const phone = code.slice(code.indexOf('id="reg-phone"') - 200, code.indexOf('id="reg-phone"') + 400);
    assert.match(phone, /dir="ltr"/);
  });
});

describe('Phase 10 — dependent College → Department clearing', () => {
  it('Register clears departmentId whenever college changes', () => {
    const code = src('pages/Register.tsx');
    assert.match(code, /setValue\('departmentId', ''\)/);
    assert.match(code, /\[selectedCollegeId, setValue\]/);
  });
  it('Register disables the department select until a college is chosen', () => {
    assert.match(src('pages/Register.tsx'), /id="reg-department"[\s\S]{0,120}disabled=\{!selectedCollegeId/);
  });
  it('AddStudentModal clears departmentId on college change', () => {
    assert.match(src('pages/students/AddStudentModal.tsx'), /setValue\('departmentId'/);
  });
});

describe('Phase 10 — in-flight / duplicate-submit protection', () => {
  const SUBMIT_FILES = [
    'pages/students/AddStudentModal.tsx',
    'pages/doctors/AddDoctorModal.tsx',
    'pages/teaching-assistants/AddTAModal.tsx',
    'pages/profile/EditProfileModal.tsx',
    'pages/exams/CreateExam.tsx',
  ];
  for (const file of SUBMIT_FILES) {
    it(`${file}: submit button is disabled while submitting`, () => {
      assert.match(src(file), /type="submit"[\s\S]{0,200}disabled=\{[^}]*(isSubmitting|loading|submitting)/);
    });
  }
  it('destructive confirmation disables both actions while loading and offers Cancel', () => {
    const code = src('components/ui/ConfirmDeleteModal.tsx');
    assert.equal((code.match(/disabled=\{loading\}/g) || []).length, 2);
    assert.match(code, /onClick=\{onClose\}/);
    assert.match(code, /onClick=\{onConfirm\}/);
  });
});

describe('Phase 10 — assessment forms no longer use blocking alert()', () => {
  for (const file of ['pages/quizzes/CreateQuiz.tsx', 'pages/exams/CreateExam.tsx']) {
    it(`${file}: no window alert(); errors are surfaced inline/toast`, () => {
      const code = src(file);
      assert.ok(!/(^|[^.\w])alert\(/m.test(code), 'raw alert() must not be used');
      assert.match(code, /role="alert"|toast\.error/);
    });
  }
  it('CreateQuiz renders an inline role=alert banner', () => {
    assert.match(src('pages/quizzes/CreateQuiz.tsx'), /role="alert"/);
  });
  it('CreateExam renders server/validation errors in a rendered error region', () => {
    const code = src('pages/exams/CreateExam.tsx');
    assert.match(code, /setError\(/);
    assert.match(code, /\{error && \(/);
  });
});
