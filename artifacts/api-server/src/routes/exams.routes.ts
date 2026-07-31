import express from 'express';
const router = express.Router();
import * as examsController from '../controllers/exams.controller';
import { authorize } from '../middleware/auth.middleware';
import { body, param } from 'express-validator';
import validate from '../middleware/validate.middleware';

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
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  createExamValidation,
  validate,
  examsController.createExam
);
router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN'),
  updateExamValidation,
  validate,
  examsController.updateExam
);
router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN'),
  [param('id').isInt().withMessage('Invalid exam ID')],
  validate,
  examsController.deleteExam
);

// --- EXAM QUESTIONS ---
router.get('/:id/questions', authorize('STUDENT', 'DOCTOR', 'ADMIN'), examsController.getExamQuestions);
router.post('/:id/questions', authorize('DOCTOR', 'ADMIN'), examsController.addExamQuestion);
router.put('/questions/:questionId', authorize('DOCTOR', 'ADMIN'), examsController.updateExamQuestion);
router.delete('/questions/:questionId', authorize('DOCTOR', 'ADMIN'), examsController.deleteExamQuestion);

// --- EXAM SESSIONS & SUBMISSIONS ---
router.post('/:id/start', authorize('STUDENT'), examsController.startExamSession);
router.post('/:id/submit', authorize('STUDENT'), examsController.submitExam);
router.get('/:id/submissions', authorize('DOCTOR', 'ADMIN', 'SUPER_ADMIN'), examsController.getExamSubmissions);
router.get('/:id/my-submission', authorize('STUDENT'), examsController.getMyExamSubmission);
router.put('/submissions/:submissionId/grade', authorize('DOCTOR', 'ADMIN', 'SUPER_ADMIN'), examsController.gradeSubmission);

export default router;
