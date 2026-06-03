const express = require('express');
const { 
  createQuiz, 
  getQuizzes, 
  getQuizById, 
  submitQuiz, 
  getQuizResults 
} = require('../controllers/quiz.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { quizValidation, functionalIdValidation } = require('../validations/functional.validation');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

router.use(protect);

router.post('/', authorize('DOCTOR'), quizValidation, validate, createQuiz);
router.get('/', getQuizzes);
router.get('/:id', functionalIdValidation, validate, getQuizById);
router.post('/:id/submit', authorize('STUDENT'), functionalIdValidation, validate, submitQuiz);
router.get('/:id/results', authorize('DOCTOR', 'SUPER_ADMIN'), functionalIdValidation, validate, getQuizResults);

module.exports = router;
