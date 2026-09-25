import express from 'express';
import rateLimit from 'express-rate-limit';
const router = express.Router();
import * as schedulesController from '../controllers/schedules.controller';
import { authorize, protect } from '../middleware/auth.middleware';
import overridesRouter from './overrides.routes';
import validate from '../middleware/validate.middleware';
import { scheduleValidation } from '../validations/functional.validation';
import { body } from 'express-validator';
import {
  createRedisStore,
  rateLimiterPassOnStoreError,
} from '../middleware/rateLimiter.middleware';
import {
  MAX_SCHEDULE_SYNC_SLOTS,
  MAX_SCHEDULE_TEXT_LENGTH,
} from '../utils/requestLimits';

const syncGridLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // Limit each IP/user to 5 bulk sync requests per 15-minute window
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: rateLimiterPassOnStoreError,
  store: createRedisStore('schedule_sync'),
  message: {
    success: false,
    message: 'Too many sync requests, please try again after 15 minutes',
  },
});

router.get('/', schedulesController.getAllSchedules);
router.get('/week', schedulesController.getWeeklyTimetable);

router.post(
  '/',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR', 'TEACHING_ASSISTANT'),
  scheduleValidation,
  validate,
  schedulesController.createSchedule
);
router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR', 'TEACHING_ASSISTANT'),
  scheduleValidation,
  validate,
  schedulesController.updateSchedule
);
router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR', 'TEACHING_ASSISTANT'),
  schedulesController.deleteSchedule
);
router.post(
  '/:id/archive',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR', 'TEACHING_ASSISTANT'),
  schedulesController.archiveSchedule
);
router.post(
  '/:id/restore',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR', 'TEACHING_ASSISTANT'),
  schedulesController.restoreSchedule
);

router.post(
  '/sync-grid',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  syncGridLimiter,
  [
    body('slots')
      .isArray({ min: 1, max: MAX_SCHEDULE_SYNC_SLOTS })
      .withMessage(`Slots must contain between 1 and ${MAX_SCHEDULE_SYNC_SLOTS} items`),
    body('slots.*').isObject().withMessage('Each schedule slot must be an object'),
    body('slots.*.courseName')
      .isString()
      .trim()
      .isLength({ min: 1, max: MAX_SCHEDULE_TEXT_LENGTH })
      .withMessage('Course name is required and must not exceed 200 characters'),
    body('slots.*.courseId')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('Course ID must be a positive integer'),
    body('slots.*.doctorId')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('Doctor ID must be a positive integer'),
    body('slots.*.teachingAssistantId')
      .optional({ nullable: true })
      .isString()
      .isLength({ min: 1, max: 64 })
      .withMessage('Teaching assistant ID must be a valid identifier'),
    body('slots.*.instructor')
      .optional({ nullable: true })
      .isString()
      .isLength({ max: MAX_SCHEDULE_TEXT_LENGTH })
      .withMessage('Instructor name must not exceed 200 characters'),
    body('slots.*.room')
      .optional({ nullable: true })
      .isString()
      .isLength({ max: MAX_SCHEDULE_TEXT_LENGTH })
      .withMessage('Room must not exceed 200 characters'),
    body('slots.*.day')
      .optional()
      .isString()
      .isLength({ max: 16 })
      .withMessage('Schedule day is too long'),
    body('slots.*.startTime')
      .optional()
      .isString()
      .isLength({ max: 16 })
      .withMessage('Schedule start time is too long'),
    body('slots.*.endTime')
      .optional()
      .isString()
      .isLength({ max: 16 })
      .withMessage('Schedule end time is too long'),
    body('slots.*.slotType')
      .optional()
      .isString()
      .isLength({ max: 32 })
      .withMessage('Schedule slot type is too long'),
  ],
  validate,
  schedulesController.syncGridToMaster
);

router.post(
  '/check-conflict',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR', 'TEACHING_ASSISTANT'),
  schedulesController.checkScheduleConflict
);

router.use('/:slotId/overrides', overridesRouter);
router.use('/overrides', overridesRouter);

export default router;
