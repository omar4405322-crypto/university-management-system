import express from 'express';
const router = express.Router();
import * as examsController from '../controllers/exams.controller';
import { authorize } from '../middleware/auth.middleware';
import { body, param } from 'express-validator';
import validate from '../middleware/validate.middleware';
import {
  isBoundedAnswerCollection,
  isBoundedAntiCheatLogCollection,
  MAX_EXAM_CANCEL_REASON_LENGTH,
} from '../utils/requestLimits';

router.get('/', examsController.getAllExams);
router.get('/upcoming', examsController.getUpcomingExams);
router.get(
  '/:id',
  [param('id').isInt().withMessage('Invalid exam ID')],
  validate,
  examsController.getExamById
);

const createExamValidation = [
  body('courseId').isInt().withMessage('Course ID must be an integer'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('startTime').notEmpty().withMessage('Start time is required'),
  body('endTime').notEmpty().withMessage('End time is required'),
  body('room').optional().trim(),
  body('location').optional().trim(),
  body('type').optional().isIn(['MIDTERM', 'FINAL', 'QUIZ']),
];

const updateExamValidation = [
  param('id').isInt().withMessage('Invalid exam ID'),
  body('date').optional().isISO8601().withMessage('Valid date is required'),
  body('startTime').optional().notEmpty().withMessage('Start time is required'),
  body('endTime').optional().notEmpty().withMessage('End time is required'),
  body('room').optional().trim(),
  body('type').optional().isIn(['MIDTERM', 'FINAL', 'QUIZ']),
];

router.post(
  '/',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR'),
  createExamValidation,
  validate,
  examsController.createExam
);
router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR'),
  updateExamValidation,
  validate,
  examsController.updateExam
);
router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR'),
  [param('id').isInt().withMessage('Invalid exam ID')],
  validate,
  examsController.deleteExam
);

const addExamQuestionValidation = [
  param('id').isInt().withMessage('Invalid exam ID'),
  body('text').notEmpty().withMessage('Question text is required').trim(),
  body('type').optional().isIn(['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER']).withMessage('Invalid question type'),
  body('optionA').optional().trim(),
  body('optionB').optional().trim(),
  body('optionC').optional().trim(),
  body('optionD').optional().trim(),
  body('correctAnswer').notEmpty().withMessage('Correct answer is required').trim(),
  body('points').optional().isInt({ min: 1 }).withMessage('Points must be a positive integer'),
  body('order').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative integer'),
];

const updateExamQuestionValidation = [
  param('questionId').isInt().withMessage('Invalid question ID'),
  body('text').optional().notEmpty().withMessage('Question text cannot be empty').trim(),
  body('type').optional().isIn(['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER']).withMessage('Invalid question type'),
  body('optionA').optional().trim(),
  body('optionB').optional().trim(),
  body('optionC').optional().trim(),
  body('optionD').optional().trim(),
  body('correctAnswer').optional().notEmpty().withMessage('Correct answer cannot be empty').trim(),
  body('points').optional().isInt({ min: 1 }).withMessage('Points must be a positive integer'),
  body('order').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative integer'),
];

// --- EXAM QUESTIONS ---
router.get('/:id/questions', authorize('STUDENT', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), examsController.getExamQuestions);
router.post('/:id/questions', authorize('DOCTOR', 'ADMIN'), addExamQuestionValidation, validate, examsController.addExamQuestion);
router.put('/questions/:questionId', authorize('DOCTOR', 'ADMIN'), updateExamQuestionValidation, validate, examsController.updateExamQuestion);
router.delete('/questions/:questionId', authorize('DOCTOR', 'ADMIN'), examsController.deleteExamQuestion);

// --- EXAM SESSIONS & SUBMISSIONS ---
router.post('/:id/start', authorize('STUDENT'), examsController.startExamSession);
const examSubmissionLimits = [
  param('id').isInt({ min: 1 }).withMessage('Invalid exam ID'),
  body('answers')
    .custom(isBoundedAnswerCollection)
    .withMessage('Answers must contain at most 200 bounded question responses'),
  body('antiCheatLogs')
    .optional()
    .custom(isBoundedAntiCheatLogCollection)
    .withMessage('Anti-cheat logs exceed the allowed size or format'),
];

router.post(
  '/:id/submit',
  authorize('STUDENT'),
  examSubmissionLimits,
  validate,
  examsController.submitExam
);
router.post(
  '/:id/cancel',
  authorize('STUDENT'),
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid exam ID'),
    body('answers')
      .optional()
      .custom(isBoundedAnswerCollection)
      .withMessage('Answers must contain at most 200 bounded question responses'),
    body('antiCheatLogs')
      .optional()
      .custom(isBoundedAntiCheatLogCollection)
      .withMessage('Anti-cheat logs exceed the allowed size or format'),
    body('reason')
      .optional()
      .isString()
      .isLength({ max: MAX_EXAM_CANCEL_REASON_LENGTH })
      .withMessage('Cancellation reason is too long'),
  ],
  validate,
  examsController.cancelExam
);
router.get('/:id/submissions', authorize('DOCTOR', 'ADMIN', 'SUPER_ADMIN'), examsController.getExamSubmissions);
router.get('/:id/my-submission', authorize('STUDENT'), examsController.getMyExamSubmission);
router.put('/submissions/:submissionId/grade', authorize('DOCTOR', 'ADMIN', 'SUPER_ADMIN'), examsController.gradeSubmission);

export default router;
