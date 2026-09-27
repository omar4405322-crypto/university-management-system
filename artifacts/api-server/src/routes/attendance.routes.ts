import express from "express";
const router = express.Router();
import * as attendanceController from "../controllers/attendance.controller";
import * as attendanceSessionController from "../controllers/attendance-session.controller";
import { protect, authorize } from "../middleware/auth.middleware";
import { param, body } from "express-validator";
import validate from "../middleware/validate.middleware";
import rateLimit from "express-rate-limit";
import {
  createRedisStore,
  rateLimiterPassOnStoreError,
} from "../middleware/rateLimiter.middleware";
import {
  MAX_ATTENDANCE_RECORDS,
  MAX_ATTENDANCE_REMARKS_LENGTH,
} from "../utils/requestLimits";

const qrLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many QR scan attempts, please try again later.",
  passOnStoreError: rateLimiterPassOnStoreError,
  store: createRedisStore("attendance_qr"),
});

const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many session requests, please try again later.",
  passOnStoreError: rateLimiterPassOnStoreError,
  store: createRedisStore("attendance_session"),
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req: any) => `session_${req.user!.id}`,
});

const rfidLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  passOnStoreError: rateLimiterPassOnStoreError,
  store: createRedisStore("attendance_rfid"),
});

const adminOrTeacher = authorize(
  "SUPER_ADMIN",
  "ADMIN",
  "COLLEGE_ADMIN",
  "DEPARTMENT_ADMIN",
  "DOCTOR",
  "TEACHING_ASSISTANT",
);

router.get("/my-courses", protect, attendanceController.getMyCourses);
router.get("/my-slots", protect, attendanceController.getMySlots);
router.get("/my-attendance", protect, attendanceController.getMyAttendance);
router.get("/my-warnings", protect, attendanceController.getMyAbsenceWarnings);
router.get(
  "/warnings/export",
  protect,
  adminOrTeacher,
  attendanceController.exportAbsenceWarnings,
);

router.get(
  "/records",
  protect,
  authorize("SUPER_ADMIN", "ADMIN", "COLLEGE_ADMIN", "DEPARTMENT_ADMIN"),
  attendanceController.getAttendanceRecords,
);

router.get(
  "/audit/duplicate-devices",
  protect,
  authorize("SUPER_ADMIN", "ADMIN", "COLLEGE_ADMIN", "DEPARTMENT_ADMIN"),
  attendanceController.getAuditDuplicateDevices,
);

router.get(
  "/course/:courseId",
  protect,
  adminOrTeacher,
  [param("courseId").isInt().withMessage("Invalid course ID")],
  validate,
  attendanceController.getCourseAttendance,
);

router.get(
  "/summary/:courseId",
  protect,
  adminOrTeacher,
  [param("courseId").isInt().withMessage("Invalid course ID")],
  validate,
  attendanceController.getAttendanceSummary,
);

router.get(
  "/student/:studentId",
  protect,
  [param("studentId").isInt().withMessage("Invalid student ID")],
  validate,
  attendanceController.getStudentAttendance,
);

router.post(
  "/unblock/:enrollmentId",
  protect,
  authorize("SUPER_ADMIN", "ADMIN", "COLLEGE_ADMIN", "DEPARTMENT_ADMIN"),
  [param("enrollmentId").isInt().withMessage("Invalid enrollment ID")],
  validate,
  attendanceController.unblockEnrollment,
);

router.post(
  "/record/:attendanceId/override",
  protect,
  adminOrTeacher,
  attendanceController.overrideFlaggedRecord,
);

router.post(
  "/record/:attendanceId/reject",
  protect,
  adminOrTeacher,
  attendanceController.rejectFlaggedRecord,
);

router.post(
  "/manual",
  protect,
  adminOrTeacher,
  [
    body("studentId")
      .optional()
      .isInt()
      .withMessage("Student ID must be an integer"),
    body("records")
      .optional()
      .isArray({ max: MAX_ATTENDANCE_RECORDS })
      .withMessage(
        `Records must be an array with at most ${MAX_ATTENDANCE_RECORDS} items`,
      ),
    body("records.*.studentId")
      .optional()
      .isInt()
      .withMessage("Student ID must be an integer"),
    body("records.*.status")
      .optional()
      .isIn(["PRESENT", "ABSENT", "LATE", "EXCUSED"])
      .withMessage("Invalid status"),
    body("records.*.remarks")
      .optional()
      .isString()
      .isLength({ max: MAX_ATTENDANCE_REMARKS_LENGTH })
      .withMessage("Attendance remarks are too long"),
    body("remarks")
      .optional()
      .isString()
      .isLength({ max: MAX_ATTENDANCE_REMARKS_LENGTH })
      .withMessage("Attendance remarks are too long"),
    body("semester")
      .optional()
      .isInt({ min: 1, max: 3 })
      .withMessage("Semester must be between 1 and 3"),
    body("courseId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Course ID must be a positive integer"),
    body("sessionId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Session ID must be a positive integer"),
  ],
  validate,
  attendanceController.recordAttendanceManual,
);

router.post(
  "/qr",
  protect,
  qrLimiter,
  [
    body("token").notEmpty().withMessage("QR token is required"),
    body("sessionId").isInt({ min: 1 }).withMessage("Session ID is required"),
    body("deviceId")
      .isString()
      .trim()
      .isLength({ min: 8, max: 255 })
      .withMessage("A valid device ID is required"),
  ],
  validate,
  attendanceController.recordAttendanceQr,
);

router.post(
  "/rfid",
  rfidLimiter,
  [
    body("deviceId").notEmpty().withMessage("Device ID is required"),
    body("rfidTag").notEmpty().withMessage("RFID tag is required"),
    body("timestamp").custom((val, { req }) => {
      const ts = val ?? req?.headers?.["x-timestamp"];
      if (ts === undefined || ts === null || ts === "") {
        throw new Error("Timestamp is required");
      }
      return true;
    }),
    body("nonce").custom((val, { req }) => {
      const n = val ?? req?.headers?.["x-nonce"];
      if (!n || typeof n !== "string" || !n.trim()) {
        throw new Error("Nonce is required");
      }
      return true;
    }),
    body("signature").custom((val, { req }) => {
      const sig =
        val ??
        req?.body?.hmac ??
        req?.headers?.["x-signature"] ??
        req?.headers?.["x-hmac"];
      if (!sig || typeof sig !== "string" || !sig.trim()) {
        throw new Error("Request signature is required");
      }
      return true;
    }),
  ],
  validate,
  attendanceController.recordAttendanceRfid,
);

const faceAttendanceGuard = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  if (process.env.ENABLE_FACE_ATTENDANCE !== "true") {
    res.status(403).json({
      success: false,
      error: {
        code: "FEATURE_DISABLED",
        message:
          "Face recognition attendance is disabled by default. Explicit configuration (ENABLE_FACE_ATTENDANCE=true) is required.",
      },
    });
    return;
  }
  next();
};

router.post("/face", protect, faceAttendanceGuard, attendanceController.recordAttendanceFace);

router.post(
  "/gps",
  protect,
  [
    body("sessionId").isInt({ min: 1 }).withMessage("Session ID is required"),
    body("deviceId")
      .isString()
      .trim()
      .isLength({ min: 8, max: 255 })
      .withMessage("A valid device ID is required"),
    body("latitude")
      .isFloat({ min: -90, max: 90 })
      .withMessage("Valid latitude is required"),
    body("longitude")
      .isFloat({ min: -180, max: 180 })
      .withMessage("Valid longitude is required"),
  ],
  validate,
  attendanceController.recordAttendanceGps,
);

router.post(
  "/session/:sessionId/mark",
  protect,
  adminOrTeacher,
  attendanceSessionController.markStudentAttendance,
);

router.post(
  "/sessions/start",
  protect,
  sessionLimiter,
  adminOrTeacher,
  [
    body("radius")
      .optional({ nullable: true })
      .isFloat({ min: 1, max: 200 })
      .withMessage("Session radius must be between 1 and 200 meters"),
    body("gracePeriodMins")
      .optional({ nullable: true })
      .isInt({ min: 0, max: 30 })
      .withMessage("Grace period must be between 0 and 30 minutes"),
  ],
  validate,
  attendanceSessionController.startSession,
);

router.post(
  "/session/start",
  protect,
  sessionLimiter,
  adminOrTeacher,
  [
    body("radius")
      .optional({ nullable: true })
      .isFloat({ min: 1, max: 200 })
      .withMessage("Session radius must be between 1 and 200 meters"),
    body("gracePeriodMins")
      .optional({ nullable: true })
      .isInt({ min: 0, max: 30 })
      .withMessage("Grace period must be between 0 and 30 minutes"),
  ],
  validate,
  attendanceSessionController.startSession,
);

router.post(
  "/sessions/:sessionId/stop",
  protect,
  adminOrTeacher,
  attendanceSessionController.stopSession,
);

router.post(
  "/session/stop/:sessionId",
  protect,
  adminOrTeacher,
  attendanceSessionController.stopSession,
);

router.get(
  "/sessions/active",
  protect,
  attendanceSessionController.getActiveSession,
);

router.get(
  "/session/active",
  protect,
  attendanceSessionController.getActiveSession,
);

router.get(
  "/sessions/:sessionId/current-code",
  protect,
  sessionLimiter,
  adminOrTeacher,
  attendanceSessionController.getCurrentCode,
);

router.get(
  "/session/:sessionId/current-code",
  protect,
  sessionLimiter,
  adminOrTeacher,
  attendanceSessionController.getCurrentCode,
);

router.put(
  "/sessions/:sessionId/location",
  protect,
  adminOrTeacher,
  attendanceSessionController.updateSessionLocation,
);

router.put(
  "/session/:sessionId/location",
  protect,
  adminOrTeacher,
  attendanceSessionController.updateSessionLocation,
);

router.get(
  "/sessions/:sessionId/flagged",
  protect,
  adminOrTeacher,
  attendanceSessionController.getFlaggedRecords,
);

router.get(
  "/session/:sessionId/flagged",
  protect,
  adminOrTeacher,
  attendanceSessionController.getFlaggedRecords,
);

router.get(
  "/slot/:slotId/sessions",
  protect,
  adminOrTeacher,
  attendanceSessionController.getSlotSessions,
);

router.get(
  "/sessions/:sessionId/roster",
  protect,
  adminOrTeacher,
  attendanceSessionController.getSessionRoster,
);

router.get(
  "/session/:sessionId/roster",
  protect,
  adminOrTeacher,
  attendanceSessionController.getSessionRoster,
);

router.post(
  "/scan-qr",
  protect,
  qrLimiter,
  [
    body("token")
      .notEmpty()
      .withMessage("يجب توفير رمز الاستجابة السريعة (TOTP)"),
    body("sessionId").isInt({ min: 1 }).withMessage("معرف الجلسة مطلوب"),
    body("deviceId")
      .isString()
      .trim()
      .isLength({ min: 8, max: 255 })
      .withMessage("معرف جهاز صالح مطلوب"),
  ],
  validate,
  attendanceController.recordAttendanceQr,
);

// RFID Device Provisioning & Management (Admin Only)
router.post(
  "/devices/rfid",
  protect,
  authorize("SUPER_ADMIN"),
  [
    body("roomId").notEmpty().withMessage("Room ID is required"),
    body("label").optional().isString().withMessage("Label must be a string"),
  ],
  validate,
  attendanceController.provisionRfidDevice,
);

router.get(
  "/devices/rfid",
  protect,
  authorize("SUPER_ADMIN"),
  attendanceController.listRfidDevices,
);

export default router;
