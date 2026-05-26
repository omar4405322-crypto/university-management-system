const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const roleMiddleware = require('../middleware/role.middleware');

router.get('/stats', roleMiddleware(['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']), dashboardController.getAdminStats);
router.get('/student', roleMiddleware(['STUDENT']), dashboardController.getStudentStats);
router.get('/doctor', roleMiddleware(['DOCTOR']), dashboardController.getDoctorStats);

module.exports = router;
