import express from 'express';
import {
  getProfile,
  updateProfile,
  updatePassword,
  updateProfilePicture,
  setup2FA,
  enable2FA,
  disable2FA,
  getAllUsers,
  createAdmin,
  deleteUser,
  hardDeleteUser,
  updateAdmin,
  resetUserPassword,
} from '../controllers/user.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import upload from '../middleware/upload.middleware';
import { userUpdateValidation, adminIdValidation } from '../validations/admin.validation';
import { body } from 'express-validator';
import validate from '../middleware/validate.middleware';

const router = express.Router();

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', userUpdateValidation, validate, updateProfile);

router.put(
  '/profile/password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .matches(/\d/)
      .withMessage('New password must contain at least one number')
      .matches(/[A-Z]/)
      .withMessage('New password must contain at least one uppercase letter'),
  ],
  validate,
  updatePassword
);

router.put('/profile/picture', upload.single('profilePicture'), updateProfilePicture);

// 2FA Routes
router.post('/2fa/setup', setup2FA);
router.post(
  '/2fa/enable',
  [body('token').notEmpty().withMessage('Verification code is required')],
  validate,
  enable2FA
);
router.post(
  '/2fa/disable',
  [
    body('token').notEmpty().withMessage('Verification code is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  disable2FA
);

// Admin management
router.get('/', authorize('SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), getAllUsers);
router.post(
  '/admins',
  authorize('SUPER_ADMIN'),
  [
    body('email').isEmail().withMessage('Invalid email format').normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long'),
    body('role').isIn(['ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN']),
    body('collegeId').optional().isInt(),
    body('departmentId').optional().isInt(),
    body('managedCollegeId').optional().isInt(),
    body('managedDepartmentId').optional().isInt(),
  ],
  validate,
  createAdmin
);

router.put('/:id', authorize('SUPER_ADMIN'), adminIdValidation, validate, updateAdmin);
router.patch('/:id/reset-password', authorize('SUPER_ADMIN'), adminIdValidation, validate, resetUserPassword);
router.delete('/:id', authorize('SUPER_ADMIN'), adminIdValidation, validate, deleteUser);
router.delete('/:id/hard-delete', authorize('SUPER_ADMIN'), adminIdValidation, validate, hardDeleteUser);

export default router;
