import { body, param } from 'express-validator';

export const academicYearValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Academic year name is required')
    .isLength({ max: 50 })
    .withMessage('Academic year name cannot exceed 50 characters'),
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((endDate, { req }) => {
      const startDate = req.body.startDate;
      if (startDate && new Date(endDate) <= new Date(startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
];

export const academicTermValidation = [
  body('academicYearId')
    .notEmpty()
    .withMessage('Academic year ID is required')
    .isInt({ min: 1 })
    .withMessage('Academic year ID must be a positive integer')
    .toInt(),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Term name is required')
    .isLength({ max: 100 })
    .withMessage('Term name cannot exceed 100 characters'),
  body('termType')
    .optional()
    .isIn(['FALL', 'SPRING', 'SUMMER'])
    .withMessage('Term type must be FALL, SPRING, or SUMMER'),
  body('semesterNumber')
    .notEmpty()
    .withMessage('Semester number is required')
    .isInt({ min: 1, max: 3 })
    .withMessage('Semester number must be 1, 2, or 3')
    .toInt(),
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((endDate, { req }) => {
      const startDate = req.body.startDate;
      if (startDate && new Date(endDate) <= new Date(startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
];

export const termIdParamValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid term ID').toInt(),
];

export const yearIdParamValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid academic year ID').toInt(),
];
