import { body, param } from 'express-validator';

export const collegeValidation = [
  body('name').notEmpty().withMessage('College name is required').trim(),
  body('nameAr').optional().trim(),
  body('description').optional().trim(),
];

export const departmentValidation = [
  body('name').notEmpty().withMessage('Department name is required').trim(),
  body('nameAr').optional().trim(),
  body('collegeId').isInt().withMessage('College ID must be an integer'),
];

export const userUpdateValidation = [
  body('email').optional().isEmail().withMessage('Invalid email format').normalizeEmail(),
  body('role')
    .optional()
    .isIn(['STUDENT', 'DOCTOR', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN']),
  body('firstName').optional().trim().isLength({ max: 50 }),
  body('lastName').optional().trim().isLength({ max: 50 }),
  body('phone').optional().trim(),
  body('address').optional().trim(),
];

export const adminIdValidation = [param('id').isInt().withMessage('Invalid ID format')];
