const express = require('express');
const { 
  getProfile, 
  updateProfile, 
  updatePassword, 
  updateProfilePicture,
  getAllUsers,
  createAdmin,
  deleteUser
} = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

const router = express.Router();

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/profile/password', updatePassword);
router.put('/profile/picture', upload.single('profilePicture'), updateProfilePicture);

// Admin management
router.get('/', authorize('SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), getAllUsers);
router.post('/admins', authorize('SUPER_ADMIN'), createAdmin);
router.delete('/:id', authorize('SUPER_ADMIN'), deleteUser);

module.exports = router;
