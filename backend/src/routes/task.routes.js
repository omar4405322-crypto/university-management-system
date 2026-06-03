const express = require('express');
const { 
  createTask, 
  getTasks, 
  submitTask, 
  gradeSubmission, 
  getTaskSubmissions 
} = require('../controllers/task.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { taskValidation, functionalIdValidation } = require('../validations/functional.validation');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

router.use(protect);

router.post('/', authorize('DOCTOR'), taskValidation, validate, createTask);
router.get('/', getTasks);
router.post('/:id/submit', authorize('STUDENT'), functionalIdValidation, validate, submitTask);
router.put('/:id/submissions/:sid/grade', authorize('DOCTOR'), [
  ...functionalIdValidation,
  param('sid').isInt().withMessage('Invalid submission ID'),
  body('score').isInt({ min: 0 }).withMessage('Score must be at least 0'),
  body('feedback').optional().trim()
], validate, gradeSubmission);
router.get('/:id/submissions', authorize('DOCTOR', 'SUPER_ADMIN'), functionalIdValidation, validate, getTaskSubmissions);

module.exports = router;
