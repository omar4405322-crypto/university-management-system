import express from 'express';
const router = express.Router();
import * as attendanceController from '../controllers/attendance.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { attendanceValidation } from '../validations/functional.validation';
import { param, query } from 'express-validator';
import validate from '../middleware/validate.middleware';

const attendanceIdParam = [param('id').isInt().withMessage('Invalid attendance ID')];
const courseIdParam = [param('courseId').isInt().withMessage('Invalid course ID')];
const studentIdParam = [param('studentId').isInt().withMessage('Invalid student ID')];
const dateRequiredQuery = [query('date').notEmpty().withMessage('date query parameter is required')];

router.post(
  '/',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  attendanceValidation,
  validate,
  attendanceController.recordAttendance
);

router.get(
  '/course/:courseId',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  courseIdParam,
  validate,
  attendanceController.getCourseAttendance
);

router.get(
  '/course/:courseId/summary',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  courseIdParam,
  validate,
  attendanceController.getCourseAttendanceSummary
);

router.delete(
  '/course/:courseId',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  courseIdParam,
  dateRequiredQuery,
  validate,
  attendanceController.deleteCourseAttendanceForDate
);

router.put(
  '/:id',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  attendanceIdParam,
  validate,
  attendanceController.updateAttendance
);

router.delete(
  '/:id',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  attendanceIdParam,
  validate,
  attendanceController.deleteAttendance
);

router.get(
  '/student/:studentId',
  protect,
  studentIdParam,
  validate,
  attendanceController.getStudentAttendance
);

export default router;
