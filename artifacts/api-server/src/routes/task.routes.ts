import express from 'express';
import {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  submitTask,
  gradeSubmission,
  getTaskSubmissions,
  getMySubmission,
} from '../controllers/task.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { taskValidation, functionalIdValidation } from '../validations/functional.validation';
import { body, param } from 'express-validator';
import validate from '../middleware/validate.middleware';

const router = express.Router();

router.use(protect);

router.post('/', authorize('DOCTOR'), taskValidation, validate, createTask);

router.get('/', getTasks);

router.put(
  '/:id',
  authorize('DOCTOR', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'),
  [
    ...functionalIdValidation,
    body('title').optional().trim(),
    body('description').optional(),
    body('dueDate').optional().isISO8601().withMessage('dueDate must be a valid ISO 8601 date'),
    body('maxScore').optional().isInt({ min: 1 }).withMessage('maxScore must be a positive integer'),
  ],
  validate,
  updateTask
);

router.delete(
  '/:id',
  authorize('DOCTOR', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'),
  functionalIdValidation,
  validate,
  deleteTask
);

router.post('/:id/submit', authorize('STUDENT'), functionalIdValidation, validate, submitTask);

router.put(
  '/:id/submissions/:sid/grade',
  authorize('DOCTOR', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'),
  [
    ...functionalIdValidation,
    param('sid').isInt().withMessage('Invalid submission ID'),
    body('score').isFloat({ min: 0 }).withMessage('Score must be a non-negative number'),
    body('feedback').optional().trim(),
  ],
  validate,
  gradeSubmission
);

router.get(
  '/:id/submissions',
  authorize('DOCTOR', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'),
  functionalIdValidation,
  validate,
  getTaskSubmissions
);

router.get(
  '/:id/submission',
  authorize('STUDENT'),
  functionalIdValidation,
  validate,
  getMySubmission
);

export default router;
