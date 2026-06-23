import express from 'express';
const router = express.Router();
import * as schedulesController from '../controllers/schedules.controller';
import { authorize } from '../middleware/auth.middleware';

router.get('/', schedulesController.getAllSchedules);
router.get('/week', schedulesController.getWeeklyTimetable);

router.post(
  '/',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  schedulesController.createSchedule
);
router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  schedulesController.updateSchedule
);
router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  schedulesController.deleteSchedule
);

export default router;
