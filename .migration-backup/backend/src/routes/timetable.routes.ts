import express from 'express';
const router = express.Router();
import * as timetableController from '../controllers/timetable.controller';
import { protect, authorize } from '../middleware/auth.middleware';

router.use(protect);

router.get('/', timetableController.getTimetables);
router.get('/:id', timetableController.getTimetableById);

// Admin only routes
router.post(
  '/',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  timetableController.createTimetable
);
router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  timetableController.updateTimetable
);
router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  timetableController.deleteTimetable
);

router.patch(
  '/:id/publish',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  timetableController.publishTimetable
);
router.patch(
  '/:id/unpublish',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  timetableController.unpublishTimetable
);

export default router;
