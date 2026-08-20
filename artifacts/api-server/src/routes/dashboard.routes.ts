import express from 'express';
const router = express.Router();
import * as dashboardController from '../controllers/dashboard.controller';
import { authorize } from '../middleware/auth.middleware';

router.get(
  '/',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  dashboardController.getAdminStats
);
router.get(
  '/stats',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  dashboardController.getAdminStats
);
router.get('/student', authorize('STUDENT'), dashboardController.getStudentStats);
router.get('/doctor', authorize('DOCTOR'), dashboardController.getDoctorStats);

export default router;
