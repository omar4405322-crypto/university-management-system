import express from "express";
const router = express.Router();
import * as timetableController from "../controllers/timetable.controller";
import { protect, authorize } from "../middleware/auth.middleware";
import { body, param } from "express-validator";
import validate from "../middleware/validate.middleware";

const timetableIdValidation = [
  param("id").isInt({ min: 1 }).withMessage("Invalid timetable ID"),
];
const timetableFieldsValidation = [
  body("collegeId")
    .isInt({ min: 1 })
    .withMessage("College ID must be a positive integer"),
  body("departmentId")
    .isInt({ min: 1 })
    .withMessage("Department ID must be a positive integer"),
  body("academicYear")
    .isInt({ min: 1, max: 10 })
    .withMessage("Academic year must be between 1 and 10"),
  body("semester")
    .isInt({ min: 1, max: 3 })
    .withMessage("Semester must be between 1 and 3"),
  body("title")
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title is required"),
  body("description").optional().isString().isLength({ max: 2000 }),
  body("fileUrl")
    .optional({ checkFalsy: true })
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .isLength({ max: 2048 })
    .withMessage("File URL must be a valid HTTP(S) URL"),
  body("status").optional().isIn(["DRAFT", "PUBLISHED", "ARCHIVED"]),
];
const timetableUpdateValidation = [
  ...timetableIdValidation,
  body("academicYear").optional().isInt({ min: 1, max: 10 }),
  body("semester").optional().isInt({ min: 1, max: 3 }),
  body("title").optional().isString().trim().isLength({ min: 1, max: 200 }),
  body("description").optional().isString().isLength({ max: 2000 }),
  body("fileUrl")
    .optional({ checkFalsy: true })
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .isLength({ max: 2048 }),
  body("status").optional().isIn(["DRAFT", "PUBLISHED", "ARCHIVED"]),
];

router.use(protect);

router.get("/", timetableController.getTimetables);
router.get(
  "/:id",
  timetableIdValidation,
  validate,
  timetableController.getTimetableById,
);

// Admin only routes
router.post(
  "/",
  authorize("SUPER_ADMIN", "ADMIN", "COLLEGE_ADMIN", "DEPARTMENT_ADMIN"),
  timetableFieldsValidation,
  validate,
  timetableController.createTimetable,
);
router.put(
  "/:id",
  authorize("SUPER_ADMIN", "ADMIN", "COLLEGE_ADMIN", "DEPARTMENT_ADMIN"),
  timetableUpdateValidation,
  validate,
  timetableController.updateTimetable,
);
router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "ADMIN", "COLLEGE_ADMIN", "DEPARTMENT_ADMIN"),
  timetableIdValidation,
  validate,
  timetableController.deleteTimetable,
);

router.patch(
  "/:id/publish",
  authorize("SUPER_ADMIN", "ADMIN", "COLLEGE_ADMIN", "DEPARTMENT_ADMIN"),
  timetableIdValidation,
  validate,
  timetableController.publishTimetable,
);
router.patch(
  "/:id/unpublish",
  authorize("SUPER_ADMIN", "ADMIN", "COLLEGE_ADMIN", "DEPARTMENT_ADMIN"),
  timetableIdValidation,
  validate,
  timetableController.unpublishTimetable,
);

export default router;
