import express from 'express';
const router = express.Router();
import * as requestsController from '../controllers/requests.controller';
import { authorize, protect } from '../middleware/auth.middleware';

router.use(protect);

router.post(
  '/',
  authorize('DOCTOR', 'TEACHING_ASSISTANT', 'ADMIN', 'SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  requestsController.createRequest
);

router.get(
  '/',
  authorize('DOCTOR', 'TEACHING_ASSISTANT', 'ADMIN', 'SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  requestsController.getRequests
);

router.put(
  '/:id/approve',
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  requestsController.approveRequest
);

router.put(
  '/:id/reject',
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  requestsController.rejectRequest
);

export default router;
