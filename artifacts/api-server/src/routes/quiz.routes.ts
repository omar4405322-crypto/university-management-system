import express from 'express';
import {
  createQuiz,
  getQuizzes,
  getQuizById,
  submitQuiz,
  getQuizResults,
} from '../controllers/quiz.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { quizValidation, functionalIdValidation } from '../validations/functional.validation';
import validate from '../middleware/validate.middleware';
import { body } from 'express-validator';
import { isBoundedAnswerCollection } from '../utils/requestLimits';

const router = express.Router();

router.use(protect);

router.post('/', authorize('DOCTOR'), quizValidation, validate, createQuiz);
router.get('/', getQuizzes);
router.get('/:id', functionalIdValidation, validate, getQuizById);
router.post(
  '/:id/submit',
  authorize('STUDENT'),
  functionalIdValidation,
  body('answers')
    .custom(isBoundedAnswerCollection)
    .withMessage('Answers must contain at most 200 bounded question responses'),
  validate,
  submitQuiz
);
router.get(
  '/:id/results',
  authorize('DOCTOR', 'SUPER_ADMIN'),
  functionalIdValidation,
  validate,
  getQuizResults
);

export default router;
