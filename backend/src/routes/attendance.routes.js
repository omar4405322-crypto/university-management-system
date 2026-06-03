const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { attendanceValidation } = require('../validations/functional.validation');
const { param } = require('express-validator');
const validate = require('../middleware/validate.middleware');

router.post('/', protect, authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR'), attendanceValidation, validate, attendanceController.recordAttendance);
router.get('/course/:courseId', protect, authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR'), [
  param('courseId').isInt().withMessage('Invalid course ID')
], validate, attendanceController.getCourseAttendance);
router.get('/student/:studentId', protect, [
  param('studentId').isInt().withMessage('Invalid student ID')
], validate, attendanceController.getStudentAttendance);

module.exports = router;
