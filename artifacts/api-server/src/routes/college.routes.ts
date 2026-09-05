import express from 'express';
import {
  getAllColleges,
  getCollegeById,
  getPublicColleges,
  getPublicCollegeById,
  createCollege,
  updateCollege,
  deleteCollege,
  assignAdmin,
} from '../controllers/college.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { collegeValidation, adminIdValidation } from '../validations/admin.validation';
import validate from '../middleware/validate.middleware';

const router = express.Router();

// Public: needed by the registration form (no token available yet)
router.get('/', getPublicColleges);
router.get(
  '/manage',
  protect,
  authorize('ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  getAllColleges
);
router.get(
  '/manage/:id',
  protect,
  authorize('ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  adminIdValidation,
  validate,
  getCollegeById
);
router.get('/:id', adminIdValidation, validate, getPublicCollegeById);

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
