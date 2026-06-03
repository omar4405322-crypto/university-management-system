const express = require('express');
const router = express.Router();
const examsController = require('../controllers/exams.controller');
const { authorize } = require('../middleware/auth.middleware');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate.middleware');

router.get('/', examsController.getAllExams);
router.get('/upcoming', examsController.getUpcomingExams);
router.get('/:id', [
  param('id').isInt().withMessage('Invalid exam ID')
], validate, examsController.getExamById);

const createExamValidation = [
  body('courseId').isInt().withMessage('Course ID must be an integer'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('startTime').notEmpty().withMessage('Start time is required'),
  body('endTime').notEmpty().withMessage('End time is required'),
  body('room').optional().trim(),
  body('location').optional().trim(),
  body('type').optional().isIn(['MIDTERM', 'FINAL', 'QUIZ']),
];

const updateExamValidation = [
  param('id').isInt().withMessage('Invalid exam ID'),
  body('date').optional().isISO8601().withMessage('Valid date is required'),
  body('startTime').optional().notEmpty().withMessage('Start time is required'),
  body('endTime').optional().notEmpty().withMessage('End time is required'),
  body('room').optional().trim(),
  body('type').optional().isIn(['MIDTERM', 'FINAL', 'QUIZ']),
];

router.post('/', authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), createExamValidation, validate, examsController.createExam);
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN'), updateExamValidation, validate, examsController.updateExam);
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), [
  param('id').isInt().withMessage('Invalid exam ID')
], validate, examsController.deleteExam);

module.exports = router;
