const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authorize } = require('../middleware/auth.middleware');

router.get('/stats', authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), dashboardController.getAdminStats);
router.get('/student', authorize('STUDENT'), dashboardController.getStudentStats);
router.get('/doctor', authorize('DOCTOR'), dashboardController.getDoctorStats);

module.exports = router;
