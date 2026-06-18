import express from 'express';
const router = express.Router();
import * as dashboardController from '../controllers/dashboard.controller.js';
import { authorize } from '../middleware/auth.middleware.js';

router.get('/stats', authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), dashboardController.getAdminStats);
router.get('/student', authorize('STUDENT'), dashboardController.getStudentStats);
router.get('/doctor', authorize('DOCTOR'), dashboardController.getDoctorStats);

export default router;
