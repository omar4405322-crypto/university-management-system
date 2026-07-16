import express from 'express';
import {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../controllers/department.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { departmentValidation, adminIdValidation } from '../validations/admin.validation';
import validate from '../middleware/validate.middleware';

const router = express.Router();

// Public: needed by the registration form (no token available yet)
router.get('/', getAllDepartments);
router.get('/:id', adminIdValidation, validate, getDepartmentById);

// Admin only routes
router.post(
  '/',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN'),
  departmentValidation,
  validate,
  createDepartment
);
router.put(
  '/:id',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN'),
  [...adminIdValidation, ...departmentValidation],
  validate,
  updateDepartment
);
router.delete(
  '/:id',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN'),
  adminIdValidation,
  validate,
  deleteDepartment
);

export default router;
