import { body, param } from 'express-validator';
import { passwordStrengthValidator } from '../utils/passwordPolicy';

export const registerValidation = [
  body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('password')
    .custom(passwordStrengthValidator),
  body('role')
    .optional()
    .isIn(['STUDENT', 'DOCTOR', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'])
    .withMessage('Invalid user role'),
  body('firstName').notEmpty().withMessage('First name is required').trim().isLength({ max: 50 }),
  body('lastName').notEmpty().withMessage('Last name is required').trim().isLength({ max: 50 }),
  // Conditional validation for students
  body('studentId')
    .if(body('role').equals('STUDENT'))
    .notEmpty()
    .withMessage('Student ID is required for students'),
  body('year')
    .if(body('role').equals('STUDENT'))
    .isInt({ min: 1, max: 4 })
    .withMessage('Valid academic division is required (1-4)'),
  body('departmentId').optional().isInt().withMessage('Department ID must be an integer'),
];

export const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

export const requestIdValidation = [param('id').isInt().withMessage('Invalid request ID')];
