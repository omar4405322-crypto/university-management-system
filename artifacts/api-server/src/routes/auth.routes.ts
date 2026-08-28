import express from 'express';
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  getRequests,
  approveRequest,
  rejectRequest,
  deleteRequest,
} from '../controllers/auth.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  registerValidation,
  loginValidation,
  requestIdValidation,
} from '../validations/auth.validation';
import validate from '../middleware/validate.middleware';

import { loginLimiter } from '../middleware/rateLimiter.middleware';

const router = express.Router();

router.post('/register', registerValidation, validate, register);
router.post('/login', loginLimiter, loginValidation, validate, login);
router.post('/refresh', refresh);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

// Registration requests
router.get(
  '/requests',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  getRequests
);
router.put(
  '/requests/:id/approve',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  requestIdValidation,
  validate,
  approveRequest
);
router.put(
  '/requests/:id/reject',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  requestIdValidation,
  validate,
  rejectRequest
);
router.delete(
  '/requests/:id',
  protect,
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  requestIdValidation,
  validate,
  deleteRequest
);

export default router;
