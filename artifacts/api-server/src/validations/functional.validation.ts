import { body, param } from 'express-validator';

export const quizValidation = [
  body('title').notEmpty().withMessage('Quiz title is required').trim(),
  body('courseId').isInt().withMessage('Course ID must be an integer'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
  body('questions').isArray({ min: 1 }).withMessage('At least one question is required'),
  body('questions.*.text').notEmpty().withMessage('Question text is required'),
  body('questions.*.optionA').notEmpty().withMessage('Option A is required'),
  body('questions.*.optionB').notEmpty().withMessage('Option B is required'),
  body('questions.*.optionC').notEmpty().withMessage('Option C is required'),
  body('questions.*.optionD').notEmpty().withMessage('Option D is required'),
  body('questions.*.correct')
    .isIn(['A', 'B', 'C', 'D'])
    .withMessage('Correct option must be A, B, C, or D'),
  body('questions.*.points').optional().isInt({ min: 1 }),
];

export const taskValidation = [
  body('title').notEmpty().withMessage('Task title is required').trim(),
  body('description').notEmpty().withMessage('Description is required'),
  body('courseId').isInt().withMessage('Course ID must be an integer'),
  body('dueDate').isISO8601().withMessage('Valid due date is required'),
  body('maxScore').optional().isInt({ min: 1 }),
];

export const paymentValidation = [
  body('studentId').isInt().withMessage('Student ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('type')
    .isIn(['TUITION', 'REGISTRATION', 'LIBRARY', 'OTHER'])
    .withMessage('Invalid payment type'),
  body('description').optional().trim(),
  body('dueDate').optional().isISO8601(),
];

export const attendanceValidation = [
  body('courseId').isInt().withMessage('Course ID is required'),
  body('date').optional().isISO8601(),
  body('records').isArray().withMessage('Records must be an array'),
  body('records.*.studentId').isInt().withMessage('Student ID is required'),
  body('records.*.status')
    .isIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
    .withMessage('Invalid status'),
];

export const functionalIdValidation = [param('id').isInt().withMessage('Invalid ID format')];

const VALID_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export const scheduleValidation = [
  body('dayOfWeek')
    .isIn(VALID_DAYS)
    .withMessage('Invalid day of week. Use uppercase: MONDAY, TUESDAY, etc.'),
  body('startTime')
    .matches(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format (24-hour)'),
  body('endTime')
    .matches(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format (24-hour)')
    .custom((endTime, { req }) => {
      if (req.body.startTime && endTime <= req.body.startTime) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),

  body('room')
    .optional()
    .isString()
    .trim()
    .customSanitizer(val => val.toUpperCase()),
];

export const overrideValidation = [
  body('dayOfWeek')
    .optional()
    .isIn(VALID_DAYS)
    .withMessage('Invalid day of week. Use uppercase: MONDAY, TUESDAY, etc.'),
  body('startTime')
    .optional()
    .matches(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format (24-hour)'),
  body('endTime')
    .optional()
    .matches(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format (24-hour)')
    .custom((endTime, { req }) => {
      if (req.body.startTime && endTime <= req.body.startTime) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required').custom((endDate, { req }) => {
    if (new Date(endDate) < new Date(req.body.startDate)) {
      throw new Error('End date must be after or equal to start date');
    }
    return true;
  }),
  body('room')
    .optional()
    .isString()
    .trim()
    .customSanitizer(val => val.toUpperCase()),
];
