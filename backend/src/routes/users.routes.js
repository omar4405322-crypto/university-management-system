const express = require('express');
const { 
  getProfile, 
  updateProfile, 
  updatePassword, 
  updateProfilePicture,
  setup2FA,
  enable2FA,
  disable2FA,
  getAllUsers,
  createAdmin,
  deleteUser
} = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const { userUpdateValidation, adminIdValidation } = require('../validations/admin.validation');
const { body } = require('express-validator');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', userUpdateValidation, validate, updateProfile);

router.put('/profile/password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
    .matches(/\d/).withMessage('New password must contain at least one number')
    .matches(/[A-Z]/).withMessage('New password must contain at least one uppercase letter'),
], validate, updatePassword);

router.put('/profile/picture', upload.single('profilePicture'), updateProfilePicture);

// 2FA Routes
router.post('/2fa/setup', setup2FA);
router.post('/2fa/enable', [
  body('token').notEmpty().withMessage('Verification code is required'),
], validate, enable2FA);
router.post('/2fa/disable', [
  body('token').notEmpty().withMessage('Verification code is required'),
  body('password').notEmpty().withMessage('Password is required'),
], validate, disable2FA);

// Admin management
router.get('/', authorize('SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), getAllUsers);
router.post('/admins', authorize('SUPER_ADMIN'), [
  body('email').isEmail().withMessage('Invalid email format').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('role').isIn(['ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN']),
  body('collegeId').optional().isInt(),
  body('departmentId').optional().isInt(),
  body('managedCollegeId').optional().isInt(),
  body('managedDepartmentId').optional().isInt(),
], validate, createAdmin);

router.delete('/:id', authorize('SUPER_ADMIN'), adminIdValidation, validate, deleteUser);

module.exports = router;
