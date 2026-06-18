import express from 'express';
import { getAllDepartments, 
  getDepartmentById, 
  createDepartment, 
  updateDepartment, 
  deleteDepartment } from '../controllers/department.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { departmentValidation, adminIdValidation } from '../validations/admin.validation.js';
import validate from '../middleware/validate.middleware.js';

const router = express.Router();

router.get('/', protect, getAllDepartments);
router.get('/:id', protect, adminIdValidation, validate, getDepartmentById);

// Admin only routes
router.post('/', protect, authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN'), departmentValidation, validate, createDepartment);
router.put('/:id', protect, authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN'), [...adminIdValidation, ...departmentValidation], validate, updateDepartment);
router.delete('/:id', protect, authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN'), adminIdValidation, validate, deleteDepartment);

export default router;
