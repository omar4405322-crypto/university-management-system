import express from 'express';
const router = express.Router();
import * as attendanceController from '../controllers/attendance.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { attendanceValidation } from '../validations/functional.validation.js';
import { param } from 'express-validator';
import validate from '../middleware/validate.middleware.js';

router.post('/', protect, authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR'), attendanceValidation, validate, attendanceController.recordAttendance);
router.get('/course/:courseId', protect, authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR'), [
  param('courseId').isInt().withMessage('Invalid course ID')
], validate, attendanceController.getCourseAttendance);
router.get('/student/:studentId', protect, [
  param('studentId').isInt().withMessage('Invalid student ID')
], validate, attendanceController.getStudentAttendance);

export default router;
