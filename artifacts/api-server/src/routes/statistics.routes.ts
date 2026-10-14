import express from 'express';
import { getOverview } from '../controllers/statistics.controller';
import { protect, authorize } from '../middleware/auth.middleware';

const router = express.Router();

router.use(protect);

router.get(
  '/overview',
  authorize('SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  getOverview
);

export default router;
