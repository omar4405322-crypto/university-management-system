import express from "express";
import { param, body } from "express-validator";
import validate from "../middleware/validate.middleware";
import { protect, authorize } from "../middleware/auth.middleware";
import auditLog from "../middleware/audit.middleware";
import {
  enrollStudent,
  withdrawStudent,
  getEnrollments,
  getMyGrades,
  updateGrade,
  setCustomAbsenceThreshold,
  createExemptionPeriod,
  getExemptionPeriods,
  deleteExemptionPeriod,
  syncAllEnrollments,
} from "../controllers/enrollment.controller";
import { validateCustomAbsenceThreshold } from "../utils/absenceThreshold.utils";

const router = express.Router();

const adminRoles = authorize(
  "COLLEGE_ADMIN",
  "SUPER_ADMIN",
  "DEPARTMENT_ADMIN",
);

const enrollmentIdValidation = [
  param("id").isInt({ min: 1 }).withMessage("Invalid enrollment ID"),
];
const enrollStudentValidation = [
  body("studentId")
    .isInt({ min: 1 })
    .withMessage("Student ID must be a positive integer"),
  body("courseId")
    .isInt({ min: 1 })
    .withMessage("Course ID must be a positive integer"),
  body("semester")
    .isInt({ min: 1, max: 3 })
    .withMessage("Semester must be between 1 and 3"),
  body("academicYear")
    .isInt({ min: 2000, max: 2100 })
    .withMessage("Academic year must be a valid calendar year"),
];

router.get("/my-grades", protect, authorize("STUDENT"), getMyGrades);
router.post("/sync-all", protect, authorize("SUPER_ADMIN"), syncAllEnrollments);
router.post(
  "/",
  protect,
  authorize("SUPER_ADMIN"),
  [
    ...enrollStudentValidation,
    body("reason")
      .trim()
      .notEmpty()
      .withMessage("Reason is required for manual enrollment")
      .isLength({ min: 5 })
      .withMessage("Reason must be at least 5 characters"),
  ],
  validate,
  auditLog("MANUAL_ENROLLMENT_CREATED", "Enrollment"),
  enrollStudent,
);

router.get("/", protect, getEnrollments);

router.delete(
  "/:id",
  protect,
  authorize("SUPER_ADMIN"),
  [
    ...enrollmentIdValidation,
    body("reason")
      .trim()
      .notEmpty()
      .withMessage("Reason is required to withdraw/drop enrollment")
      .isLength({ min: 5 })
      .withMessage("Reason must be at least 5 characters"),
  ],
  validate,
  auditLog("MANUAL_ENROLLMENT_DROPPED", "Enrollment"),
  withdrawStudent,
);

router.patch(
  "/:id/grade",
  protect,
  authorize("DOCTOR", "COLLEGE_ADMIN", "SUPER_ADMIN"),
  updateGrade,
);

router.patch(
  "/:id/absence-threshold",
  protect,
  adminRoles,
  [
    param("id").isInt().withMessage("Invalid enrollment ID"),
    body("customAbsenceThreshold").custom((val) => {
      const validationError = validateCustomAbsenceThreshold(val);
      if (validationError) {
        throw new Error(validationError);
      }
      return true;
    }),
  ],
  validate,
  setCustomAbsenceThreshold,
);

router.post(
  "/:id/exemption-periods",
  protect,
  adminRoles,
  [
    param("id").isInt().withMessage("Invalid enrollment ID"),
    body("startDate")
      .isISO8601()
      .withMessage("startDate must be a valid ISO date"),
    body("endDate").isISO8601().withMessage("endDate must be a valid ISO date"),
    body("reason")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("reason is required"),
  ],
  validate,
  createExemptionPeriod,
);

router.get(
  "/:id/exemption-periods",
  protect,
  [param("id").isInt().withMessage("Invalid enrollment ID")],
  validate,
  getExemptionPeriods,
);

router.delete(
  "/:id/exemption-periods/:exemptionId",
  protect,
  adminRoles,
  [
    param("id").isInt().withMessage("Invalid enrollment ID"),
    param("exemptionId").isInt().withMessage("Invalid exemption ID"),
  ],
  validate,
  deleteExemptionPeriod,
);

export default router;
