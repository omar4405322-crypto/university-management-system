import express from 'express';
const router = express.Router();
import * as analyticsController from '../controllers/analytics.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

router.get('/general', protect, authorize('SUPER_ADMIN', 'ADMIN'), analyticsController.getGeneralAnalytics);

export default router;
