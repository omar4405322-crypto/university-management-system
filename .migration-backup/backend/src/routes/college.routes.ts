import express from 'express';
import {
  getAllColleges,
  getCollegeById,
  createCollege,
  updateCollege,
  deleteCollege,
  assignAdmin,
} from '../controllers/college.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { collegeValidation, adminIdValidation } from '../validations/admin.validation';
import validate from '../middleware/validate.middleware';

const router = express.Router();

router.get('/', protect, getAllColleges);
router.get('/:id', protect, adminIdValidation, validate, getCollegeById);

// Admin only routes
router.post('/', protect, authorize('SUPER_ADMIN'), collegeValidation, validate, createCollege);
router.put(
  '/:id',
  protect,
  authorize('SUPER_ADMIN'),
  [...adminIdValidation, ...collegeValidation],
  validate,
  updateCollege
);
router.put(
  '/:id/assign-admin',
  protect,
  authorize('SUPER_ADMIN'),
  adminIdValidation,
  validate,
  assignAdmin
);
router.delete(
  '/:id',
  protect,
  authorize('SUPER_ADMIN'),
  adminIdValidation,
  validate,
  deleteCollege
);

export default router;
