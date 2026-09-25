import { body, param } from 'express-validator';
import { passwordStrengthValidator } from '../utils/passwordPolicy';

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
    .custom(passwordStrengthValidator),
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
    if (req.body.role === 'COLLEGE_ADMIN') {
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
  body().custom((body) => {
    if (body.role === 'ADMIN') {
      const hasCollege =
        (body.managedCollegeId && !isNaN(parseInt(body.managedCollegeId as string, 10)) && parseInt(body.managedCollegeId as string, 10) > 0) ||
        (body.collegeId && !isNaN(parseInt(body.collegeId as string, 10)) && parseInt(body.collegeId as string, 10) > 0);
      const hasDept =
        (body.managedDepartmentId && !isNaN(parseInt(body.managedDepartmentId as string, 10)) && parseInt(body.managedDepartmentId as string, 10) > 0) ||
        (body.departmentId && !isNaN(parseInt(body.departmentId as string, 10)) && parseInt(body.departmentId as string, 10) > 0);

      if (!hasCollege && !hasDept) {
        throw new Error('An ADMIN user must have an assigned college or department');
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
    if (req.body.role === 'COLLEGE_ADMIN') {
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
  body().custom((body) => {
    if (body.role === 'ADMIN') {
      const hasCollege =
        (body.managedCollegeId && !isNaN(parseInt(body.managedCollegeId as string, 10)) && parseInt(body.managedCollegeId as string, 10) > 0) ||
        (body.collegeId && !isNaN(parseInt(body.collegeId as string, 10)) && parseInt(body.collegeId as string, 10) > 0);
      const hasDept =
        (body.managedDepartmentId && !isNaN(parseInt(body.managedDepartmentId as string, 10)) && parseInt(body.managedDepartmentId as string, 10) > 0) ||
        (body.departmentId && !isNaN(parseInt(body.departmentId as string, 10)) && parseInt(body.departmentId as string, 10) > 0);

      if (body.managedCollegeId !== undefined || body.collegeId !== undefined || body.managedDepartmentId !== undefined || body.departmentId !== undefined) {
        if (!hasCollege && !hasDept) {
          throw new Error('An ADMIN user must have an assigned college or department');
        }
      }
    }
    return true;
  }),
];
