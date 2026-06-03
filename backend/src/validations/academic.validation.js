const { body, param } = require('express-validator');

const studentValidation = [
  body('firstName').notEmpty().withMessage('First name is required').trim(),
  body('lastName').notEmpty().withMessage('Last name is required').trim(),
  body('studentId').notEmpty().withMessage('Student ID is required').trim(),
  body('year').isInt({ min: 1, max: 7 }).withMessage('Valid academic year is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('departmentId').isInt().withMessage('Department ID must be an integer'),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender'),
  body('birthDate').optional().isISO8601().withMessage('Invalid birth date format')
];

const courseValidation = [
  body('courseCode').notEmpty().withMessage('Course code is required').trim(),
  body('name').notEmpty().withMessage('Course name is required').trim(),
  body('credits').isInt({ min: 1, max: 10 }).withMessage('Credits must be between 1 and 10'),
  body('departmentId').isInt().withMessage('Department ID must be an integer'),
  body('doctorId').optional().isInt().withMessage('Doctor ID must be an integer'),
  body('description').optional().trim(),
  body('maxStudents').optional().isInt({ min: 1 }).withMessage('Max students must be at least 1'),
  body('year').optional().isInt({ min: 1, max: 7 }),
  body('semester').optional().isInt({ min: 1, max: 3 })
];

const doctorValidation = [
  body('firstName').notEmpty().withMessage('First name is required').trim(),
  body('lastName').notEmpty().withMessage('Last name is required').trim(),
  body('doctorId').notEmpty().withMessage('Doctor ID is required').trim(),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('departmentId').isInt().withMessage('Department ID must be an integer'),
  body('specialty').optional().trim(),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender')
];

const idParamValidation = [
  param('id').isInt().withMessage('Invalid ID format')
];

module.exports = {
  studentValidation,
  courseValidation,
  doctorValidation,
  idParamValidation
};
