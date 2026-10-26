import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, describe } from 'node:test';

const takeExamSrc = readFileSync(
  new URL('../src/pages/exams/TakeExam.tsx', import.meta.url),
  'utf8'
);
const createExamSrc = readFileSync(
  new URL('../src/pages/exams/CreateExam.tsx', import.meta.url),
  'utf8'
);
const addExamModalSrc = readFileSync(
  new URL('../src/pages/exams/AddExamModal.tsx', import.meta.url),
  'utf8'
);
const adminExamRecordViewSrc = readFileSync(
  new URL('../src/pages/records/components/AdminExamRecordView.tsx', import.meta.url),
  'utf8'
);
const enrollmentServiceSrc = readFileSync(
  new URL('../src/services/enrollment.service.ts', import.meta.url),
  'utf8'
);

describe('WP-4 Task T-7a: UI Wiring Guards & Regression Invariants', () => {
  test('1. TakeExam.tsx calls cancelExam on leave grace expiration', () => {
    assert.ok(
      takeExamSrc.includes('cancelExam('),
      'TakeExam.tsx must call cancelExam when leave grace expires to cancel the attempt'
    );
  });

  test('2. TakeExam.tsx has no exam_timer_ in localStorage', () => {
    assert.ok(
      !takeExamSrc.includes('exam_timer_'),
      'TakeExam.tsx must not persist or read exam_timer_ in localStorage; timer must be server-authoritative'
    );
  });

  test('3. TakeExam.tsx has no client-side shuffleQuestionsForStudent call', () => {
    assert.ok(
      !takeExamSrc.includes('shuffleQuestionsForStudent('),
      'TakeExam.tsx must not shuffle questions client-side; order is determined server-side'
    );
  });

  test('4. TakeExam.tsx uses getMcqDisplayOptions and calculateRemainingSeconds', () => {
    assert.ok(
      takeExamSrc.includes('getMcqDisplayOptions('),
      'TakeExam.tsx must use getMcqDisplayOptions to map optionOrder with positional letters A-D'
    );
    assert.ok(
      takeExamSrc.includes('calculateRemainingSeconds('),
      'TakeExam.tsx must use calculateRemainingSeconds for clock-skew corrected countdown'
    );
  });

  test('5. TakeExam.tsx re-fetches questions inside PENDING branch using shouldRefetchQuestions', () => {
    assert.match(
      takeExamSrc,
      /subResult\.data\.status\s*===\s*["']PENDING["'][\s\S]*?shouldRefetchQuestions\([\s\S]*?getExamQuestions\(/,
      'TakeExam.tsx must call shouldRefetchQuestions and getExamQuestions inside the PENDING branch'
    );
  });

  test('6. CreateExam.tsx and AddExamModal.tsx use z.literal("QUIZ") and have no MIDTERM/FINAL option or card', () => {
    // CreateExam.tsx checks
    assert.match(
      createExamSrc,
      /type:\s*z\.literal\(["']QUIZ["']\)/,
      'CreateExam.tsx schema must use z.literal("QUIZ")'
    );
    assert.ok(
      !createExamSrc.includes('value="MIDTERM"'),
      'CreateExam.tsx must not have MIDTERM option'
    );
    assert.ok(
      !createExamSrc.includes('value="FINAL"'),
      'CreateExam.tsx must not have FINAL option'
    );

    // AddExamModal.tsx checks
    assert.match(
      addExamModalSrc,
      /type:\s*z\.literal\(["']QUIZ["']\)/,
      'AddExamModal.tsx schema must use z.literal("QUIZ")'
    );
    assert.ok(
      !addExamModalSrc.includes("selectedType === 'MIDTERM'"),
      'AddExamModal.tsx must not have MIDTERM selection card'
    );
    assert.ok(
      !addExamModalSrc.includes("selectedType === 'FINAL'"),
      'AddExamModal.tsx must not have FINAL selection card'
    );
  });

  test('7. AdminExamRecordView.tsx has a QUIZ option and no PRACTICAL', () => {
    assert.match(
      adminExamRecordViewSrc,
      /<option\s+value=["']QUIZ["']/,
      'AdminExamRecordView.tsx must include QUIZ filter option'
    );
    assert.ok(
      !adminExamRecordViewSrc.includes('value="PRACTICAL"'),
      'AdminExamRecordView.tsx must not include obsolete PRACTICAL option'
    );
  });

  test('8. enrollment.service.ts has no updateGrade method', () => {
    assert.ok(
      !/updateGrade\s*:/.test(enrollmentServiceSrc),
      'enrollment.service.ts must not contain updateGrade; grades are published via authoritative gradebookPublish service'
    );
  });

  test('9. TakeExam.tsx transitions to CANCELLED on leave timeout', () => {
    assert.ok(
      takeExamSrc.includes('setStatus("CANCELLED")') || takeExamSrc.includes("setStatus('CANCELLED')"),
      'TakeExam.tsx must transition to CANCELLED when leave grace expires'
    );
  });

  test('10. TakeExam.tsx uses resolveAttemptView and renders read-only cancelled view for CANCELLED_CHEATING', () => {
    assert.ok(
      takeExamSrc.includes('resolveAttemptView('),
      'TakeExam.tsx must use resolveAttemptView pure helper to map submission status'
    );
    assert.match(
      takeExamSrc,
      /status\s*===\s*["']CANCELLED["']/,
      'TakeExam.tsx must render dedicated view for CANCELLED submission status'
    );
    assert.ok(
      takeExamSrc.includes('attemptCancelled') || takeExamSrc.includes('examCancelledTitle'),
      'TakeExam.tsx must display a cancelled view message'
    );
    assert.ok(
      takeExamSrc.includes('canStartExam(') || /canStartExam|!hasSubmission|!submission/.test(takeExamSrc),
      'Start button must only render when there is no existing submission'
    );
  });
});
