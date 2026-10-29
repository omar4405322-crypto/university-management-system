import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');
const webSrcDir = path.resolve(__dirname, '../src');

async function loadSessionPointsUtils() {
  const gradebookPath = path.join(webSrcDir, 'utils/gradebook.utils.ts');
  const sessionPointsPath = path.join(webSrcDir, 'utils/sessionPoints.utils.ts');
  assert.ok(existsSync(sessionPointsPath), 'src/utils/sessionPoints.utils.ts must exist');

  const gradebookSrc = readFileSync(gradebookPath, 'utf8');
  const gradebookJs = ts.transpileModule(gradebookSrc, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const gradebookUri = `data:text/javascript;base64,${Buffer.from(gradebookJs).toString('base64')}`;

  const rawSessionPointsSrc = readFileSync(sessionPointsPath, 'utf8');
  assert.match(
    rawSessionPointsSrc,
    /import\s+\{[^}]*\bMAX_DECIMAL_PLACES\b[^}]*\}\s+from\s+['"]\.\/gradebook\.utils['"]/,
    'sessionPoints.utils.ts must import MAX_DECIMAL_PLACES from ./gradebook.utils'
  );

  const rewrittenSrc = rawSessionPointsSrc.replace(
    /from\s+['"]\.\/gradebook\.utils['"]/g,
    `from '${gradebookUri}'`
  );
  const transpiled = ts.transpileModule(rewrittenSrc, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
  return import(dataUri);
}

async function loadQuizLockUtils() {
  const quizLockPath = path.join(webSrcDir, 'utils/quizLock.utils.ts');
  assert.ok(existsSync(quizLockPath), 'src/utils/quizLock.utils.ts must exist');

  const rawSrc = readFileSync(quizLockPath, 'utf8');
  const transpiled = ts.transpileModule(rawSrc, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
  return import(dataUri);
}

describe('T-7b2 Unit & Static Verification: sessionPoints.utils, quizLock.utils, i18n Symmetry & Wiring', () => {
  it('1. validateSessionPoints accepts empty (omitted) and finite decimals with up to MAX_DECIMAL_PLACES, and rejects invalid inputs', async () => {
    const { validateSessionPoints } = await loadSessionPointsUtils();
    assert.equal(typeof validateSessionPoints, 'function');

    // Empty / whitespace -> valid, value undefined (omitted)
    assert.deepEqual(validateSessionPoints(''), {
      valid: true,
      value: undefined,
      errorKey: null,
    });
    assert.deepEqual(validateSessionPoints('   '), {
      valid: true,
      value: undefined,
      errorKey: null,
    });

    // Valid values
    assert.deepEqual(validateSessionPoints('0'), {
      valid: true,
      value: 0,
      errorKey: null,
    });
    assert.deepEqual(validateSessionPoints('2'), {
      valid: true,
      value: 2,
      errorKey: null,
    });
    assert.deepEqual(validateSessionPoints('2.5'), {
      valid: true,
      value: 2.5,
      errorKey: null,
    });
    assert.deepEqual(validateSessionPoints('0.25'), {
      valid: true,
      value: 0.25,
      errorKey: null,
    });
    assert.deepEqual(validateSessionPoints('  10.50  '), {
      valid: true,
      value: 10.5,
      errorKey: null,
    });

    // Invalid values explicitly required to be rejected
    const invalidInputs = ['-1', '1.234', 'abc', '1e2', '.5', '5.', '1..2', 'NaN', 'Infinity', '9'.repeat(400)];
    for (const input of invalidInputs) {
      const res = validateSessionPoints(input);
      assert.equal(res.valid, false, `Expected "${input}" to be rejected`);
      assert.equal(res.value, undefined, `Rejected input "${input}" must not produce a numeric value`);
      assert.equal(res.errorKey, 'attendance.sessionPointsInvalid');
    }
  });

  it('2. mapAttendanceStartError checks Cumulative sessionPoints FIRST, then exceeds maxPoints, then missing AUTO_ATTENDANCE, then finite number, and preserves 404 ScheduleSlot & fallback', async () => {
    const { mapAttendanceStartError } = await loadSessionPointsUtils();
    assert.equal(typeof mapAttendanceStartError, 'function');

    // 1. Cumulative sessionPoints MUST be checked BEFORE exceeds AUTO_ATTENDANCE component maxPoints
    const cumulativeRaw =
      'Cumulative sessionPoints (12) exceeds AUTO_ATTENDANCE component maxPoints (10)';
    const singleExceedsRaw =
      'sessionPoints 15 exceeds AUTO_ATTENDANCE component maxPoints 10';
    const noComponentRaw =
      'Course term does not have an AUTO_ATTENDANCE component configured';
    const invalidFiniteRaw =
      'sessionPoints must be a finite number >= 0 with at most 2 decimal places';

    const cumulativeKey = mapAttendanceStartError(cumulativeRaw);
    const exceedsKey = mapAttendanceStartError(singleExceedsRaw);
    const noCompKey = mapAttendanceStartError(noComponentRaw);
    const finiteKey = mapAttendanceStartError(invalidFiniteRaw);

    assert.equal(cumulativeKey, 'attendance.sessionPointsCumulativeExceeded');
    assert.equal(exceedsKey, 'attendance.sessionPointsExceedsMax');
    assert.NotEqual?.(cumulativeKey, exceedsKey);
    assert.notEqual(
      cumulativeKey,
      exceedsKey,
      'Cumulative sessionPoints error must map to a distinct key from single sessionPoints exceeds error'
    );
    assert.equal(noCompKey, 'attendance.noAutoAttendanceComponent');
    assert.equal(finiteKey, 'attendance.sessionPointsInvalid');

    // 404 ScheduleSlot branch keeps its localized message key
    const scheduleSlotRaw =
      'لم يتم العثور على موعد محدد في الجدول الدراسي. يرجى التواصل مع الإدارة لإضافة موعد (ScheduleSlot) قبل بدء الجلسة.';
    assert.equal(mapAttendanceStartError(scheduleSlotRaw, 404), 'attendance.noScheduleSlot');

    // Unknown rawMessage returns rawMessage if present, else generic attendance.startSessionError
    assert.equal(
      mapAttendanceStartError('Custom unexpected server message'),
      'Custom unexpected server message'
    );
    assert.equal(mapAttendanceStartError(''), 'attendance.startSessionError');
    assert.equal(mapAttendanceStartError(undefined), 'attendance.startSessionError');
    assert.equal(mapAttendanceStartError(null), 'attendance.startSessionError');
  });

  it('3. isQuizLockedError returns true ONLY when status is 409 AND message contains QUIZ_LOCKED_AFTER_ATTEMPT', async () => {
    const { isQuizLockedError } = await loadQuizLockUtils();
    assert.equal(typeof isQuizLockedError, 'function');

    assert.equal(
      isQuizLockedError({
        status: 409,
        message:
          'QUIZ_LOCKED_AFTER_ATTEMPT: Cannot add a question to an exam: student attempts already exist for this exam.',
      }),
      true
    );
    assert.equal(
      isQuizLockedError({
        status: 409,
        rawMessage:
          'QUIZ_LOCKED_AFTER_ATTEMPT: Cannot delete an exam: student attempts already exist for this exam.',
      }),
      true
    );

    // Plain 409 with another message is NOT locked
    assert.equal(
      isQuizLockedError({
        status: 409,
        message: 'Conflict: question order already exists for this exam.',
      }),
      false
    );
    assert.equal(isQuizLockedError({ status: 409, message: '' }), false);

    // Non-409 with QUIZ_LOCKED_AFTER_ATTEMPT is false
    assert.equal(
      isQuizLockedError({
        status: 422,
        message: 'QUIZ_LOCKED_AFTER_ATTEMPT: some message',
      }),
      false
    );
    assert.equal(
      isQuizLockedError({
        status: 500,
        message: 'QUIZ_LOCKED_AFTER_ATTEMPT',
      }),
      false
    );
    assert.equal(isQuizLockedError(null), false);
    assert.equal(isQuizLockedError(undefined), false);
  });

  it('4. i18n key symmetry between en.json and ar.json and no invented numbers in mapped error translations', () => {
    const enPath = path.join(webSrcDir, 'i18n/en.json');
    const arPath = path.join(webSrcDir, 'i18n/ar.json');
    const en = JSON.parse(readFileSync(enPath, 'utf8'));
    const ar = JSON.parse(readFileSync(arPath, 'utf8'));

    const requiredAttendanceKeys = [
      'sessionPointsLabel',
      'sessionPointsPlaceholder',
      'sessionPointsInvalid',
      'sessionPointsCumulativeExceeded',
      'sessionPointsExceedsMax',
      'noAutoAttendanceComponent',
    ];
    for (const k of requiredAttendanceKeys) {
      assert.ok(
        typeof en.attendance?.[k] === 'string' && en.attendance[k].trim().length > 0,
        `en.json must define non-empty attendance.${k}`
      );
      assert.ok(
        typeof ar.attendance?.[k] === 'string' && ar.attendance[k].trim().length > 0,
        `ar.json must define non-empty attendance.${k}`
      );
    }

    // Mapped error keys must not contain hard-coded numbers
    const noNumberKeys = [
      'sessionPointsInvalid',
      'sessionPointsCumulativeExceeded',
      'sessionPointsExceedsMax',
      'noAutoAttendanceComponent',
    ];
    for (const k of noNumberKeys) {
      assert.doesNotMatch(
        en.attendance[k],
        /[0-9٠-٩]/,
        `en.json attendance.${k} must not contain numbers: "${en.attendance[k]}"`
      );
      assert.doesNotMatch(
        ar.attendance[k],
        /[0-9٠-٩]/,
        `ar.json attendance.${k} must not contain numbers: "${ar.attendance[k]}"`
      );
    }

    const requiredExamKeys = ['quizLockedBanner', 'quizLockedDeleteToast'];
    for (const k of requiredExamKeys) {
      assert.ok(
        typeof en.exams?.[k] === 'string' && en.exams[k].trim().length > 0,
        `en.json must define non-empty exams.${k}`
      );
      assert.ok(
        typeof ar.exams?.[k] === 'string' && ar.exams[k].trim().length > 0,
        `ar.json must define non-empty exams.${k}`
      );
    }

    // Full dictionary symmetry check for attendance and exams namespaces
    assert.deepEqual(
      Object.keys(en.attendance).sort(),
      Object.keys(ar.attendance).sort(),
      'attendance namespace keys in en.json and ar.json must be symmetric'
    );
    assert.deepEqual(
      Object.keys(en.exams).sort(),
      Object.keys(ar.exams).sort(),
      'exams namespace keys in en.json and ar.json must be symmetric'
    );
  });

  it('5. Static pins: handleStartSession reads rawMessage and not response?.data; exams.service sets preferRawMessage ONLY on the 4 methods', () => {
    const dashboardPath = path.join(webSrcDir, 'pages/attendance/FacultyAttendanceDashboard.tsx');
    const dashboardSrc = readFileSync(dashboardPath, 'utf8');

    const startFnIdx = dashboardSrc.indexOf('const handleStartSession');
    const syncFnIdx = dashboardSrc.indexOf('const syncLocationNow');
    assert.ok(startFnIdx !== -1 && syncFnIdx > startFnIdx, 'Must locate handleStartSession block');
    const handleStartSessionBlock = dashboardSrc.slice(startFnIdx, syncFnIdx);

    assert.ok(
      handleStartSessionBlock.includes('rawMessage'),
      'handleStartSession must read err.rawMessage'
    );
    assert.ok(
      !handleStartSessionBlock.includes('response?.data') &&
        !handleStartSessionBlock.includes('err.response'),
      'handleStartSession must NOT read err.response or response?.data'
    );

    const examsServicePath = path.join(webSrcDir, 'services/exams.service.ts');
    const examsServiceSrc = readFileSync(examsServicePath, 'utf8');
    const preferRawMatches = examsServiceSrc.match(/preferRawMessage:\s*true/g) || [];
    assert.equal(
      preferRawMatches.length,
      4,
      `exams.service.ts must contain preferRawMessage: true in exactly 4 methods, found ${preferRawMatches.length}`
    );
    for (const methodName of [
      'deleteExam:',
      'addExamQuestion:',
      'updateExamQuestion:',
      'deleteExamQuestion:',
    ]) {
      const idx = examsServiceSrc.indexOf(methodName);
      assert.ok(idx !== -1, `exams.service.ts must define ${methodName}`);
      const nextLineEnd = examsServiceSrc.indexOf('\n', examsServiceSrc.indexOf('\n', idx) + 1);
      const snippet = examsServiceSrc.slice(idx, nextLineEnd === -1 ? undefined : nextLineEnd);
      assert.ok(
        snippet.includes('preferRawMessage: true'),
        `${methodName} must include preferRawMessage: true`
      );
    }
  });
});

