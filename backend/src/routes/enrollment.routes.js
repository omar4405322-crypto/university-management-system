const express = require('express');
const { protect, authorize } = require('../middleware/auth.middleware.js');
const {
  enrollStudent,
  withdrawStudent,
  getEnrollments,
  updateGrade
} = require('../controllers/enrollment.controller.js');

const router = express.Router();

router.post(
  '/',
  protect,
  authorize('COLLEGE_ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD'),
  enrollStudent
);

router.get(
  '/',
  protect,
  getEnrollments
);

router.delete(
  '/:id',
  protect,
  authorize('COLLEGE_ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD', 'STUDENT'),
  withdrawStudent
);

router.patch(
  '/:id/grade',
  protect,
  authorize('DOCTOR', 'COLLEGE_ADMIN', 'SUPER_ADMIN'),
  updateGrade
);

module.exports = router;
