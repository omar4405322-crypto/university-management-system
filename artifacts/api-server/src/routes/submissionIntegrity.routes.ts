import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import * as submissionIntegrityController from '../controllers/submissionIntegrity.controller';

const router = Router();

router.get(
  '/policy',
  protect,
  authorize('SUPER_ADMIN'),
  submissionIntegrityController.getPolicy
);

router.put(
  '/policy',
  protect,
  authorize('SUPER_ADMIN'),
  submissionIntegrityController.updatePolicy
);

export default router;
