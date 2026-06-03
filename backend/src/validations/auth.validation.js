const { body, param } = require('express-validator');

const registerValidation = [
  body('email')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter'),
  body('role')
    .isIn(['STUDENT', 'DOCTOR', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'])
    .withMessage('Invalid user role'),
  body('firstName')
    .notEmpty().withMessage('First name is required')
    .trim()
    .isLength({ max: 50 }),
  body('lastName')
    .notEmpty().withMessage('Last name is required')
    .trim()
    .isLength({ max: 50 }),
  // Conditional validation for students
  body('studentId').if(body('role').equals('STUDENT'))
    .notEmpty().withMessage('Student ID is required for students'),
  body('year').if(body('role').equals('STUDENT'))
    .isInt({ min: 1, max: 7 }).withMessage('Valid academic year is required'),
  body('departmentId')
    .optional()
    .isInt().withMessage('Department ID must be an integer')
];

const loginValidation = [
  body('email')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
];

const requestIdValidation = [
  param('id')
    .isInt().withMessage('Invalid request ID')
];

module.exports = {
  registerValidation,
  loginValidation,
  requestIdValidation
};
