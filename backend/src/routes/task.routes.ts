import express from 'express';
import { createTask, 
  getTasks, 
  submitTask, 
  gradeSubmission, 
  getTaskSubmissions } from '../controllers/task.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { taskValidation, functionalIdValidation } from '../validations/functional.validation.js';
import { body, param } from 'express-validator';
import validate from '../middleware/validate.middleware.js';

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

export default router;
