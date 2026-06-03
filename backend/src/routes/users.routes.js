const express = require('express');
const { 
  getProfile, 
  updateProfile, 
  updatePassword, 
  updateProfilePicture,
  updateTwoFactor,
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

router.patch('/profile/two-factor', [
  body('enabled').isBoolean().withMessage('enabled must be a boolean'),
], validate, updateTwoFactor);

// Admin management
router.get('/', authorize('SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), getAllUsers);
router.post('/admins', authorize('SUPER_ADMIN'), [
  body('email').isEmail().withMessage('Invalid email format').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('role').isIn(['ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN']),
  body('collegeId').optional().isInt(),
  body('departmentId').optional().isInt(),
], validate, createAdmin);

router.delete('/:id', authorize('SUPER_ADMIN'), adminIdValidation, validate, deleteUser);

module.exports = router;
