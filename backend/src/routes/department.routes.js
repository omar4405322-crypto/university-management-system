const express = require('express');
const { 
  getAllDepartments, 
  getDepartmentById, 
  createDepartment, 
  updateDepartment, 
  deleteDepartment 
} = require('../controllers/department.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', getAllDepartments);
router.get('/:id', getDepartmentById);

// Admin only routes
router.post('/', protect, authorize('SUPER_ADMIN', 'COLLEGE_ADMIN'), createDepartment);
router.put('/:id', protect, authorize('SUPER_ADMIN', 'COLLEGE_ADMIN'), updateDepartment);
router.delete('/:id', protect, authorize('SUPER_ADMIN', 'COLLEGE_ADMIN'), deleteDepartment);

module.exports = router;
