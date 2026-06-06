const express = require('express');
const { register, login, refresh, logout, getMe, getRequests, approveRequest, rejectRequest } = require('../controllers/auth.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { registerValidation, loginValidation, requestIdValidation } = require('../validations/auth.validation');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', protect, getMe);

// Registration requests
router.get('/requests', protect, authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), getRequests);
router.put('/requests/:id/approve', protect, authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), requestIdValidation, validate, approveRequest);
router.put('/requests/:id/reject', protect, authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), requestIdValidation, validate, rejectRequest);

module.exports = router;
