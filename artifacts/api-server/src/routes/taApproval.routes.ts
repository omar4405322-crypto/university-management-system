import express from 'express';
import * as taApprovalController from '../controllers/taApproval.controller';
import { authorize } from '../middleware/auth.middleware';
import { validateZod, approveTASchema } from '../validations/taApproval.validation';

const router = express.Router();

router.get(
  '/',
  authorize('SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  taApprovalController.listApprovals
);

router.post(
  '/approve',
  authorize('SUPER_ADMIN', 'COLLEGE_ADMIN'),
  validateZod(approveTASchema),
  taApprovalController.approveTA
);

router.post(
  '/:id/revoke',
  authorize('SUPER_ADMIN', 'COLLEGE_ADMIN'),
  taApprovalController.revokeTA
);

export default router;
