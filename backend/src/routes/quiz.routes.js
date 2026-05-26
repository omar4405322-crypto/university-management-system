const express = require('express');
const { 
  createQuiz, 
  getQuizzes, 
  getQuizById, 
  submitQuiz, 
  getQuizResults 
} = require('../controllers/quiz.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect);

router.post('/', authorize('DOCTOR'), createQuiz);
router.get('/', getQuizzes);
router.get('/:id', getQuizById);
router.post('/:id/submit', authorize('STUDENT'), submitQuiz);
router.get('/:id/results', authorize('DOCTOR', 'SUPER_ADMIN'), getQuizResults);

module.exports = router;
