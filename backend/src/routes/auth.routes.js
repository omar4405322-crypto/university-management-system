const express = require('express');
const { register, login, getMe, getRequests, approveRequest, rejectRequest } = require('../controllers/auth.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);

// Registration requests
router.get('/requests', protect, authorize('SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), getRequests);
router.put('/requests/:id/approve', protect, authorize('SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), approveRequest);
router.put('/requests/:id/reject', protect, authorize('SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), rejectRequest);

module.exports = router;
