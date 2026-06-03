const { body, param } = require('express-validator');

const collegeValidation = [
  body('name').notEmpty().withMessage('College name is required').trim(),
  body('nameAr').optional().trim(),
  body('description').optional().trim()
];

const departmentValidation = [
  body('name').notEmpty().withMessage('Department name is required').trim(),
  body('nameAr').optional().trim(),
  body('collegeId').isInt().withMessage('College ID must be an integer')
];

const userUpdateValidation = [
  body('email').optional().isEmail().withMessage('Invalid email format').normalizeEmail(),
  body('role').optional().isIn(['STUDENT', 'DOCTOR', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN']),
  body('firstName').optional().trim().isLength({ max: 50 }),
  body('lastName').optional().trim().isLength({ max: 50 }),
  body('phone').optional().trim(),
  body('address').optional().trim()
];

const adminIdValidation = [
  param('id').isInt().withMessage('Invalid ID format')
];

module.exports = {
  collegeValidation,
  departmentValidation,
  userUpdateValidation,
  adminIdValidation
};
