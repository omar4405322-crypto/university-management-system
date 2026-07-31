import express from 'express';
const router = express.Router();
import * as roomController from '../controllers/room.controller';
import { authorize } from '../middleware/auth.middleware';

router.patch(
  '/:id/coordinates',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR'),
  roomController.updateRoomCoordinates
);

export default router;
