import express from 'express';
const router = express.Router();
import * as attendanceController from '../controllers/attendance.controller';
import * as attendanceSessionController from '../controllers/attendance-session.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { param, body } from 'express-validator';
import validate from '../middleware/validate.middleware';
import rateLimit from 'express-rate-limit';

const qrLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many QR scan attempts, please try again later.',
});

const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many session requests, please try again later.',
  keyGenerator: (req: any) =>
    `session_${req.user!.id}`,
});

const rfidLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
});

const adminOrTeacher = authorize(
  'SUPER_ADMIN',
  'ADMIN',
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
  'DOCTOR',
  'TEACHING_ASSISTANT'
);

router.get('/my-courses', protect, attendanceController.getMyCourses);
router.get('/my-slots', protect, attendanceController.getMySlots);
router.get('/my-attendance', protect, attendanceController.getMyAttendance);

router.get(
  '/records',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  attendanceController.getAttendanceRecords
);

router.get(
  '/audit/duplicate-devices',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  attendanceController.getAuditDuplicateDevices
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

router.post(
  '/record/:attendanceId/override',
  protect,
  adminOrTeacher,
  attendanceController.overrideFlaggedRecord
);

router.post(
  '/manual',
  protect,
  adminOrTeacher,
  [
    body('studentId').optional().isInt().withMessage('Student ID must be an integer'),
    body('records')
      .optional()
      .isArray()
      .withMessage('Records must be an array'),
    body('records.*.studentId')
      .optional()
      .isInt()
      .withMessage('Student ID must be an integer'),
    body('records.*.status')
      .optional()
      .isIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
      .withMessage('Invalid status'),
  ],
  validate,
  attendanceController.recordAttendanceManual
);

router.post(
  '/qr',
  protect,
  qrLimiter,
  [
    body('token').notEmpty().withMessage('QR token is required'),
  ],
  validate,
  attendanceController.recordAttendanceQr
);

router.post(
  '/rfid',
  rfidLimiter,
  [
    body('deviceId').notEmpty().withMessage('Device ID is required'),
    body('rfidTag').notEmpty().withMessage('RFID tag is required'),
    body('secret').notEmpty().withMessage('Device secret is required'),
  ],
  validate,
  attendanceController.recordAttendanceRfid
);

router.post(
  '/face',
  protect,
  attendanceController.recordAttendanceFace
);

router.post(
  '/gps',
  protect,
  attendanceController.recordAttendanceGps
);

router.post(
  '/session/:sessionId/mark',
  protect,
  adminOrTeacher,
  attendanceSessionController.markStudentAttendance
);

router.post(
  '/sessions/start',
  protect,
  sessionLimiter,
  adminOrTeacher,
  attendanceSessionController.startSession
);

router.post(
  '/session/start',
  protect,
  sessionLimiter,
  adminOrTeacher,
  attendanceSessionController.startSession
);

router.post(
  '/sessions/:sessionId/stop',
  protect,
  adminOrTeacher,
  attendanceSessionController.stopSession
);

router.post(
  '/session/stop/:sessionId',
  protect,
  adminOrTeacher,
  attendanceSessionController.stopSession
);

router.get(
  '/sessions/active',
  protect,
  attendanceSessionController.getActiveSession
);

router.get(
  '/session/active',
  protect,
  attendanceSessionController.getActiveSession
);

router.get(
  '/sessions/:sessionId/current-code',
  protect,
  sessionLimiter,
  adminOrTeacher,
  attendanceSessionController.getCurrentCode
);

router.get(
  '/session/:sessionId/current-code',
  protect,
  sessionLimiter,
  adminOrTeacher,
  attendanceSessionController.getCurrentCode
);

router.put(
  '/sessions/:sessionId/location',
  protect,
  adminOrTeacher,
  attendanceSessionController.updateSessionLocation
);

router.put(
  '/session/:sessionId/location',
  protect,
  adminOrTeacher,
  attendanceSessionController.updateSessionLocation
);

router.get(
  '/sessions/:sessionId/flagged',
  protect,
  adminOrTeacher,
  attendanceSessionController.getFlaggedRecords
);

router.get(
  '/session/:sessionId/flagged',
  protect,
  adminOrTeacher,
  attendanceSessionController.getFlaggedRecords
);

router.get(
  '/slot/:slotId/sessions',
  protect,
  adminOrTeacher,
  attendanceSessionController.getSlotSessions
);

router.get(
  '/sessions/:sessionId/roster',
  protect,
  adminOrTeacher,
  attendanceSessionController.getSessionRoster
);

router.get(
  '/session/:sessionId/roster',
  protect,
  adminOrTeacher,
  attendanceSessionController.getSessionRoster
);

router.post(
  '/scan-qr',
  protect,
  qrLimiter,
  body('token').notEmpty().withMessage('يجب توفير رمز الاستجابة السريعة (TOTP)'),
  validate,
  attendanceController.recordAttendanceQr
);

export default router;
