import express from 'express';
const router = express.Router();
import * as analyticsController from '../controllers/analytics.controller';
import { protect, authorize } from '../middleware/auth.middleware';

router.get(
  '/general',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN'),
  analyticsController.getGeneralAnalytics
);

export default router;
