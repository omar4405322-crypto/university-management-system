import express from 'express';
import { createQuiz, 
  getQuizzes, 
  getQuizById, 
  submitQuiz, 
  getQuizResults } from '../controllers/quiz.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { quizValidation, functionalIdValidation } from '../validations/functional.validation.js';
import validate from '../middleware/validate.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('DOCTOR'), quizValidation, validate, createQuiz);
router.get('/', getQuizzes);
router.get('/:id', functionalIdValidation, validate, getQuizById);
router.post('/:id/submit', authorize('STUDENT'), functionalIdValidation, validate, submitQuiz);
router.get('/:id/results', authorize('DOCTOR', 'SUPER_ADMIN'), functionalIdValidation, validate, getQuizResults);

export default router;
