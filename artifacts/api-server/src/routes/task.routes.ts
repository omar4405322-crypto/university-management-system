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
import { body, param, query } from 'express-validator';
import validate from '../middleware/validate.middleware';

const router = express.Router();

router.use(protect);

router.post('/', authorize('DOCTOR'), taskValidation, validate, createTask);

router.get(
  '/',
  [
    query('courseId').optional().isInt({ min: 1 }).withMessage('courseId must be a positive integer'),
    query('status')
      .optional()
      .isIn(['ACTIVE', 'OVERDUE'])
      .withMessage('status must be one of: ACTIVE, OVERDUE'),
    query('dueFrom')
      .optional()
      .isISO8601()
      .withMessage('dueFrom must be a valid ISO 8601 date'),
    query('dueTo')
      .optional()
      .isISO8601()
      .withMessage('dueTo must be a valid ISO 8601 date'),
    query('sortBy')
      .optional()
      .isIn([
        'DUE_DATE_ASC',
        'DUE_DATE_DESC',
        'CREATED_AT_ASC',
        'CREATED_AT_DESC',
        'SUBMISSIONS_COUNT_ASC',
        'SUBMISSIONS_COUNT_DESC',
      ])
      .withMessage(
        'sortBy must be one of: DUE_DATE_ASC, DUE_DATE_DESC, CREATED_AT_ASC, CREATED_AT_DESC, SUBMISSIONS_COUNT_ASC, SUBMISSIONS_COUNT_DESC'
      ),
    query('search').optional().trim(),
  ],
  validate,
  getTasks
);

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
  [
    ...functionalIdValidation,
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('limit must be an integer between 1 and 100'),
    query('search').optional().trim(),
    query('status')
      .optional()
      .isIn(['ALL', 'SUBMITTED', 'GRADED', 'UNGRADED', 'LATE', 'NOT_SUBMITTED'])
      .withMessage(
        'status must be one of: ALL, SUBMITTED, GRADED, UNGRADED, LATE, NOT_SUBMITTED'
      ),
    query('studentYear')
      .optional()
      .isInt({ min: 1 })
      .withMessage('studentYear must be a positive integer'),
  ],
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
