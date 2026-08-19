import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  enrollStudent,
  withdrawStudent,
  getEnrollments,
  updateGrade,
} from '../controllers/enrollment.controller';

const router = express.Router();

router.post('/', protect, authorize('COLLEGE_ADMIN', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN'), enrollStudent);

router.get('/', protect, getEnrollments);

router.delete(
  '/:id',
  protect,
  authorize('COLLEGE_ADMIN', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'STUDENT'),
  withdrawStudent
);

router.patch(
  '/:id/grade',
  protect,
  authorize('DOCTOR', 'COLLEGE_ADMIN', 'SUPER_ADMIN'),
  updateGrade
);

export default router;
