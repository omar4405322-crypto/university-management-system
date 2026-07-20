import express from 'express';
const router = express.Router();
import * as schedulesController from '../controllers/schedules.controller';
import { authorize } from '../middleware/auth.middleware';
import overridesRouter from './overrides.routes';
import validate from '../middleware/validate.middleware';
import { scheduleValidation } from '../validations/functional.validation';

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
  schedulesController.syncGridToMaster
);

router.use('/:slotId/overrides', overridesRouter);
router.use('/overrides', overridesRouter);

export default router;
