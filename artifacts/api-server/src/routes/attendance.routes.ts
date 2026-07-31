import express from 'express';
const router = express.Router();
import * as attendanceController from '../controllers/attendance.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { attendanceValidation } from '../validations/functional.validation';
import { param } from 'express-validator';
import validate from '../middleware/validate.middleware';
import * as attendanceSessionController from '../controllers/attendance-session.controller';
import rateLimit from 'express-rate-limit';

const qrLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per window
  message: 'Too many QR scan attempts, please try again later.',
});

const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many session requests, please try again later.',
  keyGenerator: (req: any) => req.user?.id ? `session_${req.user.id}` : (req.ip || 'unknown'),
});


const rfidLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 scans per minute per device
});

const adminOrTeacher = authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR', 'TEACHING_ASSISTANT');

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

router.post(
  '/session/:sessionId/mark',
  protect,
  adminOrTeacher,
  attendanceSessionController.markStudentAttendance
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

// Session endpoints
router.post(
  '/session/start',
  protect,
  sessionLimiter,
  adminOrTeacher,
  attendanceSessionController.startSession
);

router.post(
  '/session/stop/:sessionId',
  protect,
  adminOrTeacher,
  attendanceSessionController.stopSession
);

router.get(
  '/session/active',
  protect,
  attendanceSessionController.getActiveSession
);

router.get(
  '/session/:sessionId/current-code',
  protect,
  sessionLimiter,
  adminOrTeacher,
  attendanceSessionController.getCurrentCode
);

router.put(
  '/session/:sessionId/location',
  protect,
  adminOrTeacher,
  attendanceSessionController.updateSessionLocation
);

router.get(
  '/session/:sessionId/flagged',
  protect,
  adminOrTeacher,
  attendanceSessionController.getFlaggedRecords
);

router.post(
  '/record/:attendanceId/override',
  protect,
  adminOrTeacher,
  attendanceSessionController.overrideFlaggedRecord
);

// Scanning endpoints
router.post(
  '/scan-qr',
  protect,
  qrLimiter,
  attendanceSessionController.scanQr
);

router.post(
  '/rfid',
  rfidLimiter, // Device endpoint, uses secret rather than JWT
  attendanceSessionController.rfidScan
);

router.get(
  '/slot/:slotId/sessions',
  protect,
  adminOrTeacher,
  attendanceSessionController.getSlotSessions
);

router.get(
  '/session/:sessionId/roster',
  protect,
  adminOrTeacher,
  attendanceSessionController.getSessionRoster
);

export default router;
