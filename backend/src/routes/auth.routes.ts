import express from 'express';
import { register, login, refresh, logout, getMe, getRequests, approveRequest, rejectRequest } from '../controllers/auth.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { registerValidation, loginValidation, requestIdValidation } from '../validations/auth.validation.js';
import validate from '../middleware/validate.middleware.js';

const router = express.Router();

router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.post('/refresh', refresh);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

// Registration requests
router.get('/requests', protect, authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), getRequests);
router.put('/requests/:id/approve', protect, authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), requestIdValidation, validate, approveRequest);
router.put('/requests/:id/reject', protect, authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), requestIdValidation, validate, rejectRequest);

export default router;
