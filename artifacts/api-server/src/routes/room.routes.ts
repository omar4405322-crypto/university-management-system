import express from 'express';
import * as roomController from '../controllers/room.controller';
import { authorize } from '../middleware/auth.middleware';
import { validateZod, createRoomSchema, updateRoomSchema } from '../validations/room.validation';

const router = express.Router();

router.get(
  '/',
  authorize('SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  roomController.getRooms
);

router.post(
  '/',
  authorize('SUPER_ADMIN'),
  validateZod(createRoomSchema),
  roomController.createRoom
);

router.patch(
  '/:id/coordinates',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR'),
  roomController.updateRoomCoordinates
);

router.patch(
  '/:id',
  authorize('SUPER_ADMIN'),
  validateZod(updateRoomSchema),
  roomController.updateRoom
);

export default router;
