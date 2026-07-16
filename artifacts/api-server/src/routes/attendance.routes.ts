import express from 'express';
const router = express.Router();
import * as attendanceController from '../controllers/attendance.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { attendanceValidation } from '../validations/functional.validation';
import { param } from 'express-validator';
import validate from '../middleware/validate.middleware';

const adminOrTeacher = authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR', 'TEACHING_ASSISTANT');

router.get('/my-courses', protect, attendanceController.getMyCourses);
router.get('/my-attendance', protect, attendanceController.getMyAttendance);

router.get(
  '/records',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  attendanceController.getAttendanceRecords
);

router.post(
  '/',
  protect,
  adminOrTeacher,
  attendanceValidation,
  validate,
  attendanceController.recordAttendance
);

router.post(
  '/bulk',
  protect,
  adminOrTeacher,
  attendanceController.bulkSaveAttendance
);

router.get(
  '/course/:courseId',
  protect,
  adminOrTeacher,
  [param('courseId').isInt().withMessage('Invalid course ID')],
  validate,
  attendanceController.getCourseAttendance
);

router.get(
  '/summary/:courseId',
  protect,
  adminOrTeacher,
  [param('courseId').isInt().withMessage('Invalid course ID')],
  validate,
  attendanceController.getAttendanceSummary
);

router.get(
  '/student/:studentId',
  protect,
  [param('studentId').isInt().withMessage('Invalid student ID')],
  validate,
  attendanceController.getStudentAttendance
);

router.post(
  '/unblock/:enrollmentId',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  [param('enrollmentId').isInt().withMessage('Invalid enrollment ID')],
  validate,
  attendanceController.unblockEnrollment
);

export default router;
