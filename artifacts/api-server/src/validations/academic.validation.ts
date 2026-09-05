import { body, param } from 'express-validator';
import { passwordStrengthValidator } from '../utils/passwordPolicy';

export const studentValidation = [
  body('firstName').notEmpty().withMessage('First name is required').trim(),
  body('lastName').notEmpty().withMessage('Last name is required').trim(),
  body('studentId').notEmpty().withMessage('Student ID is required').trim(),
  body('year').isInt({ min: 1, max: 4 }).withMessage('Valid academic division is required (1-4)'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('departmentId').isInt().withMessage('Department ID must be an integer'),
  body('password').optional().custom(passwordStrengthValidator),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender'),
  body('birthDate').optional().isISO8601().withMessage('Invalid birth date format'),
];

export const studentUpdateValidation = [
  body('firstName').optional().notEmpty().withMessage('First name cannot be empty').trim(),
  body('lastName').optional().notEmpty().withMessage('Last name cannot be empty').trim(),
  body('studentId').optional().notEmpty().withMessage('Student ID cannot be empty').trim(),
  body('year').optional().isInt({ min: 1, max: 4 }).withMessage('Valid academic division is required (1-4)'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('departmentId').optional({ checkFalsy: true }).isInt().withMessage('Department ID must be an integer'),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender'),
  body('birthDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid birth date format'),
];

export const courseValidation = [
  body('courseCode').notEmpty().withMessage('Course code is required').trim(),
  body('name').notEmpty().withMessage('Course name is required').trim(),
  body('credits').isInt({ min: 1, max: 10 }).withMessage('Credits must be between 1 and 10'),
  body('departmentId').isInt().withMessage('Department ID must be an integer'),
  body('password').custom(passwordStrengthValidator),
  body('doctorId').optional().isInt().withMessage('Doctor ID must be an integer'),
  body('description').optional().trim(),
  body('maxStudents').optional().isInt({ min: 1 }).withMessage('Max students must be at least 1'),
  body('year').optional().isInt({ min: 1, max: 4 }),
  body('semester').optional().isInt({ min: 1, max: 3 }),
];

export const courseUpdateValidation = [
  body('courseCode').optional().notEmpty().withMessage('Course code cannot be empty').trim(),
  body('name').optional().notEmpty().withMessage('Course name cannot be empty').trim(),
  body('credits').optional().isInt({ min: 1, max: 10 }).withMessage('Credits must be between 1 and 10'),
  body('departmentId').optional({ checkFalsy: true }).isInt().withMessage('Department ID must be an integer'),
  body('doctorId').optional({ checkFalsy: true }).isInt().withMessage('Doctor ID must be an integer'),
  body('description').optional().trim(),
  body('maxStudents').optional().isInt({ min: 1 }).withMessage('Max students must be at least 1'),
  body('year').optional().isInt({ min: 1, max: 4 }),
  body('semester').optional().isInt({ min: 1, max: 3 }),
];

export const doctorValidation = [
  body('firstName').notEmpty().withMessage('First name is required').trim(),
  body('lastName').notEmpty().withMessage('Last name is required').trim(),
  body('doctorId').notEmpty().withMessage('Doctor ID is required').trim(),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('departmentId').isInt().withMessage('Department ID must be an integer'),
  body('specialty').optional().trim(),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender'),
];

export const doctorUpdateValidation = [
  body('firstName').optional().notEmpty().withMessage('First name cannot be empty').trim(),
  body('lastName').optional().notEmpty().withMessage('Last name cannot be empty').trim(),
  body('doctorId').optional().notEmpty().withMessage('Doctor ID cannot be empty').trim(),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('departmentId').optional({ checkFalsy: true }).isInt().withMessage('Department ID must be an integer'),
  body('specialty').optional().trim(),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('bio').optional().trim(),
  body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender'),
];

export const idParamValidation = [param('id').isInt().withMessage('Invalid ID format')];
