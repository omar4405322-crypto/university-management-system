import express from 'express';
import {
  createQuiz,
  getQuizzes,
  getQuizById,
  addQuestionToQuiz,
  submitQuiz,
  getQuizResults,
  gradeQuizSubmission,
} from '../controllers/quiz.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { quizValidation, functionalIdValidation } from '../validations/functional.validation';
import validate from '../middleware/validate.middleware';

const router = express.Router();

router.use(protect);

// Quiz CRUD
router.post('/', authorize('DOCTOR', 'SUPER_ADMIN'), quizValidation, validate, createQuiz);
router.get('/', getQuizzes);
router.get('/:id', functionalIdValidation, validate, getQuizById);

// Question management — add a single question to an existing quiz
router.post(
  '/:id/questions',
  authorize('DOCTOR', 'SUPER_ADMIN'),
  functionalIdValidation,
  validate,
  addQuestionToQuiz
);

// Student submission
router.post('/:id/submit', authorize('STUDENT'), functionalIdValidation, validate, submitQuiz);

// Doctor / Admin results
router.get(
  '/:id/results',
  authorize('DOCTOR', 'SUPER_ADMIN'),
  functionalIdValidation,
  validate,
  getQuizResults
);

// Doctor / Admin manual grading for Essay / File Upload answers
router.put(
  '/:id/submissions/:submissionId/grade',
  authorize('DOCTOR', 'SUPER_ADMIN'),
  functionalIdValidation,
  validate,
  gradeQuizSubmission
);

export default router;
