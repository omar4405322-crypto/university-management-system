import express from 'express';
import rateLimit from 'express-rate-limit';
const router = express.Router();
import * as schedulesController from '../controllers/schedules.controller';
import { authorize } from '../middleware/auth.middleware';
import overridesRouter from './overrides.routes';
import validate from '../middleware/validate.middleware';
import { scheduleValidation } from '../validations/functional.validation';

const syncGridLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // Limit each IP/user to 5 bulk sync requests per 15-minute window
  standardHeaders: true,
  legacyHeaders: false,
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
  '/sync-grid',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  syncGridLimiter,
  schedulesController.syncGridToMaster
);

router.post(
  '/check-conflict',
  schedulesController.checkScheduleConflict
);

router.use('/:slotId/overrides', overridesRouter);
router.use('/overrides', overridesRouter);

export default router;
