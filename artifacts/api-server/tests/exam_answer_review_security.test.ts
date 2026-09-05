import assert from 'node:assert/strict';
import {
  canStudentReviewExamAnswers,
  STUDENT_EXAM_QUESTION_SELECT,
  STUDENT_EXAM_REVIEW_QUESTION_SELECT,
} from '../src/utils/examAnswerReview.utils';

function runExamAnswerReviewSecurityTests() {
  console.log('--- Starting Exam Answer Review Security Verification Suite ---');

  const exam = {
    date: new Date('2026-09-05T00:00:00.000Z'),
    endTime: '12:00',
  };
  const beforeExamEnd = new Date('2026-09-05T08:59:59.000Z');
  const atExamEnd = new Date('2026-09-05T09:00:00.000Z');

  assert.equal(
    canStudentReviewExamAnswers('PENDING', exam, atExamEnd),
    false,
    'An in-progress submission must never be reviewable, even after the exam ends'
  );
  assert.equal(
    canStudentReviewExamAnswers('CANCELLED_CHEATING', exam, atExamEnd),
    false,
    'A cancelled submission must never be treated as successfully completed'
  );
  assert.equal(
    canStudentReviewExamAnswers('GRADED', exam, beforeExamEnd),
    false,
    'A completed submission must not be reviewable before the scheduled exam end'
  );
  assert.equal(
    canStudentReviewExamAnswers('GRADED', exam, atExamEnd),
    true,
    'A completed submission must be reviewable once the scheduled exam end is reached'
  );
  assert.equal(
    canStudentReviewExamAnswers('GRADED', { ...exam, endTime: 'invalid' }, atExamEnd),
    false,
    'An invalid exam end time must fail closed'
  );

  assert.equal(
    Object.hasOwn(STUDENT_EXAM_QUESTION_SELECT, 'correctAnswer'),
    false,
    'The pre-review question projection must not request correctAnswer'
  );
  assert.deepEqual(
    Object.keys(STUDENT_EXAM_QUESTION_SELECT).sort(),
    [
      'examId',
      'id',
      'optionA',
      'optionB',
      'optionC',
      'optionD',
      'order',
      'points',
      'text',
      'type',
    ],
    'The pre-review projection must remain an explicit whitelist of non-key fields'
  );
  assert.equal(
    STUDENT_EXAM_REVIEW_QUESTION_SELECT.correctAnswer,
    true,
    'The post-review projection must explicitly request correctAnswer'
  );

  console.log('✓ Exam answer review security checks passed');
}

runExamAnswerReviewSecurityTests();
