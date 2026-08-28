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

export const adminCreateValidation = [
  body('email').isEmail().withMessage('Invalid email format').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 100 })
    .withMessage('First name cannot exceed 100 characters')
    .matches(/[a-zA-Z\u0600-\u06FF]/)
    .withMessage('First name must contain alphabetic characters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 100 })
    .withMessage('Last name cannot exceed 100 characters')
    .matches(/[a-zA-Z\u0600-\u06FF]/)
    .withMessage('Last name must contain alphabetic characters'),
  body('role')
    .isIn(['ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'])
    .withMessage('Invalid role'),
  body('collegeId').optional().isInt(),
  body('departmentId').optional().isInt(),
  body('managedCollegeId').custom((value, { req }) => {
    if (req.body.role === 'COLLEGE_ADMIN' || req.body.role === 'ADMIN') {
      if (value === undefined || value === null || value === '') {
        throw new Error('managedCollegeId is required for this role');
      }
      const parsed = parseInt(value as string, 10);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('managedCollegeId must be a positive integer');
      }
    }
    return true;
  }),
  body('managedDepartmentId').custom((value, { req }) => {
    if (req.body.role === 'DEPARTMENT_ADMIN') {
      if (value === undefined || value === null || value === '') {
        throw new Error('managedDepartmentId is required for this role');
      }
      const parsed = parseInt(value as string, 10);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('managedDepartmentId must be a positive integer');
      }
    }
    return true;
  }),
];

export const adminUpdateValidation = [
  body('email').optional().isEmail().withMessage('Invalid email format').normalizeEmail(),
  body('role')
    .optional()
    .isIn(['ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'])
    .withMessage('Invalid role'),
  body('managedCollegeId').custom((value, { req }) => {
    if (req.body.role === 'COLLEGE_ADMIN' || req.body.role === 'ADMIN') {
      if (value === undefined || value === null || value === '') {
        throw new Error('managedCollegeId is required for this role');
      }
      const parsed = parseInt(value as string, 10);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('managedCollegeId must be a positive integer');
      }
    }
    return true;
  }),
  body('managedDepartmentId').custom((value, { req }) => {
    if (req.body.role === 'DEPARTMENT_ADMIN') {
      if (value === undefined || value === null || value === '') {
        throw new Error('managedDepartmentId is required for this role');
      }
      const parsed = parseInt(value as string, 10);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('managedDepartmentId must be a positive integer');
      }
    }
    return true;
  }),
];
